Progress
-----------------
Live state of the agentry CLI. Update at session start/end and after each milestone.

## Current state

- agentry is a **raw installer** CLI (no bundled catalog): fetches **agents, skills, rules, and profiles** from any source and installs selected ones under the target provider directory.
- **Refactor complete**: migrated from zero-dep CommonJS JS to the research blueprint — TypeScript ESM, Clack + picocolors UI, obuild bundling, vitest, minimal runtime deps. 70+ providers, dual-mode discovery, idempotent install/remove, dry-run, profiles (YAML/zod), self-update with version check.

## Done this session (blueprint refactor)

- **Stack migration**: `package.json` (TS ESM, deps, scripts), `tsconfig.json`, `build.config.mjs` (obuild -> `dist/cli.mjs`), `vitest.config.ts`, `bin/cli.mjs` shim. Deps installed; Node >=22.20.
- **Core** (`src/core/`): `types.ts` (ArtifactKind `skill|rule|agent|profile`, Scope, Artifact, AgentConfig, InstallOpts, LockFile), `source_parser.ts` (6 formats + GitHub tree subdir + ref), `git.ts` (shallow clone + subpath + cleanup), `lock.ts` (provider-aware roots, symlink default / `--copy`, dry-run, lockfile records `source`+`agents`+`kind`, source-free remove).
- **Registry** (`src/registry/agents.ts`): 70+ providers; `getAgent`/`listAgents`/`detectInstalledAgents`/`resolveAgents` (`*`=all).
- **Artifacts** (`src/artifacts/`): `discovery.ts` (skill folder / agent+rule `.mdc` / profile yaml; dual-mode folder+root-marker; dedupe+sort), `profiles.ts` (zod `ProfileSchema` + YAML loader).
- **UI** (`src/ui/`): `theme.ts` (picocolors + ASCII gray-gradient `AGENTRY` logo + tagline), `prompts.ts` (Clack intro/outro/confirm/multiselect/select/spinner + `preview()` + quiet-mode), `detect.ts` (`isCI()` via `@vercel/detect-agent`).
- **Commands + CLI** (`src/commands.ts`, `src/cli.ts`): `add`/`add profile`/`remove`/`list`/`list installed`/`update assets`/`uninstall`/self-update; flags `-g`/`--project`/`--dir`/`-a`/`-l`/`--copy`/`--all`/`-y`/`-v`/`-h`; singular kinds + plural normalization; npm version check before self-update (uses scoped pkg name).
- **Tests** (`tests/core.ts`): 10 tests, all green (discovery x3, source parser x2, agents registry, install/remove, dry-run, listInstalled, profiles schema).
- **Removed old CommonJS**: `bin/agentry.js`, `src/{agents,commands,profile,registry,source,source_parser,ui}.js`, `test/core.js`, empty `test/` and `profile/` dirs. (Old `.js` files were shadowing the new `.ts` imports — removed to unblock the build.)
- **Docs**: rewrote `AGENTS.md` (rule #2 now TS ESM + minimal deps), `README.md`, `context/{overview,architecture,standards,plan,libraries}.md`.
- Smoke-tested built CLI: `--version`, `--help`, `list`, `add --list` (preview), real `add --copy` to cursor, `remove`.

## Verify

- `npm run typecheck` — passes.
- `npm test` — 10/10 pass.
- `npm run build` — `dist/cli.mjs` (41 kB, deps bundled).
- `node dist/cli.mjs --version` -> `0.2.0`.
- `node dist/cli.mjs list <local-fix>` -> skills/rules/agents/profiles.
- `node dist/cli.mjs add skills <local-fix> <selector> -a cursor --copy --dir <tmp>` -> installs; `remove` -> gone.

## Known issues / TODO

- `agentry update` self-check hits `https://registry.npmjs.org/<scoped-pkg>/latest` — 404 until published; falls back to `npm install -g <pkg>@latest` on network error.
- Profile schema is a **draft** (not locked) — see `src/artifacts/profiles.ts` + plan.md open decisions.
- `scripts` kind was in the prior design but the report's artifact kinds are `skill|rule|agent|profile`; dropped this pass. > NEEDS VERIFICATION: restore `scripts`?
- Rules adapters (canonical -> per-agent surfaces), `doctor`, `find`, `use`, `init`, conflict policy, export/snapshot — not yet built (see plan.md).

## External / out of scope

- Publish `@mhmdreza-rafiei/agentry` to npm.
- Rename GitHub repo + description.
- Telemetry (skip).
