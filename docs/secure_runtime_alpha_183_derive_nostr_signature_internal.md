# Secure Runtime Alpha 183 — derive_nostr_signature_internal()

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs` (the same file edit as Alpha
182 — this Arc lands as a single commit, per its own instruction).
This is Stage 3 of the Alpha 181–190 Nostr Schnorr Signing Foundation
Arc, following Alpha 182's own `FedosNostrSignatureHandle`.**

## 1. Why now

Alpha 181 inventoried k256's own `schnorr` module and enabled its
Cargo feature; Alpha 182 built the Opaque output type. This Stage
wires the two together: the ONE function that actually computes a
signature, using `FedosNostrSecretKeyHandle` (Alpha 164, UNCHANGED —
"Do not redesign" this Arc's own instruction) as its input.

## 2. What was implemented

```rust
fn expose_bytes_for_internal_signing(&self) -> Option<[u8; 32]> {
    self.inner.expose_bytes_for_internal_derivation()
}
```

— a new accessor on `FedosNostrSecretKeyHandle` itself (mirroring
`expose_bytes_for_internal_public_key_derivation`'s own existing
shape exactly, one dedicated named accessor per internal consumer,
this crate's established convention) — plus:

```rust
pub(crate) fn derive_nostr_signature_internal(
    secret_key: &FedosNostrSecretKeyHandle,
    message: &[u8; 32],
) -> Option<FedosNostrSignatureHandle> {
    let mut secret_bytes = secret_key.expose_bytes_for_internal_signing()?;

    let signature_bytes = match SchnorrSigningKey::from_bytes(&secret_bytes) {
        Ok(signing_key) => signing_key
            .sign_prehash(message)
            .ok()
            .map(|signature| signature.to_bytes()),
        Err(_) => None,
    };
    secret_bytes.zeroize();

    signature_bytes.map(FedosNostrSignatureHandle::new_from_64_bytes_for_internal_use)
}
```

Two new `use` items at `master_root`'s own top:
`k256::schnorr::signature::hazmat::PrehashSigner` (the trait providing
`.sign_prehash()`) and `k256::schnorr::SigningKey as SchnorrSigningKey`
(aliased to avoid ambiguity with any future `SigningKey`-named type).

## 3. `message` is a 32-byte digest, matching NIP-01 exactly

`message: &[u8; 32]` — the SAME "sha256 hash of the serialized event"
shape NIP-01 defines for `NostrEvent.id`, which is exactly what
`NostrEvent.sig` is computed OVER (Alpha 161 §2.5's own
`computeEventId`/`verifyEventId` on the TypeScript side, unrelated and
unchanged, already produce/consume this identical shape). This
function never hashes its own input — the caller is responsible for
supplying an already-hashed 32-byte digest, the SAME "prehash" contract
`k256::schnorr::signature::hazmat::PrehashSigner` itself names.

## 4. No new cryptographic algorithm, no manual signing implementation

Every step is an existing, audited operation:

- `SchnorrSigningKey::from_bytes` — k256's own constructor, unmodified.
- `PrehashSigner::sign_prehash` — k256's own trait method, unmodified,
  internally calling `sign_raw(prehash, &Default::default())` (Alpha
  181 §3's own finding: all-zero auxiliary randomness, deterministic).
- `Signature::to_bytes` — k256's own serializer, unmodified.

This function's OWN code contains no scalar arithmetic, no tagged
hash, no nonce derivation, no modular reduction — every one of those
operations happens entirely inside `k256::schnorr`, exactly as Alpha
183's own instruction requires ("No manual signing implementation").
The only NEW logic this function itself contributes is: (1) exposing
and later zeroizing a transient copy of the secret scalar, (2)
threading k256's own `Result`/`Option` outcomes through this crate's
established Fail-Closed `Option<Handle>` convention, and (3) wrapping
the raw 64 bytes in the Opaque `FedosNostrSignatureHandle` (Alpha
182) before they leave this function.

## 5. Fail Closed — every invalid input resolves `None`, never a panic

| Condition | Result |
|---|---|
| `secret_key` holds no real bytes (already `clear()`-ed) | `None` — `expose_bytes_for_internal_signing()` returns `None`, short-circuited by `?` |
| `SchnorrSigningKey::from_bytes` rejects the candidate bytes (unreachable in practice — `FedosNostrSecretKeyHandle` can only ever hold an already-`k256`-validated scalar, Alpha 164) | `None` — matched exhaustively via `Err(_) => None`, never `.unwrap()`/`.expect()`/panic |
| `sign_prehash` itself returns `Err` (unreachable in practice, per k256's own internal invariants) | `None` — via `.ok()` |
| A valid secret key and a 32-byte message | `Some(FedosNostrSignatureHandle)` |

No detailed error, exception, or diagnostic reaches this function's
own caller under any failure path — matching this crate's own
established Fail-Closed discipline every other `derive_*_internal`
function in `master_root` already follows (no `unwrap`/`expect`/
`panic!`/`todo!`/`unimplemented!` anywhere in this function's own
body, confirmed by this Stage's own structural check, §7 below).

## 6. Does not mutate `secret_key`; zeroizes its own transient copy

`secret_key` is borrowed (`&FedosNostrSecretKeyHandle`), never
consumed — the SAME Nostr Secret Key can be used to sign any number of
messages, exactly like `derive_nostr_public_key_internal` can be
called any number of times against the same secret key. The transient
`secret_bytes: [u8; 32]` copy this function draws is `.zeroize()`-d on
EVERY path — success or failure — before the function returns,
mirroring `derive_nostr_public_key_internal`'s own identical
`secret_bytes.zeroize();` placement exactly.

## 7. Structural confirmation (real inspection, this Stage)

- `#[wasm_bindgen]` count in `lib.rs`: fixed at 13, unchanged.
- `pub fn` count in `lib.rs`: fixed at 36, unchanged (`derive_nostr_signature_internal`
  is `pub(crate) fn`, not counted).
- `derive_nostr_signature_internal`'s own body contains no `unwrap()`,
  `expect()`, `panic!()`, `todo!()`, or `unimplemented!()`.
- `derive_nostr_signature_internal`'s own body contains no hand-rolled
  arithmetic (`Scalar`, `FieldElement`, or similar low-level `k256`
  type) — every operation is a call through `SchnorrSigningKey`'s own
  public API.

## 8. What this Stage does NOT do

- Does **not** verify the resulting signature — that is Alpha 184's
  own deliverable (real, executed `#[cfg(test)]` verification, landed
  in the same file edit).
- Does **not** expose `derive_nostr_signature_internal` beyond
  `pub(crate)` — unreachable from `AppRuntime`/`types.ts`/Desktop,
  exactly like `derive_nostr_public_key_internal`.
- Does **not** implement `nsec`, Event construction, Relay
  communication, or a Decoder.
- Does **not** modify `src/desktop/*`, `src/identity/*`, `src/nostr/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 9. See also

- `docs/secure_runtime_alpha_182_nostr_signature_handle.md`
- `docs/secure_runtime_alpha_181_k256_schnorr_api_inventory.md`
- `docs/secure_runtime_alpha_169_deterministic_nostr_public_key_derivation.md`
- `docs/secure_runtime_alpha_164_deterministic_nostr_secret_key_derivation.md`
