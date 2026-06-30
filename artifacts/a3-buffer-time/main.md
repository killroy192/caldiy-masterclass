# Artifact 3 Main — Buffer Time Between Bookings

**Feature slug:** `buffer-time`
**Branch:** `feat/buffer-time`
**PR:** https://github.com/killroy192/caldiy-masterclass/pull/1

---

1. **Original Work Item:** [`specs/buffer-time.story.md`](./specs/buffer-time.story.md)

2. **[Spec](./specs/buffer-time.spec.md)** — Notes:
   - Why we need a spec: the feature touches slot-calculation core logic shared across all event types. One wrong assumption about how `eventLength` is passed to `getSlots` would silently break all availability calculations. The spec forced us to verify current behavior and define a clear scope boundary (buffer added to slot increment only, invisible to booker — Decision D-2).
   - Trade-offs: writing the spec added ~20 minutes upfront but prevented the agent from adding buffer to the calendar invite output, which was the main risk.
   - Challenges: `minimumBookingNotice` lives in the same `getSlots` call — spec had to explicitly state these are independent (D-1) to prevent agent from conflating them.

3. **[Plan](./plans/buffer-time.plan.md)** — Notes:
   - Why we need a plan: the slot-calculation function `getSlots` accepts `eventLength` as a parameter, not `event.length` directly — this distinction mattered for where exactly to add `bufferTime`. Plan mode resolved this before any code was written.
   - Challenges: the agent correctly identified that `bufferTime` needed to be added to the slot *increment* (`frequency + bufferAfter`) and not just to `eventLength`, because `eventLength` controls the slot window boundary check while `frequency` controls how far the next slot is pushed. This is a subtle but correct architectural decision.
   - What was rejected: any suggestion to show buffer in the booking confirmation or calendar invite — both contradict D-2.
   - Agent chat log: see [`evidence/buffer-time.agentic-workflow.md`](./evidence/buffer-time.agentic-workflow.md)

4. **[Context Map](./evidence/buffer-time.context-map.md)** — Notes:
   - Challenge solved: email templates and calendar invite generation were placed in IGNORE to prevent agent from "helpfully" displaying buffer there (D-2 enforcement via context boundary).
   - The agent correctly identified that `bufferTime` affects `frequency + bufferAfter` in `buildSlotsWithDateRanges` and the `prevBoundaryEnd` calculation — not `eventLength` itself. This matches the comment the agent added to the code.

5. **Code diff:** https://github.com/killroy192/caldiy-masterclass/pull/1/files

6. **[Verification](./verification/buffer-time.review.md)** — Notes:
   - Why verification: the slot-calculation change is surgical (2 lines in `slots.ts`) but affects every event type in the system. Tests prove both the buffer behavior and the regression case.
   - Verification workflow: AC-to-test mapping table with automated and manual coverage noted separately. AC4 (calendar invite unchanged) verified by code review — invite path (`eventType.length`) is not touched in the diff.
