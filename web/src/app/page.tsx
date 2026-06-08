"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type LeaderboardEntry = {
  id: string;
  displayName: string;
  handle: string;
  tokensUsed: number;
  submittedAt: string;
};

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function rankLabel(index: number): string {
  return index === 0 ? "World #1" : `Rank #${index + 1}`;
}

export default function Home() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const totalTokens = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.tokensUsed, 0),
    [entries]
  );
  const topEntry = entries[0];

  async function loadLeaderboard() {
    const response = await fetch("/api/leaderboard", { cache: "no-store" });
    const payload = await response.json() as { entries?: LeaderboardEntry[] };
    setEntries(payload.entries || []);
  }

  useEffect(() => {
    void loadLeaderboard();
  }, []);

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Kiro Activity Insights</p>
          <h1>Kiro World Leaderboard</h1>
          <p className="lede">
            Turn on Public inside the Kiro Activity Insights extension to publish your latest profile snapshot.
          </p>
          <div className="hero-stats" aria-label="Leaderboard summary">
            <span><strong>{entries.length}</strong> builders</span>
            <span><strong>{compactNumber(totalTokens)}</strong> tokens</span>
            <span><strong>{topEntry ? topEntry.displayName : "Open"}</strong> leader</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <Image src="/kiro-leaderboard-og.png" alt="" width={440} height={440} priority />
        </div>
      </section>

      <section className="workspace">
        <aside className="submit-panel">
          <div className="panel-head">
            <span className="panel-icon">P</span>
            <div>
              <h2>Extension Only</h2>
              <p>Profiles appear here only after the user turns on Public in the extension.</p>
            </div>
          </div>

          <div className="sync-steps">
            <div><strong>1</strong><span>Open Kiro Profile</span></div>
            <div><strong>2</strong><span>Switch Private to Public</span></div>
            <div><strong>3</strong><span>The extension syncs changed stats</span></div>
          </div>

          <p className="sync-note">
            Public profiles update when the extension sees a changed token snapshot, or at least once every 24 hours while the profile view is active.
          </p>
        </aside>

        <section className="board" aria-label="Kiro token leaderboard">
          <div className="board-head">
            <div>
              <h2>Global Ranking</h2>
              <p>Ranked by public extension snapshots, sorted by token usage.</p>
            </div>
            <button className="ghost-button" type="button" onClick={() => void loadLeaderboard()}>
              Refresh
            </button>
          </div>

          <div className="entries">
            {entries.length === 0 ? (
              <div className="empty-state">
                <strong>No profiles yet.</strong>
                <span>Turn on Public in the extension to claim the first spot.</span>
              </div>
            ) : entries.map((entry, index) => (
              <article className="entry" key={entry.id}>
                <div className="rank">{index + 1}</div>
                <div className="entry-main">
                  <div className="entry-name-row">
                    <h3>{entry.displayName}</h3>
                    <span>{rankLabel(index)}</span>
                  </div>
                  <p>{entry.handle}</p>
                  <div className="token-meter">
                    <span style={{ width: `${Math.max(8, topEntry ? (entry.tokensUsed / topEntry.tokensUsed) * 100 : 0)}%` }} />
                  </div>
                </div>
                <div className="entry-score">
                  <strong>{compactNumber(entry.tokensUsed)}</strong>
                  <span>tokens</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
