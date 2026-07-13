# Secure Runtime Alpha 185 — Nostr Signature Boundary Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 5 of the Alpha 181–190 Nostr Schnorr Signing Foundation Arc,
following Alpha 184's own real-execution determinism verification.**

## 1. Why now

Alpha 182–184 built and verified the signing capability itself. Before
this Arc reviews interoperability, extensibility, and Runtime exposure
(Alpha 186–189), this Stage confirms the one property every prior
Handle-boundary Arc in this crate has treated as non-negotiable: no
secret ever crosses `derive_nostr_signature_internal`'s own boundary
— only the Opaque `FedosNostrSignatureHandle` does.

## 2. What crosses the boundary — traced from the function's own
   signature, not assumed

```rust
pub(crate) fn derive_nostr_signature_internal(
    secret_key: &FedosNostrSecretKeyHandle,
    message: &[u8; 32],
) -> Option<FedosNostrSignatureHandle>
```

**In:** a BORROWED reference to an existing `FedosNostrSecretKeyHandle`
(never consumed, never returned, never cloned — this type derives no
`Clone`) and a 32-byte message digest (already public — the caller's
own event id, not secret).

**Out:** `Option<FedosNostrSignatureHandle>` — nothing else. Rust's
own type system makes any other return value a compile error; this is
not a runtime discipline this Stage merely observes holding, but a
STRUCTURAL guarantee the function's own signature enforces.

## 3. Master Seed / Root Handles — never named, never reachable

`derive_nostr_signature_internal`'s own parameter list contains
exactly one Handle type, `FedosNostrSecretKeyHandle` — no
`FedosMasterSeedHandle`, `FedosIdentityRootHandle`,
`FedosApplicationRootHandle`, or `FedosProtocolRootHandle` appears
anywhere in its signature or body (confirmed directly, §6 below). This
matches the SAME "each derivation function touches exactly one input
Handle type, never reaches further up the chain than its own direct
parent" discipline every prior `derive_*_internal` function in
`master_root` already follows (`derive_nostr_public_key_internal` only
ever touches `FedosNostrSecretKeyHandle`; `derive_nostr_secret_key_internal`
only ever touches `FedosProtocolRootHandle`; neither reaches back to
`FedosMasterSeedHandle` directly). Signing inherits this discipline
unchanged — it does not, and structurally cannot, walk back up to the
Master Seed or any Root Handle to do its work.

## 4. The secret key itself — borrowed, copied once, zeroized, never
   returned

The ONE secret byte this function ever touches is a transient
`[u8; 32]` copy, drawn via `expose_bytes_for_internal_signing()`
(Alpha 183's own dedicated accessor, private to this module, its ONLY
caller). That copy:

- Is used ONLY to reconstruct a transient `k256::schnorr::SigningKey`
  for ONE `sign_prehash` call.
- Is `.zeroize()`-d on the VERY NEXT LINE after that call, on every
  path — success or failure (`secret_bytes.zeroize();`, unconditional,
  not inside either match arm).
- Is never logged, never formatted (`FedosNostrSecretKeyHandle` itself
  carries no `Debug`), never returned, never stored in any field of
  `FedosNostrSignatureHandle`.

`FedosNostrSecretKeyHandle` itself — the Handle, not a byte copy of
it — is passed by immutable reference and is provably unmutated:
Alpha 184 §2.4's own
`derive_nostr_signature_internal_does_not_mutate_the_input_secret_key`
test confirms `secret_key.is_cleared()` remains `false` after signing,
by real execution, not by reading the function body and assuming.

## 5. `FedosNostrSignatureHandle` itself — the ONLY thing that crosses
   outward, and it carries nothing secret

The signature this function produces is 64 PUBLIC bytes by
definition (Alpha 182 §4) — not secret material to begin with, so
"crossing the boundary" is not itself a leak in the way a raw secret
scalar would be. What this Stage confirms is narrower and structural:
`FedosNostrSignatureHandle` carries NO accessor of any kind back to
`secret_key`, `message`, or any intermediate value this function
computed — its only field, `bytes: [u8; 64]`, holds exclusively the
already-computed signature output, and its only methods are a
private constructor and `matches_for_internal_verification` (Alpha
182 §3). There is no path, direct or indirect, from a
`FedosNostrSignatureHandle` value back to the secret key that produced
it.

## 6. Structural confirmation (real inspection, this Stage)

- `derive_nostr_signature_internal`'s own signature contains exactly
  ONE Handle-typed parameter (`&FedosNostrSecretKeyHandle`) and
  returns exactly ONE Handle-typed value
  (`Option<FedosNostrSignatureHandle>`) — no `FedosMasterSeedHandle`,
  `FedosIdentityRootHandle`, `FedosApplicationRootHandle`, or
  `FedosProtocolRootHandle` token appears anywhere in its own body.
- Exactly one `zeroize()` call appears in the function body, applied
  to the transient `secret_bytes` copy, unconditionally reached on
  every path.
- `FedosNostrSignatureHandle`'s own impl block (Alpha 182) contains no
  accessor of any kind referencing `secret_key`, `SchnorrSigningKey`,
  or any other secret-adjacent type.
- `#[wasm_bindgen]` count in `lib.rs`: fixed at 13, unchanged — no new
  exposure of any kind was added by this REVIEW-ONLY Stage (nor by
  Alpha 182/183/184 before it).

## 7. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** add a new accessor, log statement, or debug
  implementation to any Handle type.
- Does **not** review interoperability with `FedosNostrPublicKeyHandle`
  — that is Alpha 186's own deliverable (already partly proven by
  Alpha 184 §2.5's own real cross-verification test).
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 8. See also

- `docs/secure_runtime_alpha_184_signature_determinism_verification.md`
- `docs/secure_runtime_alpha_183_derive_nostr_signature_internal.md`
- `docs/secure_runtime_alpha_182_nostr_signature_handle.md`
- `docs/secure_runtime_alpha_176_nostr_public_identifier_origin_review.md`
