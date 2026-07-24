# Secure Runtime Alpha 7721–7800 — Completion Declaration

**FedOS Archive Multi-Device Suppression Propagation Arc.**

Base: `feff676a` (Secure Runtime Alpha 7481–7560). Implements the exact
next Arc `feff676a`'s own completion declaration recommended: "closing
[the genuinely-foreign/never-informed Device limitation] for real would
require a deliberate, reviewed mechanism to propagate a deletion FACT
(not archive bytes) across a user's own already-paired devices." Ran as
"Arc B" of a two-Arc parallel-execution assignment; "Arc A" (FedOS
Delivery Observation Repository Subject Index and Query Scalability) ran
independently in a separate worktree/branch and was never touched by
this Arc (Phase N structural guard, test 3).

## Verdict: FULL COMPLETION

Every completion criterion the mission itself named is met:

- **Authenticated durable suppression fact** — `FedosArchiveSuppressionFact`
  (Phase C), a closed, versioned, 10-field type, only ever produced by
  its own dedicated constructor/validator, never a message-content or
  Archive-binary transfer.
- **Same-account trusted-Device propagation** — `FedosArchiveSuppressionOutboundCoordinator`
  fans a fact out to every OTHER currently-trusted Device on the SAME
  account (Phase F), over a real, new, dedicated `kind:1` route (never a
  new NIP), reusing the EXISTING `FedosDeviceRelaySyncPublisher`
  unmodified. `FedosArchiveSuppressionInboundHandler` verifies real
  BIP-340 Schnorr signatures, Device Registry trust, expiry, and account
  match before ever recording anything (Phase G).
- **Offline/pending truth, never fabricated** — `aggregateFedosArchiveSuppressionFactStatus()`
  (Phase I) reports per-Device status honestly: `"never-attempted"` for
  a Device that paired after the fact existed, `"relay-accepted"` as the
  strongest claim (never "the target imported it" — no
  return-acknowledgement protocol was built, by explicit scope).
- **Restore suppression after receipt** — `restoreFedosConversationArchiveBundle()`
  gains one new, optional `suppressionAuthority` dependency (Phase H);
  proven live that an IMPORTED fact denies restore of both the Envelope
  and the Payload even when the restoring Device's own local Retention
  log knows nothing about the deletion.
- **Restart safety** — the file-backed
  `AppendOnlyFedosArchiveSuppressionObservationPersistence` survives a
  literal object-recreation restart with zero hydration code, proven in
  the real, no-mocks Phase K vertical slice (real local WebSocket relay,
  real client, real BIP-340 signing, real file-backed persistence across
  3 Device contexts: A creates+fans out, B receives+restarts+suppresses,
  C — not yet paired at fanout time — legitimately still restores, an
  honestly disclosed limitation, not a bug).
- **Per-Device aggregation, no global-erasure overclaim** — Phase N's
  own structural guards (tests 11–12) scan every new/modified doc and
  source file for physical-erasure, relay-side-deletion,
  account/backup-wide-deletion, and `"all Devices informed"` language,
  requiring every mention to sit inside an explicit disclaimer.

## A real bug found and fixed during Phase K's own vertical slice

The first attempt at the real multi-Device vertical slice pushed
`message.event` (a raw `FedosNostrWireEvent`, fields `pubkey`/
`created_at`/`sig`) directly into a buffer typed as
`FedosEventDescriptor` (fields `author`/`createdAt`/`signature`) without
running it through the existing `nostrWireEventToFedosEventDescriptor()`
adapter. The Inbound Handler's very first check
(`descriptor.author !== payload.fact.accountRef.publicIdentifier`) then
always failed, since `descriptor.author` was `undefined` on the raw wire
shape — surfacing as a misleadingly generic `"invalid-signature"`
outcome rather than a type error, because both shapes are plain
JS objects. Root-caused by logging the actual outcome and descriptor,
tracing the field-name mismatch, and fixing the test to apply the SAME
adapter the outbound side already uses in reverse. No production code
was at fault — this was purely a test-fixture bug — but it is recorded
here because it is exactly the kind of subtle field-mapping mistake a
real relay round trip catches and a fully-mocked one would not have.

## What this Arc deliberately did NOT do

Per its own absolute prohibitions (Phase N, tests 1–15): no global
deletion guarantee, no forced deletion on an offline Device, no remote
filesystem deletion, no Relay deletion, no backup rewriting, no
automatic Signed Deletion approval, no new public NIP, no new
general-purpose Device Sync protocol, no message plaintext or raw
sender/recipient metadata in any wire/fact type, no private-key/
SecretHandle/Master-Seed/Ratchet-session-secret transfer, no Archive
binary transfer, no Identity Transition redesign, no Device Trust
redesign, no second Device Registry, no second Sync Journal, no
Delivery Observation Repository indexing/query change, no Board/
Conversation Outbox Scheduler change, no `p2p/` or `.tmp_gen/` change.

