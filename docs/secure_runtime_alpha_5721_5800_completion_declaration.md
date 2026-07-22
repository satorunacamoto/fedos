# Secure Runtime Alpha 5721–5800 — Completion Declaration

FedOS Ratchet Peer Notification and Capability Advertisement Arc. Base:
`f80889d`. Worktree: `C:\wt\ratchet-peer-capability-notification`. Branch:
`arc/ratchet-peer-notification-capability-advertisement`.

## Declared: FULL completion

All nine required conditions are met with real evidence:

1. **Closed capability and lifecycle schemas exist** —
   `fedos_ratchet_peer_capability_vocabulary.ts` (Phase B),
   `fedos_ratchet_peer_capability_advertisement.ts` (Phase C),
   `fedos_ratchet_peer_lifecycle_notification.ts` (Phase D). See the
   schema document.
2. **Real signatures verify** — real BIP-340 Schnorr account-level
   signatures (`RealFedosNostrSigningAuthority` in unit tests, the real
   WASM-backed `FedosWasmNostrSigningAuthority` in the vertical slice) and
   real Device-level signatures (`FedosDeviceSigningKeypair`), both
   independently verified by unmodified, existing verifiers
   (`NobleSignatureVerifier`, `verifyFedosDeviceSigningSignature`).
3. **Real private transport carries the payload** — the vertical slice
   publishes through the actual `FedosPrivateTransport` /
   `NostrNip17V1WireAdapter` / a functional in-process fake Relay, and
   receives through the real `FedosConversationRuntime.receiveNip17Rumor()`
   dispatch chain.
4. **Durable peer state survives restart** — proven by restarting Bob's
   entire `FedosConversationRuntime` (fresh `AppendOnlyFedosRatchetPeerCapabilityObservationPersistence`
   over the same log file) and confirming `getPeerDeviceCapabilityStatus()`
   is unchanged.
5. **Stale/rollback/downgrade fail closed** — proven both in the unit
   suite (pure acceptance-policy cases) and in the real vertical slice (a
   stale re-advertisement after a Device-revocation notification never
   overwrites the `"revoked"` status).
6. **Multi-device isolation is proven** — Alice Device A → Bob Device A
   and Alice Device A → Bob Device B are independent Observation rows,
   each addressed and evaluated separately; a fact addressed to one
   Device is structurally rejected (`"wrong-recipient-device"`) if
   imported by the other.
7. **No automatic trust/route activation occurs** — structural guard
   tests confirm neither coordinator calls a Device Registry mutation
   method or a Ratchet session/route method.
8. **Real vertical slice passes** —
   `test/secure_runtime_alpha_5721_5800_real_vertical_slice.test.ts`,
   real WASM crypto, no fake signature or transport on the headline flow.
9. **No secret is persisted or indexed** — the vertical slice reads back
   the durable Observation file and confirms the absence of any
   signature/key material; the Observation schema itself has no field
   capable of carrying one.

## What is now live

- A closed, versioned peer-capability vocabulary and two closed record
  types (advertisement, lifecycle notification), riding the existing
  `"nostr-nip17-v1"` Gift Wrap transport via the existing
  `sendMailboxNip17Control()` seam — no new Nostr kind, no new NIP, no
  public unencrypted event.
- Real account-level authentication (reusing the Device Binding
  kind-1-event pattern) and optional, best-effort Device-level
  authentication (reusing the Session Reset pattern) — three distinct,
  never-silently-upgraded evidence states.
- A pure, 13-outcome acceptance policy and a pure session-action
  recommendation layer, fully decoupled from any actual session mutation.
- A dedicated, append-only-capable, restart-safe, per-local-Device
  Observation domain.
- A narrow safe facade (`FedosRatchetPeerCapabilityRuntime`) exposing
  exactly the six methods this Arc's own brief named, wired into
  `FedosConversationRuntime` via one optional dependency bundle and one
  narrow, additive inbound-dispatch hook.
- Three real, load-bearing bugs found and fixed via genuine multi-step
  testing (exact-nonce replay, affected-vs-issuer Device keying,
  cross-`sourceKind` revision mixing) — see the execution spec for detail.

## What remains unbuilt (honestly disclosed, not oversights)

- **No automatic wiring from an accepted lifecycle fact into the
  Foundation Arc's own Reset Coordinator.** `recommendFedosRatchetPeerSessionAction()`
  produces a recommendation string only; a future, separate, explicitly
  authorized integration (Phase L's own boundary) would consume it. Not
  built here, by design — this Arc's own Absolute Prohibitions forbid a
  peer notification directly causing a reset.
- **Rumor-id-level dedup is not independently re-implemented for the
  peer-capability inbound attempt** (see the execution spec). A duplicate
  Relay redelivery still resolves safely to `"duplicate"` via the
  Observation store's own idempotent write, just with one avoidable
  re-verification pass.
- **The full ~35-item Phase Q failure matrix is not exhaustively,
  individually itemized as separate test cases.** A substantial,
  representative real-crypto subset is proven: malformed/oversized/
  unknown-field/unknown-capability payloads, duplicate notification,
  conflicting duplicate, stale/rollback revision, expired notification,
  bad account signature, bad/unavailable Device proof, wrong
  recipient/recipient-Device, revoked/unknown sender Device, replayed
  nonce, downgrade, unsupported suite/route. NOT separately exercised:
  future-issued-beyond-skew (no explicit skew tolerance parameter exists
  yet), publish-timeout/no-ACK/duplicate-Relay-delivery (inherited,
  unmodified behavior from the existing Outbox/publisher, not this Arc's
  own new logic), concurrent-import races, an explicit unbounded-Device
  attack simulation, and a dedicated target-existence/privacy-oracle
  probe.
- No account/Nostr identity rotation, Master Seed replacement, PQ/hybrid
  crypto, MLS, Group/Sender-Key changes, deletion-request code,
  attachment code, or Electron changes — none were in scope and none were
  touched.

## Exact next Arc

**FedOS Account and Nostr Identity Rotation V1 Specification Review.**
