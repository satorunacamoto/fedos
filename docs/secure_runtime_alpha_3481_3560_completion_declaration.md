# Secure Runtime Alpha 3481–3560: Encrypted Device-to-Device Local Transfer — Completion Declaration

## What this Arc proves

- Two already-registered, already-trusted Devices of the SAME account can complete a full, real, cryptographically-verified local transfer end to end: Invitation → Challenge → Proof → Approval → Package → Verification → Completion — proven directly with real BIP-340 Schnorr signatures throughout (`RealFedosNostrSigningAuthority` for account-level registration setup, real `FedosDeviceSigningKeypair` for both the Proof and the Approval) and real AEAD wiring (the unmodified `FedosWasmDeviceSyncPackageEncryptionAuthority`).
- Mutual device-level authentication is real: the initiator proves possession of the Device key the Challenge named; the responder proves possession of its OWN registered Device key in the same Approval step — both independently re-verified against the LIVE Registry, never a cached snapshot.
- A Transfer Package's content-hash binding catches ANY deviation from what was recorded at build time — proven directly: a package tampered in transit (a single appended byte) is refused as `"conflict"` before any decrypt is even attempted, and the session is durably failed.
- Replay is proven denied: a Proof presented over a Challenge that does not byte-for-byte match the one this session actually issued (even one differing by only its `nonce`) is refused as `"replayed"`.
- Wrong device is proven denied: a Proof naming a public key other than the one the Challenge itself named is refused as `"wrong-device"` — caught by a structural key-comparison that runs BEFORE any signature verification, so the check holds regardless of whether the presented signature happens to be well-formed.
- Wrong account is proven denied: creating an Invitation between two Devices registered under DIFFERENT accounts is refused as `"wrong-account"` at the very first step, before any Challenge is ever minted.
- Interrupted transfer is proven handled honestly: a transfer aborted mid-flow (after Invitation and Challenge, before Approval) cannot be resumed — a subsequent `approveTransfer()` attempt against the aborted session is refused (`"wrong-state"`), never silently continuing a cancelled transfer.
- Restart recovery is proven directly: a second, independent `FedosDeviceTransferCoordinator` constructed over the SAME on-disk Device Registry and Transfer Session log files recovers an identical, mid-flight (`"challenged"`) session — including its own denormalized Challenge fields — and successfully RESUMES the SAME transfer to `"approved"`, not merely reads its state back inertly.
- Duplicate package is proven idempotent: resubmitting the identical, already-verified Transfer Package a second time returns `"duplicate-package"` and re-derives the SAME recovered Sync Session, without re-mutating the session's own durable state.
- Transfer cancellation (`abortTransfer()`) is proven at multiple points in the lifecycle, and proven terminal: a second abort attempt against an already-terminal session is refused (`"already-terminal"`), never silently re-applied.
- A distinct, deliberate design decision is proven by test: a transient/environmental Package-build failure (`"key-unavailable"`) does NOT fail the session — the SAME session, still `"approved"`, successfully builds a Package once a working encryption authority is supplied, unlike every genuine cryptographic denial this Coordinator discovers, which DOES fail the session automatically.

## What this Arc explicitly does NOT claim

- **No network sync, no cloud sync, no relay sync, no synchronization daemon.** Every artifact this Arc builds — Invitation, Challenge, Proof, Approval, Package — is LOCAL data and pure verification logic; nothing in this Arc opens a socket, calls a relay, or runs on any interval/schedule.
- **No physical-channel security claim.** This Arc does not implement, or assume, any specific transport for handing an Invitation or Package between two Devices (QR code, USB, local file, local network discovery are all equally out of scope) — it proves the DATA's own authenticity/integrity/confidentiality independent of that choice.
- **No new cryptographic primitive, no new `AeadAadDomain`, no new dependency, no Rust/WASM change.** Confirmed by structural guard (below).
- **No fresh Account Authorization signature per transfer** — a deliberate, documented scope decision (Phase B of the execution spec), not an oversight; this Arc's own Requirements section omits "Account Authorization" from its reuse list, unlike the two prior Arcs.
- **No distributed exactly-once replay guarantee.** This Arc's own replay-safety is single-writer/in-process, achieved through each Transfer Session's own unique, one-shot `sessionId`/Challenge fields — a documented simplification relative to Alpha 3161–3240's own separate, long-lived global nonce-replay persistence, justified by Transfer Sessions being inherently single-use pairings rather than a shared namespace.
- **No retroactive un-transfer on late revocation.** A Device revoked mid-transfer blocks FUTURE progress (re-checked live at every remaining step); it does not erase an already-recorded Transfer Session event.
- No Sender-Key change, no Conversation Runtime change, no Archive change, no Search change, no Desktop Shell/Runtime change.

