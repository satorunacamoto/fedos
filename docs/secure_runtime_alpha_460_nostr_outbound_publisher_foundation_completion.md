# Secure Runtime Alpha 460 — Canonical Nostr Outbound Publisher Foundation Completion Declaration

Stage 10 (final) of the Alpha 451–460 Canonical Nostr Outbound
Publisher Foundation Arc.

## 1. Completion declaration

Declared complete:

- **Boundary inventory** — confirmed every upstream type this Arc
  depends on (`FedosBoardOutboxIntent`, `FedosNostrWireEvent`,
  `FedosEventDescriptor`, `FedosRelay.publish()`) unchanged, and named
  the exact gap (no adapter between wire event and descriptor; no
  signed-event field on the Outbox itself)
  (`docs/secure_runtime_alpha_451_existing_publisher_boundary_inventory.md`).
- **Scope and return-contract decision** — transport-only slice
  adopted, deliberately narrower than README's own Alpha 450 "Next Arc"
  recommendation; `publishOne`/`publishBatch` return a boolean
  success/failure signal only, never a result object
  (`docs/secure_runtime_alpha_452_publisher_scope_and_return_contract_decision.md`).
- **Entry pairing model** — `FedosNostrBoardPublishEntry { intent,
  event }`; protocol mismatch fails closed to `false`; interface/
  implementation split mirrors `FedosNostrSigningAuthority`/
  `FedosWasmNostrSigningAuthority`
  (`docs/secure_runtime_alpha_453_outbox_relay_entry_pairing_model.md`).
- **Outbox→Relay conversion** — `nostrWireEventToFedosEventDescriptor`
  (`src/board/publish/nostr/fedos_nostr_wire_event_to_event_descriptor.ts`),
  pure, the mirror image of `WebSocketRelay.publish()`'s own inbound
  wire mapping
  (`docs/secure_runtime_alpha_454_nostr_wire_event_to_event_descriptor_mapping.md`).
- **Publisher interface** — `FedosNostrBoardPublisher`
  (`src/board/publish/nostr/fedos_nostr_board_publisher.ts`), the exact
  name and path Alpha 448 reserved
  (`docs/secure_runtime_alpha_455_fedos_nostr_board_publisher_interface.md`).
- **`publishOne()`** — `FedosRelayNostrBoardPublisher`
  (`src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts`), one
  `relay.publish()` call, never throws
  (`docs/secure_runtime_alpha_456_relay_nostr_board_publisher_publish_one.md`).
- **`publishBatch()`** — sequential, independent per-entry outcomes, no
  `Promise.all`, no pool
  (`docs/secure_runtime_alpha_457_relay_nostr_board_publisher_publish_batch.md`).
- **Behavioral verification** — a full Outbox-intent → signed-event →
  conversion → Relay pipeline test, mixed-protocol batch, all green
  (`docs/secure_runtime_alpha_458_publisher_behavioral_verification.md`).
- **Security regression guards** — no Retry/Backoff/Observation/ACK/
  Pool vocabulary in code, no ActivityPub/AT Protocol/Session/Ontology/
  `p2p/` reference anywhere, Outbox persistence and Relay/Signing
  Authority contracts byte-for-byte unchanged
  (`docs/secure_runtime_alpha_459_publisher_security_regression_guards.md`).

## 2. What this Arc establishes

A minimal, transport-only Publisher: `FedosRelayNostrBoardPublisher`
takes a `FedosBoardOutboxIntent` paired with an already-signed
`FedosNostrWireEvent`, converts it to the protocol-neutral
`FedosEventDescriptor` `FedosRelay.publish()` requires, and sends it —
`publishOne()` for one entry, `publishBatch()` for many, both returning
success/failure booleans only. No signing happens inside this
Publisher; no retry, backoff, delivery observation, ACK correlation, or
connection pool exists anywhere in it.

## 3. Still out of scope

Delivery observation (an OK/NOTICE-correlated delivery-state model),
retry/backoff policy, a publish scheduler, marking an Outbox intent
"published," ActivityPub/AT Protocol/Session outbound, Ontology
integration, GUI. These are exactly what README's own Alpha 450 "Next
Arc" recommendation named beyond this Arc's own deliberately narrower
scope (Alpha 452 §1).

## 4. Verification performed at this Stage

- `npx vitest run` on this Arc's own 10 new test files plus the 4
  pre-existing test files this Arc's own new directory structurally
  affects (`secure_runtime_alpha_420`/`421`/`423`/`448`, each carrying
  one `existsSync("src/board/publish"...)` assertion written when that
  path did not yet exist — see §5) — **all GREEN.**
