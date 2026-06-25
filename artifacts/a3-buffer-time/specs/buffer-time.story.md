# Feature: Buffer Time Between Bookings

**Feature slug:** `buffer-time`
**Type:** Feature
**Source:** Scheduling UX improvements backlog
**Repository:** [caldiy-masterclass](https://github.com/killroy192/caldiy-masterclass)

---

## User story

**As** an event organizer,
**I want** to configure an automatic gap after each of my bookings,
**so that** I have time to prepare, wrap up notes, or take a break between consecutive meetings without manually blocking my calendar.

---

## Background

Today cal.diy allows visitors to book consecutive slots with zero gap between them.
A coach running 60-minute sessions can receive a 10:00–11:00 booking and immediately
another at 11:00–11:30 with no preparation time. There is no mechanism to enforce a
minimum post-meeting pause per event type.

---

## Acceptance criteria

| ID | Criterion |
|---|---|
| AC1 | Event type settings page shows "Buffer time after meeting" control (options: none / 5 / 10 / 15 / 30 / 60 min). |
| AC2 | Selected buffer value is persisted on the `EventType` record in the database. |
| AC3 | Slot-availability calculation uses `duration + bufferTime` as the effective slot length. |
| AC4 | Calendar invite duration is unchanged — buffer is not visible to the booker. |
| AC5 | `EventType` with `bufferTime = 0` passes all existing slot-calculation tests unchanged. |

---

## Out of scope

- Pre-meeting buffer (buffer before the meeting starts).
- Applying buffer retroactively to existing bookings.
- Buffer at user/global level (per-event-type only).
- Showing buffer duration in calendar invite or confirmation email.
- Any changes to recurring event or team event flows.
