# FedOS Ratchet Device Lifecycle and Authenticated Session Reset Foundation Arc — Completion Declaration

Implements the Runtime foundation `docs/reviews/fedos_ratchet_multidevice_identity_rotation_v1/index.md`
(commit `3ebfa37`) named as the exact next Arc, on top of the completed
Direct Ratchet + NIP-17 Integration (`b8e9e06`). No account/Nostr
identity rotation, Master Seed replacement, PQ, MLS, Sender-Key
redesign, group messaging, UI, Electron, or remote synchronization is
touched — matches the review's own explicit non-goals.

## What is now real

1. **Authenticated Session Reset message.** The existing `session-init`
   NIP-17 payload (`src/conversation/delivery/nostr/nip17/fedos_direct_ratchet_nip17_payload.ts`)
   gains four additive fields — `previousGeneration`, `resetReason`,
   `resetNonce`, `deviceSignatureHex` — never a new control-message kind,
   per the review's own explicit instruction. A reset always names why
   (`previousGeneration !== null` requires `resetReason !== null`,
   enforced structurally in the codec).
2. **Existing per-Device signing keypair integration.** `deviceSignatureHex`
   is a real, optional signature from the caller's own
   `FedosDeviceSigningKeypair` (Alpha 3161–3240) over a domain-separated
   digest (`fedos_direct_ratchet_session_reset_authentication.ts`) —
   verified, when a `devicePublicKeyRef` is on file for the claimed
   sender, by `FedosDirectRatchetSessionResetAuthority`. This is the
   FIRST place the Ratchet integration consumes that key; verification
   is deliberately best-effort (never a hard requirement), since no
   durable storage for a Device signing key exists anywhere in this
   codebase and this Arc does not invent one — the keypair remains a
   strictly per-call, caller-supplied parameter, mirroring
   `FedosDevicePairingFacade`'s own established pattern exactly.
3. **Session Reset Authority + Runtime Reset Coordinator.**
   `fedos_direct_ratchet_session_reset_authority.ts` is the pure decision
   function (Device Trust integration, generation-integrity check,
   best-effort signature check, nonce-keyed replay handling).
   `fedos_direct_ratchet_reset_coordinator.ts` is the stateful
   orchestrator both `FedosDirectRatchetOutboundIntegration` and
   `FedosDirectRatchetInboundIntegration` call into: persists the durable
   reset audit record and supersedes the prior generation via the
   ALREADY-LIVE `FedosDirectRatchetStateRuntime.markResetRequired()`
   (Alpha 5401–5480) — no new lifecycle state was needed; that Foundation
   Arc's own `"reset-required"` state already IS the "superseded" state
   the normative review named (confirmed directly from that file's own
   header, a discrepancy the multi-device review itself did not catch).
4. **Durable reset records, replay protection across reset,
   restart-safe session generation.** `FedosDirectRatchetSessionResetRecordV1`
   + its append-only/in-memory persistence ports mirror the Device
   Binding Challenge replay ledger's own nonce-keyed, insert-only
   discipline exactly — one immutable fact per nonce, serving as both
   the audit trail and the replay guard. Proven restart-safe end-to-end
   in the real vertical slice.
5. **Device lifecycle state + Device replacement, formalized.**
   `src/device/fedos_device_lifecycle.ts` derives a five-state view
   (`pending`/`active`/`replaced`/`revoked`/`unavailable`) over the
   existing `FedosDeviceTrustState` plus an additive, informational-only
   replacement link (`fedos_device_replacement_record.ts`) —
   `FedosDeviceReplacementCoordinator` composes the EXISTING
   `FedosDeviceBindingRegistrationAuthority.registerDevice()`/
   `revokeDevice()` (register-then-revoke, never the reverse), proven
   with real Nostr account authorizations and real Device proofs of
   possession. Never inherits the old Device's identity or key (review
   §07); a caller must supply a genuinely new `deviceId`.
