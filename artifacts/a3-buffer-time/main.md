# Artifact 3 Main — Buffer Time Between Bookings

**Feature slug:** `buffer-time`
**Branch:** `feat/buffer-time`
**Repository:** [caldiy-masterclass](https://github.com/killroy192/caldiy-masterclass)

---

1. **Original Work Item:** [`specs/buffer-time.story.md`](./specs/buffer-time.story.md)

2. **[Spec](./specs/buffer-time.spec.md)** — Notes:
   - Why we need a spec: the feature touches slot-calculation core logic shared across all event types; one wrong assumption about how `event.length` is used would silently break all availability calculations. The spec forces us to verify the current behavior first, define a clear scope boundary (buffer is post-meeting only, invisible to bookers), and get explicit alignment on AC before coding.
   - Trade-offs: writing the spec added ~30 minutes upfront but the research step (Stage 1) surfaced that the slot function name was different from what Auto mode assumed — avoiding a wrong-file edit is worth the cost.
   - Challenges: the spec was written before codebase research. OQ-2 (`minimumBookingNotice` overlap) could only be answered after reading the schema. Kept it as an open question and resolved it in the plan.

3. **[Plan](./plans/buffer-time.plan.md)** — Notes:
   - Why we need a plan: the slot-calculation function name was unknown (marked TBD in step 4). Plan Mode with Ask mode research let us confirm the exact file before any code was written.
   - Challenges during planning: Auto model hallucinated the function name as `getAvailableSlots` — switched to `claude-opus-4-6`, which correctly marked the function as TBD pending research, and also suggested `Zod.max(120)` which was corrected to `60`.
   - Rejected plan step: the initial plan included "Show buffer duration in the booking confirmation page" — removed because it contradicts AC4 (buffer must be invisible to booker). Documented in human review notes.
   - Agent chat log (compressed): see [`evidence/buffer-time.agentic-workflow.md`](./evidence/buffer-time.agentic-workflow.md)

4. **[Context Map](./evidence/buffer-time.context-map.md)** — Notes:
   - Challenge solved: Auto model kept referencing `getAvailableSlots` (non-existent) and almost modified `packages/lib/rateLimit.ts` (completely unrelated). Explicitly listing HOT files with exact paths eliminated both hallucinations.
   - IGNORE list rationale: email templates and calendar invite output were placed in IGNORE specifically because AC4 requires the buffer to be invisible to the booker — having those files in context increased the risk of the agent "helpfully" adding buffer display there.
   - Context map format: used 4-bucket / 3-tier model (HOT/WARM/COLD/IGNORE). No modifications to the template — all four tiers were meaningful for this feature.

5. **Code diff:** PR 1 → [link to be added after branch push]  
   PR 2 → [link to be added after branch push]

6. **[Verification](./verification/buffer-time.review.md)** — Notes:
   - Why verification: the slot-calculation change is a one-line edit that affects every event type in the system. Without a test that explicitly asserts the buffer window is blocked and a regression test that asserts buffer=0 is identical to pre-change behavior, a silent regression is easy to introduce.
   - Verification workflow: used AC-to-test mapping table (modeled on EPAM bootcamp pattern). Two ACs required manual verification (AC4 — external calendar, AC5-E2E — booking list UI). Documented gaps clearly rather than claiming full coverage.
   - Gateway modifications: none — the standard Vitest + Playwright pipeline was sufficient for this feature.
