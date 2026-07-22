# Secure Runtime Alpha 5401-5480: FedOS Direct Ratchet State and Sealed Persistence Foundation — Completion Declaration

## What landed

A new, additive domain, `src/conversation/ratchet/` (14 files, ~1700 lines), plus two narrow extensions of the existing Master Seed Rust/WASM boundary. Full design rationale and citations: `docs/secure_runtime_alpha_5401_5480_reconciliation_report.md` (Phase A) and `docs/secure_runtime_alpha_5401_5480_execution_spec.md` (Phase B-L).

**New production files:**

- `fedos_direct_ratchet_session_id.ts` / `fedos_direct_ratchet_session_binding.ts` — versioned, Device-pair-bound, deterministic session identity.
- `fedos_direct_ratchet_session_lifecycle.ts` / `fedos_direct_ratchet_counters.ts` / `fedos_direct_ratchet_limits.ts` — closed lifecycle vocabulary + validated transitions, monotonic counters, exact review-sourced limits (1000 skipped keys/chain-gap, 14-day retention).
- `fedos_direct_ratchet_skipped_key_index.ts` — bounded, session-isolated skipped-key reference index (never an unbounded map, never a real key).
- `fedos_sealed_direct_ratchet_secret_record.ts` — versioned sealed-secret record (one opaque `sealedBlob` field, strict closed-field metadata).
- `fedos_direct_ratchet_sealing_authority.ts` — the narrow sealing-authority port.
- `fedos_direct_ratchet_recovered_secret_handle.ts` / `fedos_direct_ratchet_readiness.ts` / `fedos_direct_ratchet_recovery_outcome.ts` / `fedos_direct_ratchet_session_record.ts` — closed record/outcome types.
- `persistence/{fedos_direct_ratchet_session_persistence,in_memory_fedos_direct_ratchet_session_persistence,append_only_fedos_direct_ratchet_session_persistence}.ts` — event-sourced (by revision), append-only session-metadata persistence.
- `persistence/{fedos_sealed_direct_ratchet_secret_persistence,in_memory_fedos_sealed_direct_ratchet_secret_persistence,append_only_fedos_sealed_direct_ratchet_secret_persistence}.ts` — insert-only sealed-secret persistence.
- `fedos_direct_ratchet_state_runtime.ts` — the narrow Runtime facade (create/inspect/readiness/suspend/reset-required/expire/revoke/counters/skipped-key register-remove/seal/recover/lock/stop).

**Extended (not redesigned):**

- `packages/fedos-core-rust/src/lib.rs` — two new methods on the EXISTING `FedosMasterSeedAuthority` (`seal_direct_ratchet_secret`/`restore_direct_ratchet_secret`), one new `HkdfDomain::DirectRatchetSealing` variant, plus their own dedicated Rust unit tests (12, all real, all passing — genuine AEAD round-trip and cross-binding rejection).
- `packages/fedos-core-rust/src/crypto/aead_internal.rs` — one new `AeadAadDomain::DirectRatchetSealing` variant (internal-only, mirrors `MasterSeedSealing`).
- `packages/fedos-core-rust/src/crypto/aead_envelope_bridge.rs` — one new match arm (`None`, same as `MasterSeedSealing`) for the new AAD domain.
- `src/runtime/fedos_wasm_loader.ts` / `src/runtime/master_seed/fedos_wasm_master_seed_authority.ts` — the two new methods' own WASM Boundary reach, following the existing `attemptDevOnlyMasterSeed*Call()` pattern exactly.

**New tests (9 files, 122 tests, all passing):** session identity, lifecycle/counters, codec/skipped-keys, sealed-secret record, persistence (both backends, both domains), Runtime facade (fake authority — orchestration-level), structural exclusion guards, a real-WASM sealing-authority suite (10 tests), and the Phase L real vertical slice (1 comprehensive test, real WASM + real durable files).

## Sealed persistence, real and honest

The headline sealed-persistence proof (`test/secure_runtime_alpha_5401_5480_real_vertical_slice.test.ts`) runs against genuine cryptography, not a mock: real HKDF-derived session-bound sealing key, real ChaCha20-Poly1305 AEAD, real append-only durable files, a real Runtime stop and a fresh Runtime restoring the SAME Master Seed from its own sealed envelope. It proves, with real bytes: restart recovery, wrong-Device rejection (AEAD authentication failure, not a string comparison), tamper rejection (one flipped hex character), `lock()` disposal of the recovered handle, and — read directly from the durable files — that the raw secret hex never appears in either the session-metadata log or the sealed-secret log.

## Baseline vs. final

