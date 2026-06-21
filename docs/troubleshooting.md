# Troubleshooting

## No sessions or empty heatmap

Use Kiro for at least one session, then run **Kiro Stat: Refresh Stats**. Kiro Stat checks `%APPDATA%/Kiro` on Windows, `~/Library/Application Support/Kiro` on macOS, and `~/.config/Kiro` on Linux. Missing or unreadable folders are treated as empty.

## Token count looks wrong

Exact fields take priority. Context percentage and file-size results are estimates. Export diagnostics and include the redacted report in an issue; never attach real session files.

## Leaderboard does not sync

Confirm Public mode, use an HTTPS URL, then run **Kiro Stat: Sync Leaderboard Now**. HTTP works only for localhost. Requests time out after nine seconds.

## Share card does not save

With a workspace open, cards save under `kiro-profile-shares`. Without a workspace they save under your home folder. Check folder permissions.

## Extension does not activate

Open **View: Toggle Output**, select **Kiro Stat**, and enable diagnostic logging in settings. Reload the window after updating the extension.
