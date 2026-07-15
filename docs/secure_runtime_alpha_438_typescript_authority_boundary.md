# Secure Runtime Alpha 438 — TypeScript Authority Boundary

Phase A, Stage 8. Introduces the minimum TypeScript interface and its
one implementation.

## Files

- `src/runtime/master_seed/fedos_sealed_master_seed_envelope.ts` —
  `FedosSealedMasterSeedEnvelopeV1` (opaque `{ readonly json: string }`)
  plus a structural, non-authoritative pre-validator.
- `src/runtime/master_seed/fedos_master_seed_authority.ts` — the
  `FedosMasterSeedAuthority` contract, adjusted from the Arc's own
  candidate: every method is `async` (constructing the underlying WASM
  authority itself requires a gated, asynchronous Rust Boundary reach,
  so even `isAvailable()`/`isCleared()` must report "not constructed"
  without throwing).
- `src/runtime/master_seed/fedos_wasm_master_seed_authority.ts` —
  `FedosWasmMasterSeedAuthority`, the one implementation.

## Mechanics actually used

`fedos_wasm_loader.ts` already owns the ONE real, gated, dev-only WASM
module reference (`FedosWasmLoaderSkeleton`, Secure Runtime Alpha
008–018) and already established the "one seam per Rust export, gated
on the same six previously-recorded conditions, duck-typed shape check,
`try`/`catch` fails closed to `CallFailed`" idiom for
`generate_aead_key_handle`/`encrypt_aead`/`decrypt_aead`. This Arc
extends that SAME class with six new gated methods —
`attemptDevOnlyMasterSeedAuthorityConstructCall`,
`...GenerateCall`, `...SealCall`, `...RestoreSealedCall`,
`...ClearCall`, and (Phase B) `attemptDevOnlyNostrSignEventCall` —
rather than building a second, duplicate WASM-loading path, per this
Stage's own "adjust based on actual WASM mechanics" / reuse-existing-
boundary instruction.

One deliberate deviation from the `AeadKeyHandle` precedent: that
type's own shape check (`isAeadKeyHandleShape`) tests a `kind` string
discriminant field. The real `FedosMasterSeedAuthority` Rust struct
carries no such field by design (Alpha 436: no field/getter beyond its
seven lifecycle methods) — so `isFedosMasterSeedAuthorityShape()`
instead validates by METHOD PRESENCE (`is_available`, `is_cleared`,
`generate`, `seal`, `restore_sealed`, `clear`, `sign_nostr_event`, all
`typeof === "function"`), an equally honest duck-type check for a real
wasm-bindgen class instance.

## Responsibilities honored

- Owns the raw WASM handle privately (`#authority`, a private class
  field, never returned by any public method).
- Validates envelope shape before use
  (`toSealedMasterSeedEnvelopeV1`/`isWellFormedSealedMasterSeedEnvelopeV1Json`).
- Calls WASM only — no cryptography, no logging of `passphrase` or
  envelope contents, anywhere in this file.
- Never exposes the underlying `FedosMasterSeedAuthorityHandle` via the
  public `FedosMasterSeedAuthority` interface — the ONE exception is
  `accessForNostrSigningAuthorityInternalUse()`, a narrowly-named,
  explicitly-documented internal accessor for the sole reviewed use of
  `FedosWasmNostrSigningAuthority` (Alpha 445), mirroring this crate's
  OWN Rust-side "one accessor per purpose" discipline
  (`expose_bytes_for_internal_sealing`) — it returns the SAME opaque,
  method-bearing handle (no byte of secret material), never a copy of
  secret state.
- No hidden automatic generation — `#ensureConstructed()` only ever
  CONSTRUCTS the handle (`Empty` state); `generate()`/`restore_sealed()`
  remain explicit caller calls.
- Deep-freezes every returned envelope
  (`toSealedMasterSeedEnvelopeV1`'s own `Object.freeze`).
- No filesystem/storage ownership — persistence is Alpha 439's own,
  separate decision.

`npm run typecheck` is GREEN against these files (verified directly,
not merely asserted).
