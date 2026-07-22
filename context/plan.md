Plan
-----------------
The agentry CLI roadmap — match the research blueprint (vercel-labs/skills parity, extended for agents/skills/rules/profiles) on a TypeScript ESM stack.

## Core principles

- TypeScript ESM, Node >=22.20; minimal intentional runtime deps (Clack, picocolors, yaml, zod, xdg-basedir, detect-agent); UI libs bundled by obuild.
- Mirror vercel-labs/skills UX and provider coverage; extend beyond skills-only.
- Keep dual-mode discovery and idempotent install/remove intact.
- One runnable check per non-trivial behavior; tests stay hermetic (vitest).

## Done (this refactor)

1. **Stack migration** — CommonJS JS -> TypeScript ESM; `package.json`, `tsconfig.json`, `obuild` build (`dist/cli.mjs`), `vitest`, deps installed. Node >=22.20.
2. **Core** (`src/core/`) — `types.ts`, `source_parser.ts` (6 formats + tree subdir + ref), `git.ts` (shallow clone + subpath), `lock.ts` (provider-aware roots, symlink/copy, dry-run, lockfile records source+agents+kind).
3. **Registry** (`src/registry/agents.ts`) — 70+ providers; `getAgent`/`listAgents`/`detectInstalledAgents`/`resolveAgents`.
4. **Artifacts** (`src/artifacts/`) — `discovery.ts` (skill folder / agent+rule .mdc / profile yaml; dual-mode); `profiles.ts` (zod `ProfileSchema` + YAML loader).
5. **UI** (`src/ui/`) — `theme.ts` (picocolors + ASCII gray-gradient logo), `prompts.ts` (Clack flows + preview + quiet-mode), `detect.ts` (isCI via detect-agent).
6. **Commands + CLI** (`src/commands.ts`, `src/cli.ts`) — add/add-profile/remove/list/list-installed/update-assets/uninstall/self-update; `--agent`/`-a`/`*`, `--list`/dry-run, `--copy`, `--all`, `-y`, `-g`/`--project`/`--dir`; singular kinds + plural normalization; version check before self-update.
7. **Tests** (`tests/core.ts`) — 10 tests green (discovery, source parser, agents registry, install/remove, dry-run, listInstalled, profiles schema).
8. **Docs** — AGENTS.md, README.md, context/* rewritten for the new stack.

## To build (next passes)

1. **Rules adapters** — canonical rule -> per-agent rule surfaces (`.cursor/rules/*.mdc`, `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.windsurf/rules/`, `GEMINI.md`, …). The adapter matrix (artifact x agent x scope) is the hard part.
2. **`doctor`** — verify installed artifacts, lockfile integrity, provider detection, broken symlinks.
3. **`find`** — search across sources/registries for artifacts by name/description.
4. **`use` / `init`** — skills-parity commands (apply a single skill quickly; scaffold a new source repo).
5. **Conflict policy** — skip/overwrite/merge on install collisions; diff view.
6. **Export/snapshot** — export current installs as a profile.
7. **`scripts` kind** — was in the prior design (`scripts/<usecase>/`); the research report's artifact kinds are `skill|rule|agent|profile`, so it is not in this pass. Re-add if wanted. > NEEDS VERIFICATION: confirm whether to restore `scripts`.
8. **Profile schema lock** — current `ProfileSchema` is a draft (see `src/artifacts/profiles.ts`); lock it down once product decisions settle.

## Open decisions

- **`scripts` kind**: dropped per report; restore? (see To build #7)
- **Profile schema**: draft only; not locked.
- **Rules adapter coverage**: which of the 70+ agents get full rules adapters vs. a universal fallback.
- **Fork vs wrap `skills`**: kept as a reimplementation (current choice); revisit if parity gaps appear.

## Setup

- `npm install` (deps), `npm run build` (obuild), `npm test` (vitest), `npm run dev -- …` (tsx).

## Rules

- Do not break tests; update them for new behavior.
- Do not add a runtime dep without explicit approval.
- Do not hardcode paths.
- Work locally on the agentry folder; do not touch the GitHub repo environment.

## Relations

- architecture.md [ Context ] — current systems.
- standards.md [ Context ] — standards the plan must meet.
- memory/progress.md [ Memory ] — live progress against this plan.
