# agentry

A raw installer for AI/agent tooling. `agentry` fetches **agents, skills, rules, and scripts** from any Git repo (or local path) and installs the ones you pick into your project — or globally — under `.cursor/`. The CLI ships no assets of its own; you point it at a source.

## Install / run

```bash
# Run without installing (recommended)
npx agentry@latest --help

# Or install the CLI globally
npm install -g agentry@latest

# Update / uninstall the CLI
agentry update
agentry --uninstall
```

> Publishing to npm is pending. Until then, run from a clone: `node bin/agentry.js …` or `npx . …`.

## Usage

```
agentry add <type> <source> [category/name | category] [options]
agentry add profile <name> [source] [options]
agentry remove <type> [category/name | category] [options]
agentry list <source> [type]
agentry update
```

`<source>` is a GitHub shorthand `author/repo`, a full git URL, or a local path.

```bash
agentry add skills Prat011/awesome-llm-skills                    # list all skills and pick
agentry add skills Prat011/awesome-llm-skills video-downloader   # one skill (no category)
agentry add skills Prat011/awesome-llm-skills document-skills/docx  # one skill (category/name)
agentry add agents author/repo frontend                         # a whole category
agentry add profile frontend author/repo                        # apply profile/frontend.json
agentry remove skills document-skills/docx                      # remove an installed asset
agentry list Prat011/awesome-llm-skills
```

Flags: `-g, --global` (into `~/.cursor`), `--project` (current folder, default), `--dir <path>`, `-y, --yes` (no prompts; install everything matched), `-v, --version`, `-h, --help`, `--uninstall`.

When neither `--global` nor `--project` is given, an interactive terminal asks where to install; non‑interactive runs (agents/CI) default to the current project.

## How sources are discovered

For each type, `agentry` finds assets in two ways and merges them:

1. Under an explicit folder — `<type>/<name>/` or `<type>/<category>/<name>/`.
2. At the repo root by marker file (like `npx skills add`) — a folder with `SKILL.md` is a skill, `AGENT.md` an agent, `RULE.md` a rule. A root folder whose children carry markers becomes a category (e.g. `document-skills/docx`).

Selectors after the source: `category/name` (one asset), `name` (one asset when uncategorized), `category` (whole category), or omit to list-and-pick.

Assets install to `<root>/.cursor/<type>/[category/]<name>/` and are tracked in `.cursor/agentry.lock.json` for idempotent installs and clean removal. `remove` works purely on installed files, so it needs no source.

## Profiles

A profile is a plain JSON file at `profile/<name>.json` in your project. It lists selectors per type; `agentry add profile <name> <source>` fetches the source once and installs everything the profile lists.

```json
{
  "repo": "author/repo",
  "agents":  ["frontend"],
  "skills":  ["prompt/enhance-prompt"],
  "rules":   ["workflow/ask-dont-guess"]
}
```

`repo` is optional — the command-line `<source>` wins when given. See [`profile/frontend.json`](profile/frontend.json) and [`profile/backend.json`](profile/backend.json).

## Publish to npm (maintainers)

```bash
# ensure package.json "name" is available (or scope it: @you/agentry)
npm login
npm publish --access public
# verify
npx agentry@latest --version
```

## Development / test

```bash
npm test                 # node --test (discovery, source resolution, install/remove, profiles)
node bin/agentry.js …    # run the CLI locally
node bin/agentry.js list ./examples   # try it against the bundled sample source
```

`examples/` is a sample source repo (skills/agents/rules/scripts) used by the demo — not part of the CLI. `src/` holds the logic: `registry` (discovery), `source` (fetch), `commands` (install/remove), `profile` (config).

## License

MIT