**Baseline** (this worktree, before any production edit): `npm run typecheck` clean except two pre-existing, unrelated errors (confirmed via `git stash` against the unmodified base branch). `cargo test --lib`: 531 passed, 1 pre-existing failure (`secp256k1_dependency_guard`, a dependency-count mismatch unrelated to this Arc, confirmed via `git stash`). Full `npx vitest run`: ~242 pre-existing failing test files, confirmed via `git stash` to be environmental/historical to this worktree, unrelated to this Arc.

**Final:**

- `npm run typecheck`: identical to baseline.
- `cargo test --lib`: 543 passed (12 new), the same 1 pre-existing failure.
- `npm run build:wasm`: succeeds; new methods correctly exported.
- New Ratchet Foundation suite: **122 passed, 0 failed** (9 files).
- Focused regression: Device Trust (36 tests, 2 files), Conversation identity (8 tests), Master Seed/sealed-envelope/conversation-key wiring (21 tests, 3 files) — all passing.
- Full `npx vitest run`: failing-file set identical to baseline (zero new failures) — verified by a sorted-file-list diff, not by inspection alone. Every test this Arc's own changes touched was found and fixed: ~96 historical structural "exact `pub fn`/`HkdfDomain` count" tests (a long-established per-Arc convention across this crate's history), the Alpha 436 method-inventory test, the Alpha 531 live `git status` ripple-review guard, and four fake-WASM-shape test fixtures.

No file under `src/conversation/archive/`, `src/conversation/search/`, `src/conversation/retention/`, `src/sync/`, or `src/conversation/transport/` was modified. `p2p/` and `.tmp_gen/` were not touched.

## Named, deliberate boundaries (not silently dropped)

- **No ratchet cryptography exists yet.** No DH ratchet step, no root-key/chain-key KDF evolution, no message-key derivation. Every "secret" this Arc seals/recovers in tests is opaque placeholder material (test CSPRNG bytes), never a real derived ratchet key — proven by a structural source-text guard (no forbidden method name, no DH/derive-key-material call in the two new Rust functions' own region).
- **No forward secrecy or post-compromise security is claimed.** This Arc is state/persistence infrastructure only.
- **No NIP-17 wire integration exists.** No Rumor/Seal/Gift-Wrap change, no transport publishing, no recipient delivery.
- **Exact limits**: 1000 max skipped keys per chain (same number doubles as the max chain-gap bound, per the review's own deliberate choice), 14-day skipped-key/superseded-session retention.
- **Exact secret-storage boundary**: the ONLY field ever carrying secret-derived bytes anywhere in this Arc's persisted state is `FedosSealedDirectRatchetSecretRecordV1.sealedBlob` — an opaque, Rust-produced hex string. No TypeScript string ever holds a raw key. No append-only log ever contains a plaintext secret byte (proven directly by reading the durable files in the real vertical slice test).
- **Session identity elaboration**: this Arc binds local Device identity in addition to the review's own 3-component (account, peer, peer-Device) model, per a documented, cited justification (this codebase's own existing multi-device-per-account reality) — not a contradiction of the review, an extension within its own delegated scope.
- **Account binding via composite context, not a wider Rust signature**: `local_device_ref`/`remote_device_ref` sealing-context parameters carry a composite (account, Device) string constructed TypeScript-side, deliberately avoiding a Rust signature change that would have rippled further than necessary.
- **No Desktop Runtime wiring.** This foundation is left as a constructible standalone Runtime, per the mission's own stated preference — no Shell/UI/IPC method, no packaged Electron exposure, nothing user-visible.
- **Archive/Search/Sync/Transport formats are byte-for-byte unmodified** — the exclusion is structural absence, proven by reading real source, never a new marker field.

## Declaration

**Complete** for this Arc's own stated scope:

- The state model exists (closed, versioned, strictly validated types for session identity, binding, lifecycle, counters, skipped-key references, limits, readiness, and recovery outcomes).
- Device-bound session identity exists (deterministic, collision-safe, cross-Device- and cross-Conversation-isolated).
- Bounds exist and are enforced (skipped-key cap/expiry/chain-gap, counter overflow, closed lifecycle vocabulary).
- Sealed persistence works — proven with real cryptography, not a mock.
- Restart recovery works — proven with a real, fresh Runtime over real durable files.
- Corruption fails closed — proven across the full matrix (malformed/truncated/out-of-order/conflicting log lines, unknown schema/suite, tampered sealed blobs).
- No plaintext secret is ever persisted — proven by direct inspection of durable files.
- Archive/Search/Sync/Transport exclusions hold — proven structurally.
- No cryptographic messaging claim is made anywhere in this Arc's code or documentation.

## Recommended next Arc

**FedOS Direct Double Ratchet Cryptographic Core Arc.**
