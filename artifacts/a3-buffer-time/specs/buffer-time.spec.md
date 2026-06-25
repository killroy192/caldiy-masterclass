# Spec: Buffer Time Between Bookings

**Feature slug:** `buffer-time`
**Story:** [`specs/buffer-time.story.md`](./buffer-time.story.md)
**Status:** Approved for planning

---

## Business goal

Allow event organizers to enforce an automatic post-meeting gap, preventing back-to-back
scheduling and improving organizer experience without requiring manual calendar blocking.

---

## User / system problem

Organizers who run consecutive sessions (coaching, interviews, demos) have no way to
automatically enforce a pause between bookings. The system currently treats
`meeting_end_time` as the earliest possible start of the next booking. There is no
`bufferTime` field or logic on `EventType`. The only workaround today is manually
blocking personal calendar time — error-prone and invisible to the booking system.

---

## Current behavior

### Product / UX
- Event type settings expose `length` (duration) but no post-meeting buffer control for the new `bufferTime` field.
- The public booking page shows all slots that are free starting at `T + length`
  with no enforced gap.

### API / backend
- `EventType.length` (integer, minutes) defines meeting length.
- Slot generation lives in `packages/features/schedules/lib/slots.ts`; busy-period blocking (including buffers) in `packages/features/busyTimes/services/getBusyTimes.ts`.
- No `bufferTime` field exists on `EventType` in `packages/prisma/schema.prisma` (note: `beforeEventBuffer` / `afterEventBuffer` exist separately).
- A visitor can book slot T and another can book slot `T + duration` immediately after.

### Data model
- `EventType` in `schema.prisma` has `length Int` (meeting duration), `minimumBookingNotice Int?`
  (advance notice for booking), and no buffer field.
- `minimumBookingNotice` is a different concept: how far in advance someone must book.
  Must not be conflated with buffer time (see D-1).

---

## Expected behavior

- `EventType` gains an optional `bufferTime` field (integer, minutes, default 0).
- Slot-availability calculation uses `length + bufferTime` as the effective slot length
  when computing available windows (not in the calendar invite).
- Event type settings UI exposes a "Buffer time after meeting" selector.
- The buffer is invisible to the booker: the calendar invite duration remains `duration` only.
  The buffer is consumed silently between bookings.
- Setting `bufferTime = 0` preserves existing behavior exactly (regression-safe).

---

## Technical scope

| Layer | In scope |
|---|---|
| **Database** | Add `bufferTime Int @default(0)` to `EventType` in `schema.prisma`. One Prisma migration. |
| **API (packages/trpc)** | Update event type tRPC router (`packages/trpc/server/routers/viewer/eventTypes/types.ts`, `heavy/create.handler.ts`, `heavy/update.handler.ts`) and Zod schema (`packages/features/eventtypes/lib/schemas.ts`) to accept and persist `bufferTime`. Zod validation: `z.number().int().min(0).max(60)`. |
| **Core logic** | Update slot calculation in `packages/features/schedules/lib/slots.ts` and/or busy-period logic in `packages/features/busyTimes/services/getBusyTimes.ts` to add `bufferTime` to effective meeting duration before computing available slots. |
| **Frontend (apps/web)** | Add `<Select>` field "Buffer time after meeting" in event type settings (see `packages/features/eventtypes/components/tabs/limits/EventLimitsTab.tsx` for existing buffer/notice field patterns). Options: 0 / 5 / 10 / 15 / 30 / 60. |
| **Tests** | Vitest unit tests for slot logic. Playwright E2E: configure buffer → book → assert adjacent slot is unavailable. |

---

## Non-goals

- Pre-meeting buffer (buffer before the meeting starts).
- Buffer reflected in calendar invites or confirmation emails.
- Buffer at global/user level (per-event-type only).
- Retroactive changes to existing bookings.
- Changes to recurring or team event flows.
- Custom buffer units (minutes only).

---

## Decisions

### D-1 — `bufferTime` vs `minimumBookingNotice` (separate concerns, do not conflate)

`minimumBookingNotice` answers: "How far in advance must someone book?"
`bufferTime` answers: "How much gap is enforced after a booking ends?"

These are orthogonal. The slot-calculation change must add `bufferTime` only to the
effective post-booking window, not to the advance-notice check. The two fields must
remain independent in both the schema and the slot logic.

### D-2 — Buffer is invisible to booker

