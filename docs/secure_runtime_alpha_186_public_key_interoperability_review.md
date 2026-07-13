# Secure Runtime Alpha 186 — Interoperability with FedosNostrPublicKeyHandle

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified beyond the
`#[cfg(test)]`-only coverage Alpha 184 already landed and this Stage
now formally reviews. This is Stage 6 of the Alpha 181–190 Nostr
Schnorr Signing Foundation Arc, following Alpha 185's own Boundary
Review.**

## 1. Why now

Signing and the public key are two independently derived outputs of
the SAME `FedosNostrSecretKeyHandle` — this Stage answers the one
question that matters for their future usefulness together: does a
signature `derive_nostr_signature_internal` produces actually verify
against the SAME public key `derive_nostr_public_key_internal`
(Alpha 169, UNCHANGED) already produces, from the SAME secret key?
If the two derivations silently disagreed on convention (e.g. x-only
even/odd-Y handling), a future Event Builder would ship syntactically
valid but cryptographically BROKEN events — the single most important
compatibility property to confirm before Alpha 187 even considers what
an Event Builder might look like.

## 2. The convention risk this Stage specifically checks

BIP-340 defines a public key as x-only — the SAME x-coordinate is
shared by two possible secret scalars, `d` and `n - d` (`n` the curve
order), corresponding to a point with even Y and one with odd Y
respectively. A conformant Schnorr SIGNER must use whichever of `d`/
`n-d` yields the EVEN-Y point, or its signatures will not verify
against the x-only public key a naive "just take the x-coordinate"
reader would compute. `derive_nostr_public_key_internal` (Alpha 169)
takes exactly that naive approach — `SecretKey::from_slice(secret_bytes).public_key().to_encoded_point(true)`,
extracting X directly, with NO even/odd-Y correction of its own — this
is CORRECT for a "what x-only key does this secret correspond to"
question (X is identical either way — negating a scalar negates Y,
never X), but it does NOT by itself guarantee a signature computed
from the SAME raw secret bytes, without equivalent correction, would
verify against that X. Whether `k256::schnorr::SigningKey` performs
this correction internally, and whether the result actually agrees
with `derive_nostr_public_key_internal`'s own independently-computed
X, is exactly what this Stage confirms — by real execution, not by
reading k256's source and assuming.

## 3. k256's own correction, confirmed present (Alpha 181's own
   inventory, re-cited here for this Stage's specific purpose)

`impl From<NonZeroScalar> for SigningKey` (`k256::schnorr::signing`)
performs exactly this correction:

```rust
let odd = (ProjectivePoint::GENERATOR * *secret_key)
    .to_affine()
    .y
    .normalize()
    .is_odd();
secret_key.conditional_assign(&-secret_key, odd);
```

`SchnorrSigningKey::from_bytes` (used by
`derive_nostr_signature_internal`, Alpha 183) routes through this SAME
conversion. This is k256's OWN existing logic — Alpha 183 added zero
correction code of its own; the "no manual signing implementation"
discipline (Alpha 181 §4) extends to this correctness-critical detail
too, not merely to the top-level sign call.

## 4. Real, executed cross-verification — not merely read-and-trust

Alpha 184 §2.5 already landed the test this Stage cites as its own
primary evidence:
`derived_signature_cryptographically_verifies_against_the_independently_derived_public_key`
derives a public key via `derive_nostr_public_key_internal` (Alpha
169, completely unmodified — this Arc's own "Do not redesign" rule
honored exactly) and a signature via `derive_nostr_signature_internal`
(Alpha 183) from the SAME secret key, reconstructs a
`k256::schnorr::VerifyingKey` from the public key's own x-only bytes,
and confirms `verify_prehash` succeeds. **This test passing is the
concrete, executed proof that the two independently-built derivation
paths agree on the x-only convention** — §2's own risk is confirmed
NOT realized, by execution, for every secret key this crate can
derive (the test's own account index and message are arbitrary,
non-special values, exercising the general case, not a hand-picked
lucky one).
`derived_signature_does_not_verify_against_a_different_message`
confirms the negative direction too — the SAME public key correctly
REJECTS a signature over the wrong message, ruling out a verification
routine that trivially accepts anything.

## 5. What remains genuinely independent between the two Handles

- `FedosNostrPublicKeyHandle` (Alpha 168) and
  `FedosNostrSignatureHandle` (Alpha 182) share no Rust type, no
  common trait, no common field — the ONLY relationship between them
  is the cryptographic one §4 just confirmed, never a structural or
  type-system one. Neither type references the other anywhere in its
  own definition.
- `FedosNostrPublicKeyHandle` carries exactly one narrowly-scoped byte
  accessor (Alpha 173's own Encoder Boundary); `FedosNostrSignatureHandle`
  carries none (Alpha 182 §3) — this asymmetry is intentional and
  UNCHANGED by this Stage: a public key needs to become `hex`/`npub`
  for display and protocol use (Alpha 177/178), while a signature has
  no analogous reviewed need yet (Alpha 187 reviews, but does not
  build, that future need).
- Neither derivation function calls the other, imports the other's
  private accessor, or depends on the other's own internal
  representation beyond the PUBLIC 32-byte x-only value both agree on
  independently.

## 6. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind (the cross-verification tests this Stage relies
  on were already landed by Alpha 184, in the same overall `lib.rs`
  edit this whole Arc lands as one commit).
- Does **not** add a shared trait, a conversion function, or any new
  relationship between `FedosNostrPublicKeyHandle` and
  `FedosNostrSignatureHandle` beyond the cryptographic one that already
  exists by construction.
- Does **not** implement an Event Builder or any code that USES this
  interoperability — that is Alpha 187's own review-only scope.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_185_signature_boundary_review.md`
- `docs/secure_runtime_alpha_184_signature_determinism_verification.md`
- `docs/secure_runtime_alpha_169_deterministic_nostr_public_key_derivation.md`
- `docs/secure_runtime_alpha_168_nostr_public_key_handle.md`
