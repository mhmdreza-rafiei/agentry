# Progress

- Rebranded repo to **agentry**: a CLI + multi-asset catalog (agents, skills, rules, scripts) with per-project / global install and profiles.
- Added `bin/agentry.js` + `src/registry.js` + `src/commands.js` (zero runtime deps); `add`/`remove`/`list`/`update`, `-g/--project/--dir/-y`, `--version/--help/--uninstall`; interactive project-vs-global prompt with non-interactive project default.
- Assets install to `<root>/.cursor/<type>/<name>/` with `.cursor/agentry.lock.json`; the CLI reads assets from its own package root so `npx agentry@latest` works without cloning.
- Scaffolded starter assets: `agents/frontend-developer`, `rules/ask-dont-guess`, `scripts/doctor`; kept `skills/enhance-prompt` (still discoverable via the external `skills` CLI).
- Added `profiles.json` (`all`/`frontend`/`backend`) and `test/core.js` (`npm test`, all passing).
- `enhance-prompt` skill behavior unchanged.
- Next / external: publish `agentry` to npm and rename the GitHub repo + description; add more real agents/rules/scripts; optionally per-agent install targets (`.claude`, `.codex`) via `agentry.json` `target`.
