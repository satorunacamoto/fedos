# Secure Runtime Alpha 450 — Master Seed Authority and Nostr Signing Activation Completion Declaration

Phase B, Stage 10 (final) of the Alpha 431–450 Master Seed Authority,
Sealed Persistence & Nostr Signing Activation Arc. Declares only what
was independently re-verified by real execution against this Arc's own
diff — not restated from earlier Stage docs without re-checking.

## 1. Completion declaration — Phase A (Alpha 431–440)

Declared complete:

- **Authority and storage inventory**
  (`docs/secure_runtime_alpha_431_existing_secret_authority_and_storage_inventory.md`) —
  twelve questions answered from direct source inspection; established
  that CSPRNG generation (`fedos_random_bytes_32`), the reviewed AEAD
  primitive (`crypto::aead_internal::seal_internal`/`open_internal`),
  and the Argon2id KDF (already adopted for the RFC 9106 vector suite)
  were all reusable without a new dependency, and that no real
  production Master Seed authority existed anywhere before this Arc.
- **Options review** — Option A (Rust-generated, Rust-owned Master
  Seed) + Option E (sealed-envelope export) adopted
  (`docs/secure_runtime_alpha_432_master_seed_authority_options_review.md`);
  Option B (TypeScript supplies raw seed bytes) explicitly rejected as
  the easy-but-wrong path.
- **Sealing-key authority decision** — Option B (user
  passphrase, Argon2id-derived, never persisted, never seen by
  TypeScript) adopted; Options D (hardcoded key) and E (device
  metadata) rejected per this Arc's own absolute prohibition; Option A
  (DPAPI) deliberately deferred rather than claimed without a real
  native caller
  (`docs/secure_runtime_alpha_433_sealing_key_authority_decision.md`).
- **Lifecycle** — `Empty → Available → Cleared`, irreversible `clear()`,
  `generate()`/`restore_sealed()` never overwrite an `Available` or
  `Cleared` instance
  (`docs/secure_runtime_alpha_434_master_seed_authority_lifecycle.md`).
- **Sealed envelope V1** — fixed schema version, Argon2id parameters,
  salt, nonce, ciphertext; no plaintext seed field of any kind
  (`docs/secure_runtime_alpha_435_sealed_master_seed_envelope_v1.md`).
- **Rust authority implementation** — `FedosMasterSeedAuthority`
  (`packages/fedos-core-rust/src/lib.rs:10123`), zero derives, no raw
  getter, fail-closed throughout
  (`docs/secure_runtime_alpha_436_rust_master_seed_authority_implementation.md`).
- **Seal/restore implementation and verification**
  (`docs/secure_runtime_alpha_437_seal_and_restore_implementation.md`).
- **TypeScript authority boundary** — `FedosWasmMasterSeedAuthority`
  (`src/runtime/master_seed/fedos_wasm_master_seed_authority.ts`), calls
  WASM only, never implements cryptography
  (`docs/secure_runtime_alpha_438_typescript_authority_boundary.md`).
- **Persistence ownership** — Option E (no Host integration this Arc;
  authority and sealed-envelope storage remain injected boundaries) —
  no default filesystem path introduced
  (`docs/secure_runtime_alpha_439_authority_persistence_ownership_review.md`).
- **Phase Gate** — sixteen conditions, all verified by real execution,
  PASS (`docs/secure_runtime_alpha_440_master_seed_authority_phase_gate.md`).

## 2. Completion declaration — Phase B (Alpha 441–450)

Declared complete:

- **Re-entry review** — confirmed the Alpha 422–430 signing-boundary
  design still holds unchanged against the real authority; no
  contradiction found
  (`docs/secure_runtime_alpha_441_signing_boundary_reentry_review.md`).
- **Request model** — `FedosNostrUnsignedEventRequest`, `kind` fixed to
  `1`, no caller-supplied `pubkey`/`id`/`sig`
  (`docs/secure_runtime_alpha_442_nostr_signing_request_model.md`).
