Progress
-----------------
Live handoff for Agentry.

## Current state

Public-facing CLI on `main`. History rewritten to remove Cursor Agent authorship and `Co-authored-by: Cursor` trailers (per GitHub community discussion #186158). Backup at sibling `.git-backup-agentry-*` under `G:\Projects\`.

## Verify

- No `Co-authored-by: Cursor` in `git log --all --grep=...`
- Authors are `mhmdreza rafiei <mhmdrezacode@gmail.com>` (or user variants)
- `npm test` / `typecheck` / `build` when touching code

## Follow-ups

- Wait for GitHub Contributors cache to drop Cursor (can take hours/days after rewrite; see discussion #186158).
- Confirm `mhmdreza-rafiei/agent-tools` is public for README examples.
- npm Trusted Publisher configured; CI publish via `.github/workflows/publish.yml` (OIDC, no token). Track `package-lock.json` for `npm ci`. Bump version then push `main` to release.
- Tip: turn off Cursor Settings → Agents → Attribution; local `.git/hooks/prepare-commit-msg` strips reinjected trailers.
