# Progress

- `agentry` is now a **raw installer** CLI (no bundled catalog): it fetches assets from any source and installs selected ones under `.cursor/`.
- Grammar: `agentry add <type> <source> [category/name|category]` (omit selector ⇒ interactive pick, like `npx skills add`); `agentry add profile <name> [source]`; `agentry remove <type> [selector]`; `agentry list <source> [type]`; `agentry update`; flags `-g/--project/--dir/-y/--version/--help/--uninstall`.
- Sources: local path, GitHub `author/repo`, or git URL (shallow clone to temp; `src/source.js`).
- Discovery (`src/registry.js`) is dual-mode: explicit `<type>/[category/]<name>/` **and** repo-root marker files (`SKILL.md`/`AGENT.md`/`RULE.md`), incl. root categories like `document-skills/docx`. Verified against `Prat011/awesome-llm-skills`.
- Install/remove (`src/commands.js`) → `<root>/.cursor/<type>/[category/]<name>/` + `.cursor/agentry.lock.json`; idempotent; remove is source-free.
- Profiles are `profile/<name>.json` (per-type selector lists); shipped examples `frontend`/`backend`.
- Old bundled assets moved to `examples/` (sample source + used by tests/demo); `profiles.json` removed.
- Tests rewritten (`test/core.js`, 5/5 pass) using a temp fixture source (no network).
- Next / external: publish `agentry` to npm; rename GitHub repo + description; optionally per-agent install targets and multi-repo profiles.
