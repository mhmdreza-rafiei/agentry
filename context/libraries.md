Libraries
-----------------
Dependencies and tooling for agentry. Minimal and intentional; UI libs are bundled by `obuild` so the published package stays small.

## Runtime

- `@clack/prompts` — interactive prompts (intro/outro/confirm/multiselect/select/spinner). For: clean skills-parity UX. Not for: non-interactive/CI (suppressed via `src/ui/detect.ts`).
- `picocolors` — terminal colors. For: theme + logo gradient. Not for: logic.
- `yaml` — parse profile YAML. For: `profile/<name>.yaml` and `profiles/<name>.yaml` in sources.
- `zod` — profile schema validation. For: `ProfileSchema` in `src/artifacts/profiles.ts`.
- `xdg-basedir` — XDG paths. For: global config dir resolution.
- `@vercel/detect-agent` — detect if running inside an agent. For: `isCI()` to suppress interactive UI.

## Dev / build / test

- `typescript` — strict ESM typecheck (`npm run typecheck`).
- `tsx` — run TS directly in dev (`npm run dev`).
- `obuild` — bundle `src/cli.ts` -> `dist/cli.mjs` (UI libs bundled in; `npm run build`).
- `vitest` — test runner (`npm test`, sources in `tests/`).
- `@types/node` — Node type defs.

## External tools used at runtime

- `git` — required only for remote sources (shallow clone to temp). Local sources need no git.
- `npm` — required only for `agentry update` (self-update) and `agentry uninstall`.

## Not used (and why)

- Ink/React, oclif, chalk, Inquirer — deferred per the research report; Clack + picocolors cover the UX bar with less weight.
- `simple-git` — not added; `git` is invoked via `child_process.execFileSync` (thin spawn) for the shallow clone.

## Rules

- Do not add a runtime dependency without explicit approval.
- If a dep is added, document it here with for / not for / how.
- Keep UI libs bundled by `obuild` so the published `dist/` is self-contained.

## Relations

- standards.md [ Context ] — "minimal intentional runtime deps" rule lives here too.
- architecture.md [ Context ] — stack and folder structure.
