# Kiro Stat Leaderboard

Small Vercel app for public Kiro Stat submissions. The page is read-only for users; profiles are published by the extension when the user turns on Public.

## Local Dev

```bash
npm install
npm run dev
```

The app works without env vars in local development, but submissions are kept in memory and reset when the dev server restarts.

## Vercel Storage

For hosted persistence, create a Vercel Blob store linked to the project. Vercel injects:

```bash
BLOB_READ_WRITE_TOKEN=...
```

You can copy `.env.example` to `.env.local` for local Blob testing.

The extension setting `kiroStat.leaderboardUrl` should point to the deployed Vercel URL.

The extension sends a profile snapshot when Public is first enabled, then updates the same public row only when the snapshot changes or when the last sync is more than 24 hours old.
