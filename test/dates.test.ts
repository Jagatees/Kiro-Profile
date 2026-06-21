import { describe, expect, it } from "vitest";
import {
  buildHeatmapFromCounts,
  dateFromEpoch,
  getCurrentStreak,
  getLongestStreak,
  toIsoDate
} from "../src/utils/dates";

describe("date utilities", () => {
  it("handles epoch seconds and milliseconds", () => {
    expect(dateFromEpoch(1_700_000_000).getTime()).toBe(1_700_000_000_000);
    expect(dateFromEpoch(1_700_000_000_000).getTime()).toBe(1_700_000_000_000);
  });

  it("formats local ISO dates", () => {
    expect(toIsoDate(new Date(2026, 0, 2))).toBe("2026-01-02");
  });

  it("calculates current and longest streaks across a year boundary", () => {
    const points = ["2025-12-31", "2026-01-01", "2026-01-02", "2026-01-04"].map((date) => ({ date, count: 1 }));
    expect(getLongestStreak(points)).toBe(3);
    expect(getCurrentStreak(points, new Date(2026, 0, 5))).toBe(1);
  });

  it("ignores future and invalid heatmap dates", () => {
    const result = buildHeatmapFromCounts(
      new Map([
        ["2026-01-01", 5],
        ["2027-01-01", 9],
        ["bad", 2]
      ]),
      [],
      new Date(2026, 0, 2)
    );
    expect(result).toEqual([{ date: "2026-01-01", count: 5 }]);
  });
});
