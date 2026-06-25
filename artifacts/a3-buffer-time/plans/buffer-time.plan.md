# Implementation Plan: Buffer Time Between Bookings

**Feature slug:** `buffer-time`
**Spec:** [`specs/buffer-time.spec.md`](../specs/buffer-time.spec.md)
**Context map:** [`evidence/buffer-time.context-map.md`](../evidence/buffer-time.context-map.md)
**Model used:** `claude-opus-4-6` (Plan Mode; switched from Auto — see human review notes)

---

## Resolved open questions

- **OQ-1 (slot function name):** `[FILL IN after Stage 1 Ask mode research]`
  → Exact file path: `[FILL IN]`
  → Duration field name used inside the function: `[FILL IN]` (e.g. `event.length`)
- **OQ-2 (minimumBookingNotice interaction):** Fully independent — see D-1 in spec.
  Buffer is added only to the slot window computation, not to the advance-notice check.

---

## Confirmed facts
- [ ] Slot-calculation function name confirmed: `buildSlotsWithDateRanges`
- [ ] Slot-calculation file path confirmed: `packages/features/schedules/lib/slots.ts`
- [ ] How `event.length` / `duration` is used inside the function: `eventLength = input.duration || eventType.length`
- [ ] Calendar invite path is in a separate code branch from slot calculation: `YES`
- [ ] `minimumBookingNotice` is processed independently: `NO`
- [ ] Event type settings UI file: `packages/web/modules/event-types/components/tabs/setup/EventSetupTab.tsx`
- [ ] Existing slot test location: `packages/features/schedules/lib/slots.test.ts`
- [ ] Similar optional integer field pattern confirmed (`minimumBookingNotice`): `YES`

---

## Files and modules involved

### PR 1 — Backend (schema + migration + tRPC + core logic + unit tests)

| File | Action | Purpose |
|---|---|---|
| `packages/prisma/schema.prisma` | **Edit** | Add `bufferTime Int @default(0)` to `model EventType` |
| `packages/prisma/migrations/YYYYMMDD_add_buffer_time_to_event_type/` | **Create** | Migration SQL for the new column |
| `packages/trpc/server/routers/eventType.ts` | **Edit** | Add `bufferTime` to create/update input schemas and persist to DB |
| `[slot-calculation file — TBD]` | **Edit** | Replace `duration` with `duration + (event.bufferTime ?? 0)` in slot window computation only |
| `[slot-calculation test file — TBD]` | **Edit** | Add 2 new unit tests (buffer=15 case + buffer=0 regression) |

### PR 2 — Frontend (UI selector + E2E test)

| File | Action | Purpose |
|---|---|---|
| `[event type settings component — TBD]` | **Edit** | Add `<Select>` field "Buffer time after meeting" wired to `bufferTime` |
| `apps/web/__tests__/e2e/bufferTime.e2e.ts` | **Create** | E2E: configure buffer=15 → book → assert 11:00 unavailable, 11:15 available |

---

## Test-first policy (mandatory)

For every implementation step, use strict red → green cycle:

1. Write the test first (describe what the behavior should be).
2. Run only the new test → confirm it **fails (red)**.
3. Implement the minimum code to satisfy the test.
4. Re-run the test → confirm it **passes (green)**.
5. Run related regression tests before moving to the next step.

---

## Implementation steps

### Stage 1 — Research (Ask mode, no code changes)

**Goal:** Resolve OQ-1 before any implementation. Do not skip this stage.

**Step 0 — Codebase research**

Cursor mode: **Ask** | Model: `claude-opus-4-6`

```
I am working on adding a "buffer time" feature to this cal.diy codebase.
Before I implement anything, I need to understand the existing slot-calculation logic.

Research the codebase (do NOT modify any files) and answer:

1. What is the exact function name and file path that computes available booking
   slots? Search for: getSchedule, getAvailableSlots, getSlots, getWorkingHours,
   computeSlots, or similar. Show the function signature.

2. How is the meeting duration (event.length or similar field) used inside that
   function when computing which time slots are available?

3. Is the calendar invite output (duration passed to calendar APIs) computed in the
   same function or in a separate code path?

4. Does minimumBookingNotice interact with the slot-computation in any way?

5. What is the exact file path for the event type settings component in apps/web/
   where organizers configure duration and similar fields?

6. Where are the existing Vitest unit tests for the slot calculation logic?

Report only facts from the codebase. Do not suggest any changes yet.
```

→ Fill in the "Confirmed facts" and "Files and modules involved" sections above before proceeding.

