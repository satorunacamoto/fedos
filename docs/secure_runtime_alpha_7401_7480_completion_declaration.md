# Secure Runtime Alpha 7401–7480 — Completion Declaration

**FedOS Direct Conversation Route Binding and NIP-17 Inbound Isolation Arc.**

## Verdict: Full completion

Both concurrent-Conversation defects the mission named are closed with
real, no-substitution testing: the standard `nostr-nip17-v1` route's
silent same-peer misrouting (Finding 1, live-reproduced and now
regression-tested as fixed) and the Direct Ratchet route's deterministic
same-peer session-establishment rejection (Finding 2, source-traced and
now live-proven as fixed). The fix is a single, minimal, closed,
versioned route-binding domain applied consistently to both routes —
never a new NIP, never a new crypto primitive, never a Ratchet
cryptographic-core change, never an Identity Transition or Signed
Deletion redesign.

## Mission requirements, verified

- **Two same-peer conversations route independently** — proven live in
  `secure_runtime_alpha_7401_7480_route_binding_defect_reproduction.test.ts`
  (plain route) and `secure_runtime_alpha_7401_7480_ratchet_route_binding_isolation.test.ts`
  (Ratchet route): A-message-1 arrives only in A, B-message-1 arrives
  only in B, both directions, interleaved.
- **No silent ambiguity** — the peer-only resolver (Alpha 1424,
  byte-for-byte unmodified) is retained ONLY for the bounded Legacy
  Policy; two or more legacy candidates fail closed as
  `"ambiguous-legacy-route"`, proven in the failure matrix.
- **Authenticated binding** — the binding lives inside encrypted Rumor
  content, obtainable only after a real NIP-44 Seal decryption whose own
  signature is the real sender's; documented in full in the Wire and
  Metadata Compatibility report.
- **Restart continuity** — proven in both Phase K/J real tests: both
  Conversations' Ratchet sessions and both routes' message history
  survive a real restart of both parties.
- **Device-pair isolation** — Device Registry trust checks
  (`resolveFedosDirectRatchetDevicePair()`) are byte-for-byte unmodified;
  the route binding only changes HOW the target Conversation is found,
  never Device trust evaluation.
- **Session Reset isolation** — proven live: resetting Conversation A's
  own Ratchet session leaves Conversation B's own session (same peer,
  same Device pair) completely untouched — status, generation, and
  message flow all unaffected.
- **Signed Deletion isolation** — verified, not fixed: Signed Deletion's
  own control payload (`fedos_deletion_request_record.ts`) already
  carries an explicit, authenticated `conversationId` field directly and
  was never routed via the peer-only resolver at all — it was never
  vulnerable to either Finding.
- **No unacceptable metadata leak** — zero new Relay-visible fields;
  confirmed by structural guard and by the Wire and Metadata
  Compatibility report's own accounting.
- **No protocol downgrade** — the outer Rumor/Seal/Gift-Wrap wire framing
  is completely unmodified (confirmed by structural guard); only the
  FedOS-proprietary inner meaning of `.content` changed, exactly mirroring
  a convention this codebase already shipped once before.

## Route classification (stated plainly, no overclaiming)

**FedOS-proprietary encrypted payload convention, carried inside standard
NIP-17 framing.** Not a new NIP. Not a compatible extension in the sense
of being understandable by a generic NIP-17 client's own rendering of
`.content` — a compliant client sees valid `kind:14` plain text and
nothing more, exactly as already true for the pre-existing Ratchet
route. See the Wire and Metadata Compatibility report for the full,
honest account.

## What was built

1. `fedos_direct_conversation_plain_message_payload.ts` (new) — the plain
   route's own closed, versioned route-binding envelope.
2. `fedos_direct_ratchet_nip17_payload.ts` (additive) — `schemaVersion: 2`
   for the Ratchet route's own `"message"` payload; a new
   version-recognition helper closing a genuine "unsupported version
   silently falls through to legacy" gap found while writing the failure
   matrix.
3. `fedos_direct_conversation_route_binding_resolver.ts` (new) — the
   primary, direct-lookup resolver both routes now use.
4. `fedos_private_nostr_inbound_legacy_candidate_count.ts` (new) — the
   bounded ambiguity-counting helper for the Legacy Policy only.
5. `fedos_conversation_direct_messaging_coordinator.ts` (modified,
   outbound wiring only — local storage/plaintext semantics unchanged).
6. `fedos_direct_ratchet_outbound_integration.ts` (modified, one field
   addition to an existing payload construction).
7. `fedos_nip17_inbound_import_coordinator.ts` (modified, admission-gate
   algorithm inverted).
8. `fedos_direct_ratchet_inbound_integration.ts` (modified, admission-gate
   algorithm inverted for both session-init and message; new
   unsupported-version handling).
9. Six new/updated test files (29 new tests across 5 new files, plus 2
   reconciled prior-arc test files whose own assertions described the
   PRE-fix behavior these fixes correct).

## No protocol redesign

Confirmed by structural guard: zero Rust/Cargo.toml change; zero
`fedos_direct_ratchet_cryptographic_session.ts`/`fedos_direct_ratchet_device_pair_resolver.ts`/
`fedos_direct_ratchet_state_runtime.ts`/`fedos_direct_ratchet_reset_coordinator.ts`
change; zero `identity_transition`/`deletion_request` change; zero
`fedos_nip17_rumor.ts`/`fedos_nip59_seal.ts`/`fedos_nip59_gift_wrap.ts`
change; zero Electron main/preload change; zero p2p/.tmp_gen change; the
peer-only resolver from Alpha 1424 remains byte-for-byte unmodified.

## Verification

- `npx tsc --noEmit` — clean (2 known pre-existing baseline errors only).
- `cargo test` — unaffected; zero Rust files touched.
- WASM build — real `pkg/` artifact built fresh this session.
- This Arc's own 5 new test files (29/29 passing) plus 2 reconciled
  prior-arc test files (both passing with updated, fix-reflecting
  assertions).
- Regression: Ratchet/NIP-17 real vertical slices (Alpha 5561–5640,
  5961–6040, 6921–7000, 7241–7320 repeated-restart, Ratchet Device
  Lifecycle/Session Reset), messaging/invitation/conversation-runtime
  suites, and the 7081-7160/7241-7320 structural guard suites all
  re-run and passing.

## Recommended next Arc

Consider a dedicated Peer-Device-Trust-Bootstrap Arc: this session's own
investigation surfaced that `FedosDevicePairingFacade` (`devicePairingCreate/Approve/Complete`)
is a same-account, multi-device trust mechanism only — there is no
production path by which one account's Device Registry ever learns to
trust a genuinely DIFFERENT account's Device for Ratchet purposes short
of directly seeding the registry (which this Arc's own Phase J test does
for controlled testing, not as a production recommendation). This is a
real, disclosed gap in the Ratchet route's own production reachability,
independent of and not blocking this Arc's own routing fix.
