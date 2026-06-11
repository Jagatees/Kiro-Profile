import { del, list, put } from "@vercel/blob";

export type LeaderboardEntry = {
  id: string;
  publicId?: string;
  displayName: string;
  handle: string;
  tokensUsed: number;
  creditsUsed: number;
  currentStreak: number;
  longestStreak: number;
  sessions: number;
  activeDays: number;
  submittedAt: string;
  updatedAt?: string;
};

export type LeaderboardSubmission = {
  publicId?: string;
  displayName: string;
  handle?: string;
  tokensUsed: number;
  creditsUsed: number;
  currentStreak: number;
  longestStreak: number;
  sessions: number;
  activeDays: number;
};

// One blob per entry: concurrent submissions from different builders never
// conflict. A single shared JSON file loses writes because blob overwrites
// can take up to 60 seconds to propagate.
const ENTRY_PREFIX = "leaderboard/entry/";
const LEGACY_PATH = "leaderboard/entries.json";
const memoryEntries: LeaderboardEntry[] = [];

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function normalizeNumber(value: unknown, max: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }
  return Math.min(Math.round(numberValue * 100) / 100, max);
}

function normalizeTokens(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }
  return Math.min(Math.round(numberValue), 1_000_000_000_000);
}

function entryPathFor(publicId: string): string {
  return `${ENTRY_PREFIX}${publicId.replace(/[^a-zA-Z0-9_-]/g, "-")}.json`;
}

function withDefaults(entry: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    id: entry.id || crypto.randomUUID(),
    displayName: entry.displayName || "Kiro Builder",
    submittedAt: entry.submittedAt || new Date(0).toISOString(),
    handle: entry.handle || "Local",
    tokensUsed: entry.tokensUsed ?? 0,
    creditsUsed: entry.creditsUsed ?? 0,
    currentStreak: entry.currentStreak ?? 0,
    longestStreak: entry.longestStreak ?? 0,
    sessions: entry.sessions ?? 0,
    activeDays: entry.activeDays ?? 0,
    publicId: entry.publicId,
    updatedAt: entry.updatedAt
  };
}

function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.tokensUsed !== a.tokensUsed) {
      return b.tokensUsed - a.tokensUsed;
    }
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });
}

export function normalizeSubmission(input: Record<string, unknown>): LeaderboardSubmission {
  return {
    publicId: cleanText(input.publicId, "", 80) || undefined,
    displayName: cleanText(input.displayName, "Kiro Builder", 60),
    handle: cleanText(input.handle, "Local", 40),
    tokensUsed: normalizeTokens(input.tokensUsed),
    creditsUsed: normalizeNumber(input.creditsUsed, 1_000_000_000),
    currentStreak: normalizeNumber(input.currentStreak, 36_500),
    longestStreak: normalizeNumber(input.longestStreak, 36_500),
    sessions: normalizeNumber(input.sessions, 1_000_000_000),
    activeDays: normalizeNumber(input.activeDays, 36_500)
  };
}

export async function listLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return sortEntries(memoryEntries).slice(0, limit);
  }

  const result = await list({ prefix: ENTRY_PREFIX, limit: 500 });
  const fetched = await Promise.all(result.blobs.map((blob) => readJsonBlob(blob.url)));
  const entries = fetched
    .filter((item): item is Partial<LeaderboardEntry> => Boolean(item) && !Array.isArray(item))
    .map(withDefaults);

  // Merge entries from the legacy single-file store that have not been
  // re-published to a per-entry blob yet.
  const knownIds = new Set(entries.map((entry) => entry.publicId).filter(Boolean));
  for (const legacy of await readLegacyEntries()) {
    if (!legacy.publicId || !knownIds.has(legacy.publicId)) {
      entries.push(withDefaults(legacy));
    }
  }

  return sortEntries(entries).slice(0, limit);
}

export async function saveSubmission(submission: LeaderboardSubmission): Promise<LeaderboardEntry> {
  const now = new Date().toISOString();
  const publicId = submission.publicId;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const existingIndex = publicId
      ? memoryEntries.findIndex((item) => item.publicId === publicId)
      : -1;
    const existing = existingIndex >= 0 ? memoryEntries[existingIndex] : undefined;
    const entry = withDefaults({
      ...existing,
      ...submission,
      id: existing?.id,
      submittedAt: existing?.submittedAt || now,
      updatedAt: now
    });
    if (existingIndex >= 0) {
      memoryEntries[existingIndex] = entry;
    } else {
      memoryEntries.push(entry);
    }
    return entry;
  }

  const existing = publicId ? await readEntryBlob(publicId) : undefined;
  const entry = withDefaults({
    ...existing,
    ...submission,
    id: existing?.id,
    submittedAt: existing?.submittedAt || now,
    updatedAt: now
  });

  await put(entryPathFor(publicId || entry.id), JSON.stringify(entry), {
    access: "public",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });

  return entry;
}

export async function deleteSubmission(publicId: string): Promise<boolean> {
  const id = cleanText(publicId, "", 80);
  if (!id) {
    return false;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const index = memoryEntries.findIndex((entry) => entry.publicId === id);
    if (index < 0) {
      return false;
    }
    memoryEntries.splice(index, 1);
    return true;
  }

  let removed = false;
  const pathname = entryPathFor(id);
  const result = await list({ prefix: pathname, limit: 1 });
  const blob = result.blobs.find((item) => item.pathname === pathname);
  if (blob) {
    await del(blob.url);
    removed = true;
  }

  // Also drop the entry from the legacy single-file store if present.
  const legacy = await readLegacyEntries();
  const nextLegacy = legacy.filter((entry) => entry.publicId !== id);
  if (nextLegacy.length !== legacy.length) {
    await put(LEGACY_PATH, JSON.stringify(nextLegacy), {
      access: "public",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60
    });
    removed = true;
  }

  return removed;
}

async function readEntryBlob(publicId: string): Promise<Partial<LeaderboardEntry> | undefined> {
  const pathname = entryPathFor(publicId);
  const result = await list({ prefix: pathname, limit: 1 });
  const blob = result.blobs.find((item) => item.pathname === pathname);
  if (!blob) {
    return undefined;
  }
  const parsed = await readJsonBlob(blob.url);
  return parsed && !Array.isArray(parsed) ? parsed as Partial<LeaderboardEntry> : undefined;
}

async function readLegacyEntries(): Promise<Array<Partial<LeaderboardEntry>>> {
  const result = await list({ prefix: LEGACY_PATH, limit: 1 });
  const blob = result.blobs.find((item) => item.pathname === LEGACY_PATH);
  if (!blob) {
    return [];
  }
  const parsed = await readJsonBlob(blob.url);
  return Array.isArray(parsed) ? parsed as Array<Partial<LeaderboardEntry>> : [];
}

async function readJsonBlob(url: string): Promise<unknown> {
  try {
    // Bust the blob CDN cache so fresh updates are visible immediately.
    const freshUrl = `${url}${url.includes("?") ? "&" : "?"}ts=${Date.now()}`;
    const response = await fetch(freshUrl, { cache: "no-store" });
    if (!response.ok) {
      return undefined;
    }
    return await response.json() as unknown;
  } catch {
    return undefined;
  }
}