- **Output reuse** — `FedosNostrWireEvent`, the existing seven-field
  shape, no fourth duplicate type
  (`docs/secure_runtime_alpha_443_signed_event_output_reuse.md`).
- **Rust/WASM signing method** — `FedosMasterSeedAuthority::sign_nostr_event`
  (`packages/fedos-core-rust/src/lib.rs:10381`), reuses the complete,
  unchanged Alpha 146–200 derivation/signing chain; never a generic
  `sign(hash)` oracle
  (`docs/secure_runtime_alpha_444_rust_wasm_nostr_signing_method.md`).
- **TypeScript signing adapter** — `FedosWasmNostrSigningAuthority`
  (`src/nostr/sign/fedos_wasm_nostr_signing_authority.ts`), validates,
  calls WASM, normalizes and freezes the result only
  (`docs/secure_runtime_alpha_445_typescript_nostr_signing_authority_adapter.md`).
- **Cryptographic verification** — real `cargo test` execution proves
  determinism, account/content/`createdAt`/tag separation, unsupported-
  kind and cleared-authority rejection, and independent BIP-340
  verification via `k256::schnorr` outside this crate's own signing
  path (`docs/secure_runtime_alpha_446_cryptographic_verification.md`).
- **Restart-stable signing** — a real, independent second
  `FedosMasterSeedAuthority` instance, restored from a sealed envelope,
  reproduces a byte-for-byte identical signed event; corrupt restore
  never silently substitutes a fresh identity
  (`docs/secure_runtime_alpha_447_restart_and_recovery_signing_verification.md`).
- **Publisher readiness** — review-and-types-only; `FedosNostrSigningAuthority.signEvent()`
  is already Publisher-ready with zero additional adapter code; no
  `FedosNostrBoardPublisher` created
  (`docs/secure_runtime_alpha_448_outbox_publisher_readiness_adapter.md`).
- **Security regression guards** — every guard in
  `docs/secure_runtime_alpha_449_security_regression_guards.md`
  re-verified directly during this Stage (see §4 below), not merely
  read from the prior Stage's own claims.

## 3. Phase Gate result

**PASS.** Both Phase A (Alpha 440) and Phase B (Alpha 441–449) gates
hold.

## 4. Independent re-verification performed at this Stage

- `npm run typecheck` — GREEN, zero errors.
- `npm test` — 674/684 files, 10584/10600 tests passing. The 16 failing
  tests span the SAME 10 pre-existing files named in the Alpha 422–430
  README status entry (`fedos_core_rust_public_crypto_api`,
  `fedos_core_rust_public_opaque_crypto_api`,
  `fedos_core_rust_secret_handle_real_bytes`,
  `secure_runtime_alpha_018_ciphertext_wire_export_import_api`,
  `secure_runtime_alpha_147_identity_root_derivation`,
  `secure_runtime_alpha_151_protocol_root_handle`,
  `secure_runtime_alpha_154_protocol_separation_verification`,
  `secure_runtime_alpha_155_integration_completion`,
  `secure_runtime_alpha_156_nostr_root_handle`,
  `secure_runtime_alpha_158_nostr_root_verification`) — all hardcoded
  `pub fn`/`#[wasm_bindgen]`-count or line-position structural
  assertions over `lib.rs` source text, none touching Master Seed,
  signing, Board, or Outbox code. Confirmed pre-existing, not a
  regression, by `git stash` of exactly this Arc's four modified Rust/
  loader files and re-running the same ten files against the stashed
  (pre-Arc) `lib.rs`: 25 failures at the stashed baseline versus 16
  with this Arc's changes applied — this Arc's own insertions
  incidentally realign some of these fragile counts rather than
  breaking new ones.
