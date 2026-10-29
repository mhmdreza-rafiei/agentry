Progress
-----------------
Live handoff for Agentry.

## Current state

Public-facing CLI on `main`. History rewritten to remove Cursor Agent authorship and `Co-authored-by: Cursor` trailers (per GitHub community discussion #186158). Backup at sibling `.git-backup-agentry-*` under `G:\Projects\`.

## Features added

- **Root Discovery (All Kinds)**:
  - Discovers standalone root `SKILL.md` (single-skill repositories) parsing frontmatter `name` and `description`.
  - Discovers root `AGENT.md`, `RULE.md`, `.cursorrules`, and root `.mdc` files.
  - Discovers root `profile.yaml`, `*.profile.yaml`, and local `profile/<name>.yaml` configs.
  - Discovers root scripts (`run.sh`, `script.sh`, `run.js`, `main.py`).
  - Added `'script'` to `listAll()`.
- **Ignore Rules (`.agentryignore` / `.agentry.ignore`)**:
  - Zero-dependency glob matcher (`#` comments, wildcards `*`/`**`, directory slashes).
  - Default ignores built-in (`.git`, `.github`, `node_modules`, `.agents`, `.agentry`, `.cursor`, `.claude`, `dist`, `build`).
  - Ignored directories and files are omitted during discovery and excluded during installation tree copying (ensuring `.git` is never installed into `.agents/skills/<name>`).
- **Optional Kind in CLI Routing**:
  - `agentry add <source> [selector]` discovers and installs without requiring `skill` or `all`.
  - `agentry remove [source] <selector>` works with optional kind.
  - `selectAll(root, selector)` filters across all kinds.
- **Web / Skill Hub Installation (`add from <url>`)**:
  - `agentry add from <url> [selector]` / `agentry from <url>` / `agentry add <url>`.
  - Resolves arbitrary websites and hubs (e.g. `awesomeskill.ai/skill/...`): auto-detects embedded GitHub tree URLs, canonical repo links, GitHub Gists, or direct raw markdown / embedded HTML `<pre><code>` code blocks.
  - Zero external dependencies: powered by Node standard `http`/`https`.
  - Recorded in `.agentry/lock.json` as `web:<url>`.
- **Unit Tests**:
  - 31 hermetic vitest tests in `tests/core.ts` (all passing).

## Verify

- No `Co-authored-by: Cursor` in `git log --all --grep=...`
- Authors are `mhmdreza rafiei <mhmdrezacode@gmail.com>` (or user variants)
- `npm test` / `typecheck` / `build` when touching code

## Follow-ups

- Wait for GitHub Contributors cache to drop Cursor (can take hours/days after rewrite; see discussion #186158).
- Confirm `mhmdreza-rafiei/agent-tools` is public for README examples.
- **npm `@mhmdreza-rafiei/agentry@0.2.2` published** (2026-07-23) via Trusted Publisher after upgrading Actions npm to ≥11.5.1 for OIDC. Bump `package.json` version then push `main` for each release.
- GitHub sidebar **Packages** = GitHub Packages only; npmjs packages do not appear there (expected empty).
- Dependabot/vite-esbuild alerts cleared by upgrading `vitest` to ^4.1.10 (`npm audit` → 0).
- Security hardening (2026-07-23 audit): install `cpSync` uses `dereference: true`; subpath containment; `execFileSync` for npm self-update; Action SHA pins + Dependabot for Actions; ref validation + URL redaction.
- Interactive **Installation scope** (Project vs Global) after agent pick when `-g`/`-p`/`-d` omitted; shortcuts `-p`/`-d` — on npm from 0.2.2.
- Tip: turn off Cursor Settings → Agents → Attribution; local `.git/hooks/prepare-commit-msg` strips reinjected trailers.
