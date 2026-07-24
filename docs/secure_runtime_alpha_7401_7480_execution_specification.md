# Secure Runtime Alpha 7401–7480 — Execution Specification

**FedOS Direct Conversation Route Binding and NIP-17 Inbound Isolation Arc.**

Resumes from Secure Runtime Alpha 7321–7400 (`194dc448`). Runs in a
dedicated worktree/branch, `arc/direct-conversation-route-binding-nip17-isolation`,
base `194dc448`.

## Mission (as given)

A real security-correctness defect was proven during Alpha 7241–7320:
two concurrent Direct Conversations involving the same peer can be
silently misrouted by inbound NIP-17 processing, because inbound routing
resolves primarily by peer identity rather than an unambiguous
conversation/session binding. This Arc first decides the minimum
compatible routing model, then — only if one safe model is unambiguous —
implements it. Fail closed over fabrication.

## Stage 1 — Review Gate

### Phase A — Defect reproduction

Two findings, both documented in
`docs/secure_runtime_alpha_7401_7480_defect_reproduction_report.md`:

1. **Live-reproduced, fresh** (this Arc's own independent test,
   `test/secure_runtime_alpha_7401_7480_route_binding_defect_reproduction.test.ts`,
   plus re-running the prior Arc's own test unmodified): the standard
   `nostr-nip17-v1` route silently misrouted a message addressed to a
   second, later-created Direct conversation into the first
   (`resolveFedosPrivateNostrInboundDirectConversation()`, Alpha 1424 —
   peer-pubkey-only, first-match).
2. **Source-traced**: the Direct Ratchet route (Alpha 5561–5640) does
   NOT silently misroute (its own session-id embeds the conversationId
   and a cross-check exists) but instead deterministically REJECTS a
   second same-peer session-init as `"wrong-conversation"` — a different
   symptom, identical root cause.

### Phase B — Route inventory

`docs/secure_runtime_alpha_7401_7480_route_inventory.md` — every
identifier at every layer (Conversation ID, Membership ID, account/Device
refs, Ratchet session identity/generation, NIP-17 Rumor/Seal/Gift-Wrap
id, Outbox/Relay event id, invitation identity, control-payload
discriminator), assessed for authentication, encryption, Relay
visibility, persistence, and routing suitability.

### Phase C — Option review

`docs/secure_runtime_alpha_7401_7480_option_review.md` — eight options
(A–H) evaluated; Option C (encrypted Rumor content/tags) selected, with
Option F's algorithmic shape ("decrypt once by peer, then disambiguate")
and Option E's "exact binding" intent absorbed into the concrete design.
Options A (Relay-visible), B (touches a shared cross-route codec), D
(would require eliminating the plain route), and G (product regression,
doesn't fix reachable existing state) were disqualified or rejected.

### Phase D — Normative decision

`docs/secure_runtime_alpha_7401_7480_routing_decision.md` — a versioned,
closed route-binding structure inside the encrypted Rumor content, used
as the PRIMARY resolution key (never a secondary equality check against
a peer-only guess). Classified explicitly as a FedOS-proprietary
encrypted payload convention, never a new NIP.

### Phase E — Decision gate: PASSED

Recorded in the Normative Decision doc's own gate section. All required
conditions met; proceeded to Stage 2.

## Stage 2 — Implementation

### Phase F — Closed route-binding type

- NEW: `src/conversation/delivery/nostr/nip17/fedos_direct_conversation_plain_message_payload.ts`
  — `FedosDirectConversationPlainMessagePayloadV1` (`schemaVersion: 1`,
  `conversationId`, `senderAccountRef`, `recipientAccountRef`, `body`), a
  3-way discriminated decode result (`ok` / `absent` / `malformed`) —
  richer than the Ratchet payload's own simple-nullable `decode()`,
  needed to give the Legacy Policy its own distinct `"malformed-binding"`
  vs. genuinely-absent-binding outcomes.
- MODIFIED (additive): `fedos_direct_ratchet_nip17_payload.ts` —
  `FedosDirectRatchetMessagePayloadV1.schemaVersion` widened to `1 | 2`;
  `conversationId?` added, required at `schemaVersion: 2`; a new
  `isRecognizableFedosDirectRatchetNip17PayloadShape()` lets the inbound
  side distinguish "ratchet-shaped, unsupported version" from "not a
  ratchet payload at all" — closing a real gap found while writing the
  failure matrix (an unrecognized-schemaVersion ratchet message would
  otherwise have silently fallen through to the legacy plain-chat path).

### Phase G — Outbound wiring

- `fedos_conversation_direct_messaging_coordinator.ts`: the plain
  route's own `sendDirectMessage()` now wraps `plaintext` in the new
  envelope (real, already-validated `conversationId`/participant refs)
  before handing bytes to `sendMailboxNip17()` — LOCAL storage/plaintext
  semantics are completely unchanged; only the WIRE bytes change.
- `fedos_direct_ratchet_outbound_integration.ts`: the Ratchet route's own
  `"message"` payload now emits `schemaVersion: 2` with `conversationId`
  (the already-real parameter this method already received).

### Phase H — Inbound routing

- NEW: `fedos_direct_conversation_route_binding_resolver.ts` —
  `resolveFedosDirectConversationByRouteBinding()`, an O(1) direct lookup
  by the binding's own `conversationId`, then a genuine Membership check
  — never a scan, never a first-match guess.
- NEW: `fedos_private_nostr_inbound_legacy_candidate_count.ts` —
  `countFedosPrivateNostrInboundLegacyCandidates()`, mirrors the OLD
  resolver's own iteration but collects every match (for the bounded
  Legacy Policy's ambiguity check only).
- `fedos_nip17_inbound_import_coordinator.ts`: binding-first resolution,
  legacy fallback only on genuinely absent bindings.
- `fedos_direct_ratchet_inbound_integration.ts`: session-init and
  `schemaVersion: 2` messages resolve via the binding directly; only
  `schemaVersion: 1` messages use the bounded legacy fallback; unknown
  schemaVersions fail closed as `"unsupported-version"`.
- New closed outcomes across both routes: `"malformed-binding"`,
  `"unknown-conversation"`, `"membership-denied"`, `"binding-mismatch"`
  (Ratchet route's tamper/integrity cross-check, renamed from the old
  `"wrong-conversation"` ambiguity-guess semantics), `"ambiguous-legacy-route"`,
  `"unsupported-version"`.

### Phase I — Legacy and migration policy

`docs/secure_runtime_alpha_7401_7480_legacy_migration_policy.md` — 0
candidates → unknown-sender; exactly 1 → legacy-unambiguous, accepted; 2+
→ fails closed. No destructive migration; no new persisted-state version;
no past Relay event ever rewritten.

### Phase J — Multi-Device and Session Reset isolation

`test/secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts`
— real WASM Ratchet crypto, real Device Registry, real Session Reset:
two independent same-peer Conversations, BOTH session-inits now succeed
(closing Finding 2), each Conversation's messages route correctly and
only to themselves, a Session Reset on one Conversation's session leaves
the other's completely untouched, restart survives both, and Device
revocation (Device-pair-scoped by design) correctly stops every
Conversation sharing that Device pair — proven, not merely asserted.

### Phase K — Real vertical slice

Three real test files together prove the mission's own numbered success
sequence: `..._route_binding_defect_reproduction.test.ts` (create, invite,
two Conversations, A/B routing, restart-free baseline),
`..._ratchet_route_binding_isolation.test.ts` (Ratchet session
establishment ×2, interleaving, Session Reset isolation, restart, Device
revocation), `..._real_vertical_slice.test.ts` (duplicate Relay
redelivery is a no-op, reverse delivery order still lands correctly,
Search stays isolated per Conversation for the same-peer case). Signed
Deletion's own control payload already carried an explicit,
authenticated `conversationId` and was never vulnerable — verified, not
re-fixed.

### Phase L — Failure matrix

`test/secure_runtime_alpha_7401_7480_failure_matrix.test.ts` (11 tests)
plus cross-referenced coverage in the Phase K/J files — 22 named
scenarios, all closed, none silently accepted.

### Phase M — Structural guards

`test/secure_runtime_alpha_7401_7480_structural_guards.test.ts` (15
tests) — no peer-only first-match routing survives as a PRIMARY path, no
unauthenticated routing fact, no Relay-visible Conversation ID, no
silent legacy fallback under ambiguity, no new NIP, no new crypto
primitive, no second Runtime/authority, zero Identity Transition/Signed
Deletion/Ratchet-cryptographic-core change, zero Electron/p2p/.tmp_gen
change.

## Verification

- `npx tsc --noEmit` — clean (the same 2 known pre-existing baseline
  errors, unrelated to this Arc).
- `cargo test` — unaffected (zero Rust files touched, confirmed by
  structural guard).
- WASM build — a real `pkg/` artifact was built fresh for this session
  (this worktree lives outside the OneDrive-synced tree, so the
  previously-documented `CARGO_TARGET_DIR` workaround was not needed).
- Targeted suites — this Arc's own 6 new/modified test files, all
  passing; the reconciled prior-arc tests
  (`secure_runtime_alpha_7241_7320_multi_conversation_isolation.test.ts`,
  `secure_runtime_alpha_7081_7160_structural_guards.test.ts`) passing
  with updated assertions reflecting the fix.
- Regression — Ratchet/NIP-17/messaging/invitation/session-reset suites
  re-run and passing (see completion declaration for the full list).
