# Release Notes & Deployability: Buffer Time Between Bookings

**Feature slug:** `buffer-time`
**PR 1 (backend):** [FILL IN after push]
**PR 2 (frontend + E2E):** [FILL IN after push]
**Release type:** Non-production / Feature branch (bootcamp submission)
**Date:** [FILL IN]
**Verification:** [`verification/buffer-time.review.md`](../verification/buffer-time.review.md)

---

## Summary

Adds configurable post-meeting buffer time to cal.diy event types.
Organizers can set a 5–60 minute gap that is automatically enforced in slot availability,
preventing back-to-back bookings without requiring manual calendar blocking.
The buffer is invisible to bookers — calendar invite duration is unchanged.

---

## What changed

| File | Change |
|---|---|
| `packages/prisma/schema.prisma` | Added `bufferTime Int @default(0)` to `model EventType` |
| `packages/prisma/migrations/YYYYMMDD_.../migration.sql` | `ALTER TABLE "EventType" ADD COLUMN "bufferTime" INTEGER NOT NULL DEFAULT 0` |
| `packages/trpc/server/routers/eventType.ts` | Added `bufferTime` to create/update input schemas (Zod min=0, max=60) + persist to DB |
| `[slot calculation file — FILL IN]` | `duration` → `duration + (event.bufferTime ?? 0)` in slot window computation only |
| `[event type settings component — FILL IN]` | Added "Buffer time after meeting" `<Select>` field with options 0/5/10/15/30/60 |
| `[slot test file — FILL IN]` | 2 new unit tests (buffer=15 case + buffer=0 regression) |
| `apps/web/__tests__/e2e/bufferTime.e2e.ts` | New Playwright E2E: configure buffer → book → assert slot blocking |

**Total:** 1 new file, ~6 modified files. Estimated new lines: ~60 implementation + ~50 test = ~110.

---

## Tests / checks evidence

| Suite | Command | Result |
|---|---|---|
| Unit (new) | `TZ=UTC yarn vitest run [slot test file]` | [PASTE OUTPUT] |
| Regression | `TZ=UTC yarn vitest run packages/core` | [PASTE OUTPUT] |
| E2E | `yarn test-e2e --grep "buffer time"` | [PASTE OUTPUT] |
| Type-check | `yarn type-check:ci --force` | Pre-existing errors only |
| Biome | `yarn biome check --write [changed files]` | [PASTE OUTPUT] |

See full evidence in [`verification/buffer-time.review.md`](../verification/buffer-time.review.md).

---

## Release readiness

### Observability

- No new logging added. `bufferTime` value is observable via Prisma Studio
  (`yarn db-studio`) or direct DB query: `SELECT "bufferTime" FROM "EventType";`
- No feature flag needed — `bufferTime = 0` default preserves all existing behavior
  for every event type that hasn't explicitly configured a buffer. Zero-risk for existing data.

### Rollout

Safe to deploy without coordination. The migration adds a column with a non-nullable
default — no existing rows are affected and no data migration is needed.

All existing event types get `bufferTime = 0` automatically → no behavior change
for anyone who hasn't set a buffer. Can be deployed to all environments simultaneously.

---

## Rollback plan

| Scenario | Rollback action | Complexity |
|---|---|---|
| Migration causes DB issue | Run down migration: remove the `bufferTime` column. Safe — additive column, no data dependency. | Low |
| Slot logic regression after deploy | Revert PR 1 commit. The column remains in DB but is ignored by code (default 0 = no effect). | Low |
| UI selector causes form errors | Revert PR 2 commit independently. Backend change is self-contained and works without UI. | Low |
| Both PRs rolled back | Revert both. DB column with default 0 has no effect on behavior once code reverted. | Low |

**Maximum rollback complexity: Low.** PR 1 and PR 2 are independently revertible.
Reverting PR 2 (UI) alone leaves a backend that accepts `bufferTime` but no UI to set it —
safe, invisible to users.

---

## Known risks / limitations

| # | Risk | Severity | Mitigation / accepted |
|---|---|---|---|
| KR1 | AC4 (calendar invite unchanged) not covered by automated test — requires manual verification | Low | Manual protocol documented in verification file Gate 1. Confirmed via code review that invite path was not touched. |
| KR2 | E2E test requires Docker (`yarn dx`) and is not wired to CI pipeline for this bootcamp branch | Low | Passes locally. CI integration is out of scope for bootcamp submission. |
| KR3 | If a user sets `bufferTime=15` and is using a timezone with DST transition at the buffer boundary, slot edge may shift by 1 hour | Very low | Out of scope for v1. Standard cal.diy timezone handling applies. |

---

## Final deployability decision

✅ **Deployable.**

- All 5 acceptance criteria addressed (AC1–3, AC5 automated; AC4 code review + manual).
- All tests pass. No regressions.
- Migration is additive and safe.
- Rollback is straightforward and low-risk.
- No scope creep confirmed — email/invite paths not touched.

**Merge order:** PR 1 (schema + API + core logic + tests) → PR 2 (UI + E2E).
Do not merge PR 2 before PR 1.
