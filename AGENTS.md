# Agent entrypoint — comprehensive-skills

This repo packages installable Agent Skills. Prefer progressive disclosure: lean `SKILL.md`, details in `references/`.

## Project Skills

### Shipped from this repo

| Skill | When to use | Always-use? |
|-------|-------------|-------------|
| `/enhance-prompt` | User asks to enhance, improve, rewrite, optimize, or clarify a prompt — or always-on is enabled for the session | Opt-in (see below) |

### Skill-authoring toolkit

Use these when creating or refining skills in this repo. Install from their upstream packages if not already available.

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

1. Ensure the skill is installed (`npx skills add … --skill enhance-prompt`).
2. In the **target** project’s `AGENTS.md`, add a Skills section that marks `enhance-prompt` as always-use, e.g. note `alwaysApply: true` for that skill, **or** set equivalent always-apply metadata in the agent’s skill config if the client supports it.
3. Confirm: casual user messages are rewritten into structured Goal / Constraints / Output prompts before tools run; enhanced prompts stay free of absolute paths and authoring-machine context.

### Disable

Remove the always-apply registration from `AGENTS.md` / agent skill config, or tell the agent to stop enhancing every prompt.

## Repo conventions

- New skills live under `skills/<skill-name>/`.
- Do not invent product requirements beyond what the skill documents.
- No hardcoded absolute paths from an authoring machine in skill text or templates.
