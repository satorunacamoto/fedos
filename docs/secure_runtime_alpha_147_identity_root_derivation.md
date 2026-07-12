# Secure Runtime Alpha 147 — Identity Root Derivation

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 2 of the Alpha 146–150 Master Root
Derivation Foundation Arc, following Alpha 146's own
`FedosMasterSeedHandle` addition.**

## 1. Why now

Alpha 146 added the Master Seed Handle with no derivation. This Stage
adds the FIRST real derivation step: Identity Root, using the
EXISTING, unchanged HKDF-SHA256 bridge — no new cryptographic
algorithm and no new HKDF implementation.

## 2. What was implemented

```rust
pub(crate) fn derive_identity_root_internal(
    master_seed: &FedosMasterSeedHandle,
) -> IdentityRootDecision
```

- A new `SecretHandleKind::IdentityRootMaterial` variant (the ninth),
  mirroring `MasterSeedMaterial`'s own precedent.
- `FedosIdentityRootHandle` — a new opaque handle type, structurally
  identical to `FedosMasterSeedHandle` (`kind()`/`is_cleared()`/
  `clear()`, no public byte accessor).
- `derive_identity_root_internal` — calls the EXISTING
  `kdf_core::derive_secret_handle_internal` under the EXISTING, fixed
  `HkdfDomain::Identity` — reusing `HkdfDomain::Identity`'s own
  already-committed salt/info
  (`b"fedos-hkdf-salt-identity-v1"`/`b"fedos-hkdf-info-identity-v1"`,
  Stage 147) byte-for-byte, unchanged.
- Chaining follows `crypto::hkdf_bridge::derive_message_key_from_conversation_key_internal`'s
  own exact precedent: the Master Seed's own bytes are exposed via
  its one narrow accessor, copied into a TRANSIENT
  `SecretHandle(HkdfInputMaterial)` for the sole duration of one
  derive call, immediately `clear()`-ed, and the derivation's own
  output bytes are copied ONE more time into the final
  `FedosIdentityRootHandle`'s own dedicated `IdentityRootMaterial`
  `SecretHandle` — never aliased, never re-used storage.

## 3. Purity confirmed

- **No new HKDF implementation:** `derive_identity_root_internal`
  calls the SAME `derive_secret_handle_internal` function every other
  `kdf_core` consumer in this crate already calls — zero new
  cryptographic code.
- **No new domain:** `HkdfDomain::Identity` already existed before
  this Stage; this Stage does not add or modify any `HkdfDomain`
  variant.
- **Fixed order:** `master_seed`'s own bytes are read exactly once,
  copied into a transient handle, immediately cleared after the
  derive call — no dangling copy survives the function call.
- **No mutation of the input:** `master_seed` is borrowed, not
  consumed; it remains fully usable (and re-derivable-from) after
  this call returns.
- **Deterministic:** the SAME Master Seed bytes always produce the
  SAME Identity Root bytes — verified directly by a dedicated unit
  test constructing two independent `FedosMasterSeedHandle`s from the
  same fixture bytes and comparing their own derived outputs.

## 4. What this Stage does NOT do

- Does **not** derive an Application Root or any other value from the
  Identity Root — that is a later Stage's own deliverable.
- Does **not** add a new `HkdfDomain` variant.
- Does **not** add a `#[wasm_bindgen]`-annotated item of any kind.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.
- Does **not** generate a Nostr secret key, public key, `npub`, or
  signature, and does **not** contact a Relay.

## 5. See also

- `docs/secure_runtime_alpha_146_master_seed_handle.md`
- `docs/secure_runtime_alpha_141_existing_secret_kdf_inventory.md`
- `docs/crypto_test_vectors.md`
