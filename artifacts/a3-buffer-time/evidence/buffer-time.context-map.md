# Context Map: Buffer Time Between Bookings

**Feature slug:** `buffer-time`
**Story:** [`specs/buffer-time.story.md`](../specs/buffer-time.story.md)
**Spec:** [`specs/buffer-time.spec.md`](../specs/buffer-time.spec.md)
**PR:** https://github.com/killroy192/caldiy-masterclass/pull/1

---

## HOT — directly required for this feature

### Spec & Story

| Artefact | Path |
|---|---|
| User story | `artifacts/a3-buffer-time/specs/buffer-time.story.md` |
| Technical spec | `artifacts/a3-buffer-time/specs/buffer-time.spec.md` |

### Active files — slot logic

| File | Role | What changed |
|---|---|---|
| `packages/features/schedules/lib/slots.ts` | Core slot computation | Added `bufferTime?: number` param; `bufferAfter` variable; applied to `frequency + bufferAfter` in slot increment and `prevBoundaryEnd` |
| `packages/features/schedules/lib/slots.test.ts` | Slot tests | Added 2 new test cases |
| `packages/trpc/server/routers/viewer/slots/util.ts` | `getSlots` caller | Added `bufferTime: eventType.bufferTime ?? 0` to the `getSlots` call |

### Active files — data model & API

| File | Role | What changed |
|---|---|---|
| `packages/prisma/schema.prisma` | DB schema | `bufferTime Int @default(0)` on `EventType` |
| `packages/prisma/migrations/20260625131627_add_buffer_time_to_event_type/migration.sql` | Migration | `ALTER TABLE "public"."EventType" ADD COLUMN "bufferTime" INTEGER NOT NULL DEFAULT 0` |
| `packages/features/eventtypes/lib/schemas.ts` | Zod schema | `bufferTime: z.number().int().min(0).max(60).optional().default(0)` |
| `packages/features/eventtypes/lib/types.ts` | TypeScript types | `bufferTime: number` in `FormValues` and `EventTypeUpdateInput` |
| `packages/features/eventtypes/repositories/eventTypeRepository.ts` | DB repository | `bufferTime: true` in 3 `select` blocks |
| `packages/trpc/server/routers/viewer/eventTypes/types.ts` | tRPC input types | `bufferTime` in `BaseEventTypeUpdateInput` |

### Active files — frontend

| File | Role | What changed |
|---|---|---|
| `packages/features/eventtypes/components/tabs/limits/EventLimitsTab.tsx` | UI settings | Added `<Select>` "Buffer time after meeting" with options 0/5/10/15/30/60 |
| `packages/platform/atoms/event-types/hooks/useEventTypeForm.ts` | Form hook | `bufferTime: eventType.bufferTime ?? 0` in form defaults |
| `packages/i18n/locales/en/common.json` | i18n | `"buffer_time_after_meeting": "Buffer time after meeting"` |

---

## WARM — reusable guidance, always active

| Item | Detail |
|---|---|
| `AGENTS.md` (repo root) | Use `select` not `include` in Prisma — followed: all 3 repository selects use `bufferTime: true` |
| `beforeEventBuffer` / `afterEventBuffer` pattern | Template for how other buffer fields are declared and handled — `bufferTime` follows the same pattern throughout |
| `minimumBookingNotice` pattern | Template for optional integer field in Zod schema and tRPC types |

---

## COLD — referenced only if needed

| File | When |
|---|---|
| `packages/features/eventtypes/lib/eventTypeUtils.ts` | If form default handling needed deeper investigation |
| `packages/trpc/server/routers/viewer/eventTypes/` handlers | Only if update mutation needed additional wiring |

---

## IGNORE — explicitly excluded

| Resource | Reason |
|---|---|
| `packages/emails/` | AC4/D-2: buffer must be invisible to booker. Not in PR diff ✅ |
| Calendar invite generation | AC4/D-2: invite duration = `eventType.length` unchanged. Not in PR diff ✅ |
| Public booking page components | Buffer must not appear to the booker. Not in PR diff ✅ |
| Recurring events logic | Non-goal per spec. Not in PR diff ✅ |
| `InstantMeetingToken` / team flows | Non-goal per spec. Not in PR diff ✅ |

---

## Context decisions

**Why `bufferTime` is added to `frequency + bufferAfter`, not to `eventLength`:**
`eventLength` controls the slot boundary check — whether a slot fits within the available range.
`frequency + bufferAfter` controls where the *next* slot starts. Buffer belongs in the increment
so that the meeting itself is still `eventLength` minutes (same invite duration — D-2 preserved),
but the next bookable slot starts `bufferAfter` minutes later.

**Why email and calendar invite files are in IGNORE:**
Decision D-2 requires buffer to be invisible to the booker. Having these files in context
would risk the agent adding buffer display there. Confirmed absent from PR diff.
