# Secure Runtime Alpha 5961–6040 — Execution Specification

**FedOS Identity Transition Peer Notification and Ratchet Reset
Integration Arc.**

See [reconciliation report](secure_runtime_alpha_5961_6040_reconciliation_report.md)
for Phase A/mandatory-reconciliation. See
[transition notification / wire mapping](secure_runtime_alpha_5961_6040_notification_wire_mapping.md)
and
[acceptance and Ratchet reset truth document](secure_runtime_alpha_5961_6040_acceptance_and_reset_truth.md)
for the field/decision reference.

## Scope

A new, additive bridge domain at
`src/conversation/identity_transition/peer_integration/` wiring the
Identity Transition Foundation (`b4aaab9`) into the live peer-capability
private-transport pipeline (`d825aa0`) and the live authenticated Ratchet
Session Reset foundation (`f80889d`), plus three narrow, additive
extensions to existing production files (all confirmed safe in the
reconciliation report).

## Phases implemented

- **B — Transition notification schema**: `fedos_identity_transition_notification.ts`.
  A `SignableContent`/`Record` split mirroring
  `fedos_ratchet_peer_capability_advertisement.ts` exactly, carrying the
  REAL evidence artifacts (new-key proof, optional continuity evidence,
  bounded Device corroborations) inline. Adds `reasonCategory` beyond
  this Arc's own literal field list — REQUIRED for correct receiver-side
  compromise-reason gating (documented in the file's own header).
- **Control payload extension**: `fedos_ratchet_peer_capability_control_payload.ts`
  gained a third `kind`, `"identity-transition-notification"` — no new
  Nostr kind, no change to the Ratchet's own frozen NIP-17 payload codec.
- **C — Signature/evidence boundary**: the account-level signature reuses
  `authorizeFedosRatchetPeerCapabilityContent()`/
  `verifyFedosRatchetPeerCapabilityAccountAuthorization()` VERBATIM
  (generic over canonical content, same fixed tag, own domain string) —
  no new signing code. Evidence states remain distinct end to end: new-key
  proof validity, continuity-evidence status, and the notification's own
  account authorization outcome are three separate fields/checks, never
  collapsed to one boolean.
- **D — Outbound Notification Coordinator**: `fedos_identity_transition_outbound_notification_coordinator.ts`.
  Preflight (stopped/local-Device-revoked/recipient-Device-unknown) ->
  re-verify the caller-supplied transition + evidence cryptographically
  (never signs unverified evidence onto the wire) -> canonical content
  (with `issuedAt`/`expiresAt` copied VERBATIM from the transition
  record, never a fresh send-time value — see the file's own header;
  this was caught and fixed by the notification-schema test before it
  shipped) -> account authorization -> optional Device signature ->
  encode -> `sendMailboxNip17Control()`, reusing that seam's Outbox/
  retry/Relay-ACK machinery unmodified.
- **E — Inbound Notification Coordinator**: `fedos_identity_transition_inbound_notification_coordinator.ts`.
  classify -> recipient account/Device binding -> local-Device-revoked
  check -> real account-signature verification (signer identity taken
  ONLY from the verified signature, never the claimed `senderAccountRef`
  blind) -> expiry -> reconstruct the transition record from the
  notification's own fields and check its `bodyHash` self-consistency ->
  real new-key-proof/continuity-evidence verification -> pure evidence
  evaluation (the Foundation's own `evaluateFedosIdentityTransitionEvidence()`,
  reused verbatim) -> durable Peer Observation write (which independently
  detects duplicate/conflicting/rollback/broken-predecessor/cycle) ->
  safe status returned. **Disclosed scope limitation**: embedded Device
  corroboration is informational only on the receiving side (this
  Runtime has no access to the sender's own Device Registry to confirm
  trust/revocation state) — never silently upgraded to
  `"device-corroborated"` from the sender's own say-so.
- **F — Durable Peer Transition Observation**: `fedos_identity_transition_peer_observation.ts` +
  `fedos_identity_transition_peer_observation_conflict_detection.ts` +
  `persistence/` (in-memory, append-only). A NEW, dedicated append-only
  domain (never generic Device Sync). Keyed by `(localDeviceRef,
  peerAccountRef, peerDeviceRef, transitionId)` — two different peer
  Devices reporting the same transition get two distinct rows; lineage/
  conflict/rollback scope is `(localDeviceRef, oldAccountIdentity)`, so
  two different LOCAL Devices never share a lineage (Phase M).
- **G — Local acceptance policy**: reuses the Foundation's own
  `FedosIdentityTransitionEvidenceOutcome` (14 values) and
  `FedosIdentityTransitionAcceptanceState` (11 values) directly — no
  third, overlapping vocabulary invented.
- **H — Peer capability integration**: `fedos_ratchet_peer_capability_vocabulary.ts`
  gained one new lifecycle-capability id, `"identity-transition-v1"`, so
  a peer can advertise support through the EXISTING, unmodified
  advertisement pipeline. The finer-grained facts this Arc's brief named
  (`identity-transition-advertised`, `-evidence-verified`, etc.) are
  represented by the Peer Observation's own `evidenceOutcome`/
  `acceptanceState` fields rather than duplicated a second time as new
  `FedosRatchetPeerLifecycleFact` kinds inside the peer-capability
  domain's own frozen union.
- **I — Ratchet impact identification**: `fedos_identity_transition_ratchet_reset_authorization.ts::planFedosIdentityTransitionAffectedSessions()`.
  PURE, read-only — filters an already-loaded list of live session
  records to those whose remote party is the transition's OLD identity
  and whose lifecycle state is still `"initialized"|"active"|"suspended"`.
- **J — Authenticated reset construction**: `authorizeFedosIdentityTransitionRatchetReset()`.
  The ONE function in this Arc that mutates Ratchet state. Refuses
  outright unless `acceptanceState === "accepted"`. Calls the EXISTING,
  unmodified `FedosDirectRatchetOutboundIntegration.establishSession()`
  with `reason: "identity-transition"` (the one new, additive reason
  value) for each affected session — never a new reset message type.
  Binds `transitionId` to the resulting session via a SEPARATE, additive,
  durable local correlation record
  (`fedos_identity_transition_ratchet_reset_link.ts`) rather than
  widening the frozen, positional-array `FedosDirectRatchetSessionResetSignableContent`
  tuple (see the reconciliation report's own "Phase J scope decision").
- **K — Conversation continuity**: honored by omission — this Arc imports
  nothing from `membership/`, `archive/`, or `search/` (proven by the
  structural guard suite); no message author, Membership record, Reply
  reference, Nostr event, Archive entry, or Search participant identity
  is ever touched.
- **L — Archive/Search/Sync exclusions**: proven the same way — zero
  imports from those domains anywhere in `peer_integration/`.
- **M — Multi-Device behavior**: proven directly in
  `secure_runtime_alpha_5961_6040_peer_observation_persistence.test.ts`
  ("Bob Device B observes independently", "two different peer Devices
  reporting the same transitionId are both recorded as distinct rows").
- **N — Safe Runtime facade**: `fedos_identity_transition_peer_runtime.ts::FedosIdentityTransitionPeerRuntime`.
  Composes the Outbound/Inbound coordinators exactly the way
  `FedosRatchetPeerCapabilityRuntime` composes its own two coordinators.
  Exposes `publishIdentityTransitionNotification`,
  `importIdentityTransitionNotification`,
  `recordIdentityTransitionDecision`, `inspectPeerIdentityTransitionStatus`,
  `assessIdentityTransitionRatchetImpact`,
  `authorizeIdentityTransitionRatchetReset`. Never exposes a private key,
  raw evidence internals, a filesystem path, or a generic mutation
  method.
- **O — Real vertical slice**: `test/secure_runtime_alpha_5961_6040_real_vertical_slice.test.ts`.
  100% real BIP-340 Schnorr crypto through notification construction,
  signing, verification, evidence evaluation, durable observation with a
  genuine restart, and reset-authorization call-contract proof (reason
  binding + correlation persistence). The one genuinely WASM-gated piece
  (a real `establishSession()` Double-Ratchet-crypto round trip) is
  `describe.skip`'d in this worktree exactly like the two EARLIER Arcs'
  own real vertical slices (`5561-5640`, `5721-5800`) already are, for
  the identical, pre-existing reason (no compiled `pkg/` here) — not a
  gap specific to this Arc's own design.
- **P/Q — Failure matrix / structural guards**: see the dedicated test
  files; both re-verified against the Foundation's own guard suite
  (extended, never weakened — see "Shared test updates" below).

## Shared test updates (within this Arc's own branch only)

Two PRE-EXISTING test files needed narrow, additive updates because this
Arc's own sanctioned vocabulary widenings changed their exact-count
assertions — neither the other Arc's branch nor worktree was touched:

- `test/fedos_ratchet_device_lifecycle_session_reset_foundation_unit.test.ts` —
  its own closed-reason-vocabulary count assertion updated from four to
  five values (`"identity-transition"` added), with a comment explaining
  why.
- `test/secure_runtime_alpha_5801_5880_structural_guards.test.ts` — its
  own `node:fs`-confinement allowlist extended with this Arc's two new
  append-only backends, and its `fedos_nostr_signing_authority`
  forbidden-import check gained a narrow, explicit, TYPE-ONLY-import
  exception for this Arc's own two new files — the underlying guard
  (no live signing/mutation authority) is unchanged and unweakened.

## Verification performed

`npm run typecheck:core` clean for every file this Arc touched (2
pre-existing, unrelated baseline errors remain). 7 new test files, 55 new
tests (1 intentionally WASM-gated skip), all passing. Re-ran: the
Foundation's own 6 test files (all still pass, including the two edited
above), Device Trust/Registry, Session Reset foundation unit tests,
Nostr signing authority tests, Peer Capability capability-and-lifecycle
unit tests, and both prior structural-exclusion-guard suites — all pass.
Full `npx vitest run`: 842/1067 files and 13,644/13,981 tests passing;
every failing file inspected belongs to the documented pre-existing
missing-WASM-artifact/raw-import class; none of this Arc's own new or
edited files fail. No `pkg/`/`target/`/`Cargo.lock` was generated in this
worktree.

## Next Arc

**FedOS Identity Replacement User Verification and Conversation
Continuity UI Arc.**
