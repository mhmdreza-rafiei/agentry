# Agent entrypoint — agentry

`agentry` is a **raw installer**: a TypeScript ESM Node CLI that fetches **agents, skills, rules, and profiles** from any Git repo (or local path) and installs the selected ones into a project (or globally) under the target provider's directory (`.cursor/`, `.claude/skills/`, etc.). It mirrors the clean Clack-style UX of `vercel-labs/skills` and extends it beyond skills-only. The CLI ships no assets of its own — you point it at a source. Prefer progressive disclosure in assets: lean `SKILL.md` / `.mdc`, details in `references/`.

## How it works

- `agentry add <kind> <source> [selector]` — fetch a source (`author/repo`, git URL, GitHub tree URL, GitLab URL, or local path) and install matching artifacts. Omit the selector to list-and-pick. Use `--agent cursor --agent claude-code` to target specific providers (or `--agent '*'` for all). Kinds are singular (`skill | rule | agent | profile | script`); plurals are accepted and normalized.
- `agentry add profile <name> [source]` — read `profile/<name>.yaml` (a bundled install config: artifacts + targets + scope) and install everything it lists from the source (or per-artifact `source` overrides).
- `agentry remove <kind> [source] [selector]` / `agentry list [source] [kind]` / `agentry update [kind] [source] [selector]` / `agentry init <kind> [name] [category]` / `agentry uninstall`.
- Selectors: `category/name`, `name` (uncategorized), or `category` (whole category). Remove/update accept a GitHub repo or local path to filter by recorded install source.

Artifact layouts in a source repo:
- **skill** — folder per skill: `skills/<name>/SKILL.md` (or `skills/<category>/<name>/SKILL.md`).
- **agent** — single `.mdc` file: `agents/<name>.mdc` (or `agents/<category>/<name>.mdc`).
- **rule** — single `.mdc` file: `rules/<name>.mdc` (or `rules/<category>/<name>.mdc`).
- **script** — folder per use case: `scripts/<usecase>/` (or `scripts/<category>/<usecase>/`).
- **profile** — single `.yaml`/`.yml` file: `profiles/<name>.yaml` (or `profiles/<category>/<name>.yaml`).

Discovery is dual-mode: it finds artifacts under an explicit `<kind>s/` folder **and** at the repo root by marker (`SKILL.md` for skills, `.mdc` files for agents/rules), so generic repos work. Scripts and profiles are folder/file kinds found only under their `scripts/` and `profiles/` folders. See `README.md` for the full command grammar.

**Universal install:** providers whose skills dir is `.agents/skills/` (Cursor, Codex, OpenCode, Gemini CLI, Cline, Amp, Zed, Warp, GitHub Copilot, …) are universal — a skill installs **once** to `.agents/skills/<id>` and non-universal providers (Claude Code, Windsurf, Goose, Roo, Augment, Continue, …) get a **symlink** to it. `--copy` makes independent copies instead. The agent registry (`src/registry/agents.ts`) mirrors `vercel-labs/skills` (70+ entries, `showInUniversalList`/`showInUniversalPrompt` flags, sync `detectInstalled`). When no `--agent` is given, `agentry` prompts "Which agents do you want to install to?" (universal locked + others selectable, defaulting to installed providers); non-interactively it defaults to auto-detected + `cursor`.

## Context

```
context\
   README.md         — entry point + how this folder works.   When to read: first, once.
   overview.md       — what the project is and is not.         When to read: scoping work.
   architecture.md   — systems, boundaries, rules.             When to read: before any code.
   standards.md      — how code is written here.               When to read: before writing.
   plan.md           — what to build, setup, roadmap.          When to read: before a feature.
   libraries.md      — deps and how to use them.               When to read: using a dependency.
   memory\
      progress.md    — current state + handoff.                When to read: session start/end.
```

## Rules you must always follow!

1. Read `context/` before building — start with `overview.md` and `architecture.md`.
2. TypeScript ESM, Node >=22.20. Runtime deps are intentional and minimal (`@clack/prompts`, `picocolors`, `yaml`, `zod`, `xdg-basedir`, `@vercel/detect-agent`); UI libs are bundled by `obuild` into `dist/`. No new dep without explicit approval.
3. Keep discovery dual-mode (explicit `<kind>s/` folder **and** repo-root marker files) — that is what makes generic skill repos work.
4. Install/remove are idempotent; `remove` works from the lockfile/filesystem and needs no source.
5. No hardcoded paths in any asset or template.
6. Tests build a throwaway fixture source in a temp dir — they do not hit the network.
7. Use the UI helpers (`src/ui/prompts.ts`, `src/ui/theme.ts`) for all CLI output — no raw `console.log` for success/error/warn. Suppress interactive UI (logo, spinners, prompts) when running inside an agent or CI (`src/ui/detect.ts`).

