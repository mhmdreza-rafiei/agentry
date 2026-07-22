Progress
-----------------
Live state of the agentry CLI. Update at session start/end and after each milestone.

## Current state

- agentry is a **raw installer** CLI (no bundled catalog): fetches **agents, skills, rules, scripts, and profiles** from any source and installs selected ones under the target provider directory.
- **Refactor complete + UX parity pass**: TypeScript ESM, Clack + picocolors UI, obuild bundling, vitest, minimal runtime deps. 70+ providers mirroring vercel-labs/skills with a **universal `.agents/skills` install + symlink** system, dual-mode discovery, idempotent install/remove, dry-run, profiles (YAML/zod), self-update with version check. Animated robot logo, spinner-step fetch animation, artifact multiselect with `All` toggle, and an interactive "Which agents do you want to install to?" prompt (universal locked + others selectable).

## Done this session (UX parity pass — on top of the blueprint refactor)

- **Registry rewrite** (`src/registry/agents.ts`): faithful port of vercel-labs/skills — 70+ providers, universal providers use `.agents/skills`, `showInUniversalList`/`showInUniversalPrompt` flags, sync `detectInstalled`, helpers `getUniversalAgents`/`getVisibleUniversalAgents`/`getNonUniversalAgents`/`isUniversalAgent`. `cursor` is universal (`.agents/skills`).
- **Lockfile path** (`src/core/lock.ts`): canonical **`.agentry/lock.json`** (not under `.cursor/`). `readLock` falls back to legacy `.cursor/agentry.lock.json`; `writeLock` migrates by removing the legacy file after writing the new path.
- **Universal + symlink install** (`src/core/lock.ts`): skills install **once** to `.agents/skills/<id>` (canonical); non-universal agents symlink their `<skillsDir>/<id>` to it (or copy with `--copy`); agents/rules/profiles/scripts stay per-agent to `<configDir>/<kind>s/<...>`. `remove` cleans canonical + per-agent targets.
- **`scripts` kind restored**: `scripts/<usecase>/` (or `scripts/<category>/<usecase>/`); added to `ARTIFACT_KINDS`, `discovery.ts` (`collectScripts`), `lock.ts` (`pluralKind`), `profiles.ts` (schema `scripts`), `cli.ts` HELP, and docs.
- **Theme** (`src/ui/theme.ts`): `PALETTE` (primary cyan), robot mascot `ROBOT` (2 blink frames), clean white→gray gradient `agentry` wordmark, `logo()`, `animateLogo()` (TTY blink), `badge()` (bgCyan ` agentry `), `tagline()`.
- **UI flow** (`src/ui/prompts.ts`, `src/commands.ts`): `cmdAdd` now does intro badge → spinner "Parsing source…" → `Source: <url>` → spinner "Discovering…" → `Found N` → `selectArtifacts` (descriptions + `All` toggle) → `selectAgents` ("Which agents do you want to install to?", universal locked + others selectable, defaults to installed) → install → outro. `resolveAgentList` is async; non-interactive falls back to auto-detected + `cursor`.
- **CLI** (`src/cli.ts`): animated logo + tagline on TTY (help + run); HELP lists `script` kind.
- **Release docs**: `README.md` — logo image (`docs/agentry-logo.png`), badges (npm/license/node/stars), star CTA, `script` kind, scripts layout section, universal-install section, updated provider table (cursor=`.agents/skills`). `AGENTS.md` — kinds + layouts + universal install note updated.
- **Tests**: updated `tests/core.ts` for the universal layout (cursor→`.agents/...`, claude→`.claude/...`); lock at `.agentry/lock.json` + legacy migration test; 11/11 green.

## Verify

- `npm run typecheck` — passes.
- `npm test` — 11/11 pass.
- `npm run build` — `dist/cli.mjs` (~49 kB total dist, deps bundled).
- `node dist/cli.mjs --help` -> lists `skill | rule | agent | profile | script`.
- `node dist/cli.mjs list <local-fix>` -> skills/rules/agents/profiles/scripts with descriptions.
- Logo is **large block ASCII `AGENTRY`** (capitalized, white→gray gradient) + blue ` Agentry ` badge + tagline.
- Non-interactive add: spinner with min duration; stepped delays between parse → discover → prompts; compact install log.
- Interactive lists use custom `searchMultiselect` with a visible **All** row (selecting All disables other ticks), fixed viewport, blue ●/❯, rectangle Info box with labeled fields (Name/Kind/Id/About/Path), required ≥1 for artifacts. Agent list shows Universal locked + Additional with All.
- Install output is a structured **Install summary** panel (scope, targets, artifact list + descriptions) — not a raw dump.
- Spinners are custom blue (no clack green); step spacing uses blank lines between sections.

## UI redesign pass (beat vercel-labs/skills)

- Ported searchable multiselect from vercel-labs/skills → `src/ui/search_multiselect.ts`, themed **blue** (not green), with rectangle **Info** box (kind/id/description/path for artifacts; provider/id/paths/universal/installed for agents).
- Fixed viewport (`maxVisible: 8`) + `↑ N more / ↓ N more` — no 70-row terminal history scroll.
- Dedupes items by value; artifact specific requires ≥1 selection.
- Spinners keep a minimum visible time; `cmdAdd` adds short delays between steps.
- Primary palette + badge switched to blue; Source lines use blue.

## Known issues / TODO

- `agentry update` self-check hits `https://registry.npmjs.org/<scoped-pkg>/latest` — 404 until published; falls back to `npm install -g <pkg>@latest` on network error.
- Profile schema is a **draft** (not locked) — see `src/artifacts/profiles.ts` + plan.md open decisions.
- `docs/agentry-logo.png` is ~1.2MB; consider compressing before release.
- Interactive TUI needs a real PTY to screenshot in CI/agent harness (stdout often non-TTY).
- Rules adapters (canonical -> per-agent surfaces), `doctor`, `find`, `use`, `init`, conflict policy, export/snapshot — not yet built (see plan.md).

## External / out of scope

- Publish `@mhmdreza-rafiei/agentry` to npm.
- Rename GitHub repo + description.
- Telemetry (skip).
