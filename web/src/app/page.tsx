"use client";

import { useEffect, useMemo, useState } from "react";

type LeaderboardEntry = {
  id: string;
  displayName: string;
  handle: string;
  tokensUsed: number;
  submittedAt: string;
};

const marketplaceUrl = "https://open-vsx.org/extension/jagatees/kiro-stat";

function GhostIcon() {
  return (
    <svg viewBox="0 0 100 112" fill="none" aria-hidden="true">
      <path
        d="M50 6C27 6 13 24 13 48v46q0 7 5.5 3.5l8.5-5.5q3-2 6 0l8.5 6q4.5 3 9 0l8.5-6q3-2 6 0l8.5 5.5Q87 101 87 94V48C87 24 73 6 50 6Z"
        fill="#fff"
        stroke="#111"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <ellipse cx="38" cy="47" fill="#111" rx="5.5" ry="8.5" />
      <ellipse cx="62" cy="47" fill="#111" rx="5.5" ry="8.5" />
    </svg>
  );
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function displayLabel(name: string): string {
  const base = name.includes("@") ? name.split("@")[0] : name;
  const label = base
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`)
    .join(" ");
  return label || "Kiro Builder";
}

export default function Home() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const ranked = useMemo(() => {
    return [...entries].sort((a, b) => {
      const diff = b.tokensUsed - a.tokensUsed;
      if (diff !== 0) {
        return diff;
      }
      return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
    });
  }, [entries]);

  const totalTokens = useMemo(() => entries.reduce((sum, entry) => sum + entry.tokensUsed, 0), [entries]);
  const topValue = ranked.length > 0 ? ranked[0].tokensUsed : 0;
  const topBuilder = ranked[0];

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
      <header className="profile-card">
        <span className="header-ghost" aria-hidden="true">
          <GhostIcon />
        </span>
        <div className="profile-line">
          <span className="brand-mark">K</span>
          <div className="profile-meta">
            <p className="name">Kiro Profile</p>
            <p className="handle">
              @token-board <span className="local-badge">LOCAL</span>
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button className="action sync-button" type="button" onClick={() => void loadLeaderboard()}>
            Sync
          </button>
          <a className="action" href={marketplaceUrl} target="_blank" rel="noreferrer">
            Install
          </a>
        </div>
      </header>

      <section className="summary-strip" aria-label="Leaderboard totals">
        <article className="summary-cell pink-cell">
          <span>{compactNumber(totalTokens)}</span>
          <strong>Est. Tokens</strong>
        </article>
        <article className="summary-cell">
          <span>{entries.length}</span>
          <strong>Profiles</strong>
        </article>
        <article className="summary-cell lime-cell">
          <span>{topBuilder ? compactNumber(topBuilder.tokensUsed) : "0"}</span>
          <strong>Top Builder</strong>
        </article>
      </section>

      <section className="board" aria-label="Token leaderboard">
        <div className="board-head">
          <h1>Token Leaderboard</h1>
          <span>{loaded ? "Last synced just now" : "Loading"}</span>
        </div>

        {!loaded ? (
          <div className="empty">Loading rankings...</div>
        ) : ranked.length === 0 ? (
          <div className="empty">No public token data yet.</div>
        ) : (
          <ol className="entries">
            {ranked.map((entry, index) => {
              const width = topValue > 0 ? Math.max(4, (entry.tokensUsed / topValue) * 100) : 0;
              return (
                <li className="entry" key={entry.id}>
                  <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className="who">
                    <span className="entry-name">{displayLabel(entry.displayName)}</span>
                    <span className="entry-handle">@{entry.handle}</span>
                  </span>
                  <span className="score">
                    <strong>{compactNumber(entry.tokensUsed)}</strong>
                    <span>tokens</span>
                  </span>
                  <span className="meter" aria-hidden="true">
                    <span style={{ width: `${width}%` }} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
