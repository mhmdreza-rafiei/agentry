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
    cli.ts                 Router + help/self-update/uninstall
    commands.ts            add / remove / list / update / init
    core/
      types.ts
      source_parser.ts     parse + sourceIdentity / sourcesEqual
      git.ts               resolveSource (clone + cache fallback)
      lock.ts              .agentry/lock.json, installOne, remove + prune
    registry/agents.ts     70+ providers, universal helpers
    artifacts/
      discovery.ts
      profiles.ts
      scaffold.ts          init templates
    ui/
      theme.ts             sky primary, ASCII AGENTRY logo, printHelp
      prompts.ts           select + sky confirm + installSummary
      search_multiselect.ts
      detect.ts
  tests/core.ts
  context/                 shared agent context
  README.md                public GitHub docs (no docs/ logo asset)
```

## Systems (short)

- **cli** — kinds singular/plural; `list` grammar: installed | kind | source [kind] [selector]; `init`; flags include `--description`, `--alwaysApply`, `--reference`, `--skills|agents|rules|scripts`.
- **git** — shallow clone; save to `~/.cache/agentry/repos`; on failure ask (or `-y`) to load cache.
- **lock** — skills always copy to `.agents/skills/<id>`; remove deletes files + empty parents; empty lock removes `.agentry/`.
- **list** — panel-style installed inventory or source discovery.
- **UI** — sky `#38bdf8`; compact Universal line; short agent viewport to avoid Windows redraw stacking.

## Data flow (add)

```
cli → parseSource → resolveSource → discover → selectArtifacts → selectAgents → installOne → lock
```

## Rules

- Core/registry/artifacts stay pure (no stdout); UI via `src/ui`.
- Dual-mode discovery stays.
- No new deps without approval.
