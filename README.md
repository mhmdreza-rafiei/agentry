# comprehensive-skills

A portable Agent Skills package. Skills are installable folders (`skills/<name>/SKILL.md`) that coding agents load on demand.

First skill: **`enhance-prompt`** — rewrites casual or vague chat into precise, portable agent instructions without injecting workspace paths, stack, or session-local context.

## Install

```bash
# All skills from this repo
npx skills add mhmdreza-rafiei/comprehensive-skills

# One skill
npx skills add mhmdreza-rafiei/comprehensive-skills --skill enhance-prompt

# Local clone / path
npx skills add ./path/to/comprehensive-skills --skill enhance-prompt

# Global (all projects)
npx skills add -g mhmdreza-rafiei/comprehensive-skills --skill enhance-prompt
```

List without installing:

```bash
npx skills add mhmdreza-rafiei/comprehensive-skills --list
```

## Layout

```
skills/
  <skill-name>/
    SKILL.md          # required — frontmatter + instructions
    references/       # optional — templates, examples (progressive disclosure)
    scripts/          # optional
    assets/           # optional
AGENTS.md             # agent entrypoint for this repo
```

The `skills` CLI discovers skills one level under `skills/` (and catalog layouts under `skills/<group>/<name>/`). Keep each skill in its own folder to avoid path conflicts.

## Add a new skill

1. Create `skills/<skill-name>/SKILL.md` with YAML frontmatter (`name`, `description`). `name` must match the folder name.
2. Keep `SKILL.md` lean; put long examples/templates in `references/`.
3. Document the skill in this README and list it under **Project Skills** in `AGENTS.md` when it ships from this repo.
4. Validate discovery:

```bash
npx skills add . --list
```

Authoring helpers for writing skills are listed in `AGENTS.md` (e.g. `/skill-writer`, `/skill-creator`).

## Always-on `enhance-prompt`

On demand by default. To rewrite every user message before acting, see **Always-on skills** in `AGENTS.md` and the Always-on section in `skills/enhance-prompt/SKILL.md`.

## License

MIT