- `npm run typecheck` — GREEN for every file this Arc adds or touches.
- **A concurrent writer was detected in this working tree during this
  Stage's own verification**: `git status` (checked repeatedly, seconds
  apart) showed files under `docs/`, `src/board/observation/`, and an
  edit to `README.md` itself appearing and then disappearing between
  checks, and — during this same window — a brand new commit,
  `272f108 "Add Secure Runtime Alpha 461-470: Canonical Delivery
  Observation Arc"`, landed on top of this Arc's own starting point
  (`8716eb0`, Alpha 431–450), authored by a second, concurrent process
  working this same repository at the same time (no `git remote` is
  configured; this happened entirely locally). That commit's own
  message independently confirms the same finding this Arc reaches at
  §6: it found this Arc's own (then-uncommitted) Publisher work in the
  tree and deliberately left it alone rather than reconciling with it.
  A full-repository `npm test` run captured during this window also
  reported substantially more failures (113 tests across 71 files) than
  any prior Arc's own documented baseline (Alpha 450 §4: 16 tests
  across 10 files), including failures in Rust structural-count tests
  (`secure_runtime_alpha_156`/`158`) this Arc's own diff does not touch
  — consistent with concurrent, in-flight edits by that other process
  during the run, not a regression this Arc introduces. This Stage does
  NOT claim a clean full-repository `npm test` baseline for that reason,
  and commits ONLY this Arc's own specific files — no other untracked
  or concurrently-modified file is added or touched.
- **This Arc's own commit lands out of numeric order**, after
  `272f108` (Alpha 461–470) rather than before it, purely because of
  the timing collision above — Alpha 451–460 was already fully written
  and verified before `272f108` landed, and correctly fills the numeric
  gap between the committed Alpha 431–450 and Alpha 461–470 regardless
  of commit-log position. This is recorded honestly rather than
  silently renumbered or hidden.

## 5. Regression note: four pre-existing tests updated

`secure_runtime_alpha_420_outbox_foundation_completion.test.ts`,
`secure_runtime_alpha_421_existing_nostr_outbound_construction_inventory.test.ts`,
`secure_runtime_alpha_423_nostr_signing_boundary_options.test.ts`, and
`secure_runtime_alpha_448_outbox_publisher_readiness_adapter.test.ts`
each carried one `existsSync("src/board/publish"...)).toBe(false)`
assertion, true as of their own Stage and correct until now — each
one's own doc explicitly named a FUTURE Arc as the place this would be
fulfilled (Alpha 420 §3, Alpha 421, Alpha 448 §"Not built this Stage").
This Arc IS that future Arc, at exactly the path Alpha 448 reserved.
Each assertion is updated from `false` to `true`, with a comment
explaining why; no other line in any of the four files is touched, and
every other assertion in all four continues to pass unmodified.

## 6. Next Arc recommendation

Not this Arc's own concern to decide unilaterally. Alpha 461–470
(Canonical Delivery Observation Arc) is now real, committed history
(`272f108`, landed while this Arc was in progress — §4) and already
declares its own "No next-Arc number recommended" per its own commit
message. This working tree separately still contains further-numbered,
UNCOMMITTED material (Alpha 471–480-labeled documents and source under
`src/board/outbox/fedos_board_outbox_publisher.ts`,
`fedos_board_outbox_observation.ts`, `fedos_publish_scheduler.ts`) that
this Arc did not create, does not import, and does not reconcile with —
mirroring the same posture Alpha 451 §4 already took toward the single
such file found at that Stage, and the posture Alpha 461–470's own
commit message already took toward this Arc's own then-uncommitted
work. Whoever commits that Arc next should resolve the reconciliation
between the three parallel Observation/Publisher/Scheduler threads
(this Arc's own transport-only Publisher, Alpha 461–470's own
`FedosDeliveryObservation`, and the still-uncommitted
`FedosBoardOutboxPublisher`/`FedosPublishScheduler` thread) — not this
Arc's own doc, which has no authority over work outside its own diff.

## 7. See also

- `docs/secure_runtime_alpha_451_existing_publisher_boundary_inventory.md`
  through `docs/secure_runtime_alpha_459_publisher_security_regression_guards.md`
- `docs/secure_runtime_alpha_450_master_seed_authority_and_nostr_signing_activation_completion.md`
- `docs/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.md`
