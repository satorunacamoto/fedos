# Secure Runtime Alpha 181 — k256 Schnorr API Inventory & Dependency Decision

**Status: this Stage INVENTORIES and DECIDES, then implements the ONE
minimal Cargo dependency-shape change its own decision requires. This
is Stage 1 of the Alpha 181–190 Nostr Schnorr Signing Foundation Arc,
following the completed Nostr Public Identifier Runtime Boundary Arc
(Alpha 176–180), which froze the Identifier Boundary and recommended
this exact Arc as its own next candidate.**

## 1. Why now

The Secret Key (Alpha 161–165), Public Key (Alpha 166–170), and
Identifier (Alpha 171–180) foundations are complete and frozen. This
Arc's own Objective is real, deterministic BIP-340 Schnorr signing on
top of them, reusing only k256 — the secp256k1 library this crate
already depends on (Stage 194) — and explicitly forbidding both a new
Cargo dependency and a hand-written signing implementation. Before
writing any code, this Stage inventories exactly what k256 already
ships for Schnorr, and confirms it is directly reusable.

## 2. Inventory: k256 already ships real BIP-340 Schnorr signing

`k256` 0.13.4 (the exact version already pinned in this crate's
`Cargo.lock`) contains a complete `schnorr` module
(`k256::schnorr`), gated behind a Cargo feature literally named
`"schnorr"` (confirmed directly:
`packages/fedos-core-rust/... /k256-0.13.4/src/lib.rs:44-45`,
`#[cfg(feature = "schnorr")] pub mod schnorr;`). Per that module's own
doc comment, it implements "Taproot Schnorr signatures as defined in
[BIP340]" — the SAME signature scheme this Arc's own Objective names —
and states plainly: "Because Taproot Schnorr is intended for use in
consensus-critical applications (e.g. Bitcoin), it is fully specified
such that no two implementations should disagree on the validity of a
signature." This is RustCrypto's own audited implementation, the SAME
organization and license (Apache-2.0 OR MIT) as every dependency this
crate already trusts — not a new library, not a new trust boundary.

Two public types this Stage's own inventory confirms are directly
usable, unmodified:

- **`k256::schnorr::SigningKey`** — constructed from a raw 32-byte
  scalar via `SigningKey::from_bytes(&[u8]) -> Result<Self>`, the
  EXACT shape `FedosNostrSecretKeyHandle`'s own internal bytes already
  take.
- **`k256::schnorr::VerifyingKey`** / **`k256::schnorr::Signature`** —
  `VerifyingKey::from_bytes(&[u8]) -> Result<Self>` takes the EXACT
  32-byte x-only shape `FedosNostrPublicKeyHandle` already holds
  (Alpha 168); `Signature::to_bytes()` returns a fixed `[u8; 64]`.

## 3. The deterministic signing path — `PrehashSigner::sign_prehash`

`SigningKey` implements `signature::hazmat::PrehashSigner<Signature>`:

```rust
impl PrehashSigner<Signature> for SigningKey {
    fn sign_prehash(&self, prehash: &[u8]) -> Result<Signature> {
        self.sign_raw(prehash, &Default::default())
    }
}
```

`sign_raw`'s second argument is BIP-340's own "auxiliary randomness"
input — `&Default::default()` for `[u8; 32]` is thirty-two ZERO bytes,
never drawn from an RNG. BIP-340 itself states all-zero auxiliary
randomness is an explicitly acceptable, secure choice for a signer
that does not want to depend on an external entropy source (it exists
to harden against certain side-channel/fault-injection attacks, not
to make ordinary signing non-deterministic by requirement). `sign_raw`
itself is otherwise a pure function of `(secret scalar, verifying key
x-coordinate, message)` — no other randomness anywhere in the call
path. **This means `sign_prehash` — with zero code of this crate's own
— is already exactly the deterministic signing primitive this Arc's
own Alpha 184 requires**, confirmed by real execution in that Stage,
not merely by reading k256's own source here.

`prehash` takes an already-hashed message, matching NIP-01's own
convention exactly: `NostrEvent.sig` is "the sha256 hash of the
serialized event data" (`= NostrEvent.id`) run through Schnorr, never
the raw event JSON itself — this crate's `derive_nostr_signature_internal`
(Alpha 183) therefore takes a `&[u8; 32]` message digest, not an
arbitrary-length message.

## 4. The conflict: k256's own `"schnorr"` feature is not yet enabled

