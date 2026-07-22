# agentry

A raw installer for AI/agent tooling. `agentry` fetches **agents, skills, rules, and profiles** from any Git repo (or local path) and installs the ones you pick into your project — or globally — under each target provider's directory (`.cursor/`, `.claude/skills/`, etc.). The CLI ships no assets of its own; you point it at a source. It mirrors the clean Clack-style UX of [`vercel-labs/skills`](https://github.com/vercel-labs/skills) and extends it beyond skills-only. Supports 70+ agent providers.

## Install / run

```bash
# Run without installing (recommended)
npx agentry@latest --help

# Or install the CLI globally
npm install -g agentry@latest

# Update / uninstall the CLI
agentry update
agentry uninstall
```

> Publishing to npm is pending. Until then, run from a clone: `node dist/cli.mjs …` (after `npm run build`) or `npm run dev -- …`.

## Usage

```
agentry add <kind> <source> [category/name | category] [options]
agentry add profile <name> [source] [options]
agentry remove <kind> [category/name | category] [options]
agentry list [source] [kind]
agentry update [kind] [source] [selector]
agentry uninstall
```

`<kind>` is `skill | rule | agent | profile` (singular; plurals like `skills` are accepted and normalized). `<source>` is a GitHub shorthand `author/repo`, a full GitHub URL, a GitHub tree subdir URL, a GitLab URL, any git URL, or a local path.

```bash
agentry add skills Prat011/awesome-llm-skills                    # list all skills and pick
agentry add skills Prat011/awesome-llm-skills video-downloader    # one skill (no category)
agentry add skills Prat011/awesome-llm-skills document-skills/docx  # one skill (category/name)
agentry add skills ./my-skills --list                            # preview only, no install
agentry add skills ./my-skills prompt/enhance-prompt -a cursor -a claude-code  # install to 2 providers
agentry add agents author/repo frontend-developer               # one agent (.mdc file)
agentry add rules author/repo ask-dont-guess                    # one rule (.mdc file)
agentry add profile frontend author/repo                        # apply profile/frontend.yaml
agentry remove skills document-skills/docx                      # remove an installed artifact
agentry list author/repo
agentry update                                                  # self-update (checks version first)
agentry update skills author/repo prompt/enhance-prompt         # re-install one artifact from source
agentry update skills                                           # re-install all skills from lockfile sources
agentry uninstall                                               # remove the CLI
```

Flags: `-g, --global` (into `~`), `--project` (current folder, default), `--dir <path>`, `-a, --agent <name>` (repeatable; `*` for all; default: auto-detect installed agents), `-l, --list` (preview, no install), `--copy` (copy files instead of symlinking), `--all` (install everything to all agents, no prompts), `-y, --yes` (no prompts), `-v, --version`, `-h, --help`.

When neither `--global` nor `--project` is given, an interactive terminal asks where to install; non-interactive runs (agents/CI) default to the current project. The interactive UI (logo, spinners, prompts) is suppressed automatically when running inside an agent or CI.

## How sources are discovered

For each kind, `agentry` finds artifacts in two ways and merges them:

1. Under an explicit `<kind>s/` folder (see artifact layouts below).
2. At the repo root by marker — a folder with `SKILL.md` is a skill; a `.mdc` file at root is an agent or rule.

Selectors after the source: `category/name` (one artifact), `name` (one artifact when uncategorized), `category` (whole category), or omit to list-and-pick.

Artifacts install to the provider's directory and are tracked in `.cursor/agentry.lock.json` for idempotent installs and clean removal. `remove` works purely on installed files, so it needs no source.

## Artifact layouts (how to create installable tools)

Create artifacts in your repo using these layouts, then `agentry add` from your repo:

### Skills — folder per skill

```
skills/
  enhance-prompt/
    SKILL.md            # YAML frontmatter: name, description
    references/
      TEMPLATE.md       # optional supporting docs
    ...
```

`SKILL.md` frontmatter:

```yaml
---
name: enhance-prompt
description: Rewrite a user message into a precise, portable agent prompt.
---
# enhance-prompt
Instructions for the agent...
```

Categorized skills: `skills/<category>/<name>/SKILL.md`.

### Agents — single `.mdc` file

```
agents/
  frontend-developer.mdc
```

`.mdc` frontmatter (same shape as skills):

