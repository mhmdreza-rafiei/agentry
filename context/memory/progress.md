Progress
-----------------
Live state of the Agentry CLI.

## Current state

Public-ready CLI: install / list / remove / update / init for skills, agents, rules, scripts, profiles. Universal `.agents/skills` + symlinks, sky UI, git clone cache, empty-folder prune, `.agentry/lock.json`.

## Done this session

- Checkpoint + list feature commits.
- Expanded `agentry list` (installed / kind / source / selector) with panel-style output.
- Regenerated `docs/agentry-logo.png` with **Agentry** wordmark; modern public README (skills-style), examples from `mhmdreza-rafiei/agent-tools`.
- `.gitignore` ignores local install/scaffold trees (`.agents/`, `.agentry/`, authored `skills/` etc.).

## Verify

- `npm run typecheck` / `npm test` (17) / `npm run build`
- `node dist/cli.mjs list` · `list skills`

## External

- Push + `npm version` / `npm publish --access public` when ready.
- Confirm `mhmdreza-rafiei/agent-tools` is public for README examples.
