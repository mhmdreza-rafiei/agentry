Progress
-----------------
Live state of the agentry CLI. Update at session start/end and after each milestone.

## Current state

- agentry is a **raw installer + scaffolder** CLI: fetches **agents, skills, rules, scripts, and profiles** from any source; installs/removes/updates by selector or install source; scaffolds new artifacts with `init`.
- Stack: TypeScript ESM, Clack + picocolors UI, obuild, vitest, 70+ providers, universal `.agents/skills` + symlinks, dual-mode discovery, `.agentry/lock.json`.

## Done this session

- **Sky primary** (`#38bdf8` truecolor) across theme, prompts, multiselect, help, badge (was saturated ANSI blue).
- **Universal list duplication fix**: multiselect clear uses `readline.moveCursor` + `clearScreenDown` with +1 row safety; compact Universal header (no long dashed lines that wrap).
- **Action-aware wording**: install to / remove from / update for (agent prompt + section transitions).
- **Source-aware remove/update**: GitHub shorthand/URL and local paths; `sourcesEqual` / `sourceIdentity` in `source_parser.ts`; `removeSelection(..., sourceFilter)`.
- **`agentry init`**: scaffolds skill (optional `references/TEMPLATE.md`), agent/rule `.mdc` (`--alwaysApply`), script folder, profile yaml; profile can `--skills`/`--agents`/`--rules`/`--scripts` `[source]` and pick interactively.
- **Agent UI fixes**: Selected shows `Universal (N)` (not `(none)`); submit shows Universal; locked block is one compact line; shorter viewport + line-by-line clear to stop Windows stacked-prompt bug.
- **Update flow**: same order as add — parse source → discover → select skills → choose agents → summary.
- **Git cache**: successful clones saved under `~/.cache/agentry/repos/`; on clone failure prompts “Load from cache instead?” (`-y` / quiet auto-uses cache).
- **Remove deletes files**: skills always remove canonical `.agents/skills/<id>` plus non-universal copies; remove prints deleted paths. Install always copies into canonical (no junction to temp clones).
- **Empty-folder prune**: after remove, empty category/kind dirs (e.g. `skills/`), empty `.agents`, and empty `.agentry` (lock with no items) are deleted.
- **Tests**: 17/17.

## Verify

- `npm run typecheck` — pass
- `npm test` — 15/15
- `npm run build` — pass
- `node dist/cli.mjs --help` — lists init + sky colors
- Smoke: `node dist/cli.mjs init skill demo-skill prompt --no-reference --dir <tmp>`

## Known issues / TODO

- Profile schema still draft.
- `doctor` / `find` / `use` still not built.
- Interactive TUI needs a real PTY to screenshot in CI.

## External / out of scope

- npm publish of this release (user runs `npm version` + `npm publish`).
- GitHub remote URL rename note (repo moved to mhmdreza-rafiei/agentry).
