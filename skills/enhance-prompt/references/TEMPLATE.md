# enhance-prompt — output template

Correct shape and wrong-vs-right examples. Enhance = clarify + structure. **Never strip user-stated contracts** (fields, endpoints, remove/keep). Never inject paths/stack.

## Correct output shape

```markdown
# <short title>

## Goal
<what success looks like>

## Contract
<optional — endpoint/body/remove-keep lists the user stated>

## Constraints
- <must / must-not>
- <user-stated boundaries — keep field names exact>

## Steps
1. <only if needed>
2. …

## Related skills
- `/skill-name` — use for <why>
- …

## Output
<expected deliverable format>

## Open questions
- <optional — resolve, don’t guess>

## After you finish
When the work is done, write a summary that anyone can understand, while remaining detailed:
- What you changed (and what you removed/added)
- How to verify
- Anything still open or risky
```

Omit empty optional sections. **After you finish** stays at the end. Do not invent constraints or field names.

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
- Prefer the target workspace’s existing design system / patterns when present
- Keep the first viewport uncluttered: brand/product signal, one headline, short support line, CTA group, one dominant visual

## Related skills
- `/frontend-design` — use for layout, visual hierarchy, and UI polish (if installed)
- None found beyond defaults — proceed with workspace design rules if no matching skills

## Output
Implement UI improvements in the target workspace.

## After you finish
Write a plain-language summary anyone can follow: what looked weak before, what you changed, and how to check it on desktop and mobile.
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

## Related skills
- `/skill-check` — only if validating skill/docs changes (skip if unrelated)
- Prefer any installed auth/test skills in the target agent

## Output
Fix + verification notes.

## After you finish
Write a plain-language summary anyone can follow: root cause, what you changed, that desktop was left alone, and how to verify the mobile login tap.
```

**Out (wrong — path injection):**

```markdown
## Goal
Fix `packages/auth/src/LoginButton.tsx` under /workspace/acme-app ...
```

---

## Example C — anti-pattern: path / stack leak

**Wrong:**

```markdown
# Refactor billing
## Goal
Clean up billing in /home/ubuntu/old-client and /Users/dev/acme/billing-service.
## Constraints
- Stack: Next.js 14, Prisma, tRPC, Tailwind, Redis
```

**Right:** keep portable goal/constraints; load stack from target workspace. No path/stack paste.

---

## Example D — rich auth refactor: preserve contracts (do not dilute)

**In (excerpt of user intent):**

```text
OTP verify should be internal only. Flow: otp/request → action (login | register | password-change).
Remove public verify-OTP and separate change/reset password APIs.
password-change shaped like login: secret, method, phone.
Register: phone, password, code — no method/secret; verify OTP inside register.
locale_pref from localStorage preferred, else cookies.
```

**Out (wrong — stripped fields / invented names):**

```markdown
## Constraints
- Register: accept phone-number and password only
```

That drops `code`, renames `phone` → `phone-number`, and hurts accuracy.

**Out (right — contracts kept, no path/stack dump):**

```markdown
# Auth: OTP internal + collapse password APIs

## Goal
Refactor auth so OTP verification is internal only. Public flow: request OTP, then call the action endpoint (`login` | `register` | `password-change`). Remove standalone verify-OTP and separate change/reset password APIs.

## Contract
Desired public API:
- `POST /auth/otp/request` — `{ phone, purpose }`
- `POST /auth/login` — `{ phone, method, secret }`
- `POST /auth/register` — `{ phone, password, code }` (OTP verified inside register)
- `POST /auth/password-change` — `{ phone, method, secret, new_password }`
- Keep refresh/logout unchanged

Remove:
- public verify-OTP endpoint
- separate password change + reset endpoints
- any otp_proof / proof-cookie register flow if present

## Constraints
- Keep verify-OTP as an internal function only — do not re-expose it
- Register body is `{ phone, password, code }` — no `method`, no `secret`
- `password-change` request shape matches login plus `new_password`
- `locale_pref`: prefer frontend `localStorage`; fall back to cookies
- Do not invent auth fields, status codes, or error shapes beyond the target workspace
- Preserve security behaviors already in the workspace (rate limits, session revoke on password change, etc.) unless the user said otherwise
- Use target workspace context for existing routes, models, and tests — do not paste paths/stack

## Steps
1. Map current auth endpoints and callers
2. Make verify-OTP internal; remove public verify-OTP
3. Wire login / register / password-change to validate OTP internally when needed
4. Replace change+reset with `/auth/password-change`
5. Align frontend: otp/request → action
6. Update tests for the new flow (valid + invalid OTP)

## Related skills
- List installed skills that match auth, API, frontend, or testing (discovered in target env)
- Instruct agent to load and follow each listed skill

## Output
- Backend + frontend implementing the contract above

## Open questions
- For authenticated vs unauthenticated password-change: resolve OTP purpose / phone-vs-session rules from workspace auth context — do not guess silently

## After you finish
Write a plain-language summary anyone can follow, while remaining detailed:
- What changed in the auth flow (before → after)
- Which endpoints were removed vs added/updated (with request shapes)
- How to verify (tests run + expected results)
- Any open decisions still unresolved
```

**Rule:** Paths/stack from a scan = strip. User-stated `{ phone, password, code }` and endpoint lists = **keep**.
