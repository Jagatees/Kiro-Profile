# Release Checklist

- [ ] Update `package.json` version and changelog.
- [ ] Run `npm install` and confirm lockfile root version matches.
- [ ] Run `npm ci` and `npm run validate`.
- [ ] Inspect VSIX contents and install it in a clean Kiro/VS Code profile.
- [ ] Test refresh, share card, public publish, manual sync, and private deletion.
- [ ] Run the manual privacy fixture test.
- [ ] Validate Windows and record macOS/Linux results or remaining gaps.
- [ ] Tag `vX.Y.Z` and verify the GitHub release artifact.
- [ ] Verify Open VSX install when `OVSX_PAT` publishing is configured.

Semantic versioning: patch for compatible fixes, minor for compatible features or new stats, and major for breaking public payload or extension behavior.