---

### PR 1: Backend

**Step 1 — Schema**

Cursor mode: **Agent** | Model: `claude-opus-4-6`

```
Implement Step 1 only.

Add the field bufferTime Int @default(0) to the EventType model in
packages/prisma/schema.prisma.

Do not run migrations yet. Do not touch any other files.
Show me the diff before saving.
```

Human check: diff shows only `schema.prisma`, only `bufferTime Int @default(0)` added
to `model EventType`. Accept → save.

---

**Step 2 — Migration**

Cursor mode: **Agent**

```
Now run the Prisma migration for the schema change we just made.
Migration name: add-buffer-time-to-event-type

Command: yarn workspace @calcom/prisma db-migrate --name add-buffer-time-to-event-type

If the local database is not running, tell me — I will run yarn dx manually first.
Do not touch any application code in this step.
```

If local DB not running → open terminal: `yarn dx` → wait → repeat prompt.

Human check: migration SQL is `ALTER TABLE "EventType" ADD COLUMN "bufferTime" INTEGER NOT NULL DEFAULT 0;`

---

**Step 3 — tRPC router**

Cursor mode: **Agent**

```
Implement the tRPC router update only.

In packages/trpc/server/routers/eventType.ts:
- Add bufferTime to the input schema of both the create and update mutations:
  bufferTime: z.number().int().min(0).max(60).optional().default(0)
- Persist the value to the database via Prisma in both mutations.

Important constraints:
- max must be 60, not 120.
- Do not change any other fields or logic.
- Show me the diff before saving.
```

Human check: only `eventType.ts` in diff. `max(60)` confirmed. Accept → save.

---

**Step 4 — Slot-calculation logic**

> ⚠️ Highest-risk step. Read the diff line by line before accepting.

Cursor mode: **Agent**

```
Implement the slot-calculation change only.

In [FILL IN exact file path from Step 0]:
- Find where the meeting duration ([FILL IN field name, e.g. event.length]) is used
  to compute available slot windows.
- In that specific computation, replace the duration variable with:
  duration + (event.bufferTime ?? 0)
- The calendar invite output ([FILL IN where event.length is used for invite])
  must NOT change.
- Do not touch any other files. No email templates. No confirmation pages.
- Show me the exact diff before saving.
```

Human check (mandatory — all three):
- [ ] Only the slot window computation is changed, not the invite output path.
- [ ] Only the target file from research is in the diff — no other files.
- [ ] `event.bufferTime ?? 0` pattern used (null-safe default).

If anything else is in the diff → `Revert the change to [file]. Only [exact file] should be modified.`

Accept → save.

---

**Step 5 — Unit tests**

Cursor mode: **Agent**

```
Write unit tests for the slot-calculation change.

Location: [FILL IN test file path from Step 0]

Write exactly 2 new test cases:
1. bufferTime=15, duration=60: a slot at time T should block T+60 through T+75.
   Assert that a booking starting at T+61 is NOT available.
   Assert that a booking starting at T+75 IS available.
2. bufferTime=0: behavior is identical to the pre-change baseline.
   Assert that the same slot windows pass as before.

Do not modify any existing tests.
Show the test code before saving.
```

Human check: test 1 asserts blocking behavior. Test 2 is a regression guard. No existing tests modified.

Run: `yarn vitest run [slot test file]`

Expected:
```
✓ bufferTime=0 produces identical slots to no-buffer baseline
✓ bufferTime=15 blocks T+60 through T+75 after a 60-min meeting
```

→ Copy output to `verification/buffer-time.review.md` section "Unit tests".

Full regression: `yarn vitest run packages/core`

→ Copy output to verification file.

**Git commit PR 1:**
```bash
git add packages/prisma/schema.prisma
git add packages/prisma/migrations/
git add packages/trpc/server/routers/eventType.ts
git add [slot calculation file]
git add [slot test file]
git commit -m "feat: add bufferTime field to EventType and slot calculation"
git push origin feat/buffer-time
```

Create PR 1 on GitHub → copy URL to `releases/buffer-time.release.md` and `verification/buffer-time.review.md`.

---

### PR 2: Frontend + E2E

**Step 6 — UI selector**

Cursor mode: **Agent**

