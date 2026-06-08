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

const extensionDownloadUrl = "/downloads/kiro-stat-0.2.11.vsix";

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
          <p className="eyebrow">Kiro Stat</p>
          <h1>Kiro Stat Leaderboard</h1>
          <p className="lede">
            Install the Kiro Stat extension, turn on Public in Kiro, and publish your latest profile snapshot to the world ranking.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href={extensionDownloadUrl} download>
              Download for Kiro
            </a>
            <a className="secondary-link" href="#leaderboard">
              View leaderboard
            </a>
          </div>
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
            <span className="panel-icon">K</span>
            <div>
              <h2>Install in Kiro</h2>
              <p>Download the VSIX from this site, then install it from Kiro.</p>
            </div>
          </div>

          <a className="download-card" href={extensionDownloadUrl} download>
            <strong>Kiro Stat</strong>
            <span>Version 0.2.11 · VSIX installer</span>
          </a>

          <div className="sync-steps">
            <div><strong>1</strong><span>Open Kiro Command Palette</span></div>
            <div><strong>2</strong><span>Run Extensions: Install from VSIX...</span></div>
            <div><strong>3</strong><span>Open Kiro Stat and switch Public on</span></div>
          </div>

          <p className="sync-note">
            The website does not accept manual uploads. Profiles appear only when the extension sends a public snapshot.
          </p>
        </aside>

        <section className="board" id="leaderboard" aria-label="Kiro token leaderboard">
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