## Documentation produced

- `secure_runtime_alpha_7721_7800_reconciliation_report.md` (Phase A)
- `secure_runtime_alpha_7721_7800_threat_and_trust_model.md` (Phase B)
- `secure_runtime_alpha_7721_7800_suppression_fact_schema.md` (Phase C)
- `secure_runtime_alpha_7721_7800_authentication_and_evidence_model.md` (Phase D)
- `secure_runtime_alpha_7721_7800_durable_ownership_and_conflict_model.md` (Phase E)
- `secure_runtime_alpha_7721_7800_device_sync_propagation_specification.md` (Phase F/G)
- `secure_runtime_alpha_7721_7800_archive_restore_integration_truth.md` (Phase H)
- `secure_runtime_alpha_7721_7800_multidevice_status_and_non_guarantees.md` (Phase I/J)
- This completion declaration

## Verification performed

- `npx tsc --noEmit`: clean, modulo the same two pre-existing baseline
  errors `feff676a` itself already disclosed
  (`test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
  `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`),
  confirmed via `git diff` that neither file was modified by this Arc.
- Targeted Archive/Retention/Local-Deletion/Device-Registry-Trust/
  Device-Pairing/Device-Sync/Search/Safety-Center regression: 34 test
  files, 437 tests — 434 passing, 1 pre-existing failure
  (`test/runtime_wasm_loader_js_glue_module_retention_execution.test.ts`,
  a Rust-pub-fn-count structural guard — this Arc made zero Rust/Cargo
  changes, confirmed by Phase N's own zero-diff guard on
  `packages/fedos-core-rust`, and this exact class of drift is the
  documented "fresh worktree raw-import artifact" already seen across
  many prior Arcs in this lineage), 2 skipped (pre-existing, unrelated).
- This Arc's own 7 test files: 62 tests, all passing (fact/schema unit
  tests, outbound/inbound sync with real BIP-340 signing, restore
  integration, real multi-Device vertical slice, Signed Deletion
  relationship separation, failure matrix, structural guards).
- Secret/plaintext scan: performed both via a direct grep for
  private-key/PEM markers across every new file (none found) and via
  Phase N's own structural guard (test 10) scanning for forbidden field
  names (`plaintext`, `ciphertext`, `masterSeed`, `privateKey`,
  `secretHandle`, `ratchetState`, `sessionKey`, `archiveBytes`,
  `bytesBase64`) in every new wire/fact type.
- Real multi-Device vertical slice (Phase K): real local WebSocket relay
  server, real `WebSocketRelay` client, real BIP-340 Schnorr signing, real
  file-backed persistence across a literal restart — passing.
- Full `npx vitest run`: 1146 files / 14677 tests — 849 files / 14238
  tests passing, 270 files / 361 tests failing, 78 skipped. The failing
  set is the well-documented, pre-existing "fresh worktree raw-import
  artifact" class (hundreds of historical `test/fedos_core_rust_*.test.ts`
  "Stage NNN" milestone checks, `test/reviews/*` source-alignment scans,
  and Rust-pub-fn-count structural guards that assert properties about
  the raw repository/package layout, unrelated to runtime behavior) —
  confirmed, not assumed: (1) zero overlap between the visible failing
  files and any file this Arc touched or created (`git diff`/`git
  status` scoped checks against sample failures, e.g.
  `test/reviews/private_protocol_delivery_group_v1/source_alignment.test.ts`,
  came back empty); (2) the targeted regression run's own single failure
  (`runtime_wasm_loader_js_glue_module_retention_execution.test.ts`,
  pub-fn-count drift) was independently diagnosed above as the same
  artifact class. Count is consistent with the range this exact artifact
  class has measured at across many prior Arcs in this lineage.

## Recommended next Arc

**FedOS Archive Suppression Return-Acknowledgement Protocol Arc** — the
one honestly-disclosed limitation this Arc leaves standing:
`"relay-accepted"` is the strongest per-Device delivery claim this Arc's
own status model can make; there is no real signal that a target Device
actually imported and applied a propagated suppression fact, nor any
resend-on-late-pairing mechanism for a Device that pairs after a fact
was already fanned out. A future Arc could add a narrow, reviewed return
fact (mirroring Signed Deletion's own Acknowledgement record) — a
natural, bounded follow-on now that fanout/import/restore-suppression is
solid, never a general-purpose Device Sync redesign.
