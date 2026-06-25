# Context Map: Buffer Time Between Bookings

**Feature slug:** `buffer-time`
**Story:** [`specs/buffer-time.story.md`](../specs/buffer-time.story.md)
**Spec:** [`specs/buffer-time.spec.md`](../specs/buffer-time.spec.md)

---

## HOT context — directly required for this feature right now

### Spec & Story

| Artefact | Path | Notes |
|---|---|---|
| User story | `specs/buffer-time.story.md` | Fixed scope: post-meeting buffer, 5 AC, out-of-scope list. |
| Technical spec | `specs/buffer-time.spec.md` | Decisions D-1/D-2/D-3; all 5 AC; open questions; spec self-check. |

### Active files — database

| File | Role | Why it matters |
|---|---|---|
| `packages/prisma/schema.prisma` → `model EventType` | Schema to modify | Agent needs current `EventType` field list to add `bufferTime Int @default(0)` correctly without conflicts. |
| `packages/prisma/migrations/` | Migration destination | Agent must follow existing migration naming convention (timestamp prefix). |

### Active files — API / tRPC

| File | Role | Why it matters |
|---|---|---|
| `packages/trpc/server/routers/viewer/eventTypes/types.ts` | tRPC input schema | Contains create/update Zod schemas; agent needs to see existing pattern (e.g. `minimumBookingNotice`, `afterEventBuffer`) to follow the same structure for `bufferTime`. |
| `packages/trpc/server/routers/viewer/eventTypes/heavy/create.handler.ts` | Create mutation | Persists new event type fields. |
| `packages/trpc/server/routers/viewer/eventTypes/heavy/update.handler.ts` | Update mutation | Persists updated event type fields. |
| `packages/features/eventtypes/lib/schemas.ts` | Shared Zod schema | Event type input validation used across create/update flows. |

### Active files — core slot logic

| File | Role | Why it matters |
|---|---|---|
| `packages/features/schedules/lib/slots.ts` | Slot-generation function (`getSlots`) | Primary file where `bufferTime` may change slot computation. Most critical file. Must be confirmed by research before Step 4 — do not guess. |
| `packages/features/busyTimes/services/getBusyTimes.ts` | Busy-period blocking | Applies existing `beforeEventBuffer` / `afterEventBuffer` when marking slots unavailable — likely also relevant for post-meeting buffer. |
| `packages/features/schedules/lib/slots.test.ts` | Slot-calculation tests | Baseline for regression. Agent must not break these. New tests co-located here. |

### Active files — frontend

| File | Role | Why it matters |
|---|---|---|
| `packages/features/eventtypes/components/tabs/limits/EventLimitsTab.tsx` | Event type limits/buffer settings | Where existing buffer controls (`beforeEventBuffer`, `afterEventBuffer`) and `minimumBookingNotice` live. Follow this component's Select/Controller pattern for the new field. |
| `apps/web/app/(use-page-wrapper)/event-types/[type]/page.tsx` | Event type settings route | App Router entry point that renders the event type settings UI. |

---

## WARM context — reusable guidance, always active

### Project configuration

| Item | Path | Key rules for this feature |
|---|---|---|
| AGENTS.md | Repo root | Use `select` not `include` in Prisma queries; `import type` for type imports; direct paths, no barrel imports; conventional commits (`feat:`); PRs < 500 lines. |
| `.cursor/rules/` | Repo root | Repo-specific cursor rules — check for TypeScript, Prisma, and tRPC conventions before generating code. |

### Similar field pattern (follow this, don't invent)

| File | Detail |
|---|---|
| `minimumBookingNotice` in `schema.prisma` | Template for how an optional integer field is declared on `EventType`. |
| `afterEventBuffer` in `schema.prisma` | Existing post-meeting buffer field — closest structural analogue to `bufferTime`. |
| `minimumBookingNotice` / `afterEventBuffer` in `packages/trpc/server/routers/viewer/eventTypes/types.ts` and `packages/features/eventtypes/lib/schemas.ts` | Template for how a Zod-validated optional integer is accepted and persisted in the tRPC mutation. |
| `minimumBookingNotice` / `afterEventBuffer` in `packages/features/eventtypes/components/tabs/limits/EventLimitsTab.tsx` | Template for how similar numeric controls are rendered (Select + Controller pattern). |

### Commands reference

| Command | When to use |
|---|---|
| `yarn workspace @calcom/prisma db-migrate --name [name]` | After schema change |
| `yarn vitest run [file]` | Targeted test run (use TZ=UTC prefix if timezone-sensitive) |
| `yarn type-check:ci --force` | Before every push |
| `yarn biome check --write [files]` | Lint + format changed files |
| `yarn dx` | Start local stack (Docker required) |
| `yarn test-e2e --grep "[pattern]"` | Targeted Playwright run |

---

## COLD context — investigate only if needed

| Area | Path | When to access |
|---|---|---|
| Slot pipeline internals | `packages/trpc/server/routers/viewer/slots/util.ts` | Only if slot generation has unexpected dependencies in Step 4. |
| Booking confirmation page | `apps/web/` — booking success/confirmation component | Only to confirm buffer is NOT shown there (verify D-2). Read-only. |
| Playwright test helpers / fixtures | `apps/web/playwright/` | Only when writing E2E test in Step 7. |
| tRPC mutation shape for event type | `packages/trpc/server/routers/viewer/eventTypes/` (full router) | Only if the create/update mutation input shape is significantly different from what the Zod pattern suggests. |
| `CONTRIBUTING.md` | Repo root | Only if unsure about PR process, naming conventions, or commit format. |

---

## IGNORE — explicitly excluded

| Resource | Reason |
|---|---|
| `packages/emails/` and all email templates | AC4/D-2: buffer must be invisible. Including email files increases risk of agent "helpfully" adding buffer display in emails. |
| Calendar invite generation code | AC4/D-2: invite duration must remain `event.length`. Same risk as emails. |
| Public booking page components | Buffer must not appear to the booker. Agent must not modify the booker-facing slot display. |
| `packages/app-store/` (all) | Third-party integrations — completely unrelated to this feature. |
| `deploy/`, `docker-compose.yml` | Infrastructure — not touched. |
| Recurring events logic | Non-goal per spec. |
| Team / org routing code | Non-goal per spec. |
| `packages/prisma/migrations/` (historical migrations) | Read-only context. Only the new migration is created — old ones are not touched. |

---

## Context decisions and rationale

**Why email and calendar invite files are in IGNORE:**
D-2 decision requires the buffer to be invisible to the booker. Keeping these files
out of context enforces the scope boundary mechanically — if the agent can't "see"
the confirmation email template, it can't add buffer display there even if it tries.
This is an active context pollution prevention decision, not an oversight.

**Why the slot function is marked TBD (filled in after Stage 1 research):**
Auto model hallucinated `getAvailableSlots` as the function name — it does not exist
under that name in this repo. Rather than trust model memory, we use Ask mode to
confirm the exact file path before any code is written. Stage 1 is a mandatory gate.

**Why `minimumBookingNotice` is in WARM, not HOT:**
It is not being changed. It serves only as a structural pattern reference — how to
add a Zod-validated optional integer to both the schema and the tRPC router. D-1
confirms it is semantically independent from `bufferTime`.

**Context map format used:**
Standard HOT/WARM/COLD/IGNORE with three sub-layers in HOT (spec, database, slot logic,
frontend). No modifications to the template were needed — all four tiers were meaningful
for this feature scope.
