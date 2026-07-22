Overview
-----------------
`agentry` is a raw installer CLI for AI/agent tooling. It fetches **agents, skills, rules, scripts, and profiles** from any Git repo (or local path) and installs the selected ones into a project (or globally). The CLI ships no assets of its own — you point it at a source. It mirrors the clean Clack-style UX of `vercel-labs/skills` and extends it beyond skills-only.

## About

- One CLI, TypeScript ESM, Node >=22.20. Minimal runtime deps (`@clack/prompts`, `picocolors`, `yaml`, `zod`, `xdg-basedir`, `@vercel/detect-agent`); UI libs bundled by `obuild` into `dist/`.
- Sources: local path, GitHub `author/repo` shorthand, full GitHub URL, GitHub tree subdir URL, GitLab URL, or any git URL (shallow-cloned to temp).
- Discovery is dual-mode: explicit `<kind>s/[category/]<name>/` folders **and** repo-root marker files (`SKILL.md` / `.mdc`), so generic skill repos work. Scripts and profiles are folder/file kinds found only under their `scripts/` and `profiles/` folders.
- Install target is the provider's directory (project or global), tracked in `.agentry/lock.json` (legacy: `.cursor/agentry.lock.json` is read once then migrated). Idempotent; `remove` works from the lockfile/filesystem and needs no source.
- **Universal install:** providers whose skills dir is `.agents/skills/` (Cursor, Codex, OpenCode, Gemini CLI, Cline, Amp, Zed, Warp, GitHub Copilot, …) share one canonical install at `.agents/skills/<id>`; non-universal providers (Claude Code, Windsurf, Goose, Roo, Augment, Continue, …) get a symlink to it. `--copy` makes independent copies instead.
- Artifact kinds: `skill | rule | agent | profile | script` (singular; plurals accepted).

## Problem

Existing agent/skill tooling is fragmented across providers (Cursor, Claude Code, Codex, OpenCode, …). Each provider has its own install layout. `agentry` aims to be one portable installer that fetches from any source and installs into any provider's directory.

## Does

- Fetch artifacts from a Git source or local path.
- Discover artifacts by folder convention or root marker file (dual-mode).
- Install selected artifacts into the target provider directory, idempotently (universal `.agents/skills` canonical + symlinks; `--copy` for independent copies).
- Remove installed artifacts without needing the source.
- Apply profiles (bundled artifact + target + scope configs) against a source.
- Auto-detect installed providers; prompt "Which agents do you want to install to?" (universal locked + others selectable) when no `--agent`; target specific ones with `--agent`; preview with `--list`.
- Animated robot logo + spinner-step fetch animation on a TTY; suppress interactive UI automatically when running inside an agent or CI.

## Does not

- Bundle any artifacts of its own.
- Run agents or skills — it only installs files.
- (Yet) ship `doctor`, `find`, `use`, `init`, or per-provider rules adapters beyond install paths — see plan.md.

## User flow

1. User runs `agentry add <kind> <source> [selector]`.
2. CLI resolves the source (local path used as-is; remote shallow-cloned to temp) with a spinner ("Parsing source…").
3. CLI discovers matching artifacts (folder convention + root markers, unioned) with a spinner ("Discovering…") and prints "Found N".
4. If no selector and multiple matches on a TTY, prompts the user to pick artifacts (with an `All` toggle).
5. CLI prompts "Which agents do you want to install to?" (universal locked + others selectable, defaulting to installed providers).
6. CLI installs each selected artifact (universal canonical + symlinks) into the provider's directory and records it in the lockfile.

## Target users

- Developers using AI coding agents who want to install community skills/agents/rules.
- Skill/agent authors who want a portable installer for their repo.
- CI/agent runs that need non-interactive installs.

## Success criteria

- `npm test` passes (vitest, no network).
- `node dist/cli.mjs <action>` works for add/remove/list/update against local and remote sources.
- Installs are idempotent; removes are source-free.
- Dual-mode discovery works against real-world skill repos (verified against `Prat011/awesome-llm-skills`).

## Rules

- TypeScript ESM, Node >=22.20. Minimal intentional runtime deps; no new dep without explicit approval.
- No hardcoded paths in any asset or template.
- Discovery must stay dual-mode (folder + root marker) — that is what makes generic skill repos work.
- Install/remove are idempotent; remove is source-free.
- Tests build a throwaway fixture source in a temp dir — they do not hit the network.

## Relations

- architecture.md [ Context ] — systems, boundaries, folder structure.
- standards.md [ Context ] — code style and conventions.
- plan.md [ Context ] — roadmap (rules adapters, doctor, find/use/init).
- libraries.md [ Context ] — dependencies and tooling.
- memory/progress.md [ Memory ] — current state + handoff.