6. **Device revocation quarantine wired to the Ratchet.**
   `FedosDirectRatchetResetCoordinator.applyDeviceRevocation()` (exposed
   as `FedosDirectRatchetConversationRuntime.applyDeviceRevocationToSessions()`)
   transitions every ratchet session involving a revoked Device to the
   existing, already-terminal `"revoked"` lifecycle state — review §06's
   chosen quarantine consequence (never destroys sealed state, never
   allows new resolution). A caller (Desktop, out of this Arc's scope)
   invokes it explicitly; no automatic cross-subsystem trigger exists.

## Maintained, unchanged

One independent ratchet session per Device pair (proven with a real
second Device pair, Alice's tablet, in the vertical slice — its own
independent generation 0 establishes and is untouched by the desktop
pair's reset). Device replacement always creates a new Device identity
(enforced structurally — `FedosDeviceReplacementCoordinator` refuses
reusing the old `deviceId`). Archive Restore and generic Device Sync are
untouched by this Arc.

## Verification performed

- `npx tsc --noEmit` — clean (the same two pre-existing, unrelated
  baseline errors as `b8e9e06`'s own completion declaration).
- `cargo test --manifest-path packages/fedos-core-rust/Cargo.toml --release`
  — 608 passed, the same one pre-existing, unrelated failure
  (`secp256k1_dependency_guard`) already documented in `b8e9e06`; zero
  Rust source touched by this Arc.
- `npm run build:wasm` + `npm run build:wasm:manifest` — real Rust/WASM
  build succeeded (no Rust change; rebuilt to run the real-crypto tests).
- Focused suites: `secure_runtime_alpha_5561_5640_*`,
  `secure_runtime_alpha_5401_5480_*`, `secure_runtime_alpha_5481_5560_*`,
  `secure_runtime_alpha_3161_3240_*` — all pass unchanged.
- New unit suites (pure logic, no WASM): reset reason vocabulary, payload
  codec extensions, Device-signature authentication (real
  `@noble/curves` signing), Session Reset Authority, Reset Coordinator,
  reset-record persistence restart-safety — 25 tests, all pass.
- New Device Lifecycle/Replacement suite (real Nostr + real Device
  signatures, no WASM): 5 tests, all pass.
- New REAL, no-fake-crypto vertical slice
  (`test/fedos_ratchet_device_lifecycle_session_reset_real_vertical_slice.test.ts`):
  generation 0 establishes and carries a real message; Alice initiates
  an authenticated, reasoned, Device-signed reset to generation 1; both
  sides durably supersede generation 0 (`"reset-required"`) and activate
  generation 1; a real message flows on generation 1; brand-new Runtimes
  built from the same durable files after a full stop/restart still show
  the correct state and the reset audit record on file; a second, real
  Device pair (Alice's tablet) establishes its own independent
  generation 0, proving per-Device-pair isolation is unaffected by the
  reset; "a reset always names why" is enforced structurally
  (`"reason-required"` returned, not a silent default) both for a
  fresh-but-superseded session and is exercised end-to-end through a
  second real reset to generation 2. 1 test, passing.
- Full-suite A/B comparison (JSON reporter, `git stash` baseline vs.
  this Arc's own working tree, both against the SAME built WASM
  artifact): 232 pre-existing failures on baseline (all a mechanical
  consequence of the real WASM artifact now being present, which dozens
  of unrelated review guard tests assert should be ABSENT in a fresh
  checkout — pre-existing, unrelated to this Arc) vs. 239 with this
  Arc's own changes. Every one of the 7 new failures was individually
  confirmed to be the SAME already-documented, self-resolving artifact
  (historical Arc-scoped guard tests asserting a clean `git status`
  relative to THEIR OWN prior scope, tripped by this Arc's own
  legitimate in-progress uncommitted files) — none is a logic defect;
  all resolve once this Arc's own changes are committed.

## Remaining, disclosed boundaries (not blockers)

- Late-inbound-after-reset behavior (a message tagged with an already-
  superseded generation) remains an explicitly undecided non-guarantee,
  per the normative review's own §09 — this Arc does not decide it.
- Peer notification/capability advertisement (the review's own
  Arc-after-next) is not built — a reset/revocation is never proactively
  announced to a peer beyond the reset message itself.
- Device-revocation-to-ratchet-session wiring is a callable capability,
  not an automatic trigger — no cross-subsystem event bus links Device
  Trust and the Ratchet Runtime in this codebase, and building one is
  out of this Arc's own "narrow Runtime foundation" scope.
- The concurrent-multi-Device-reset split-brain case (review §17 #15) is
  unresolved by this Arc, as that review itself deferred it.

## Recommended next Arc

**FedOS Ratchet Peer Notification and Capability Advertisement Arc** —
matches the multi-device/identity-rotation review's own §16/§19
sequencing (named as the Arc after this one, deliberately deferred until
this Arc's own reason-codes and lifecycle states existed to have
something meaningful to advertise, which they now do).
