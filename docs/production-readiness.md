# Production Readiness

## Automated gates complete

- Package and lockfile versions are `0.3.0`.
- `npm ci` succeeds and `npm run validate` passes.
- Formatting, TypeScript, ESLint, 13 unit tests, clean compilation, and VSIX packaging pass.
- The packaged VSIX contains only runtime output, icon resources, license, changelog, package metadata, and README.
- CI and tagged release workflows are defined.
- Leaderboard publishing requires confirmation, validates the aggregate payload, requires HTTPS outside localhost, and times out after nine seconds.
- Local scans are bounded and skip symbolic links.
- Redacted diagnostics and an opt-in output channel are available.
- The leaderboard site lints, builds, and has zero known npm audit vulnerabilities.

## Manual launch gates

- Windows clean-profile install, first-run privacy, no-workspace rendering, refresh, share-card, diagnostics-redaction, and deployed publish checks passed on 2026-06-21. See `docs/manual-qa-2026-06-21.md`.
- Confirm real delete behavior against the deployed Vercel URL and inspect deployment logs.
- Complete upgrade-state coverage.
- Run missing-folder, permission-denied, malformed-file, large-folder, and share-card checks across Windows, macOS, and Linux.
- Add current marketplace screenshots/GIFs and verify the Open VSX listing after publishing.
- Configure `OVSX_PAT` and repository release protections/secrets.
- Add durable backend rate limiting and moderation before promoting a high-traffic public leaderboard.

Do not describe the release as fully production-ready until these manual items are signed off in a release issue.
