Architecture
-----------------
How agentry is structured: the CLI router, command handlers, core (types/source-parser/git/lock), the provider registry, artifact discovery + profiles, and the UI layer.

## Stack

- Language: TypeScript, ESM (`"type": "module"`), strict.
- Runtime: Node >=22.20 (uses `node:fs`, `node:path`, `node:os`, `node:child_process`, `node:https`).
- Dependencies (minimal, intentional): `@clack/prompts` (interactive prompts), `picocolors` (colors), `yaml` (profiles), `zod` (profile schema), `xdg-basedir` (paths), `@vercel/detect-agent` (detect running inside an agent).
- Build: `obuild` bundles `src/cli.ts` → `dist/cli.mjs` (UI libs bundled in; tiny runtime deps).
- Tests: `vitest` (sources in `tests/`).

## Folder structure

```
agentry/
  bin/cli.mjs           Dev/published shim -> dist/cli.mjs (fallback to tsx in dev).
  src/
    cli.ts              Router: arg parsing, command dispatch, self-update, uninstall, help/logo.
    commands.ts         Command handlers: add, add profile, remove, list, list installed, update assets.
    core/
      types.ts          Shared types: ArtifactKind, Scope, Artifact, AgentConfig, InstallOpts, LockFile.
      source_parser.ts  Parse 6 source formats into { kind, url, subpath, ref, local }.
      git.ts            Source resolution: local | git clone to temp -> { root, cleanup }.
      lock.ts           Lockfile + install/remove (provider-aware roots, symlink/copy, idempotent).
    registry/
      agents.ts         70+ provider registry (skillsDir, globalSkillsDir, configDir, detectInstalled).
    artifacts/
      discovery.ts      Discovery: list/select artifacts in a source root (folder + root marker).
      profiles.ts       Profile schema (zod) + YAML loader.
    ui/
      theme.ts          picocolors theme + ASCII gray-gradient logo + symbols.
      prompts.ts        Clack flows (intro/outro/confirm/multiselect/select/spinner) + quiet-mode.
      detect.ts         isCI(): env CI, no TTY, or @vercel/detect-agent says we're inside an agent.
  tests/
    core.ts             vitest suite (10 tests, temp fixture, no network).
  context/              This folder — shared agent context.
```

Artifact layouts in a source repo:
- skill — folder per skill: `skills/<name>/SKILL.md` (or `skills/<category>/<name>/SKILL.md`).
- agent — single `.mdc` file: `agents/<name>.mdc` (or `agents/<category>/<name>.mdc`).
- rule — single `.mdc` file: `rules/<name>.mdc` (or `rules/<category>/<name>.mdc`).
- script — folder per use case: `scripts/<usecase>/` (or `scripts/<category>/<usecase>/`).
- profile — single `.yaml`/`.yml` file: `profiles/<name>.yaml` (or `profiles/<category>/<name>.yaml`).

## Systems

### CLI router (`src/cli.ts`)
- `parseArgs(argv)` — flag parser (`-g/--global`, `--project`, `--dir`, `-a/--agent` (repeatable), `-l/--list`, `--copy`, `--all`, `-y/--yes`, `-v/--version`, `-h/--help`).
- `normalizeKind(s)` — accepts singular and plural (`skills`->`skill`).
- Dispatches: `add <kind> <source> [selector]`, `add profile <name> [source]`, `remove <kind> [selector]`, `list [source] [kind]`, `update [kind] [source] [selector]`, `uninstall`.
- `runUpdateSelf` — checks npm registry version first; "Already up to date" if equal; else `npm install -g <pkg>@latest`.
- `runUninstall` — `npm uninstall -g <pkg>`.
- Renders the animated robot logo + tagline unless quiet (inside agent/CI); `--help` shows logo + help.

### Command handlers (`src/commands.ts`)
- `cmdAdd` / `cmdAddProfile` / `cmdRemove` / `cmdList` / `cmdListInstalled` / `cmdUpdateAssets` / `cmdInit`.
- `cmdAdd` flow: `ui.intro()` (badge) → spinner "Parsing source…" → print `Source: <url>` → spinner "Discovering…" → `Found N` → `selectArtifacts` → `resolveAgentList` (action-aware prompt) → `installAll` → `outro`.
- `cmdRemove` / `cmdUpdateAssets` accept optional GitHub/local `source` (+ selector); lock entries filtered via `sourcesEqual`.
- `cmdInit` scaffolds skill/agent/rule/script/profile templates (`src/artifacts/scaffold.ts`); profile init can pick artifacts from a remote/local source.
- `resolveAgentList(opts, action)` (async) — `--all` -> all; `--agent` -> resolved; else prompt via `selectAgents` with install/remove/update wording; non-interactive -> auto-detected + `cursor`.