## Baseline vs. final

| | Baseline (before this Arc, `205a425`) | Final (this Arc) |
| --- | --- | --- |
| Device-to-device transfer | none — Alpha 3321–3400's own Sync Package used self-ECDH ("encrypt to self", no second Device involved) | Full Invitation → Challenge → Proof → Approval → Package → Verification → Completion protocol between two DIFFERENT, real Devices |
| Mutual device authentication | none | Real Schnorr Proof (initiator) + real Schnorr Approval (responder), both re-verified against the LIVE Registry |
| Transfer-level replay/tamper/duplicate detection | none | Challenge-content equality check (replay), package content-hash gate (conflict/tamper), session-state idempotency (duplicate) |
| Transfer state durability | none | Event-sourced `FedosDeviceTransferSessionPersistence`, in-memory + append-only backends, restart-safe |
| `npm run typecheck` | clean except pre-existing `alpha_477_scheduler_lifecycle_model.test.ts:121` | unchanged — same one pre-existing failure, nothing new |
| New test files | — | 2 files, 26 tests, real Schnorr signatures + real Device Registry + real AEAD wiring throughout |

## Verification run (this worktree, `C:\wt\device-local-transfer`)

1. `npm run typecheck` — clean except the one pre-existing, unrelated `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` failure (present before this Arc's own changes).
2. New Arc test files — `secure_runtime_alpha_3481_3560_device_transfer_protocol.test.ts` (18/18) and `secure_runtime_alpha_3481_3560_device_transfer_package.test.ts` (8/8) — 26/26 passed.
3. `npx vitest run` (full suite) — 12,257 passed / 239 failed across 946 files. The failed count is UNCHANGED from the base Arc's own documented baseline (239, immediately before this Arc's changes), and the passed count increased by exactly 26 (this Arc's own new tests) — confirming zero regressions. Every failure falls into the same two pre-existing, previously-documented categories (the fresh-worktree `?raw`-import artifact, and `test/reviews/**` git-status snapshot assertions reacting to this Arc's own new, still-uncommitted files — both resolve once this Arc's changes are committed).
4. Rust/`cargo` — not run; no Rust file was touched by this Arc.
5. Restart-recovery test uses `mkdtempSync(os.tmpdir())` with an unconditional `rmSync` in a `finally` block — no stray temp files left behind.

## Security guard scan

`grep` across every new file under `src/device/transfer/` for `masterseed`, `privatekey`/`private_key`, `passphrase`, `mnemonic`, `Math.random` — every match is prose/comments documenting the reuse of an existing guardrail; zero occurrences carry an actual secret-bearing field or value. No new file constructs a `FedosDeviceSigningKeypair` from raw bytes, reads a private key, or reads the Master Seed directly — `buildTransferPackage()`/`verifyTransferPackage()` receive only an already-constructed `FedosDeviceSyncPackageEncryptionAuthority` (injected per call, never built internally) and an opaque `AeadKeyHandle` flows through it exactly as Alpha 3321–3400 already established.

**A genuine bug found and fixed during test-writing, in the SAME commit**: `isWellFormedFedosDeviceTransferInvitationV1()` and `isWellFormedFedosDeviceTransferChallengeV1()` both initially checked `keys.length !== 7` against interfaces with 8 fields each, and every `deserializeFedosDeviceTransfer*Event()` function in the new event codec initially under-counted its own field set by one (e.g. checking `!== 8` against a 9-field `"invited"` event) — the exact same class of off-by-one the base Arc's own docs record finding once before (`isWellFormedFedosDeviceBindingChallengeV1`, Alpha 3161–3240). Every one of these made the corresponding structural check reject every genuinely well-formed object, caught immediately by this Arc's own first real end-to-end test run (`issueChallenge()` returning `"invalid-invitation"` for a freshly, correctly constructed Invitation) rather than by code review — fixed in the same commit, before any test was allowed to pass.

## Security Statement

**What this Arc's transfer proves:** that the Device named as initiator in a Transfer Session really holds the private key the Registry recorded for it at registration time, at the moment of Approval; that the Device named as responder likewise really holds ITS OWN registered private key; that both were, at every step, currently `"trusted"` for the SAME account; that the Package exchanged between them is byte-for-byte the one the initiator actually built (any deviation refused before decryption); and that its content, once opened, is the exact Sync Session the initiator prepared.

**What this Arc's transfer does NOT prove:** that the physical/local channel carrying the Invitation or Package between the two Devices was itself private or authenticated (out of scope, left to a future integration); that either Device is malware-free or under the intended human's physical control (inherited, unproven boundary from Alpha 3161–3240); that a Device revoked mid-transfer had its PRIOR transfer activity retroactively undone; any distributed exactly-once guarantee beyond this Coordinator's own single-writer, in-process discipline.

## Structural guards confirmed

- `git diff 205a425 -- src/device/fedos_device_binding.ts src/device/binding_challenge/ src/device/persistence/ src/device/runtime/ src/device/sync_session/ src/device/sync_package/ src/sync/ src/desktop/ package.json package-lock.json src/runtime/fedos_wasm_loader.ts` — empty except for newly ADDED files under `src/device/transfer/` (all new paths, zero modification to any existing file's own content).
- `git diff 205a425 --stat -- src/conversation/` — empty (Archive, Search, Sender-Key, Group/Conversation Runtime all live under `src/conversation/` in this codebase; none touched).
- No new dependency: `git diff 205a425 -- package.json package-lock.json` — empty.
- No new `AeadAadDomain` variant, no Rust/WASM change: `git diff 205a425 -- src/runtime/` — empty.
- `p2p/`, `.tmp_gen/` untouched: confirmed via `git status --porcelain p2p .tmp_gen` — empty.

## Files changed

New: `src/device/transfer/fedos_device_transfer_challenge.ts`, `fedos_device_transfer_proof.ts`, `fedos_device_transfer_session.ts`, `fedos_device_transfer_invitation.ts`, `fedos_device_transfer_package.ts`, `fedos_device_transfer_coordinator.ts`, `persistence/fedos_persisted_device_transfer_event_v1.ts`, `persistence/fedos_device_transfer_event_codec.ts`, `persistence/fedos_device_transfer_session_persistence.ts`, `persistence/in_memory_fedos_device_transfer_session_persistence.ts`, `persistence/append_only_fedos_device_transfer_session_persistence.ts`, `test/secure_runtime_alpha_3481_3560_device_transfer_protocol.test.ts`, `test/secure_runtime_alpha_3481_3560_device_transfer_package.test.ts`, this doc pair.

Modified: `README.md` (new status blurb, prepended per this repo's own stacking convention).

Unmodified: everything under `src/device/` outside the new `transfer/` directory (Device Registry, Device Binding, Registration Authority, Device Sync Runtime, Sync Session, Sync Package — all Alpha 2921–3000/3161–3240/3321–3400), `src/sync/`, `src/desktop/`, Conversation Runtime, Archive, Search, Sender-Key, Group Runtime, `src/crypto/`, `src/runtime/` (including `fedos_wasm_loader.ts`'s `AeadAadDomain` enum), `packages/`, `p2p/`, `.tmp_gen/`, every Rust file, `package.json`/`package-lock.json`.

## Recommended next Arc

**Relay-assisted Device Synchronization.**
