# Agent entrypoint — agentry

`agentry` is a **raw installer**: a zero-dependency Node CLI that fetches **agents, skills, rules, and scripts** from any Git repo (or local path) and installs the selected ones into a project (or globally) under `.cursor/`. The CLI ships no assets of its own — you point it at a source. Prefer progressive disclosure in assets: lean `SKILL.md` / `AGENT.md` / `RULE.md`, details in `references/`.

## How it works

- `agentry add <type> <source> [selector]` — fetch a source (`author/repo`, git URL, or local path) and install matching assets. Omit the selector to list-and-pick (like `npx skills add`).
- `agentry add profile <name> [source]` — read `profile/<name>.json` (per-type selector lists) and install everything it lists from the source.
- `agentry remove <type> [selector]` / `agentry list <source> [type]` / `agentry update`.
- Selectors: `category/name`, `name` (uncategorized), or `category` (whole category).

Discovery finds assets both under an explicit `<type>/` folder (`<type>/<name>/` or `<type>/<category>/<name>/`) and at the **repo root by marker file** (`SKILL.md`→skills, `AGENT.md`→agents, `RULE.md`→rules), so it works against real-world skill repos where each skill sits at the root. See `README.md` for the full command grammar.

`examples/` is a sample source repo (not part of the CLI) used by the demo and tests: it contains `enhance-prompt` (skill), `frontend-developer` (agent), `ask-dont-guess` (rule), `doctor` (script). `profile/*.json` are example profiles.

## Skill-authoring toolkit

Use these when creating or refining skills. Install from their upstream packages if not already available.

| Skill | Role |
|-------|------|
| `/skill-writer` | Create, synthesize, and iteratively improve skills (spec-aligned authoring) |
| `/skill-optimizer` | Benchmark and refine skill docs / descriptions until agents trigger and execute reliably |
| `/skill-creator-ms` | Create modular skills (Azure / Foundry–oriented creator workflow) |
| `/skill-creator` | Create, edit, eval, and optimize skills end-to-end |
| `/skill-issue` | Diagnose why a skill fails to fire; grade metadata and find collisions |
| `/skill-check` | Lint / validate `SKILL.md` against the Agent Skills spec |

## Skills: when-to-use vs always-use

- **When-to-use** — Agent loads the skill only when the user request matches the skill `description` (or the user invokes it by name / slash command).
- **Always-use** — Skill applies to every user turn until disabled. Register with frontmatter such as `alwaysApply: true`.

To enable always-on `enhance-prompt`: install it (`agentry add skills <source> prompt/enhance-prompt`), then in the target project's `AGENTS.md` mark it `alwaysApply: true` (or set equivalent metadata in the agent's skill config). Disable by removing that registration.

## Repo conventions

- The CLI lives in `bin/` + `src/` (`registry` discovery, `source` fetch, `commands` install/remove, `profile` config). Zero runtime dependencies.
- Sample assets live in `examples/<type>/[category/]<name>/`; keep skills discoverable via `SKILL.md`.
- No hardcoded authoring-machine paths in any asset or template.

## Cursor Cloud specific instructions

Two things live here: the **`agentry` CLI** (Node, zero runtime deps) and a **sample source** in `examples/`. No long-running service.

- Run the CLI: `node bin/agentry.js <action> …` (or `npx . …`); published entry will be `npx agentry@latest …`.
- Tests: `npm test` (Node built-in runner, `node --test`, sources in `test/`). Tests build a throwaway fixture source in a temp dir — they do not hit the network. No lint tooling is configured.
- Remote sources are fetched with a shallow `git clone` to a temp dir (cleaned up after); `author/repo` expands to `https://github.com/author/repo.git`. Fetching a remote source needs network + `git`.
- Discovery is dual-mode (explicit `<type>/` folder **and** root-level marker files) — this is why it works against generic skill repos like `Prat011/awesome-llm-skills`; keep that in mind when changing `src/registry.js`.
- Install target is always `<root>/.cursor/<type>/[category/]<name>/` (cwd for project, `~` for global) with `.cursor/agentry.lock.json`. `add`/`remove` are idempotent; `remove` works from the lockfile/filesystem and needs no source. On a TTY with no location flag it prompts; non-interactively it defaults to a **project** install (agent/CI-safe).
- Publishing to npm and the GitHub repo rename/description are external user steps.