`Cargo.toml`'s `k256` dependency line enables ONLY `"arithmetic"`
today (Stage 194's own decision, confirming field/group arithmetic
only, deliberately excluding `ecdsa`/`schnorr`/`serde`/`pem`/`pkcs8`
— that decision's own comment names `schnorr` explicitly: "a separate
future Nostr-signing candidate, not this one"). A pre-existing test,
`crypto::secp256k1_dependency_guard::k256_is_declared_with_default_features_false_and_only_the_arithmetic_feature`
(Stage 196), formally asserted `schnorr` absent — its own doc comment
states the guard exists "to guard the DEPENDENCY shape stays fixed
until a future, separate, explicitly-reviewed stage builds real
[signing] code on top of it."

This Arc's own instruction simultaneously requires (a) reusing ONLY
k256's own existing capabilities, (b) adding no new Cargo dependency,
and (c) "No manual signing implementation." (a)+(c) together leave
exactly one path: use k256's OWN `schnorr` module — which requires
enabling the Cargo FEATURE FLAG `"schnorr"` on the `k256` dependency
line already present. This is confirmed, by direct review with the
project owner, to be the intended reading of (b): a feature-flag
change on an ALREADY-DECLARED dependency line is not a new
`[dependencies]` entry — no new crate name is introduced, and
`k256`'s own Stage-194 adoption already anticipated exactly this
future need in its own comment (§4 above). Hand-writing BIP-340's
scalar/tagged-hash arithmetic instead (the only alternative that
touches zero Cargo state) was explicitly rejected as violating (c)
directly — re-implementing consensus-critical signature math by hand
is precisely the category of risk "No manual signing implementation"
exists to rule out.

## 5. Decision and its ONE consequence — a feature flag, not a new
   dependency

**`k256`'s `features` list gains `"schnorr"`, alongside the
already-enabled `"arithmetic"` — `ecdsa`, `serde`, `pem`, `pkcs8`,
`std`, `alloc`, and `rand` all remain excluded, unchanged.** The
`[dependencies]` section's own LINE COUNT does not change — this is
still one `k256` entry, not two. Verified directly (`cargo tree`,
this Stage): enabling `"schnorr"` transitively resolves exactly three
NEW crates into the build graph — `ecdsa v0.16.9`, `signature v2.2.0`
(both RustCrypto, Apache-2.0 OR MIT, the SAME organization/license as
`k256` itself and every other dependency already listed), and a
SECOND, independent copy of `sha2` (`v0.10.9`, alongside this crate's
own existing direct `sha2 = "0.11.0"`) — a normal, harmless Cargo
outcome (multiple major versions of one crate coexisting in one build
graph), not a functional risk. This crate's own code calls no ECDSA
function anywhere — `ecdsa`'s presence is an unavoidable, undirected
consequence of k256's own internal feature wiring (its `"digest"`
sub-feature unconditionally activates the optional `ecdsa-core`
dependency's `"hazmat"` feature), the SAME category of reviewed,
documented, unavoidable transitive exception `Cargo.toml`'s own
comment already accepted for `rand_core` at Stage 194.

`crypto::secp256k1_dependency_guard.rs`'s own test is UPDATED (Stage
196's own doc comment anticipated exactly this): the test asserting
`schnorr` absent now asserts `arithmetic` + `schnorr` present, still
asserting every other forbidden feature (`ecdsa`, `serde`, `pem`,
`pkcs8`, `rand`, `std`, `alloc`) absent from the `k256` LINE ITSELF —
`ecdsa`/`signature` appearing as TRANSITIVE crates in `Cargo.lock` is
expected and unavoidable (§5 above); the guard's own concern has
always been what THIS crate's OWN `Cargo.toml` line requests, not the
full transitive graph.

## 6. Answers to this Stage's own two required questions

1. **Which APIs already exist and can be reused?**
   `k256::schnorr::SigningKey::from_bytes`/`sign_prehash`,
   `k256::schnorr::VerifyingKey::from_bytes`/`verify_prehash`,
   `k256::schnorr::Signature::to_bytes`/`try_from` — all four reused
   verbatim by Alpha 183/184/186, zero new cryptographic algorithm.
2. **Is anything not yet available?** Only the Cargo FEATURE FLAG
   exposing that module (§4/§5 above) — no missing capability, no gap
   requiring a new dependency or hand-written primitive.

## 7. What this Stage does NOT do

- Does **not** add a new `[dependencies]` entry — `k256` remains the
  crate's ONLY secp256k1/Schnorr dependency, one line, unchanged in
  count.
- Does **not** implement `FedosNostrSignatureHandle` or
  `derive_nostr_signature_internal` — that is Alpha 182/183's own
  deliverable (landed in the same `lib.rs` edit as this Stage's own
  Cargo.toml change, per this Arc's single-commit instruction, exactly
  as Alpha 173/174 already landed together).
- Does **not** implement `nsec`, Event construction, Relay
  communication, or a Decoder.
- Does **not** modify `src/desktop/*`, `src/identity/*`, `src/nostr/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  or `package.json`.

## 8. See also

- `docs/secure_runtime_alpha_180_nostr_public_identifier_runtime_boundary_completion.md`
- `docs/secure_runtime_alpha_175_nostr_public_identifier_completion.md`
- `docs/nip44_dependency_adoption.md`
- `packages/fedos-core-rust/src/crypto/secp256k1_dependency_guard.rs`