```yaml
---
name: frontend-developer
description: Senior frontend engineer agent.
---
# frontend-developer
Agent instructions...
```

Categorized agents: `agents/<category>/<name>.mdc`.

### Rules — single `.mdc` file

```
rules/
  ask-dont-guess.mdc
```

Same frontmatter and body shape as agents. Categorized rules: `rules/<category>/<name>.mdc`.

### Profiles — single `.yaml` file (in a source repo)

```
profiles/
  frontend.yaml
```

A profile bundles artifact selectors + target agents + scope into one config. See the **Profiles** section below for the schema. Categorized profiles: `profiles/<category>/<name>.yaml`.

## How to install tools with agentry

```bash
# From a GitHub repo (author/repo shorthand)
agentry add skills Prat011/awesome-llm-skills

# From a full GitHub URL
agentry add skills https://github.com/Prat011/awesome-llm-skills

# From a subdirectory of a repo (GitHub tree URL)
agentry add skills https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design

# From a GitLab URL
agentry add skills https://gitlab.com/org/repo

# From any git URL
agentry add skills git@github.com:owner/repo.git

# From a local path
agentry add skills ./my-skills

# Install to specific providers
agentry add skills ./my-skills enhance-prompt --agent cursor --agent claude-code

# Install to all providers
agentry add skills ./my-skills enhance-prompt --agent '*'

# Preview without installing
agentry add skills ./my-skills --list
```

## Supported providers

`agentry` installs into 70+ agent providers, mirroring vercel-labs/skills. Each provider has a project skills directory and a global one. A few common ones:

| Provider | `--agent` | Project path | Global path |
|----------|-----------|--------------|-------------|
| Cursor | `cursor` | `.cursor/skills/` | `~/.cursor/skills/` |
| Claude Code | `claude-code` | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `codex` | `.agents/skills/` | `~/.codex/skills/` |
| OpenCode | `opencode` | `.agents/skills/` | `~/.config/opencode/skills/` |
| Gemini CLI | `gemini-cli` | `.agents/skills/` | `~/.gemini/skills/` |
| Windsurf | `windsurf` | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` |
| Cline | `cline` | `.agents/skills/` | `~/.agents/skills/` |
| Amp | `amp` | `.agents/skills/` | `~/.config/agents/skills/` |
| Goose | `goose` | `.goose/skills/` | `~/.config/goose/skills/` |
| Roo Code | `roo` | `.roo/skills/` | `~/.roo/skills/` |
| GitHub Copilot | `github-copilot` | `.agents/skills/` | `~/.copilot/skills/` |
| Augment | `augment` | `.augment/skills/` | `~/.augment/skills/` |
| Continue | `continue` | `.continue/skills/` | `~/.continue/skills/` |
| Zed | `zed` | `.agents/skills/` | `~/.agents/skills/` |
| Warp | `warp` | `.agents/skills/` | `~/.agents/skills/` |

...and 55+ more. The CLI auto-detects installed providers; pass `--agent` to target specific ones or `--agent '*'` for all.

## Profiles

A profile is a YAML file at `profile/<name>.yaml` in your project. It bundles artifact selectors, target agents, and scope; `agentry add profile <name> <source>` fetches the source once and installs everything the profile lists.

```yaml
name: frontend
description: Frontend agents, rules, and skills
scope: project          # project | global
targets:
  agents: [cursor, claude-code]   # target providers; '*' = all
artifacts:
  skills:
    - id: prompt/enhance-prompt
  agents:
    - id: frontend-developer
  rules:
    - id: ask-dont-guess
```

Each artifact ref may override the CLI source with its own `source:`. The command-line `<source>` is the default for refs without one.

## Development / test

```bash
npm run typecheck        # tsc --noEmit
npm test                 # vitest (discovery, source parser, agents registry, install/remove, profiles)
npm run build            # obuild -> dist/cli.mjs
npm run dev -- …         # run via tsx (no build needed)
node dist/cli.mjs …      # run the built CLI
```

`src/` holds the logic: `cli.ts` (router), `commands.ts` (handlers), `core/` (types, source-parser, git, lock), `registry/agents.ts` (70+ providers), `artifacts/` (discovery, profiles), `ui/` (theme, prompts, detect). Runtime deps are minimal and UI libs are bundled by `obuild`.

## License

MIT
