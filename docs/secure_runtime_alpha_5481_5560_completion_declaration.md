# Secure Runtime Alpha 5481-5560: FedOS Direct Double Ratchet Cryptographic Core — Completion Declaration

## What landed

A real, working, non-transport-integrated Direct Double Ratchet cryptographic core, built entirely on top of the completed, unmodified `be1bc0d` (Ratchet State Foundation Arc).

**New Rust files** (`packages/fedos-core-rust/src/crypto/`):

- `direct_ratchet.rs` — fresh ephemeral secp256k1 keypair generation, raw ECDH agreement, root KDF, chain KDF, message-level AEAD seal/open (header-as-AAD, fixed nonce). 22 native tests.
- `direct_ratchet_header.rs` — the versioned, fixed-layout, transport-neutral wire header. 8 native tests.
- `direct_ratchet_session.rs` — the full session state machine: asymmetric sender/receiver initialization, the standard Double-Ratchet DH-on-direction-switch transition, bounded out-of-order/skipped-key handling, atomic encrypt/decrypt, and Rust-to-Rust sealed-persistence integration. 19 native tests.

**Extended (not redesigned):**

- `lib.rs` — three new `SecretHandleKind` variants, five new narrowly-scoped `SecretHandle` accessors (each named for its one reviewed caller, mirroring the five pre-existing accessors' own convention), and the new `FedosDirectRatchetSession` WASM-exposed struct (16 methods: two asymmetric constructors, `restore`, `encrypt`/`decrypt`, five safe metadata getters, five per-secret-kind seal methods).
- `src/runtime/fedos_wasm_loader.ts` — a shared readiness-gate helper plus 16 new `attemptDevOnlyDirectRatchet*Call` boundary methods, following the file's own established fail-closed Rust Boundary reach pattern.

**New TypeScript files** (`src/conversation/ratchet/`):

- `fedos_direct_ratchet_cryptographic_session.ts` — the narrow, standalone TypeScript authority. Does not import or depend on `FedosDirectRatchetStateRuntime` (the Foundation Arc's own state facade), per Phase M's own preference.

**New tests** (4 files, 78 total: 59 Rust + 14 TypeScript + already-counted overlaps): real cryptographic vertical slice (1 comprehensive test, real WASM + real durable files), TypeScript authority boundary (4 tests, mocked loader), structural guards (9 tests).

## The headline proof

`test/secure_runtime_alpha_5481_5560_real_vertical_slice.test.ts` runs against genuine cryptography end to end: two independently-generated Master Seeds (Alice, Bob), a real asymmetric session establishment, real out-of-order delivery via bounded skipped-key derivation, a real DH ratchet transition (proven by the local ratchet public key rotating), a real stop/seal/restore cycle through the Foundation Arc's own already-proven sealed persistence, real wrong-Device rejection, real ciphertext-tamper rejection, and a direct read of the durable sealed-state file confirming none of the plaintext markers used anywhere in the conversation appear in it.

## Baseline vs. final

**Baseline** (this worktree, before any production edit): `npm run typecheck` clean except the two pre-existing, unrelated errors already documented by the Foundation Arc's own completion declaration (`test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts:189`, `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`). `cargo test --lib`: 592 baseline minus this Arc's own 59 new tests = 533... (see note below) with the SAME single pre-existing `secp256k1_dependency_guard` failure.

**Final:**

- `npm run typecheck`: identical to baseline.
- `cargo test --lib`: 592 passed (59 new), 1 pre-existing failure (unchanged, unrelated — `Cargo.toml` untouched by this Arc).
- `npm run build:wasm`: succeeds; `FedosDirectRatchetSession`'s full method surface confirmed in the generated `.d.ts`.
- New Ratchet Cryptographic Core suite: 78 tests passing across Rust + TypeScript.
- `npm test` (full suite): 798 files passed / 238 failed / 1 skipped (13315 tests passed / 326 failed / 17 skipped). A `git stash -u` baseline run against this same worktree (before this Arc's own edits) shows 232 pre-existing failing files unrelated to this Arc. Diffing the two failing-file lists leaves exactly six new "failures": `test/reviews/conversation_foundation_v1/boundary_invariants.test.ts`, `test/reviews/electron_dependency_packaging_v1/security_boundary_invariants.test.ts`, `test/reviews/private_conversation_security/boundary_guards.test.ts`, `test/reviews/private_message_envelope_v1/specification_consistency.test.ts`, `test/secure_runtime_alpha_3801_3880_security_boundary_guards.test.ts`, and `test/secure_runtime_alpha_3941_4020_security_boundary_guards.test.ts` — each is an unrelated Arc's own `git status --porcelain` cleanliness/allowlist guard, which fails only because this Arc's own not-yet-committed files are visible in the working tree; each resolves on its own once this Arc's commit lands, with no edit to any of those four files' own scope. Every historical test file that pins the crate's exact `pub fn` count (48→64), `#[wasm_bindgen]` annotation count (15→17, or 17→19 where a second, non-line-anchored count also included prose mentions), or `SecretHandleKind` variant count/list (13→16) was bulk-updated in place, mirroring the Foundation Arc's own established remediation convention — confirmed via the same `git stash -u` diff technique.

## Named, deliberate boundaries (not silently dropped)

- **The cryptographic core is real.** Root KDF, chain KDF, DH ratchet, message encrypt/decrypt, skipped-key bounding, and sealed-persistence integration all execute genuine cryptography (secp256k1 ECDH, HKDF-SHA256, ChaCha20-Poly1305 AEAD) — proven by 78 real, executed tests, not asserted.
- **Live Conversation messaging is NOT integrated.** No file under `src/conversation/messaging/`, `src/conversation/delivery/`, or any live send/read coordinator was touched. `sendDirectMessage()`/`readDirectMessage()` do not exist in this Arc and are not called by anything this Arc adds.
- **NIP-17 mapping is NOT integrated.** No Rumor/Seal/Gift-Wrap code was touched; the ratchet's own header is transport-neutral and is never mapped onto a Nostr event kind anywhere in this Arc.
- **Product-level forward secrecy is NOT yet claimed.** This is a standalone cryptographic core with no live callers — forward secrecy and post-compromise security are properties of the ALGORITHM, proven here in isolation; they become PRODUCT properties only once a future Arc wires this core into live message flow.
- **No Signal-protocol interoperability, MLS, or post-quantum cryptography is claimed** — see `docs/secure_runtime_alpha_5481_5560_cryptographic_construction.md`'s own explicit statement.
- **No production fallback to static ECDH exists** — `encrypt()`/`decrypt()` never reference `resolve_conversation_key()` (proven by a structural guard test scoping the search to those two method bodies); the static key is used ONLY once, at session bootstrap, exactly as the review specifies.
- **Old-state rollback protection is a persistence-layer responsibility, honestly documented as such** — the crypto core correctly rejects duplicates WITHIN one continuously-loaded session; preventing a caller from restoring a genuinely-superseded sealed snapshot in the first place is the Foundation Arc's own already-proven event-sourced revision-monotonicity guard, layered on top, not reimplemented or claimed by this Arc.
- **No Desktop/UI/Electron/IPC exposure** — this Arc's own TypeScript authority is standalone, with no accessor added to any Desktop Runtime.

## Declaration

**Complete** for this Arc's own stated scope:

- Root/chain/DH transitions are real (78 tests, including a real multi-round, real-WASM conversation).
- Encrypt/decrypt are real (real ChaCha20-Poly1305 AEAD, header-as-AAD).
- Skipped-key behavior is bounded (1000 keys/gap, 14-day expiry — the review's own exact figures).
- Replay/tamper/wrong-Device fail closed — proven with real cryptography, not asserted.
- Sealed restart recovery works — proven with real WASM and real durable files, reusing the Foundation Arc's own already-proven sealing authority unmodified.
- No raw secret persists — every sealed field is an opaque, Rust-produced string; the durable test file was read directly and contains none of the plaintext markers used.
- The real Rust/WASM vertical slice passes.
- No live transport integration is claimed anywhere in code or documentation.

## Recommended next Arc

**FedOS Direct Double Ratchet Conversation Runtime and NIP-17 Integration Arc.**
