# Secure Runtime Alpha 158 — Nostr Root Verification

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `packages/` file, no `src/` file, is modified. This is
Stage 3 of the Alpha 156–160 Nostr Root Foundation Arc, following
Alpha 157's own confirmation that `derive_nostr_root_internal` already
satisfies this Arc's HKDF-only requirement.**

## 1. Why now

This Arc's own Objective calls for `matches_for_internal_verification()`
on the new Handle, using constant-time comparison only, and never
comparing raw byte arrays outside Handle types. Alpha 154 already
added exactly this method to `FedosProtocolRootHandle` — the SAME type
Alpha 156 confirmed already serves as the Nostr Root Handle. This
Stage reviews that existing method specifically against Nostr Root
instances, rather than adding a second comparison method.

## 2. What already exists

```rust
pub(crate) fn matches_for_internal_verification(&self, other: &Self) -> bool {
    let mut left = match self.inner.expose_bytes_for_internal_derivation() {
        Some(bytes) => bytes,
        None => return false,
    };
    let mut right = match other.inner.expose_bytes_for_internal_derivation() {
        Some(bytes) => bytes,
        None => {
            left.zeroize();
            return false;
        }
    };
    let equal = bool::from(left.ct_eq(&right));
    left.zeroize();
    right.zeroize();
    equal
}
```

(`packages/fedos-core-rust/src/lib.rs`, `impl FedosProtocolRootHandle`,
Alpha 154.) Since a Nostr Root IS a `FedosProtocolRootHandle` instance
(Alpha 156), this method already applies to two Nostr Root values with
no further code needed.

## 3. Requirement-by-requirement review

- **"Use constant-time comparison only":** confirmed.
  `left.ct_eq(&right)` uses `subtle::ConstantTimeEq`, not `==` or a
  derived `PartialEq`. `FedosProtocolRootHandle` derives neither.
- **"Never compare raw byte arrays outside Handle types":** confirmed.
  `left`/`right` are transient local arrays that exist only inside this
  one method's own stack frame, immediately `zeroize()`-d on every
  return path (the `Some`/`None` short-circuit on `other` and the final
  return both zeroize before returning) — no byte ever escapes to a
  caller, a log, or a second comparison site.

## 4. Nostr-specific coverage already confirmed by real execution

Alpha 154's own `different_protocol_domains_from_the_same_application_root_never_match`
test derives all four Protocol Roots — Nostr, Session, ATProto, Wallet
— from the SAME `FedosApplicationRootHandle` via
`ALL_PROTOCOL_ROOT_DERIVE_FNS` (a fixed four-element array including
`derive_nostr_root_internal`), then compares every pairwise
combination. This means a Nostr Root's own separation from every other
protocol's Root is already exercised by real execution, not merely
asserted — the six pairs include Nostr-vs-Session, Nostr-vs-ATProto,
and Nostr-vs-Wallet, all three confirmed non-matching.
`same_protocol_root_rederived_twice_matches_exactly_via_handle_comparison`
separately confirms deriving a Nostr Root twice from the same
Application Root yields a match — the SAME-domain case.

## 5. What this Stage does NOT do

- Does **not** add a second `matches_for_internal_verification`-shaped
  method, or a new comparison function of any kind.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs` or any
  other file in `packages/`.
- Does **not** add a `PartialEq`/`Eq`/`Hash` derive to
  `FedosProtocolRootHandle`.
- Does **not** implement secret key generation, public key generation,
  `npub`/`nsec` encoding, secp256k1 keypair creation, Nostr events, or
  Relay communication.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_157_nostr_root_derivation.md`
- `docs/secure_runtime_alpha_154_protocol_separation_verification.md`
- `docs/secure_runtime_alpha_149_root_handle_verification.md`
