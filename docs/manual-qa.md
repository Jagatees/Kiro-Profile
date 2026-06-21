# Manual QA

## Fresh install

1. Build and install the VSIX in a clean profile.
2. Open Kiro Stat and confirm the privacy notice appears once.
3. Refresh with and without a workspace.
4. Generate a share card.
5. Toggle Public, inspect the approved payload, and verify the entry appears.
6. Toggle Private and verify the entry disappears.
7. Export diagnostics and inspect it for prompts, responses, emails, ARNs, secrets, and local home paths.

## Upgrade

Install the prior version, enable Public, upgrade, and confirm settings, public ID, and sync state remain usable.

## Platforms

Repeat missing-folder, permission-denied, malformed-file, and large-folder cases on Windows, macOS, and Linux. Record the tested OS and Kiro version in the release notes.