### Core (`src/core/`)
- `source_parser.ts` — `parseSource(source)` -> `{ kind, raw, url, subpath, ref?, local? }`; `sourceIdentity` / `sourcesEqual` / `isExplicitSource` for lock matching.
- `git.ts` — `resolveSource(source)` -> `{ root, cleanup }`. Local: as-is. Remote: `git clone --depth 1 [--branch ref]` to temp; optional subpath; cleanup after.
- `lock.ts` — `lockBase` / `lockPath` (`.agentry/lock.json`) / legacy migrate; `installOne`; `removeSelection(kind, selector, opts, agents, sourceFilter?)` — optional source filter via `sourcesEqual`.
- `types.ts` — shared types + `ARTIFACT_KINDS` (`skill | rule | agent | profile | script`).

### Registry (`src/registry/agents.ts`)
- `AGENTS` — 70+ providers mirroring `vercel-labs/skills`: `skillsDir`, `globalSkillsDir`, `configDir` (derived), `globalConfigDir`, `detectInstalled` (sync), `showInUniversalList`, `showInUniversalPrompt`. Universal providers use `.agents/skills`.
- `getAgent` / `listAgents` / `detectInstalledAgents` / `resolveAgents` (`*` = all; collects unknown).
- Universal helpers: `getUniversalAgents` / `getVisibleUniversalAgents` / `getNonUniversalAgents` / `isUniversalAgent`.

### Artifacts (`src/artifacts/`)
- `discovery.ts` — `listKind(root, kind)` unions `<kind>s/` folder + repo-root markers (scripts/profiles are folder/file kinds, no root marker); dedupes by id; sorts. `select(root, kind, selector)` — `undefined` (all), `category/name`, `category`, bare `name`. `listAll`.
- `profiles.ts` — `ProfileSchema` (zod: name, description, scope, targets.agents, artifacts.{skills,rules,agents,scripts}); `loadProfile(name)` reads `profile/<name>.yaml`.
- `scaffold.ts` — `scaffoldSkill` / `scaffoldMdc` / `scaffoldScript` / `scaffoldProfile` for `agentry init`.

### UI (`src/ui/`)
- `theme.ts` — `PALETTE` (primary **sky** `#38bdf8` truecolor), large block ASCII `AGENTRY` wordmark (white→gray gradient), `badge()` (` Agentry ` on sky), `tagline()`, `delay()`, `animateLogo()`, `printHelp()`.
- `search_multiselect.ts` — custom searchable multiselect (readline raw mode): fixed viewport (`maxVisible`), Search filter, sky ●/❯ selection, rectangle Info box, locked Universal section, required ≥1 option, value dedupe; clear-frame uses `moveCursor` + `clearScreenDown` (+1 row safety) to avoid stacked duplicates.
- `prompts.ts` — Clack wrappers + `selectArtifacts` / `selectAgents` + action-aware `agentsPrompt` (install/remove/update) + `installSummary`.
- `detect.ts` — `isCI()`: `CI` env, no TTY, or `@vercel/detect-agent` detects an agent.

## Data flow

```
user -> src/cli.ts (parseArgs, normalizeKind, animateLogo)
      -> src/commands.ts cmdAdd
        -> ui.spinner "Parsing source" -> src/core/source_parser.ts (parseSource)
        -> src/core/git.ts (resolveSource: local | git clone to temp)
        -> ui.spinner "Discovering" -> src/artifacts/discovery.ts (listKind/select)
        -> ui.selectArtifacts (All toggle) if TTY, multiple, not --all/--yes
        -> resolveAgentList -> ui.selectAgents (universal locked + others)
        -> src/core/lock.ts (installOne: universal canonical + symlinks, write lock)
      -> cleanup temp clone
```

## Rules

- Keep `src/core` + `src/registry` + `src/artifacts` pure (no direct stdout); CLI/commands own output via `src/ui`.
- Discovery must stay dual-mode — do not drop root-marker support.
- Universal install: skills install once to `.agents/skills/<id>`; non-universal agents symlink to it (or copy with `--copy`). Do not duplicate skill files per universal agent.
- Lockfile is the source of truth for what is installed; `remove` reads it.
- No network in tests — use a temp fixture source.
- Suppress interactive UI (logo, spinners, prompts) when inside an agent or CI.

## Relations

- overview.md [ Context ] — what the project is and is not.
- standards.md [ Context ] — how code is written here.
- plan.md [ Context ] — roadmap (rules adapters, doctor, find/use/init).
- libraries.md [ Context ] — dependencies and tooling.
