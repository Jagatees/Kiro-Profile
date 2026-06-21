import { parseKiroDate, toIsoDate } from "../utils/dates";

export type SessionMetrics = {
  tokens: number;
  promptTokens: number;
  generatedTokens: number;
  credits: number;
  days: string[];
  modelCounts: Map<string, number>;
  confidence: "Exact" | "Estimated" | "Fallback" | "Unavailable";
};

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function recordDay(record: Record<string, unknown>, fallbackDay: string): string {
  for (const key of ["end_timestamp", "updated_at", "created_at", "timestamp"]) {
    const date = parseKiroDate(record[key]);
    if (date) return toIsoDate(date);
  }
  return fallbackDay;
}

export function parseSessionMetrics(root: unknown, fileSize: number, fallbackDay: string): SessionMetrics {
  const result: SessionMetrics = {
    tokens: 0,
    promptTokens: 0,
    generatedTokens: 0,
    credits: 0,
    days: [],
    modelCounts: new Map(),
    confidence: "Unavailable"
  };
  let contextEstimate = 0;
  const stack: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];
  while (stack.length > 0) {
    const { value, depth } = stack.pop()!;
    if (!value || typeof value !== "object" || depth > 12) continue;
    const record = value as Record<string, unknown>;
    const day = recordDay(record, fallbackDay);
    if (!result.days.includes(day)) result.days.push(day);

    const prompt =
      numberValue(record.input_token_count) || numberValue(record.inputTokens) || numberValue(record.promptTokens);
    const generated =
      numberValue(record.output_token_count) || numberValue(record.outputTokens) || numberValue(record.generatedTokens);
    if (prompt + generated > 0) {
      result.promptTokens += prompt;
      result.generatedTokens += generated;
      result.tokens += prompt + generated;
      result.confidence = "Exact";
    }
    if (result.confidence !== "Exact") {
      const percentage = numberValue(record.contextUsagePercentage);
      if (percentage > 0 && percentage <= 100)
        contextEstimate = Math.max(contextEstimate, Math.round(percentage * 2_000));
    }
    if (Array.isArray(record.metering_usage)) {
      for (const item of record.metering_usage) {
        if (item && typeof item === "object") {
          const metering = item as Record<string, unknown>;
          if (typeof metering.unit === "string" && metering.unit.toLowerCase() === "credit")
            result.credits += numberValue(metering.value);
        }
      }
    }
    const modelId =
      record.model_info && typeof record.model_info === "object"
        ? (record.model_info as Record<string, unknown>).model_id
        : undefined;
    const model = typeof record.model === "string" ? record.model : typeof modelId === "string" ? modelId : "";
    if (model.trim()) result.modelCounts.set(model.trim(), (result.modelCounts.get(model.trim()) ?? 0) + 1);
    for (const child of Object.values(record)) {
      if (child && typeof child === "object") {
        if (Array.isArray(child)) child.forEach((item) => stack.push({ value: item, depth: depth + 1 }));
        else stack.push({ value: child, depth: depth + 1 });
      }
    }
  }
  if (result.confidence !== "Exact" && contextEstimate > 0) {
    result.tokens = contextEstimate;
    result.confidence = "Estimated";
  } else if (result.tokens === 0 && fileSize > 2_048) {
    result.tokens = Math.round(fileSize / 8);
    result.confidence = "Fallback";
  }
  return result;
}

export function parseTokenJsonLines(
  content: string
): Pick<SessionMetrics, "tokens" | "promptTokens" | "generatedTokens" | "modelCounts"> & { invalidLines: number } {
  let promptTokens = 0;
  let generatedTokens = 0;
  let invalidLines = 0;
  const modelCounts = new Map<string, number>();
  for (const line of content.split(/\r?\n/).filter(Boolean)) {
    try {
      const row = JSON.parse(line) as Record<string, unknown>;
      promptTokens += numberValue(row.inputTokens) || numberValue(row.promptTokens);
      generatedTokens += numberValue(row.outputTokens) || numberValue(row.generatedTokens) || numberValue(row.tokens);
      if (typeof row.model === "string" && row.model.trim()) {
        modelCounts.set(row.model.trim(), (modelCounts.get(row.model.trim()) ?? 0) + 1);
      }
    } catch {
      invalidLines += 1;
    }
  }
  return { tokens: promptTokens + generatedTokens, promptTokens, generatedTokens, modelCounts, invalidLines };
}
