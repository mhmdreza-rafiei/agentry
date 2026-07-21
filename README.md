# agentry

One CLI to install **agents, skills, rules, and scripts** into any project — or globally — for portable AI/agent tooling. No cloning, no copy‑pasting folders: run one command and `agentry` scaffolds the right files (e.g. under `.cursor/`) for you.

## Install / run

```bash
# Run without installing (recommended)
npx agentry@latest --help

# Or install the CLI globally
npm install -g agentry@latest
```

> Publishing to npm is pending; until then run it from a clone with `node bin/agentry.js …` or `npx . …`.

## Usage

```
agentry <action> <target> [name] [options]
```

```bash
agentry add skills                   # add all skills (asks: project or global)
agentry add skills enhance-prompt    # add one skill
agentry add agents frontend-developer
agentry add rules ask-dont-guess
agentry add frontend                 # add a whole profile (e.g. frontend / backend / all)
agentry remove skills enhance-prompt
agentry list                         # show available assets + profiles
agentry update                       # update the agentry CLI itself
```

Flags: `-g, --global` (install into `~/.cursor`), `--project` (current folder, default), `--dir <path>`, `-y, --yes` (no prompts), `-v, --version`, `-h, --help`, `--uninstall`.

When neither `--global` nor `--project` is given, an interactive terminal asks where to install; non‑interactive runs (agents/CI) default to the current project.

## Asset types & profiles

| Type | Folder | Ships with |
|------|--------|------------|
| agents | `agents/<name>/` | `frontend-developer` (starter) |
| skills | `skills/<name>/SKILL.md` | `enhance-prompt` |
| rules | `rules/<name>/` | `ask-dont-guess` (starter) |
| scripts | `scripts/<name>/` | `doctor` (starter) |

Profiles group assets so a project can install a curated set at once. Defined in [`profiles.json`](profiles.json): `all`, `frontend`, `backend` (extend as needed).

Assets install to `<root>/.cursor/<type>/<name>/` (`<root>` = current folder for project, `~` for global) and are tracked in `.cursor/agentry.lock.json` for idempotent installs and clean removal.

## Layout

```
agents/   <name>/                 # agent definitions
skills/   <name>/SKILL.md         # skills (also discoverable by the `skills` CLI)
rules/    <name>/                 # rules
scripts/  <name>/                 # scripts
profiles.json                     # profile → asset sets
bin/agentry.js                    # CLI entrypoint
src/                              # CLI logic (registry, commands)
AGENTS.md                         # agent entrypoint for this repo
```

Each asset lives in its own folder and may include an optional `agentry.json` (`name`, `type`, `description`). Descriptions otherwise come from `SKILL.md` / `AGENT.md` / `RULE.md` frontmatter.

## Add a new asset

1. Create `<type>/<name>/` with its content (for skills: `SKILL.md` with `name`/`description` frontmatter matching the folder).
2. Optionally add `<type>/<name>/agentry.json` for metadata.
3. Add the asset to any relevant profile in `profiles.json`.
4. Verify: `node bin/agentry.js list` (and `npx skills add . --list` for skills).

## Skills also work with the `skills` CLI

Skills keep the `skills/<name>/SKILL.md` convention, so they remain installable via the external tool too:

```bash
npx skills add . --list
npx skills add . --skill enhance-prompt
```

## Development

```bash
npm test                 # node --test (registry + install/remove + profiles)
node bin/agentry.js …    # run the CLI locally
```

## License

MIT
