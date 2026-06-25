# Release Notes & Deployability: Buffer Time Between Bookings

**Feature slug:** `buffer-time`
**PR:** https://github.com/killroy192/caldiy-masterclass/pull/1
**Branch:** `feat/buffer-time`
**Verification:** [`verification/buffer-time.review.md`](../verification/buffer-time.review.md)

---

## Summary

Adds configurable post-meeting buffer time to cal.diy event types.
Organizers can set a 0–60 minute gap that is automatically enforced in slot availability,
preventing back-to-back bookings. The buffer is invisible to bookers — calendar invite
duration is unchanged.

---

## What changed

| File | Change |
|---|---|
| `packages/prisma/schema.prisma` | `bufferTime Int @default(0)` on `model EventType` |
| `packages/prisma/migrations/20260625131627_add_buffer_time_to_event_type/migration.sql` | `ALTER TABLE "public"."EventType" ADD COLUMN "bufferTime" INTEGER NOT NULL DEFAULT 0` |
| `packages/features/eventtypes/lib/schemas.ts` | `bufferTime: z.number().int().min(0).max(60).optional().default(0)` in create input |
| `packages/features/eventtypes/lib/types.ts` | `bufferTime: number` in `FormValues` and `EventTypeUpdateInput` |
| `packages/features/eventtypes/repositories/eventTypeRepository.ts` | `bufferTime: true` in 3 Prisma `select` blocks |
| `packages/trpc/server/routers/viewer/eventTypes/types.ts` | `bufferTime` in `BaseEventTypeUpdateInput` |
| `packages/features/schedules/lib/slots.ts` | `bufferTime?: number` param; `bufferAfter` applied to `frequency` increment and `prevBoundaryEnd` |
| `packages/trpc/server/routers/viewer/slots/util.ts` | `bufferTime: eventType.bufferTime ?? 0` passed to `getSlots` |
| `packages/features/eventtypes/components/tabs/limits/EventLimitsTab.tsx` | `<Select>` "Buffer time after meeting" with options 0/5/10/15/30/60 |
| `packages/platform/atoms/event-types/hooks/useEventTypeForm.ts` | `bufferTime: eventType.bufferTime ?? 0` in form defaults |
| `packages/i18n/locales/en/common.json` | `"buffer_time_after_meeting": "Buffer time after meeting"` |
| `packages/features/schedules/lib/slots.test.ts` | 2 new tests: buffer=15 blocks window, buffer=0 regression |

**Total: 1 new file, 11 modified files**

---

## Tests evidence

| Suite | Command | Result |
|---|---|---|
| Unit tests | `TZ=UTC yarn vitest run packages/features/schedules/lib/slots.test.ts` | est Files  1 passed (1), Tests  45 passed (45) |
| Type-check | `yarn type-check:ci --force` | 2 successful, 2 total |

## Review notes
 
**Summary:** Feature implements buffer time between bookings as specified in
`artifacts/a3-buffer-time/specs/buffer-time.spec.md`. 12 files changed, all within
the approved scope boundary. The implementation correctly adds `bufferTime` to the
slot *increment* (`frequency + bufferAfter`) rather than to `eventLength`, which
preserves the calendar invite duration (Decision D-2).
 
**Findings:**
 
| # | Finding | Classification | Resolution |
|---|---|---|---|
| F1 | Diff matches spec — `bufferTime` added to slot increment, not `eventLength` | ✅ Pass | No action needed |
| F2 | No scope creep — email templates, calendar invite output, confirmation page not touched | ✅ Pass | No action needed |
| F3 | Agent JSDoc comment in `slots.ts` explicitly references spec D-2 — good traceability | ✅ Pass | No action needed |
| F4 | E2E test absent from this PR | ⚠️ Minor | Documented as KR2. Unit tests cover slot computation. E2E is a follow-up task, not a blocker. |
| F5 | `bufferTime` correctly applied to `prevBoundaryEnd` calculation (line ~176 in slots.ts) as well as the main increment — prevents slots appearing inside buffer window in multi-range scenarios | ✅ Pass | No action needed |
 
**Missing evidence:**
- Actual test run terminal output — add after running `TZ=UTC yarn vitest run packages/features/schedules/lib/slots.test.ts` locally.
**Blockers:** None.
 
**Final merge / deployability decision:** ✅ Ready to merge. All 5 AC verified. No blockers. Migration is safe. Rollback is straightforward.
 
---

## Release readiness

### Observability

- `bufferTime` value stored on `EventType` — visible via Prisma Studio (`yarn db-studio`).
- No feature flag needed — `bufferTime = 0` default means zero behavioral change for all
  existing event types until an organizer explicitly sets a buffer.

### Rollout

Safe to deploy without coordination. The migration adds a column with a non-nullable default.
No existing rows are affected. All existing event types get `bufferTime = 0` automatically.

---

## Rollback plan

| Scenario | Action | Complexity |
|---|---|---|
| Migration issue | Down migration: remove `bufferTime` column. Additive column, no data dependency. | Low |
| Slot logic regression | Revert `feat/buffer-time` branch. Column stays in DB with default 0 — no behavioral effect. | Low |
| UI issue | Revert only `EventLimitsTab.tsx` and `useEventTypeForm.ts`. Backend unchanged. | Low |

**Maximum rollback complexity: Low.**

---

## Known risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| KR1 | AC4 (calendar invite unchanged) not covered by automated test | Low | Code review confirms `eventType.length` in invite path not touched. PR diff verified. |
| KR2 | E2E test not included in this PR | Low | Unit tests cover the slot computation. E2E can be added in follow-up. |

---

## Final deployability decision

✅ **Deployable.**

- All 5 acceptance criteria addressed.
- Migration is additive and safe.
- Buffer added to slot increment only — calendar invite unchanged.
- Rollback is straightforward.
- No scope creep confirmed.

**PR:** https://github.com/killroy192/caldiy-masterclass/pull/1
