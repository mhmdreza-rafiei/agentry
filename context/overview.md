# Overview

`agentry` is a raw installer CLI for AI/agent tooling. It fetches assets from any source and installs the selected ones under `.cursor/`. The CLI bundles no assets.

- **CLI** (`bin/agentry.js`): `add` / `remove` / `list` / `update`; flags for global vs project install, plus `--version` / `--help` / `--uninstall`. Zero runtime dependencies.
- **Sources** (`src/source.js`): a local path (used as-is), a GitHub `author/repo` shorthand, or a full git URL (shallow-cloned to temp).
- **Discovery** (`src/registry.js`): finds assets under `<type>/[category/]<name>/` **and** at the repo root by marker file (`SKILL.md`/`AGENT.md`/`RULE.md`), so generic skill repos work. Assets are addressed `category/name`, `name`, or `category`.
- **Install/remove** (`src/commands.js`): copy to `<root>/.cursor/<type>/[category/]<name>/`, tracked in `.cursor/agentry.lock.json` (idempotent; remove works from the lockfile/filesystem, no source needed).
- **Profiles** (`src/profile.js` + `profile/<name>.json`): per-type selector lists applied against a source.

`examples/` is a sample source (skills/agents/rules/scripts) used by the demo/tests, not part of the CLI.

Run: `node bin/agentry.js <action> …` (published: `npx agentry@latest …`). Test: `npm test`.
