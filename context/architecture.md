Architecture
-----------------
How Agentry is structured: CLI router, commands, core, registry, artifacts, UI.

## Stack

- TypeScript ESM, strict; Node >=22.20.
- Deps: `@clack/prompts`, `picocolors`, `yaml`, `zod`, `xdg-basedir`, `@vercel/detect-agent`.
- Build: `obuild` → `dist/cli.mjs`. Tests: `vitest` (`tests/core.ts`, hermetic).

## Folder structure

```
agentry/
  bin/cli.mjs
  src/
    cli.ts                 Router + help/self-update/uninstall + optional kind routing
    commands.ts            add / remove / list / update / init
    core/
      types.ts
      source_parser.ts     parse + sourceIdentity / sourcesEqual
      git.ts               resolveSource (clone + cache fallback)
      web.ts               resolveWebSource (hub/website and HTML resolver)
      lock.ts              .agentry/lock.json, installOne, remove + prune, safe copyTreeDereferenced
    registry/agents.ts     70+ providers, universal helpers
    artifacts/
      discovery.ts         dual-mode root & folder discovery + selectAll
      ignore.ts            .agentryignore / .agentry.ignore parser + matcher
      profiles.ts
      scaffold.ts          init templates
    ui/
      theme.ts             sky primary, ASCII AGENTRY logo, printHelp
      prompts.ts           select + sky confirm + installSummary
      search_multiselect.ts
      detect.ts
  tests/core.ts
  context/                 shared agent context
  README.md                public GitHub docs
```

## Systems (short)

- **cli** — kinds singular/plural, optional on add/remove; `list` grammar: installed | kind | source [kind] [selector]; `init`; flags include `--description`, `--alwaysApply`, `--reference`, `--skills|agents|rules|scripts`.
- **discovery** — dual-mode: `<kind>s/` folders AND root markers (`SKILL.md`, `AGENT.md`, `RULE.md`, `.cursorrules`, `profile.yaml`, scripts).
- **ignore** — `.agentryignore` / `.agentry.ignore` glob matcher + built-in ignores (`.git`, `node_modules`, etc.).
- **git** — shallow clone; save to `~/.cache/agentry/repos`; on failure ask (or `-y`) to load cache.
- **lock** — skills always copy to `.agents/skills/<id>` (VCS/ignored files excluded); remove deletes files + empty parents; empty lock removes `.agentry/`.
- **list** — panel-style installed inventory or source discovery.
- **UI** — sky `#38bdf8`; compact Universal line; short agent viewport to avoid Windows redraw stacking.

## Data flow (add)

```
cli → parseSource → resolveSource → discover (ignore-filtered) → selectArtifacts → selectAgents → installOne → lock
```

## Rules

- Core/registry/artifacts stay pure (no stdout); UI via `src/ui`.
- Dual-mode discovery stays.
- No new deps without approval.
