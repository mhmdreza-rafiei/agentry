Overview
-----------------
Agentry is a raw installer CLI. It fetches **agents, skills, rules, scripts, and profiles** from any Git repo (or local path) and installs selected ones into a project (or globally). It ships no catalog of its own — you point it at a source. UX mirrors `vercel-labs/skills`, extended beyond skills-only.

## About

- TypeScript ESM, Node >=22.20. Runtime deps: `@clack/prompts`, `picocolors`, `yaml`, `zod`, `xdg-basedir`, `@vercel/detect-agent` (UI libs bundled by `obuild`).
- Sources: local path, GitHub `author/repo`, GitHub/GitLab URL, tree URL, any git URL (shallow clone + optional cache under `~/.cache/agentry/repos`).
- Dual-mode discovery: `<kind>s/` folders **and** root markers (`SKILL.md`, `.mdc`). Scripts/profiles only under `scripts/` / `profiles/`.
- Lockfile: `.agentry/lock.json` (legacy `.cursor/agentry.lock.json` migrates on write).
- Universal skills install once to `.agents/skills/<id>`; non-universal agents symlink or `--copy`.
- Kinds: `skill | rule | agent | profile | script` (plurals accepted).
- Commands: `add`, `remove`, `list`, `update`, `init`, `uninstall`.

## Does

- Install / remove / update / list by selector and/or install source (GitHub or local).
- Scaffold with `init` (templates + optional pick-from-source for profiles).
- Action-aware prompts (install to / remove from / update for); sky primary UI.
- Prune empty kind / `.agents` / `.agentry` trees after remove.
- Quiet mode in agent/CI.

## Does not

- Bundle a product catalog (only empty `init` templates).
- Run agents or skills — files only.
- Ship `doctor` / `find` / `use` yet — see plan.md.

## User flow (add)

1. Parse + resolve source (clone or cache fallback).
2. Discover artifacts → pick (TTY) → pick agents → install → lock.

## Success criteria

- `npm test` hermetic; `npm run build` → `dist/cli.mjs`.
- Idempotent install; remove deletes files + lock + empty parents.
- Dual-mode discovery works on generic skill repos.

## Relations

- `architecture.md` — systems
- `standards.md` — conventions
- `plan.md` — roadmap
- `libraries.md` — deps
- `memory/progress.md` — handoff
