import * as os from "node:os";

export type LeaderboardPayload = {
  publicId: string;
  displayName: string;
  handle: string;
  tokensUsed: number;
  creditsUsed: number;
  currentStreak: number;
  longestStreak: number;
  sessions: number;
  activeDays: number;
};

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ARN = /\barn:(?:aws|aws-us-gov|aws-cn):[^\s]+/i;
const SECRET =
  /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._~-]{16,})\b/i;
const WINDOWS_PATH = /(?:^|\s)[A-Za-z]:\\[^\r\n]+/;

export function containsSensitiveText(value: string): boolean {
  return EMAIL.test(value) || ARN.test(value) || SECRET.test(value) || WINDOWS_PATH.test(value);
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(new RegExp(EMAIL.source, "gi"), "[REDACTED_EMAIL]")
    .replace(new RegExp(ARN.source, "gi"), "[REDACTED_ARN]")
    .replace(new RegExp(SECRET.source, "gi"), "[REDACTED_SECRET]")
    .replace(new RegExp(WINDOWS_PATH.source, "gi"), " [REDACTED_PATH]")
    .replaceAll(os.homedir(), "[REDACTED_HOME]");
}

export function validateLeaderboardUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  const localhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localhost)) {
    throw new Error("Leaderboard URL must use HTTPS (HTTP is allowed only for localhost). ");
  }
  if (url.username || url.password || !url.hostname || url.hostname.includes("..")) {
    throw new Error("Leaderboard URL contains unsupported credentials or hostname.");
  }
  return url;
}

function boundedNumber(value: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0;
}

export function createLeaderboardPayload(input: LeaderboardPayload): LeaderboardPayload {
  const publicId = input.publicId.trim();
  const displayName = input.displayName.replace(/\s+/g, " ").trim().slice(0, 60);
  const handle = input.handle.replace(/\s+/g, " ").trim().slice(0, 40);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(publicId)) throw new Error("Public profile ID is invalid.");
  if (!displayName || !handle || containsSensitiveText(displayName) || containsSensitiveText(handle)) {
    throw new Error("Public profile fields contain sensitive or invalid text.");
  }
  return {
    publicId,
    displayName,
    handle,
    tokensUsed: boundedNumber(input.tokensUsed, 1_000_000_000_000),
    creditsUsed: boundedNumber(input.creditsUsed, 1_000_000_000),
    currentStreak: boundedNumber(input.currentStreak, 100_000),
    longestStreak: boundedNumber(input.longestStreak, 100_000),
    sessions: boundedNumber(input.sessions, 10_000_000),
    activeDays: boundedNumber(input.activeDays, 100_000)
  };
}

export function getLeaderboardApiUrl(rawUrl: string): string {
  const url = validateLeaderboardUrl(rawUrl);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/api/leaderboard`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
