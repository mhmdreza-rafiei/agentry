# Agent entrypoint — agentry

`agentry` is a CLI plus a catalog of installable **agents, skills, rules, and scripts**. It installs selected assets into a project (or globally) under `.cursor/`, individually or by profile. Prefer progressive disclosure: lean `SKILL.md` / `AGENT.md` / `RULE.md`, details in `references/`.

## Asset catalog

Each asset lives in `<type>/<name>/`. Types: `agents`, `skills`, `rules`, `scripts`. Optional `<type>/<name>/agentry.json` provides metadata (`name`, `type`, `description`); otherwise description comes from the asset's Markdown frontmatter. Profiles (`profiles.json`) group assets: `all`, `frontend`, `backend`.

### Shipped from this repo

| Asset | Type | When to use |
|-------|------|-------------|
| `enhance-prompt` | skill | Enhance/rewrite prompts: preserve contracts, ask mode/better-decision questions, attach related skills, after-finish summary |
| `frontend-developer` | agent | Starter frontend developer persona (edit for your stack) |
| `ask-dont-guess` | rule | Ask before guessing requirements or product truth |
| `doctor` | script | Print a simple environment readiness check |

### Skill-authoring toolkit

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
- **Always-use** — Skill applies to every user turn in the session or project until disabled. Register with frontmatter such as:

```yaml
alwaysApply: true
```

Always-on for `enhance-prompt` means: rewrite the user’s message into a better agent prompt **before** acting, while still obeying the skill’s **context policy** (portable, session-safe — no workspace paths, no assumed stack, no dumps of target-workspace docs).

### Enable always-on `enhance-prompt`

1. Install the skill: `agentry add skills enhance-prompt` (or `npx skills add … --skill enhance-prompt`).
2. In the **target** project’s `AGENTS.md`, mark `enhance-prompt` as always-use (`alwaysApply: true`), or set equivalent always-apply metadata in the agent’s skill config if the client supports it.
3. Confirm: casual user messages are rewritten into structured Goal / Constraints / Output prompts before tools run; enhanced prompts stay free of absolute paths and authoring-machine context.

### Disable

Remove the always-apply registration from `AGENTS.md` / agent skill config, or tell the agent to stop enhancing every prompt.

## Repo conventions

- Assets live under `<type>/<name>/` (`agents`, `skills`, `rules`, `scripts`). Skills keep `skills/<name>/SKILL.md` so the external `skills` CLI still discovers them.
- Add new assets to the relevant profile(s) in `profiles.json`.
- Do not invent product requirements beyond what an asset documents.
- No hardcoded absolute paths from an authoring machine in asset text or templates.

## Cursor Cloud specific instructions

Two things live here: the **`agentry` CLI** (Node, zero runtime deps) and a **catalog** of installable assets. There is no long-running service.

- Run the CLI locally: `node bin/agentry.js <action> …` (or `npx . …`). Published entry will be `npx agentry@latest …` — see `README.md` for full command grammar.
- Tests: `npm test` (Node built-in runner, `node --test`, sources in `test/`). No lint tooling is configured.
- The CLI reads assets from its **own package root** (resolved via `__dirname`), not the caller's cwd — so it works when run via `npx` from anywhere. Install target is cwd (project) or `~` (global), always namespaced under `.cursor/<type>/<name>/` with a `.cursor/agentry.lock.json`.
- `add`/`remove` are idempotent (re-install wipes+recopies the asset dir). When neither `--global` nor `--project`/`--dir` is passed and stdin is **not** a TTY, it defaults to a **project** install (safe for agents/CI); on a TTY it prompts.
- Skills stay dual-discoverable: keep `skills/<name>/SKILL.md` so `npx skills add . --list` and `--skill <name>` keep working; discovery is depth-limited to `skills/<name>/` (or `skills/<group>/<name>/`).
- Publishing to npm and the GitHub repo rename/description are external user steps; the CLI already resolves versions via `package.json`.
