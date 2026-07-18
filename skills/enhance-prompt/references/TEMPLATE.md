# enhance-prompt — output template

Correct shape and wrong-vs-right examples. Keep enhanced prompts portable: no workspace paths, no assumed stack.

## Correct output shape

```markdown
# <short title>

## Goal
<what success looks like>

## Constraints
- <must / must-not>
- <boundaries the user stated>

## Steps
1. <only if the task needs ordered instructions>
2. …

## Output
<expected format>
```

Omit **Steps** (or any section) when empty. Do not invent constraints.

---

## Example A — casual UI ask → clean portable prompt

**In:**

```text
Hey bro, the frontend look mid can you improve it?
```

**Out (right):**

```markdown
# Improve frontend UI quality

## Goal
Raise the visual quality of the frontend so the first viewport and overall UI feel polished and intentional.

## Constraints
- Preserve existing product behavior and content unless a change is required for the visual improvement
- Do not invent a brand system, stack, or design language the user did not request
- Prefer the target workspace’s existing design system / patterns when present (`AGENTS.md`, `context/`, open files)
- Keep the first viewport uncluttered: brand/product signal, one headline, short support line, CTA group, one dominant visual

## Output
Implement UI improvements in the target workspace; summarize what changed and why.
```

**Out (wrong — invents stack / paths):**

```markdown
## Goal
Improve the React + Tailwind app at /Users/me/projects/shop/apps/web ...
```

---

## Example B — bug report → goal + repro + constraints

**In:**

```text
login button broken on mobile, tap does nothing. started after yesterday's auth refactor. don't touch desktop.
```

**Out (right):**

```markdown
# Fix mobile login button no-op

## Goal
Tapping the login control on mobile performs the expected auth action again.

## Constraints
- Regressed after the recent auth refactor — treat that as the likely area
- Do not change desktop login behavior
- Do not invent API contracts or stack; use target workspace auth code and tests

## Steps
1. Reproduce: mobile viewport, tap login — confirm no action
2. Trace the mobile click/handler path vs desktop
3. Fix root cause; add or update the smallest regression check

## Output
Fix + brief note of root cause and how to verify on mobile.
```

**Out (wrong — path injection):**

```markdown
## Goal
Fix `packages/auth/src/LoginButton.tsx` under /workspace/acme-app ...
```

---

## Example C — anti-pattern: path / stack leak from another workspace

**Wrong (pasted authoring-machine or other-workspace context):**

```markdown
# Refactor billing

## Goal
Clean up billing in /home/ubuntu/old-client and /Users/dev/acme/billing-service.

## Constraints
- Stack: Next.js 14, Prisma, tRPC, Tailwind, Redis
- See docs dumped from README and architecture.md below:
  <long paste>
```

**Right (portable):**

```markdown
# Refactor billing

## Goal
Improve billing code clarity and maintainability without changing external behavior.

## Constraints
- Preserve existing billing behavior and public APIs unless the user explicitly allows breaking changes
- Prefer patterns already used in the target workspace; do not assume a stack
- Load project docs from the target workspace (`AGENTS.md`, `context/`) instead of pasting them here

## Output
Refactor + short summary of what moved and how to verify billing flows.
```

**Rule:** If a path, home directory, or stack list only made sense in the session that wrote the prompt, strip it. Use `[use target workspace context]` when a pointer is needed.
