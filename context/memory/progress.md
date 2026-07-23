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

- Force-push rewritten history; wait for GitHub Contributors cache to refresh (can take hours/days; discussion notes it may still list Cursor briefly).
- Confirm `mhmdreza-rafiei/agent-tools` is public for README examples.
- Publish npm when ready (`npm version` + `npm publish --access public`).
