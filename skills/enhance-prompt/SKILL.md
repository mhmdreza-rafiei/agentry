---
name: enhance-prompt
description: >
  Use when the user asks to enhance, improve, rewrite, optimize, or clarify a prompt —
  or when always-on prompt enhancement is enabled for the session.
  Rewrites casual or vague chat into precise, portable agent instructions
  without injecting workspace paths, stack, or session-local context.
---

# enhance-prompt

Rewrite the user’s message into a precise, portable agent prompt. Improve clarity and structure; do **not** invent requirements or paste workspace-local context.

For output shape and wrong-vs-right examples, open [references/TEMPLATE.md](references/TEMPLATE.md).

## Procedure

Apply all five passes below, in order. Then deliver the enhanced prompt (and optional summary).

### 1) Full-text enhance

- Fix grammar, wording, clarity; prefer precise verbs.
- Remove filler, noise symbols, decorative separators, emojis.
- Preserve user intent and constraints; never invent requirements, brand systems, stack, or scope the user did not ask for.

### 2) Context policy (non-negotiable)

**Prompt context must be portable and session-safe.**

**Include only:**

- Intent, goal, constraints, acceptance criteria
- New facts the session may not already have (bugs, errors, decisions, do / don’t)
- Explicit user-supplied details meant to travel with the prompt

**Never inject:**

- Absolute or relative project/workspace folder paths
- Repo roots, home paths, machine-specific paths
- Tech stack / framework / language lists the target workspace already provides via `AGENTS.md`, `context/`, rules, or open files
- Long dumps of docs already loadable by the agent in the *target* workspace
- Paths or facts from the *current* workspace when the enhanced prompt will be used in a *different* workspace

Rules of thumb:

- If the agent can read it from the target workspace, do not paste it into the prompt.
- If unsure whether context is session-local, omit it or use a short placeholder like `[use target workspace context]`.
- Casual chat is enough input — enhance structure, not invent environment.

### 3) Structure / layout enhance

Reorganize into a clear prompt. Use only sections that have content; drop empty ones.

- **Title / short description** — when helpful
- **Goal** — what success looks like
- **Constraints** — boundaries, must / must-not
- **Steps** — ordered instructions only if the task needs them
- **Output** — expected format

Move unrelated bits into the right section. Keep one structure; do not nest duplicate Context/Objective blocks.

### 4) Token optimization

- Same or better meaning, fewer tokens.
- Strip decorative banners (`---- Header ----`), redundant headers, fluff.
- Prefer short imperative lines over essays.

### 5) Enhancement summary (optional, short)

After the enhanced prompt, add a **brief** summary of what changed — only when:

- the chat is not already overloaded, **and**
- the user did not disable summaries

Skip the summary if context is large/expanding or the user said not to.

## Always-on mode

If the user asks to enhance every chat / every prompt:

1. Create or update `AGENTS.md` in the **target** project.
2. Add a **Skills** section distinguishing when-to-use vs always-use.
3. Register `enhance-prompt` as always-on, e.g.:

```yaml
alwaysApply: true
```

Always-on means: rewrite the user’s message into a better agent prompt **before** acting — still obeying the context policy above.

## Output

1. Deliver the enhanced prompt in a single copy-ready block.
2. Optionally append a short summary (pass 5).
3. Do not announce skill usage unless the user asks.
