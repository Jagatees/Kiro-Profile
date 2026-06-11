"use client";

import { useEffect, useMemo, useState } from "react";

type LeaderboardEntry = {
  id: string;
  displayName: string;
  handle: string;
  tokensUsed: number;
  creditsUsed: number;
  currentStreak: number;
  longestStreak: number;
  sessions: number;
  activeDays: number;
  submittedAt: string;
};

type Category = {
  id: string;
  label: string;
  unit: string;
  description: string;
  value: (entry: LeaderboardEntry) => number;
};

const marketplaceUrl = "https://open-vsx.org/extension/jagatees/kiro-stat";

const categories: Category[] = [
  {
    id: "tokens",
    label: "Tokens",
    unit: "tokens",
    description: "Estimated tokens used across all local Kiro sessions.",
    value: (entry) => entry.tokensUsed
  },
  {
    id: "credits",
    label: "Credits",
    unit: "credits",
    description: "Credits recorded from local Kiro metering data.",
    value: (entry) => entry.creditsUsed
  },
  {
    id: "streak",
    label: "Streak",
    unit: "day streak",
    description: "Consecutive days of activity, counted up to today.",
    value: (entry) => entry.currentStreak
  },
  {
    id: "best-streak",
    label: "Best Streak",
    unit: "days",
    description: "Longest run of consecutive active days on record.",
    value: (entry) => entry.longestStreak
  },
  {
    id: "sessions",
    label: "Sessions",
    unit: "sessions",
    description: "Local Kiro sessions tracked by the extension.",
    value: (entry) => entry.sessions
  },
  {
    id: "active-days",
    label: "Active Days",
    unit: "days",
    description: "Total days with tracked Kiro or git activity.",
    value: (entry) => entry.activeDays
  }
];

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

export default function Home() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0].id);

  const category = categories.find((item) => item.id === categoryId) ?? categories[0];

  const ranked = useMemo(() => {
    return [...entries].sort((a, b) => {
      const diff = category.value(b) - category.value(a);
      if (diff !== 0) {
        return diff;
      }
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });
  }, [entries, category]);

  const totalTokens = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.tokensUsed, 0),
    [entries]
  );
  const topValue = ranked.length > 0 ? category.value(ranked[0]) : 0;

  async function loadLeaderboard() {
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      const payload = await response.json() as { entries?: LeaderboardEntry[] };
      setEntries(payload.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void loadLeaderboard();
  }, []);

  return (
    <main className="shell">
      <header className="top">
        <span className="wordmark">Kiro Stat</span>
        <a className="top-link" href={marketplaceUrl} target="_blank" rel="noreferrer">
          Get the extension
        </a>
      </header>

      <section className="intro">
        <h1>Global rankings</h1>
        <p className="lede">
          Builders who installed the Kiro Stat extension and switched their profile to public.
          Rankings update from local stats only — nothing else leaves your machine.
        </p>
        <p className="summary">
          {entries.length} {entries.length === 1 ? "builder" : "builders"} · {compactNumber(totalTokens)} tokens tracked
        </p>
      </section>

      <nav className="tabs" aria-label="Ranking categories">
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === category.id ? "tab tab-active" : "tab"}
            onClick={() => setCategoryId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="board" aria-label={`${category.label} leaderboard`}>
        <div className="board-head">
          <p>{category.description}</p>
          <button className="refresh" type="button" onClick={() => void loadLeaderboard()}>
            Refresh
          </button>
        </div>

        {!loaded ? (
          <div className="empty">Loading rankings…</div>
        ) : ranked.length === 0 ? (
          <div className="empty">
            No public profiles yet. Install the extension and switch Public on to claim the first spot.
          </div>
        ) : (
          <ol className="entries">
            {ranked.map((entry, index) => {
              const value = category.value(entry);
              const width = topValue > 0 ? Math.max(2, (value / topValue) * 100) : 0;
              return (
                <li className={index < 3 ? "entry entry-top" : "entry"} key={entry.id}>
                  <span className="rank">{index + 1}</span>
                  <span className="who">
                    <span className="name">{entry.displayName}</span>
                    <span className="handle">{entry.handle}</span>
                  </span>
                  <span className="meter" aria-hidden="true">
                    <span style={{ width: `${width}%` }} />
                  </span>
                  <span className="score">
                    <strong>{compactNumber(value)}</strong>
                    <span>{category.unit}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="how">
        <h2>Join the board</h2>
        <ol>
          <li><span>1</span>Open Extensions in Kiro and install <em>Kiro Stat</em>.</li>
          <li><span>2</span>Open the Kiro Stat panel to see your local profile.</li>
          <li><span>3</span>Switch the profile to Public to publish a snapshot.</li>
        </ol>
        <p className="note">
          Only your display name, handle, and the totals shown above are published.
          Switch back to Private at any time to remove your entry.
        </p>
      </section>

      <footer className="foot">
        <span>Kiro Stat · local-first stats for Kiro</span>
        <a href={marketplaceUrl} target="_blank" rel="noreferrer">Open VSX</a>
      </footer>
    </main>
  );
}