```
Implement the UI change for the buffer time feature.

In [FILL IN event type settings component path from Step 0]:
Add a Select field labeled "Buffer time after meeting" with these options:
  { value: 0, label: "No buffer" }
  { value: 5, label: "5 minutes" }
  { value: 10, label: "10 minutes" }
  { value: 15, label: "15 minutes" }
  { value: 30, label: "30 minutes" }
  { value: 60, label: "1 hour" }

The field must:
- Be optional (default 0)
- Wire to the bufferTime field in the existing form submit → tRPC mutation
- Use the same Select component pattern as other duration/notice fields nearby

Do NOT add:
- Any tooltip or explanation text visible to the booker
- Any display of buffer time on the public booking page
- Any changes to confirmation email templates
Show me the diff before saving.
```

Human check: only settings component in diff. No booking page. No email. No tooltip added beyond the label.

---

**Step 7 — E2E test**

Cursor mode: **Agent**

```
Write a Playwright E2E test for the buffer time feature.

File: apps/web/__tests__/e2e/bufferTime.e2e.ts
(or the closest existing E2E test folder — check what exists in apps/web/playwright/ first)

Test scenario:
1. Sign in as organizer (credentials from yarn dx: pro@example.com / pro)
2. Create or update an event type with duration=60 minutes, bufferTime=15 minutes
3. Open the public booking page for that event type as a visitor
4. Select and confirm a booking at 10:00
5. Assert that the 11:00 slot is NOT available (inside buffer window)
6. Assert that the 11:15 slot IS available (after buffer window ends)

Use the existing Playwright helpers, page objects, and fixtures already in the project.
```

Run: `yarn test-e2e --grep "buffer time"` (requires `yarn dx` running)

→ Copy output to verification file.

**Git commit PR 2:**
```bash
git add [event type settings component]
git add apps/web/__tests__/e2e/bufferTime.e2e.ts
git commit -m "feat: add buffer time selector to event type settings and E2E test"
git push origin feat/buffer-time
```

Create PR 2 on GitHub → copy URL to release file.

---

## Red/green run sequence

- Steps 1–5 (backend): run targeted Vitest after each test addition, confirm red → implement → confirm green.
- Step 6 (UI): run targeted component test after assertion change, confirm red → green.
- Step 7 (E2E): run targeted Playwright spec, confirm red → green.
- End of each PR: `yarn vitest run [affected packages]` → `yarn type-check:ci --force` → `yarn biome check --write [changed files]`.

---

## Human plan review notes

> **Reviewer:** [Your name]
> **Date:** [Date]
> **Model used for Plan Mode:** `claude-opus-4-6`
> **Auto model first attempt result:** Hallucinated `getAvailableSlots` as the slot function name — this function does not exist in the repo. Switched to `claude-opus-4-6` and added explicit TBD placeholder.

**What I accepted as-is:**
- Step 1–3 (schema + migration + tRPC) — standard Prisma + tRPC pattern.
- Step 5 test cases — cover both the happy path (buffer=15) and regression (buffer=0).
- Step 7 E2E scenario — mirrors AC3 directly and tests buffer invisibility indirectly.

**What I changed:**
- Changed Zod `max` from 120 to 60 — AI suggested 120; product decision is 60 (highest option is 60 min).
- Marked Step 4 target file as TBD — Auto had a wrong name; forced research in Stage 1.

**What I explicitly rejected:**
- Step 6b proposed by Auto: "Display buffer duration on the confirmation page." Contradicts AC4 (buffer invisible to booker). Removed entirely.

**Approved implementation boundary:**
- PR 1: Steps 1–5 (schema, migration, API, core slot logic, unit tests).
- PR 2: Steps 6–7 (UI selector, E2E test). Depends on PR 1.
- No other files to be touched. Any "while we are here" suggestion must be rejected.

---

## Risks

| Risk | Mitigation |
|---|---|
| Slot function name is unknown until Step 0 — Step 4 is the highest-risk step | Stage 1 research resolves this before any code is written. Do not skip. |
| Agent modifies calendar invite output (violates AC4/D-2) | Diff check: calendar invite path must NOT appear in Step 4 diff. |
| Agent modifies email templates (out of scope) | Email files explicitly in IGNORE list in context map. |
| `minimumBookingNotice` overlap in slot logic | D-1 decision: independent. Verified in Stage 1 research. |
| E2E test requires running Docker | `yarn dx` before Step 7. Document in verification if skipped. |
| Race condition: double submit creates two bookings | Out of scope for v1. Button disable-on-click mitigates in UI. |

---

## Non-goals (explicit)

- No pre-meeting buffer.
- No buffer in calendar invites or emails.
- No global/user-level buffer setting.
- No retroactive changes to existing bookings.
- No changes to recurring or team event flows.
- No configurable buffer units (minutes only, integer only).
