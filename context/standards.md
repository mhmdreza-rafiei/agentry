Standards
-----------------
How code is written in agentry. Keep it boring, small, and minimal-dep.

## Engineering mindset

- Lazy senior dev: the best code is the code never written. Climb the ladder — stdlib first, existing helper next, then write the minimum that works.
- Bug fix = root cause, not symptom. Fix the shared function once.
- One runnable check for non-trivial logic (a vitest test). Trivial one-liners need no test.
- Mark deliberate simplifications with a `ponytail:` comment naming the ceiling and upgrade path.

## Files and folders

- Folders: lowercase, one word when possible, max two (`src`, `tests`, `context`, `bin`).
- Files: snake_case stems; do not repeat the parent folder name; do not embed language/format tokens (`py`, `ts`) in stems; do not duplicate words.
- Group related files into a subfolder when 2+ files form a set (e.g. `src/ui/`, `src/core/`); otherwise keep one file.
- Root/well-known agent docs: UPPERCASE stem (`AGENTS.md`, `README.md`, `LICENSE`). Other docs: lowercase snake.

## Code style

- TypeScript ESM, strict; `import`/`export`. Use `.js` specifiers in relative imports (resolve to `.ts`).
- Minimal intentional runtime deps (`@clack/prompts`, `picocolors`, `yaml`, `zod`, `xdg-basedir`, `@vercel/detect-agent`); UI libs bundled by `obuild`. No new dep without explicit approval.
- Functions are small and pure where possible; side effects (fs, stdout, network) live at the edges (CLI router, git fetcher, commands, ui).
- No abstractions that were not requested. No boilerplate nobody asked for.
- Comments only for non-obvious intent, trade-offs, or constraints — never narrate what the code does.

## Testing

- `npm test` runs `vitest` (sources in `tests/`).
- Tests build a throwaway fixture source in a temp dir — no network, no fixtures checked in.
- One test per behavior; assert with vitest `expect`.
- Keep the suite fast and hermetic.

## Rules

- TypeScript ESM, Node >=22.20. Minimal intentional runtime deps; no new dep without explicit approval.
- No hardcoded paths in any asset or template.
- Deletion over addition. Boring over clever. Fewest files possible.

## Relations

- architecture.md [ Context ] — systems and boundaries the standards apply to.
- overview.md [ Context ] — project scope.
- plan.md [ Context ] — planned changes (must still meet these standards).
