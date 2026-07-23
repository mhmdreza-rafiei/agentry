Plan
-----------------
Agentry roadmap — skills-parity CLI extended for agents/skills/rules/profiles/scripts.

## Core principles

- TypeScript ESM, Node >=22.20; minimal deps; hermetic vitest.
- Dual-mode discovery; idempotent install/remove.
- Public README oriented at GitHub visitors; example catalog `mhmdreza-rafiei/agent-tools`.

## Done

1. TS ESM stack + 70+ providers + universal `.agents/skills`.
2. add / remove / update / list / init / uninstall.
3. Source-aware remove/update; git clone cache; empty-folder prune.
4. Sky UI + searchable multiselect; action-aware agent prompts.
5. Expanded `list` (installed + source + kind + selector).
6. Public README refresh; docs logo removed from tree (user choice).

## Next

1. Rules adapters (canonical → per-agent surfaces).
2. `doctor` — lock integrity, broken symlinks, provider detection.
3. `find` — search catalogs by name/description.
4. Conflict policy on install (skip/overwrite/merge).
5. Export/snapshot installs as a profile.
6. Lock ProfileSchema once product decisions settle.

## Open

- Profile schema still draft.
- Rules adapter coverage vs universal fallback.
- GitHub Contributors UI may lag after history rewrite (see community discussion #186158).