## Skills

1. `/groundwork` — create and continuously improve this context system. When to use: setting up the project, or refreshing/deepening context.
2. `/enhance-prompt` — rewrite a user message into a precise, portable agent prompt. When to use: before acting on a complex or dense user request.
3. `/architect` — think through a change and write a plan into `context/plan.md`. When to use: before building any feature or refactor.

## References

- **vercel-labs/skills** — the reference CLI for UX/provider parity. README: https://github.com/vercel-labs/skills . Source: `src/agents.ts` (provider registry), `src/source-parser.ts` (source formats), `src/cli.ts` (UI).
- **Agent Skills spec** — `SKILL.md` with YAML frontmatter (`name`, `description`). Used by Cursor, Claude Code, Codex, OpenCode, and 70+ others.
- **Prat011/awesome-llm-skills** — real-world skill repo used to verify dual-mode discovery.

## Build

```powershell
# Run the CLI in dev (tsx, no build needed)
npm run dev -- <action> …

# Build the bundled CLI (obuild -> dist/cli.mjs)
npm run build

# Run the built CLI
node dist/cli.mjs <action> …

# Typecheck
npm run typecheck

# Tests (vitest; hermetic, no network)
npm test
```

Published entry will be `npx agentry@latest …`. Publishing to npm and the GitHub repo rename/description are external user steps.

## Repo conventions

- The CLI lives in `src/` (`cli.ts` router, `commands.ts` handlers, `core/` types+source-parser+git+lock, `registry/agents.ts` provider registry, `artifacts/` discovery+profiles, `ui/` theme+prompts+detect). Bundled by `obuild` to `dist/cli.mjs`; bin shim is `bin/cli.mjs`.
- Artifact layouts: skill = `skills/<name>/SKILL.md`; agent = `agents/<name>.mdc`; rule = `rules/<name>.mdc`; script = `scripts/<usecase>/`; profile = `profiles/<name>.yaml`. Local profile configs live at `profile/<name>.yaml`.
- No hardcoded authoring-machine paths in any asset or template.

## Cursor Cloud specific instructions

Two things live here: the **`agentry` CLI** (Node, TypeScript ESM). No long-running service.

- Run the CLI: `node dist/cli.mjs <action> …` (built) or `npm run dev -- <action> …` (dev via tsx); published entry will be `npx agentry@latest …`.
- Tests: `npm test` (vitest, sources in `tests/`). Tests build a throwaway fixture source in a temp dir — they do not hit the network. No lint tooling is configured.
- Remote sources are fetched with a shallow `git clone` to a temp dir (cleaned up after); `author/repo` expands to `https://github.com/author/repo.git`. Fetching a remote source needs network + `git`.
- Discovery is dual-mode (explicit `<kind>s/` folder **and** root-level marker files) — this is why it works against generic skill repos like `Prat011/awesome-llm-skills`; keep that in mind when changing `src/artifacts/discovery.ts`.
- Install target is the provider's directory (`.cursor/`, `.claude/skills/`, etc.); install state is tracked in `.agentry/lock.json` (legacy `.cursor/agentry.lock.json` is read once, then removed on the next write). Provider list lives in `src/registry/agents.ts` (70+ agents, mirroring vercel-labs/skills). `add`/`remove` are idempotent; `remove` works from the lockfile/filesystem and needs no source. On a TTY with no `--agent` flag it auto-detects installed agents and prompts; non-interactively (or inside an agent/CI) it defaults to `cursor`.
- `agentry update` (no args) checks the npm registry version first and prints "Already up to date" if equal; otherwise runs `npm install -g <pkg>@latest`. `agentry update <kind> <source> [selector]` re-fetches and re-installs specific artifacts; `agentry update <kind>` (no source) re-installs from sources recorded in the lockfile. `agentry uninstall` removes the CLI.
- Publishing to npm and the GitHub repo rename/description are external user steps.
