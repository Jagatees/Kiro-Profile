# Kiro Stat Privacy

## Local only

Kiro Stat reads local Kiro sessions, application metadata, launch logs, workspace file extensions, and optional git history to calculate aggregate stats. Raw sessions, prompts, responses, file content, workspace names, local paths, account metadata, emails, and ARNs stay local.

## Public leaderboard

Publishing is off by default and requires confirmation. The approved payload contains only a random public ID, display name, handle, token and credit totals, current and longest streak, session count, and active-day count. Text is checked for common email, ARN, path, and secret patterns before sending. Production endpoints must use HTTPS; HTTP is permitted only on localhost.

Switching back to Private sends a delete request for the public ID. The local public ID remains so an accidental toggle does not create duplicate profiles.

## Diagnostics

The diagnostics command exports extension version, platform, redacted detected paths, file counts, scan limits, and sync state. It never includes raw session content. Review the JSON before attaching it to an issue.
