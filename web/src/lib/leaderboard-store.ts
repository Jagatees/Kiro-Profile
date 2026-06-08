import { list, put } from "@vercel/blob";

export type LeaderboardEntry = {
  id: string;
  publicId?: string;
  displayName: string;
  handle: string;
  tokensUsed: number;
  submittedAt: string;
  updatedAt?: string;
};

export type LeaderboardSubmission = {
  publicId?: string;
  displayName: string;
  handle?: string;
  tokensUsed: number;
};

const BLOB_PATH = "leaderboard/entries.json";
const memoryEntries: LeaderboardEntry[] = [];

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function normalizeTokens(value: unknown): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }
  return Math.min(Math.round(numberValue), 1_000_000_000_000);
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
    tokensUsed: normalizeTokens(input.tokensUsed)
  };
}

export async function listLeaderboard(limit = 100): Promise<LeaderboardEntry[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return sortEntries(memoryEntries).slice(0, limit);
  }

  const entries = await readBlobEntries();
  return sortEntries(Array.isArray(entries) ? entries : []).slice(0, limit);
}

export async function saveSubmission(submission: LeaderboardSubmission): Promise<LeaderboardEntry> {
  const entries = await listLeaderboard(500);
  const existingIndex = submission.publicId
    ? entries.findIndex((item) => item.publicId === submission.publicId)
    : -1;
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    const updated: LeaderboardEntry = {
      ...existing,
      displayName: submission.displayName,
      handle: submission.handle || "Local",
      tokensUsed: submission.tokensUsed,
      updatedAt: now
    };
    entries[existingIndex] = updated;
    await writeEntries(entries);
    return updated;
  }

  const entry: LeaderboardEntry = {
    id: crypto.randomUUID(),
    publicId: submission.publicId,
    displayName: submission.displayName,
    handle: submission.handle || "Local",
    tokensUsed: submission.tokensUsed,
    submittedAt: now,
    updatedAt: now
  };

  entries.push(entry);
  await writeEntries(entries);
  return entry;
}

export async function deleteSubmission(publicId: string): Promise<boolean> {
  const id = cleanText(publicId, "", 80);
  if (!id) {
    return false;
  }

  const entries = await listLeaderboard(500);
  const nextEntries = entries.filter((entry) => entry.publicId !== id);
  if (nextEntries.length === entries.length) {
    return false;
  }

  await writeEntries(nextEntries);
  return true;
}

async function writeEntries(entries: LeaderboardEntry[]): Promise<void> {
  const nextEntries = sortEntries(entries).slice(0, 500);
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    memoryEntries.splice(0, memoryEntries.length, ...nextEntries);
    return;
  }

  await put(BLOB_PATH, JSON.stringify(nextEntries), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });
}

async function readBlobEntries(): Promise<LeaderboardEntry[]> {
  const result = await list({ prefix: BLOB_PATH, limit: 1 });
  const blob = result.blobs.find((item) => item.pathname === BLOB_PATH);
  if (!blob) {
    return [];
  }

  try {
    const response = await fetch(blob.url, { cache: "no-store" });
    if (!response.ok) {
      return [];
    }

    const parsed = await response.json() as unknown;
    return Array.isArray(parsed) ? parsed as LeaderboardEntry[] : [];
  } catch {
    return [];
  }
}
