export type DayPoint = {
  date: string;
  count: number;
};

export function dateFromEpoch(value: number): Date {
  return new Date(value > 1_000_000_000_000 ? value : value * 1000);
}

export function parseKiroDate(value: unknown): Date | undefined {
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    const date = Number.isFinite(numeric) ? dateFromEpoch(numeric) : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 1_000_000_000) {
    const date = dateFromEpoch(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildHeatmapFromCounts(
  counts: ReadonlyMap<string, number>,
  fallbackDays: readonly string[] = [],
  now = new Date()
): DayPoint[] {
  const today = toIsoDate(now);
  const merged = new Map<string, number>();
  for (const [date, count] of counts) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today && Number.isFinite(count) && count > 0) {
      merged.set(date, (merged.get(date) ?? 0) + count);
    }
  }
  for (const date of fallbackDays) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today && !merged.has(date)) {
      merged.set(date, 1);
    }
  }
  return [...merged.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

export function getCurrentStreak(points: readonly DayPoint[], now = new Date()): number {
  const active = new Set(points.filter((point) => point.count > 0).map((point) => point.date));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!active.has(toIsoDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (active.has(toIsoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getLongestStreak(points: readonly DayPoint[]): number {
  const days = [...new Set(points.filter((point) => point.count > 0).map((point) => point.date))].sort();
  let longest = 0;
  let current = 0;
  let previous: Date | undefined;
  for (const day of days) {
    const date = new Date(`${day}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    current = previous && date.getTime() - previous.getTime() === 86_400_000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}
