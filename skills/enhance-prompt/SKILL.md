---
name: enhance-prompt
description: >
  Use when the user asks to enhance, improve, rewrite, optimize, or clarify a prompt —
  or when always-on prompt enhancement is enabled for the session.
  Rewrites casual or vague chat into precise, portable agent instructions
  without injecting workspace paths, stack, or session-local context.
  Preserves user-stated contracts (API shapes, fields, remove/keep lists);
  attaches related skills and an after-finish summary instruction for the implementing agent.
---

# enhance-prompt

Rewrite the user’s message into a precise, portable agent prompt. **Enhance = clarify and structure — never strip user-stated details that affect accuracy.**

Do **not** invent requirements or paste workspace-local paths/stack. For shape and examples, open [references/TEMPLATE.md](references/TEMPLATE.md).

## Procedure

Apply passes 1–6 in order. Deliver one copy-ready enhanced prompt.

### 1) Full-text enhance

- Fix grammar, wording, clarity; prefer precise verbs.
- Remove filler, noise symbols, decorative separators, emojis.
- Preserve user intent and constraints; never invent requirements, brand systems, stack, or scope the user did not ask for.
- **Do not rename** user field names (`phone` stays `phone`, not `phone-number`).

### 2) Context policy (non-negotiable)

**Prompt context must be portable and session-safe.**

#### Always preserve (if present in the user input)

These are contracts — compressing them away makes results worse:

- Endpoint lists, request/response bodies, field lists (e.g. `{ phone, password, code }`)
- Remove / keep / replace lists
- Security rules, do / don’t, acceptance criteria
- Explicit open questions or ambiguities the user left unresolved
- Any detail the user wrote that changes implementation behavior

**Enhance** = reorganize and tighten wording. **Not** = delete or “summarize away” those facts.

#### Never inject

- Absolute or relative project/workspace folder paths
- Repo roots, home paths, machine-specific paths
- Tech stack / framework / language lists the target workspace already provides via `AGENTS.md`, `context/`, rules, or open files
- Long dumps of docs already loadable by the agent in the *target* workspace
- Paths or facts from the *current* workspace when the enhanced prompt will be used in a *different* workspace
- Invented field names, status codes, or API shapes the user did not state

Rules of thumb:

- If the agent can read it from the target workspace, do not paste paths/stack/docs into the prompt.
- If the user already stated a contract (fields, routes, remove list), keep it — densely.
- If unsure whether context is session-local, omit it or use `[use target workspace context]`.
- Rich input → **compress, don’t dilute**. Casual input → structure without inventing environment.

### 3) Structure / layout enhance

Use only sections that have content; drop empty ones. Keep one structure.

- **Title** — short description when helpful
- **Goal** — what success looks like
- **Contract** (optional) — desired API / bodies / remove-keep lists when the user stated them
- **Constraints** — boundaries, must / must-not
- **Steps** — ordered instructions only if needed
- **Related skills** — see pass 5
- **Output** — expected deliverable format
- **Open questions** (optional) — unresolved ambiguities; “resolve, don’t guess”
- **After you finish** — see pass 6 (always at the end of the enhanced prompt)

After drafting: **Goal ↔ Contract ↔ Constraints ↔ Steps must agree** (e.g. if register verifies OTP inside, body must include `code` unless the user said otherwise).

### 4) Token optimization

- Same or better meaning, fewer tokens — **without dropping preserved contracts**.
- Strip decorative banners, redundant headers, fluff.
- Prefer short imperative lines; keep field lists and endpoint tables compact.

### 5) Related skills

Discover skills relevant to the enhanced prompt and **attach them inside the prompt** so the implementing agent loads them.

1. Search installed / project / agent skills (e.g. `npx skills list`, `AGENTS.md` Project Skills, agent skills dirs). Prefer what is available in the **target** environment.
2. Match by intent: auth, API, frontend, tests, refactor, security, etc.
3. Include **all or most** clearly related skills; skip unrelated noise. Cap at a sensible list (prefer ≤8); if more match, keep the strongest.
4. Add a **Related skills** section listing each skill by name (slash or bare) plus one short “use for …” clause.
5. Instruct the agent to **load and follow** those skills while executing.
6. Do not invent skill names that are not discoverable. If none found, omit the section or write `None found — proceed with workspace defaults.`

### 6) After you finish (handoff summary instruction)

End the enhanced prompt with an **After you finish** section that tells the *implementing* agent: once the work is done, write a summary of the result.

Requirements for that summary instruction:

- Plain language — anyone should understand it (not only the author)
- Still detailed — cover what changed, what was added/removed, and how to verify
- Not a restatement of the prompt; not an enhancer changelog
- Always include (unless the user asked to omit post-work summaries)

Optional chat-only note after the copy-ready block (enhancer changelog) remains optional and separate — omit if overloaded or user disabled it.

## Always-on mode

If the user asks to enhance every chat / every prompt:

1. Create or update `AGENTS.md` in the **target** project.
2. Add a **Skills** section distinguishing when-to-use vs always-use.
3. Register `enhance-prompt` as always-on, e.g.:

```yaml
alwaysApply: true
```

Always-on means: rewrite the user’s message into a better agent prompt **before** acting — still obeying the context policy and detail-preservation rules above.

## Output

1. One copy-ready enhanced prompt (includes Related skills when found + **After you finish** at the end).
2. Optionally a brief chat-only enhancer changelog outside that block.
3. Do not announce skill usage unless the user asks.
