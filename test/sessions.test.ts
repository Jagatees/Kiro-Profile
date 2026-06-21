import { describe, expect, it } from "vitest";
import { parseSessionMetrics, parseTokenJsonLines } from "../src/kiro/sessions";

describe("session parsing", () => {
  it("prefers explicit input and output tokens", () => {
    const result = parseSessionMetrics(
      { inputTokens: 120, outputTokens: 30, model_info: { model_id: "claude-sonnet" } },
      10_000,
      "2026-01-01"
    );
    expect(result).toMatchObject({ tokens: 150, promptTokens: 120, generatedTokens: 30, confidence: "Exact" });
    expect(result.modelCounts.get("claude-sonnet")).toBe(1);
  });

  it("uses context estimate then file-size fallback", () => {
    expect(parseSessionMetrics({ contextUsagePercentage: 10 }, 10_000, "2026-01-01").confidence).toBe("Estimated");
    expect(parseSessionMetrics({}, 8_000, "2026-01-01")).toMatchObject({ tokens: 1_000, confidence: "Fallback" });
    expect(parseSessionMetrics({}, 100, "2026-01-01").confidence).toBe("Unavailable");
  });

  it("parses credit metering and malformed JSONL safely", () => {
    expect(parseSessionMetrics({ metering_usage: [{ unit: "credit", value: 2 }] }, 0, "2026-01-01").credits).toBe(2);
    expect(parseTokenJsonLines('{"inputTokens":5,"outputTokens":3,"model":"auto"}\nnope')).toMatchObject({
      tokens: 8,
      invalidLines: 1
    });
  });
});
