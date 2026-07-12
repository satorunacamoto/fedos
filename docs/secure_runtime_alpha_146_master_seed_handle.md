# Secure Runtime Alpha 146 — Master Seed Handle

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 1 of the Alpha 146–150 Master Root
Derivation Foundation Arc, following the completed Deterministic
Identity Root Derivation Design Arc (Alpha 141–145).**

## 1. Why now

Alpha 145 declared the design phase complete and recommended a Master
Seed / Root Derivation Rust Boundary Review as the next Stage. This
Stage is the FIRST real implementation step: a Rust-internal handle
type for the Master Seed itself, with no derivation, no WASM
exposure, and no Desktop/Identity Layer access of any kind.

## 2. What was implemented

A new module, `master_root`, added to `packages/fedos-core-rust/src/lib.rs`
immediately after the existing `kdf_core` module. This Stage adds
exactly one new type:

```rust
pub(crate) struct FedosMasterSeedHandle {
    inner: SecretHandle,
}
```

- A new `SecretHandleKind::MasterSeedMaterial` variant (the eighth),
  appended to the EXISTING `SecretHandleKind` enum
  (`packages/fedos-core-rust/src/lib.rs`) — a non-sensitive
  classification label only, exactly mirroring the precedent already
  set by `ConversationKeyMaterial`/`MessageKeyMaterial` (each
  "named" secret type gets its own dedicated label, never a generic
  `HkdfInputMaterial` reuse).
- `FedosMasterSeedHandle::new_from_32_bytes_for_internal_use(bytes: [u8; 32]) -> Self`
  — takes an already-drawn, fixed-size `[u8; 32]`. This constructor
  does NOT, and must not, generate its own bytes — it never calls
  `fedos_random_bytes_32`/`fedos_aead_nonce_96` itself, mirroring
  `SecretHandle`'s own established discipline exactly.
- `kind()`, `is_cleared()`, `clear()` — the same non-sensitive status
  surface every other Handle type in this crate exposes.
- ONE private accessor, `expose_bytes_for_internal_root_derivation`,
  reserved for the Identity Root derivation a later Stage in this
  same Arc adds.

## 3. Purity confirmed

- **Raw bytes never leave `master_root`:** the accessor that reads
  bytes is a bare private `fn` (not even `pub(crate)`) — no other
  module in the crate can call it.
- **No WASM exposure:** zero `#[wasm_bindgen]` annotations exist
  anywhere in `master_root` — the crate's own WASM-exported count
  stays fixed at 13 (confirmed unchanged by this Stage).
- **No Desktop access:** `src/desktop/*` is untouched by this Stage —
  `FedosMasterSeedHandle` is unreachable from TypeScript in any way.
- **No Identity Layer access:** `src/identity/*` is untouched by this
  Stage, for the same reason.
- **No generation:** this type never calls a CSPRNG itself — the
  caller supplies bytes, exactly as `SecretHandle`'s own
  `new_from_32_bytes_for_internal_use` already requires of its own
  callers.

## 4. What this Stage does NOT do

- Does **not** derive an Identity Root, an Application Root, or any
  other value from the Master Seed — that is a later Stage's own
  deliverable.
- Does **not** add any new HKDF implementation or cryptographic
  algorithm — this Stage adds a plain data-holding type only.
- Does **not** add a `#[wasm_bindgen]` item of any kind.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.
- Does **not** generate a Nostr secret key, public key, `npub`, or
  signature, and does **not** contact a Relay.

## 5. See also

- `docs/secure_runtime_alpha_141_existing_secret_kdf_inventory.md`
- `docs/secure_runtime_alpha_142_root_hierarchy_decision.md`
- `docs/secret_handle_api_shape.md`
- `docs/secret_lifecycle_implementation_plan.md`
