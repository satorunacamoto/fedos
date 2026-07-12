# Secure Runtime Alpha 168 — Nostr Public Key Handle

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 3 of the Alpha 166–170 Deterministic
Nostr Public Key Derivation Arc, following Alpha 167's own adoption of
Option C (a dedicated 32-byte x-only type).**

## 1. Why now

Alpha 167 decided HOW a Nostr public key is represented; before
writing the derivation function itself (Alpha 169), this Stage adds
the opaque Handle type that function will return — mirroring Alpha
163's own "Handle first, deriver second" split for
`FedosNostrSecretKeyHandle`/`derive_nostr_secret_key_internal`.

## 2. What was implemented

```rust
pub(crate) struct FedosNostrPublicKeyHandle {
    x_only_bytes: [u8; 32],
}
```

— plus `kind`-free `matches_for_internal_verification`, its ONLY
comparison method. Its private constructor,
`new_from_32_bytes_for_internal_use`, is unreachable from outside
`master_root` — the only production caller is
`derive_nostr_public_key_internal` (Alpha 169), added alongside it in
this same file edit.

## 3. Requirement-by-requirement review

- **Holds a Nostr public key representation internally:** yes, the
  32-byte x-only value Alpha 166/167 confirmed is Nostr's own required
  shape.
- **Separate type from the Secret Key Handle:** confirmed —
  `FedosNostrPublicKeyHandle` and `FedosNostrSecretKeyHandle` are two
  distinct Rust `struct` declarations; neither derives `From`/`Into`
  the other, and no function converts one into the other except
  `derive_nostr_public_key_internal` itself (secret → public, never
  the reverse).
- **No raw secret reference:** confirmed — `FedosNostrPublicKeyHandle`
  holds NO `SecretHandle` field of any kind; it cannot reach a secret
  byte because it never stores one.
- **No raw byte getter added this Stage:** confirmed — no method on
  `FedosNostrPublicKeyHandle` returns `[u8; 32]`/`&[u8; 32]`/any byte
  value; only `matches_for_internal_verification` exists beyond the
  private constructor.
- **No `Serialize`:** confirmed — no `serde` import or derive anywhere
  near this type.
- **No `wasm_bindgen`:** confirmed — the crate's own total
  `#[wasm_bindgen]` annotation count stays fixed at 13.
- **Never reaches Desktop/TypeScript boundary:** confirmed —
  `pub(crate)` only, defined inside `master_root`, a plain (non-`pub`)
  module; no `src/` file is touched by this Stage.
- **No `Debug` implementation added:** confirmed — no
  `#[derive(Debug)]` and no manual `impl Debug` anywhere on this type.
- **`Clone` investigated, not added:** investigated per this Arc's own
  instruction — no caller within this Arc's own scope (Alpha
  169/170's own tests included) ever needs to duplicate a
  `FedosNostrPublicKeyHandle`; each test that needs two independently
  derives two, exactly as `FedosNostrSecretKeyHandle`'s own tests
  already do. `Clone` is therefore NOT added — a future Stage that
  discovers a real need may add it then, as its own explicit, reviewed
  decision.
- **`matches_for_internal_verification` is the only comparison
  method:** confirmed — no `#[derive(PartialEq, Eq)]`, no manual `impl
  PartialEq`, anywhere on this type.
- **Comparison reuses the existing safe pattern:** confirmed —
  `subtle::ConstantTimeEq` (`.ct_eq(...)`), the SAME pattern every
  other Handle type in `master_root` already uses, applied here even
  though the value is not secret (Alpha 166 §2.9), for exactly ONE
  uniform comparison convention across this module.

## 4. Why NOT a `SecretHandle`-backed type

Unlike every prior Handle in `master_root`,
`FedosNostrPublicKeyHandle` does NOT wrap a `SecretHandle`. A public
key is, by definition, not secret material — wrapping it in
`secrecy::SecretBox`/`zeroize` machinery designed specifically to
protect SECRET bytes would be misleading (implying a protection this
value neither needs nor claims) and inconsistent with
`docs/secret_lifecycle_implementation_plan.md`'s own scoping of that
machinery to secret material only (Alpha 166 §2.9). The type instead
holds a plain `[u8; 32]` field directly. It remains Opaque — no public
constructor, no public byte accessor — per this Arc's own explicit
instruction to keep the boundary design consistent with every other
Handle in this module, even though the underlying value is not secret.

## 5. What this Stage does NOT do

- Does **not** yet wire a constructible-from-a-real-secret-key path —
  `derive_nostr_public_key_internal` (Alpha 169) is the sole
  production caller of the private constructor, added in this same
  file edit but documented as its own, separate Stage.
- Does **not** add a raw-byte getter, `Clone`, `Debug`, `Serialize`, or
  `#[wasm_bindgen]` attribute to `FedosNostrPublicKeyHandle`.
- Does **not** implement `npub` encoding, Schnorr signing, or any
  Relay/Event code.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_167_nostr_public_key_representation_decision.md`
- `docs/secure_runtime_alpha_163_nostr_secret_key_handle.md`
- `docs/secret_handle_api_shape.md`
- `docs/secret_lifecycle_implementation_plan.md`
