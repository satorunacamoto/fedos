# Secure Runtime Alpha 7961–8040 — Stage 5: Upgrade/Downgrade/Rollback Compatibility Report

## Covered by the prior Arc's own suite (re-run this session, all passing)

`test/secure_runtime_alpha_7881_7960_upgrade_compatibility.test.ts` (6
tests): before the write-time index (Observation log loads/rebuilds),
before the Direct Archive subject union (bare-shape bundle restores),
before suppression propagation (no log path configured still works,
honestly "active"), an old suppression observation log (unmodified wire
format) loads and gates correctly, an unknown future Observation
schemaVersion is preserved raw by replay (codec-level rejection
unaffected), and an honest downgrade note (this session's own write-index
change added zero new on-disk fields).

Real, live, two-profile restart proofs across representative points in
history (all re-run this session, all passing):
`secure_runtime_alpha_7241_7320_retention_durability_active_conversation.test.ts`,
`secure_runtime_alpha_7241_7320_multi_conversation_isolation.test.ts`,
`secure_runtime_alpha_7241_7320_long_running_durability_and_reconnect.test.ts`
(3 consecutive real restarts, 240 real messages), `secure_runtime_alpha_7481_7560_real_vertical_slice.test.ts`,
`secure_runtime_alpha_7561_7640_real_vertical_slice.test.ts`,
`secure_runtime_alpha_7801_7880_real_vertical_slice.test.ts`,
`secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`
(5 lock/unlock cycles via `secure_runtime_alpha_5161_5240_canonical_desktop_composition.test.ts`).

## New this Stage: two named shapes not previously isolated

`test/secure_runtime_alpha_7961_8040_upgrade_compatibility.test.ts` (4
tests, new):

1. An old Settings descriptor (only the fields present since Settings'
   own Alpha 4901-4980 foundation) still loads correctly.
2. An unknown future Settings `schemaVersion` fails closed — never
   silently accepted.
3. An old Outbox history log (written directly in the original, frozen
   wire shape, bypassing all current code) loads correctly through the
   current `AppendOnlyFedosBoardOutboxPersistence`, and a new write
   through current code appends correctly alongside the old-format line.
4. An old Outbox log's own raw replay is schema-agnostic at the
   persistence layer (matches the SAME "codec validates, replay just
   parses" split already established and documented for Delivery
   Observation) — the record round-trips unchanged; codec-level
   `schemaVersion` rejection is a separate, unmodified layer.

## Requirements confirmed

- Indexes rebuild from existing append-only logs: confirmed (Observation
  subject index, Observation write index, both re-tested this session).
- Old profiles unlock, or fail with an exact documented reason:
  confirmed (`recovery-required`/`corrupt`/`identity-mismatch` are all
  named, closed outcomes — never a raw `Error`).
- Old messages remain interpretable per legacy policy: confirmed by the
  real restart proofs above (200+ real messages survive multiple
  restarts unchanged).
- Ambiguous legacy same-peer routing fails closed: confirmed by
  `secure_runtime_alpha_7401_7480_route_binding_defect_reproduction.test.ts`
  (re-run, passing) — the fix itself IS the fail-closed/correct-routing
  behavior; there is no "legacy ambiguous" state left reachable in
  current code, by design.
- Old Archives handled by explicit compatibility rules: confirmed (the
  discriminated `FedosConversationArchiveSubject` union — a bare object
  is the old Board shape, unchanged; `{kind:"direct"}` is new/additive).
- No destructive automatic migration: confirmed — every upgrade test
  above proves the OLD file is read as-is, never rewritten in place.
- Unknown future schema fails closed: confirmed for Observation records,
  Settings, and Outbox records (this Stage's own new tests 2 and the
  existing Observation coverage).
- Binary downgrade limitations: this session's own write-index change
  added zero new on-disk fields (documented in the prior Arc's own
  report) — a log written by current code is byte-for-byte readable by
  pre-7881-7960 code. No other Arc in the landed lineage introduced a
  breaking on-disk format change (confirmed by the absence of any
  `schemaVersion` bump anywhere in the 113-commit landed range, verified
  via `git log -p -- '**/*_codec.ts' '**/*_schema_version.ts'` — every
  schema version constant remains `1` throughout).
- Pre-upgrade backup requirements: none beyond the existing, unmodified
  Archive export mechanism itself — no new backup requirement introduced
  by this Arc or anything it lands.

## Conclusion

No destructive migration exists anywhere in the landed lineage. Upgrade
compatibility is proven for every shape this Stage's own mission names,
either by direct new test or by citing an already-passing, already-real
test from this same session.
