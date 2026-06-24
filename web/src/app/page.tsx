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

  const totalTokens = useMemo(() => entries.reduce((sum, entry) => sum + entry.tokensUsed, 0), [entries]);
  const totalCredits = useMemo(() => entries.reduce((sum, entry) => sum + entry.creditsUsed, 0), [entries]);
  const activeBuilders = useMemo(() => entries.filter((entry) => entry.currentStreak > 0).length, [entries]);
  const topValue = ranked.length > 0 ? category.value(ranked[0]) : 0;

  async function loadLeaderboard() {
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      const payload = (await response.json()) as { entries?: LeaderboardEntry[] };
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
      <header className="app-header">
        <div className="profile-line">
          <span className="avatar">KS</span>
          <div className="profile-meta">
            <p className="name">Kiro Stat Leaderboard</p>
            <p className="handle">
              Public profiles
              <span className="badge">Live</span>
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button className="action sync-button" type="button" onClick={() => void loadLeaderboard()}>
            Refresh
          </button>
          <a className="action" href={marketplaceUrl} target="_blank" rel="noreferrer">
            Get Extension
          </a>
        </div>
      </header>

      <section className="metric-grid" aria-label="Leaderboard totals">
        <article className="metric-card hot">
          <p className="metric-label">Builders Ranked</p>
          <p className="metric-value">{entries.length}</p>
          <p className="metric-sub">{entries.length === 1 ? "public profile" : "public profiles"}</p>
        </article>
        <article className="metric-card soft">
          <p className="metric-label">Tokens Tracked</p>
          <p className="metric-value">{compactNumber(totalTokens)}</p>
          <p className="metric-sub">shared from local Kiro stats</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Credits Used</p>
          <p className="metric-value">{compactNumber(totalCredits)}</p>
          <p className="metric-sub">aggregate public total</p>
        </article>
        <article className="metric-card accent">
          <p className="metric-label">Active Streaks</p>
          <p className="metric-value">{activeBuilders}</p>
          <p className="metric-sub">builders active today</p>
        </article>
      </section>

      <section className="layout">
        <section className="panel board" aria-label={`${category.label} leaderboard`}>
          <div className="panel-head">
            <div>
              <h1 className="panel-title">{category.label} Ranking</h1>
              <p className="panel-subtitle">{category.description}</p>
            </div>
            <span className="refresh-status">{loaded ? "Updated" : "Loading"}</span>
          </div>

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

          {!loaded ? (
            <div className="empty">Loading rankings...</div>
          ) : ranked.length === 0 ? (
            <div className="empty">
              <strong>No public profiles yet.</strong> Install the extension and switch Public on to claim the first
              spot.
            </div>
          ) : (
            <ol className="entries">
              {ranked.map((entry, index) => {
                const value = category.value(entry);
                const width = topValue > 0 ? Math.max(4, (value / topValue) * 100) : 0;
                return (
                  <li className={`entry rank-${index + 1}`} key={entry.id}>
                    <span className="rank">{index + 1}</span>
                    <span className="who">
                      <span className="entry-name">{entry.displayName}</span>
                      <span className="entry-handle">@{entry.handle}</span>
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

        <aside className="side">
          <section className="panel join-panel">
            <h2 className="panel-title">Publish Profile</h2>
            <ol className="steps">
              <li>
                <span>1</span>Install Kiro Stat from Open VSX
              </li>
              <li>
                <span>2</span>Open the profile panel
              </li>
              <li>
                <span>3</span>Switch Public on
              </li>
            </ol>
            <a className="action sync-button action-wide" href={marketplaceUrl} target="_blank" rel="noreferrer">
              Open VSX
            </a>
          </section>

          <section className="panel privacy-panel">
            <h2 className="panel-title">Privacy</h2>
            <p className="card-copy">
              Only your display name, handle, and aggregate totals are published. Switching back to Private removes the
              public row.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}
