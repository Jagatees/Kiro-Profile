import { describe, expect, it } from "vitest";
import {
  containsSensitiveText,
  createLeaderboardPayload,
  getLeaderboardApiUrl,
  validateLeaderboardUrl
} from "../src/leaderboard/payload";

const base = {
  publicId: "123e4567-e89b-12d3-a456-426614174000",
  displayName: "Kiro Builder",
  handle: "builder",
  tokensUsed: 10,
  creditsUsed: 2,
  currentStreak: 1,
  longestStreak: 2,
  sessions: 3,
  activeDays: 4
};

describe("leaderboard privacy", () => {
  it("allows HTTPS and localhost HTTP only", () => {
    expect(getLeaderboardApiUrl("https://example.com/board")).toBe("https://example.com/board/api/leaderboard");
    expect(validateLeaderboardUrl("http://localhost:3000").hostname).toBe("localhost");
    expect(() => validateLeaderboardUrl("http://example.com")).toThrow(/HTTPS/);
  });

  it("rejects emails, ARNs, secrets, and local paths", () => {
    for (const value of ["me@example.com", "arn:aws:iam::123:user/me", "AKIA1234567890ABCDEF", "C:\\Users\\dev\\file"])
      expect(containsSensitiveText(value)).toBe(true);
    expect(() => createLeaderboardPayload({ ...base, displayName: "me@example.com" })).toThrow(/sensitive/);
  });

  it("keeps only the approved aggregate contract", () => {
    expect(Object.keys(createLeaderboardPayload(base)).sort()).toEqual(Object.keys(base).sort());
  });
});
