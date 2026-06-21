# Contributing to Kiro Stat

1. Create a focused branch from current `main`.
2. Run `npm ci`.
3. Make the smallest coherent change and add tests for parsing, privacy, or data-contract behavior.
4. Run `npm run validate` before opening a pull request.
5. Explain user-visible behavior and privacy implications in the pull request.

Never commit real Kiro session data, account metadata, diagnostics, credentials, `.env` files, or local paths. Use synthetic fixtures only.
