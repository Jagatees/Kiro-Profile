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

function Ghost({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 112" fill="none" aria-hidden="true">
      <path
        d="M50 6C27 6 13 24 13 48v46q0 7 5.5 3.5l8.5-5.5q3-2 6 0l8.5 6q4.5 3 9 0l8.5-6q3-2 6 0l8.5 5.5Q87 101 87 94V48C87 24 73 6 50 6Z"
        fill="#fff"
        stroke="#111"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <ellipse cx="38" cy="47" rx="5.5" ry="8.5" fill="#111" />
      <ellipse cx="62" cy="47" rx="5.5" ry="8.5" fill="#111" />
    </svg>
  );
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
      <Ghost className="ghost-wanderer" />

      <header className="top">
        <div className="brand">
          <span className="brand-badge"><Ghost className="brand-ghost" /></span>
          <span className="brand-name">KIRO STAT</span>
        </div>
        <a className="btn btn-blue" href={marketplaceUrl} target="_blank" rel="noreferrer">
          GET THE EXTENSION →
        </a>
      </header>

      <section className="hero">
        <span className="doodle doodle-star-yellow" aria-hidden="true">★</span>
        <span className="doodle doodle-star-pink" aria-hidden="true">✦</span>
        <span className="doodle doodle-zigzag" aria-hidden="true">⌁⌁</span>
        <h1>
          GLOBAL<br />
          <span className="hl">RANKINGS</span>
        </h1>
        <p className="lede">
          See who&apos;s leading the world.<br />
          Install Kiro Stat, go Public, and make your mark.
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

      <section className="layout">
        <section className="board-wrap">
          <Ghost className="ghost-peek" />
          <div className="board" aria-label={`${category.label} leaderboard`}>
            <div className="board-head">
              <span className="board-title">{category.label.toUpperCase()} ↓</span>
              <button className="btn btn-small btn-white" type="button" onClick={() => void loadLeaderboard()}>
                REFRESH
              </button>
            </div>
            <p className="board-desc">{category.description}</p>

            {!loaded ? (
              <div className="empty">Loading rankings…</div>
            ) : ranked.length === 0 ? (
              <div className="empty">
                <strong>No public profiles yet!</strong> Install the extension and switch Public on to claim the first spot.
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
                        <span className="name">{entry.displayName}</span>
                        <span className="handle">@{entry.handle}</span>
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
          </div>
        </section>

        <aside className="side">
          <div className="card card-blue">
            <span className="card-tag">THE BOARD</span>
            <p className="big-number">{entries.length}</p>
            <p className="card-sub">{entries.length === 1 ? "builder ranked" : "builders ranked"}</p>
            <p className="big-number small">{compactNumber(totalTokens)}</p>
            <p className="card-sub">tokens tracked worldwide</p>
          </div>

          <div className="card card-yellow">
            <span className="card-tag">JOIN THE BOARD</span>
            <ol className="steps">
              <li><span>1</span>Install <em>Kiro Stat</em> from Kiro Extensions</li>
              <li><span>2</span>Open the panel to see your local stats</li>
              <li><span>3</span>Flip <em>Public</em> on to publish</li>
            </ol>
            <a className="btn btn-pink" href={marketplaceUrl} target="_blank" rel="noreferrer">
              OPEN VSX →
            </a>
          </div>

          <div className="card card-pink">
            <span className="card-tag">PRIVACY</span>
            <p className="card-copy">
              Only your name, handle, and the totals above are published. Flip back to Private to vanish from the board — poof!
            </p>
          </div>
        </aside>
      </section>

      <footer className="foot">
        <span className="foot-doodle" aria-hidden="true">★</span>
        <span className="foot-line">TRACK. <span className="hl-blue">COMPETE.</span> SHARE.</span>
        <span className="foot-doodle" aria-hidden="true">★</span>
      </footer>
    </main>
  );
}
