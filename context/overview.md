# Overview

`agentry` is a CLI + catalog for installing AI/agent tooling into any project or globally.

- **CLI** (`bin/agentry.js`, logic in `src/`): `add` / `remove` / `list` / `update` assets; flags for global vs project install, plus `--version` / `--help` / `--uninstall`. Zero runtime dependencies (Node stdlib only).
- **Catalog**: assets under `<type>/<name>/` for four types — `agents`, `skills`, `rules`, `scripts`. Profiles in `profiles.json` (`all`, `frontend`, `backend`) group assets for one-shot installs.
- **Install model**: assets copy to `<root>/.cursor/<type>/<name>/` (`<root>` = cwd for project, `~` for global), tracked in `.cursor/agentry.lock.json` (idempotent add/remove).
- **Skills** keep the `skills/<name>/SKILL.md` convention so they remain installable via the external `skills` CLI too.

Shipped assets: `enhance-prompt` (skill), `frontend-developer` (agent, starter), `ask-dont-guess` (rule), `doctor` (script).

Run: `node bin/agentry.js <action> …` (published: `npx agentry@latest …`). Test: `npm test`.
