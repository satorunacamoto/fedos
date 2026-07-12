# Secure Runtime Alpha 163 — Nostr Secret Key Handle

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 3 of the Alpha 161–165 Deterministic
Nostr Secret Key Derivation Arc, following Alpha 162's own adoption of
Option B (HKDF(account index)).**

## 1. Why now

Alpha 162 decided HOW a Nostr secret key is derived; before writing
the derivation function itself (Alpha 164), this Stage adds the opaque
Handle type that function will return — mirroring Alpha 151's own
"Handle first, deriver second" split for `FedosProtocolRootHandle`/
`derive_nostr_root_internal`.

## 2. What was implemented

```rust
pub(crate) struct FedosNostrSecretKeyHandle {
    inner: SecretHandle,
}
```

— a NEW `SecretHandleKind::NostrSecretKeyMaterial` variant, and
`FedosNostrSecretKeyHandle`'s own `kind()`/`is_cleared()`/`clear()`/
`matches_for_internal_verification()` methods, the same four
non-sensitive methods every prior Root Handle type in `master_root`
exposes. Its private constructor,
`new_from_32_bytes_for_internal_use`, is unreachable from outside
`master_root` — the only production caller is
`derive_nostr_secret_key_internal` (Alpha 164), added alongside it in
this same file edit.

## 3. Design comparison: dedicated type vs. reusing an existing one

This Arc's own Objective requires: "専用型を作らず既存型を再利用する案
も比較してよいが、Protocol Root HandleとSecret Key Handleを同一型にし
てはならない." Two reuse candidates were considered and rejected:

- **Reuse `FedosProtocolRootHandle` itself** — REJECTED. Explicitly
  forbidden by this Arc's own Objective; would also collapse the
  Root/Key type distinction Alpha 162 §3's Secret Exposure row relies
  on for Option A's own rejection.
- **Reuse `SecretHandle` directly, with `SecretHandleKind::NostrSecretKeyMaterial`,
  and no wrapper type at all** — REJECTED. Every other level of this
  hierarchy (`FedosMasterSeedHandle`, `FedosIdentityRootHandle`,
  `FedosApplicationRootHandle`, `FedosProtocolRootHandle`) wraps its
  own dedicated type around a `SecretHandle`, rather than passing a
  bare `SecretHandle` between callers; a bare `SecretHandle` also
  cannot carry its own dedicated
  `matches_for_internal_verification` method without either exposing a
  public comparison function outside `master_root` or breaking the
  "narrowest accessor per caller" discipline (Alpha 161 §2.10).

A genuinely NEW, dedicated type — `FedosNostrSecretKeyHandle` — is
therefore adopted, consistent with the existing one-type-per-hierarchy-
level convention.

## 4. Requirement-by-requirement review

- **Holds a secp256k1 secret key internally:** yes, via its own
  `SecretHandle(NostrSecretKeyMaterial)` field.
- **No raw byte getter, no export:** confirmed — `kind()`/
  `is_cleared()`/`clear()`/`matches_for_internal_verification()` are
  the only public(crate) methods; none returns a byte.
- **`Clone` forbidden:** confirmed — no `#[derive(Clone)]`, no manual
  `Clone` impl, matching every sibling Root Handle type exactly.
- **No `Debug`-over-secret-value:** confirmed — no `#[derive(Debug)]`
  at all on `FedosNostrSecretKeyHandle`, matching
  `FedosProtocolRootHandle`'s own bare, undecorated struct declaration.
- **No `Serialize`:** confirmed — no `serde` import or derive anywhere
  near this type; this crate has never enabled `serde` in a production
  dependency (`docs/ciphertext_serialization_format_decision.md`,
  reconfirmed by Alpha 161's own inventory).
- **No `wasm_bindgen`:** confirmed — the crate's own total
  `#[wasm_bindgen]` annotation count stays fixed at 13.
- **Never reaches Desktop/TypeScript boundary:** confirmed —
  `pub(crate)` only, defined inside `master_root`, a plain (non-`pub`)
  module; no `src/` file is touched by this Stage.
- **Consistent with `SecretHandle` discipline:** confirmed — same
  single-field-wrapping shape as every sibling Root Handle type.
- **Drop-time zeroize:** `SecretHandle`'s own existing `RealSecretBytes`
  wrapper already zeroizes on `Drop` via `secrecy::SecretBox`'s own
  `Drop` impl (`docs/secret_lifecycle_implementation_plan.md` §10) —
  `FedosNostrSecretKeyHandle` inherits this for free through its
  `SecretHandle` field; no additional `Drop` impl is added or needed.

## 5. What this Stage does NOT do

- Does **not** yet wire a constructible-from-a-real-Nostr-Root path —
  `derive_nostr_secret_key_internal` (Alpha 164) is the sole production
  caller of the private constructor, added in this same file edit but
  documented as its own, separate Stage.
- Does **not** derive a public key, `npub`, `nsec`, or signature.
- Does **not** add a `Clone`, `Debug`, `Serialize`, or `#[wasm_bindgen]`
  attribute to `FedosNostrSecretKeyHandle` or any type it touches.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_162_nostr_account_derivation_decision.md`
- `docs/secure_runtime_alpha_151_protocol_root_handle.md`
- `docs/secret_handle_api_shape.md`
- `docs/secret_lifecycle_implementation_plan.md`