- `cargo check` — GREEN.
- `cargo test` (external `CARGO_TARGET_DIR`, avoiding this
  environment's own non-ASCII/space-containing repository path) — 515
  passed, 1 failed
  (`crypto::secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`),
  confirmed pre-existing and unrelated: `git diff --stat -- packages/fedos-core-rust/Cargo.toml`
  is empty for this entire Arc, and that one failing test counts lines
  in `Cargo.toml` exclusively. This is the first Arc in this
  repository's own recorded history where `cargo test` actually BUILDS
  and RUNS in this environment (every prior Arc's own README entry
  reports a MinGW `dlltool` build failure) — resolved by Alpha 440's
  own `CARGO_TARGET_DIR` workaround, independently reproduced here.
- Security guards (`git diff`/`git status`/direct inspection, not
  re-stated from Alpha 449 alone): no raw seed getter, no raw
  secret-key getter, no `nsec` string outside pre-existing unrelated
  denylist files and this Arc's own prohibition doc-comments, no
  `Clone`/`Debug`/`Serialize` derive on `FedosMasterSeedAuthority` or
  `FedosMasterSeedAuthorityState`, `Cargo.toml`/`package.json` diffs
  both empty, `p2p/` remains the sole untracked entry in `git status
  --short`.
- Artifact hygiene — `packages/fedos-core-rust/target/` and
  `packages/fedos-core-rust/Cargo.lock` both present on disk (created
  by this Stage's own verification runs) but confirmed git-ignored
  (`git status --short --ignored` reports `!!`, not `??`/`A`); no
  `packages/fedos-core-rust/pkg/` directory exists.

## 5. What this Arc establishes

- A production Master Seed authority (`FedosMasterSeedAuthority`) that
  generates inside Rust via the OS CSPRNG, never inside TypeScript.
- Sealed persistence (Argon2id + ChaCha20-Poly1305, Sealed Master Seed
  Envelope V1) that survives a real restart, verified via a real
  second, independent authority instance.
- An explicit, irreversible lifecycle with fail-closed behavior on
  every malformed/wrong-key/corrupted/already-occupied path.
- No raw Master Seed export, no raw Nostr secret-key export, no `nsec`
  export, anywhere.
- A narrow Nostr signing authority (`sign_nostr_event`) constrained to
  `kind = 1`, deterministic per `accountIndex`, producing a complete
  signed NIP-01 event independently re-verifiable by both a separate
  Rust `k256::schnorr` verifier and this repository's own existing
  TypeScript `validateInboundNostrEvent()`.
- Restart-stable signing identity: the same sealed seed, restored,
  reproduces byte-for-byte identical signatures.
- A Publisher-ready signing authority boundary with zero transport
  concern, ready for a future Publisher Arc to depend on without
  further adapter code.

## 6. Still out of scope

Nostr Board Publisher execution, Relay publish, OK correlation,
delivery observation, retry/backoff, ActivityPub/AT Protocol/Session
outbound, Bridge attribution, GUI seed-management screen, mnemonic UI,
hardware wallet support, multi-device seed sync, DM/private Board,
capabilities/invites, Lightning/NIP-13, JA4/CrowdSec, Ontology
integration.

## 7. Next Arc recommendation

**Secure Runtime Alpha 451–460: Nostr Outbound Board Publisher &
Delivery Observation Arc** — wire `Board Reader → Nostr Signing
Authority → FedosRelay` into an actual publish flow, decide OK-message
correlation and delivery-observation shape, and decide retry/backoff
policy (all explicitly deferred by Alpha 448). This Arc's own
Publisher-readiness review found no missing dependency shape, so the
next Arc can proceed directly to the publish flow itself rather than
another boundary-review Stage.

## 8. See also

- `docs/secure_runtime_alpha_431_existing_secret_authority_and_storage_inventory.md`
  through `docs/secure_runtime_alpha_449_security_regression_guards.md`
- `docs/secure_runtime_alpha_430_nostr_signing_boundary_completion.md`
  (the prior Arc's own honest block, resolved by this Arc)
