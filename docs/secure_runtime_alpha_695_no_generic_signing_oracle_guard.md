# Secure Runtime Alpha 695 — No Generic Signing Oracle Guard

Stage 15 of Phase A. Structural verification, confirmed by direct
inspection of every file this Arc touched or added:

- No `sign(hash)` method exists anywhere — `FedosNostrSigningAuthority`
  exposes exactly `signEvent(request: FedosNostrUnsignedEventRequest)` and
  the new `publicIdentityForAccount(accountIndex)`; neither accepts an
  arbitrary hash/message to sign blindly.
- No raw secret getter exists — `FedosWasmMasterSeedAuthority`'s only
  internal-use accessor (`accessForNostrSigningAuthorityInternalUse()`)
  returns an opaque, method-bearing handle carrying no byte of secret
  material, unchanged by this Arc.
- No public method returns signer internals — `publicIdentityForAccount()`
  returns `FedosNostrSigningPublicIdentity` (two public fields only, Alpha
  683); `public_key_hex_for_account()` in Rust returns `Option<String>`
  only (Alpha 685).
- The Publisher (Phase B) still receives a fully-signed
  `FedosNostrWireEvent`, never the signing authority itself.
- `FedosBoardRuntime` never accesses Master Seed bytes — it holds only a
  `FedosNostrAuthorBindingAuthority` reference (Alpha 694), which itself
  holds only a `FedosNostrSigningAuthority` reference, never a Master Seed
  authority directly.

No exception found; no change required.
