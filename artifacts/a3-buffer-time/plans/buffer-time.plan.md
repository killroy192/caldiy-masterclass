# Implementation Plan: Buffer Time Between Bookings

**Feature slug:** `buffer-time`
**Spec:** [`specs/buffer-time.spec.md`](../specs/buffer-time.spec.md)
**Context map:** [`evidence/buffer-time.context-map.md`](../evidence/buffer-time.context-map.md)
**Model used:** `claude-opus-4-6` (Agent mode)
**PR:** https://github.com/killroy192/caldiy-masterclass/pull/1

---

## Resolved open questions

- **OQ-1 (slot function name):** `getSlots`
  → File: `packages/features/schedules/lib/slots.ts`
  → `bufferTime` is added to the slot *increment* (`frequency + bufferAfter`), not to `eventLength`.
    This is correct: `eventLength` controls the slot boundary check (`!slotStartTime.add(eventLength)`),
    while the increment controls how far the next slot start is pushed.
- **OQ-2 (minimumBookingNotice interaction):** Fully independent — `minimumBookingNotice` controls
  the earliest bookable time (`startTimeWithMinNotice`), not the slot spacing. Separate logic path confirmed.

---

## Confirmed facts

- [x] Slot function name: `getSlots` (exported as default via `withReporting` wrapper)
- [x] Slot file: `packages/features/schedules/lib/slots.ts`
- [x] `bufferTime` added to `frequency + bufferAfter` in `buildSlotsWithDateRanges` and in the `prevBoundaryEnd` calculation (line ~176)
- [x] Calendar invite output uses `eventType.length` directly in `packages/trpc/server/routers/viewer/slots/util.ts` — separate from slot computation ✅
- [x] `minimumBookingNotice` is processed as `startTimeWithMinNotice` — completely independent from slot spacing ✅
- [x] Event type settings UI: `packages/features/eventtypes/components/tabs/limits/EventLimitsTab.tsx`
- [x] Slot tests: `packages/features/schedules/lib/slots.test.ts`
- [x] `bufferTime` wired into `getSlots` call via `packages/trpc/server/routers/viewer/slots/util.ts` line 1093

---

## Files changed (from PR diff)

| File | Action | What changed |
|---|---|---|
| `packages/prisma/schema.prisma` | Edit | `bufferTime Int @default(0)` added to `model EventType` |
| `packages/prisma/migrations/20260625131627_add_buffer_time_to_event_type/migration.sql` | Create | `ALTER TABLE "public"."EventType" ADD COLUMN "bufferTime" INTEGER NOT NULL DEFAULT 0` |
| `packages/features/eventtypes/lib/schemas.ts` | Edit | `bufferTime: z.number().int().min(0).max(60).optional().default(0)` added to `createEventTypeInput` |
| `packages/features/eventtypes/lib/types.ts` | Edit | `bufferTime: number` added to `FormValues` and `EventTypeUpdateInput` |
| `packages/features/eventtypes/repositories/eventTypeRepository.ts` | Edit | `bufferTime: true` added to 3 Prisma `select` blocks |
| `packages/trpc/server/routers/viewer/eventTypes/types.ts` | Edit | `bufferTime: z.number().int().min(0).max(60).optional().default(0)` in `BaseEventTypeUpdateInput` |
| `packages/features/schedules/lib/slots.ts` | Edit | `bufferTime?: number` param added; `bufferAfter` variable; applied to `frequency + bufferAfter` increment and `prevBoundaryEnd` |
| `packages/trpc/server/routers/viewer/slots/util.ts` | Edit | `bufferTime: eventType.bufferTime ?? 0` passed into `getSlots` call |
| `packages/features/eventtypes/components/tabs/limits/EventLimitsTab.tsx` | Edit | `<Select>` field "Buffer time after meeting" added with options 0/5/10/15/30/60 |
| `packages/platform/atoms/event-types/hooks/useEventTypeForm.ts` | Edit | `bufferTime: eventType.bufferTime ?? 0` added to form defaults |
| `packages/i18n/locales/en/common.json` | Edit | `"buffer_time_after_meeting": "Buffer time after meeting"` added |
| `packages/features/schedules/lib/slots.test.ts` | Edit | 2 new test cases added (buffer=15 blocks window, buffer=0 regression) |

**Total: 1 new file, 11 edited files**

---

## Test-first policy

The 2 new test cases were written to verify behavior, not line coverage:
- Test 1: `bufferTime=15` on 60-min event → asserts `["09:00", "10:15"]` and explicitly asserts `"10:00"` is NOT in slots
- Test 2: `bufferTime=0` → asserts output is identical to calling `getSlots` without `bufferTime` at all

---

## Human plan review notes

**What was accepted as-is:**
- Adding `bufferTime` to `frequency + bufferAfter` in the slot increment — correct architectural choice. `eventLength` controls where the slot boundary check is, the increment controls where the *next* slot starts. Buffer belongs in the increment.
- The `prevBoundaryEnd` fix (line ~176) — this is the correct second place where buffer must be applied to prevent slots from appearing inside the buffer window in multi-range scenarios.
- The JSDoc comment in `slots.ts` explicitly stating buffer does not affect calendar invite duration (D-2) — good documentation.

**What was verified and confirmed correct:**
- `bufferTime` is passed as `eventType.bufferTime ?? 0` from `slots/util.ts` — the null-safe default is correct.
- `bufferTime` in `schemas.ts` uses `max(60)` — matches product decision (options are 0–60 min).
- `eventType.length` in `util.ts` at line 1093 remains unchanged — calendar invite duration is not affected ✅

**What was not needed / out of scope:**
- No changes to email templates — confirmed absent from diff ✅
- No changes to calendar invite generation — confirmed absent from diff ✅
- No changes to confirmation page — confirmed absent from diff ✅

**Approved implementation boundary:**
- All changes confined to: slot logic, event type schemas/types/repository, tRPC input types, UI component, i18n, tests, migration.
- No recurring event, team event, or booking flow changes.