The buffer must be consumed silently between bookings. The calendar invite duration
must remain `event.length` (unchanged). The booking page must not show the buffer
as an "unavailable" label. This was a deliberate UX decision: exposing the buffer
would confuse bookers who see slots disappearing without explanation.

Consequence for implementation: the slot-calculation function must use
`duration + bufferTime` only for the window computation, not for the stored
`endTime` of the booking or the invite duration. The implementation must not
touch email templates, calendar invite generation, or the confirmation page.

### D-3 — Schema change: additive, no data migration

`bufferTime Int @default(0)` is a non-nullable column with a safe default.
All existing `EventType` rows get `bufferTime = 0` automatically.
No data migration required. No existing behavior changes for any event type
that hasn't explicitly set a buffer.

---

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC1 | Event type settings page shows "Buffer time after meeting" control (0 / 5 / 10 / 15 / 30 / 60 min). |
| AC2 | `bufferTime` value is persisted to the `EventType` record in the database. |
| AC3 | Slot-availability calculation uses `duration + bufferTime` as the effective slot length. |
| AC4 | Calendar invite duration is unchanged — buffer is not visible to the booker. |
| AC5 | `EventType` with `bufferTime = 0` passes all existing slot-calculation tests. |

---

## Open questions

| # | Question | Options | Status |
|---|---|---|---|
| OQ-1 | Exact slot-calculation entry point? | Candidates: `packages/features/schedules/lib/slots.ts` (`getSlots`), `packages/features/busyTimes/services/getBusyTimes.ts` | **Resolve via Ask mode research before Step 4** |
| OQ-2 | Does `minimumBookingNotice` interact with `bufferTime` in the slot logic? | (a) Fully independent (b) Combined window | **Resolved: independent — see D-1** |
| OQ-3 | Should buffer apply when organizer manually books on behalf of someone? | (a) Yes (b) No, organizer-initiated bookings bypass buffer | Out of scope for v1 |

---

## Assumptions

- Buffer is stored in minutes as integer. No fractional support.
- Buffer = 0 is safe default; existing event types require no migration.
- The slot-calculation function accepts an event type object and uses a duration field.
- The buffer should not appear in the UI shown to the guest/visitor.
- Zod max is 60 minutes (options are 0/5/10/15/30/60 — no value exceeds 60).

---

## Initial context hints

| Area | File | Key detail |
|---|---|---|
| Schema | `packages/prisma/schema.prisma` → `model EventType` | Current field list; `length Int` is meeting duration |
| Slot logic | `packages/features/schedules/lib/slots.ts` | `getSlots` — primary slot-generation function for Step 4 |
| Busy-period logic | `packages/features/busyTimes/services/getBusyTimes.ts` | Applies `beforeEventBuffer` / `afterEventBuffer` when blocking slots |
| tRPC router | `packages/trpc/server/routers/viewer/eventTypes/types.ts` (+ `heavy/create.handler.ts`, `heavy/update.handler.ts`) | Create/update mutations to extend |
| Zod schema | `packages/features/eventtypes/lib/schemas.ts` | Shared event type input validation |
| Event type settings UI | `packages/features/eventtypes/components/tabs/limits/EventLimitsTab.tsx` | Existing buffer/notice controls — pattern for the new Select field |
| Event type page (App Router) | `apps/web/app/(use-page-wrapper)/event-types/[type]/page.tsx` | Route entry point for event type settings |
| Existing slot tests | `packages/features/schedules/lib/slots.test.ts` | Baseline regression tests |
| Similar field pattern | `minimumBookingNotice` / `afterEventBuffer` in schema, router, and `EventLimitsTab.tsx` | Template for how to add a new optional integer field |

---

## Spec self-check

**Blocking questions:** OQ-1 (exact function name) — must resolve before implementation.

**Scope creep risks:**
- Agent adding buffer to calendar invite output (violates D-2).
- Agent touching email templates (violates D-2 and non-goals).
- Agent changing `minimumBookingNotice` logic (separate concern, D-1).
- Agent suggesting `bufferTime` on user/global level instead of event type.

**Risky assumptions:**
- The slot-calculation function accepts a clean event type object — if it has hidden
  dependencies on other service state, Step 4 becomes more complex.
- The calendar invite path is clearly separated from the slot-calculation path —
  needs verification during research (Stage 1).

**Acceptance criteria gaps:**
- AC4 (buffer invisible to booker) has no automated test for the invite path.
  Manual verification protocol documented in verification file.
