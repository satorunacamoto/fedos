# Secure Runtime Alpha 156 — Nostr Root Handle

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `packages/` file, no `src/` file, is modified. This is
Stage 1 of the Alpha 156–160 Nostr Root Foundation Arc.**

## 1. Why now

This Arc's own Objective calls for a `FedosNostrRootHandle` — an
opaque Handle, never exposing raw bytes, following exactly the
existing Handle conventions used by `FedosMasterSeedHandle`/
`FedosIdentityRootHandle`/`FedosApplicationRootHandle`/
`FedosProtocolRootHandle`. Before writing a second, structurally
identical Rust type, this Stage first checks what the Protocol Root
Derivation Arc (Alpha 151–155) already built, since Alpha 152 already
named its own deliverable "Nostr Root Derivation".

## 2. What already exists

```rust
pub(crate) struct FedosProtocolRootHandle {
    inner: SecretHandle,
}

impl FedosProtocolRootHandle {
    fn new_from_32_bytes_for_internal_use(bytes: [u8; 32]) -> Self { ... }
    pub(crate) fn kind(&self) -> SecretHandleKind { ... }
    pub(crate) fn is_cleared(&self) -> bool { ... }
    pub(crate) fn clear(&mut self) { ... }
    pub(crate) fn matches_for_internal_verification(&self, other: &Self) -> bool { ... }
}

pub(crate) fn derive_nostr_root_internal(
    application_root: &FedosApplicationRootHandle,
) -> ProtocolRootDecision {
    derive_protocol_root_internal(application_root, HkdfDomain::Nostr)
}
```

(`packages/fedos-core-rust/src/lib.rs`, `master_root` module — struct
and `impl` block added Alpha 151, `derive_nostr_root_internal` added
Alpha 152.)

Calling `derive_nostr_root_internal(&application_root)` and taking its
`ProtocolRootDecision::output` on `RootDerivationStatus::Success` IS,
today, the Nostr Root Handle this Arc's Objective describes: an opaque
`FedosProtocolRootHandle` value, constructed exclusively under the
fixed `HkdfDomain::Nostr` salt/info pair
(`b"fedos-hkdf-salt-nostr-v1"`/`b"fedos-hkdf-info-nostr-v1"`, Alpha
152), never distinguishable from any other `FedosProtocolRootHandle`
by inspecting its own fields — only by which `derive_*_internal`
function produced it.

## 3. Convention comparison

| Convention required by this Arc's Objective | `FedosProtocolRootHandle` (Nostr instance) |
| --- | --- |
| Opaque Handle only | Yes — single private `inner: SecretHandle` field, no other field |
| Never expose raw bytes | Yes — no public byte-returning method exists on the type |
| `pub(crate)` visibility only | Yes — `pub(crate) struct`, never `pub` |
| Constructor never generates its own bytes | Yes — `new_from_32_bytes_for_internal_use` takes bytes already derived elsewhere |
| `kind()`/`is_cleared()`/`clear()` accessors | Yes — all three present, identical shape to every other Root Handle |
| No `PartialEq`/`Eq` derive | Yes — comparison only via `matches_for_internal_verification` |

Every row matches `FedosMasterSeedHandle` (Alpha 146),
`FedosIdentityRootHandle` (Alpha 147), and `FedosApplicationRootHandle`
(Alpha 148) exactly — the SAME shape, at every hierarchy level.

## 4. Decision: no new Rust type is introduced

`FedosProtocolRootHandle`, once constructed via
`derive_nostr_root_internal` under `HkdfDomain::Nostr`, already
satisfies every property this Arc's Objective names for
`FedosNostrRootHandle`. Introducing a second, structurally identical
type (same single `SecretHandle` field, same four methods, same
`pub(crate)` visibility) would duplicate code with zero new guarantee
— this mirrors Alpha 151's own deliberate decision to use ONE Rust
type for every Protocol Root instance rather than one type per
protocol, per that Stage's own precedent from
`SecretHandleKind::HkdfOutputMaterial`'s single-kind-many-domains
design.

**One honestly-recorded limitation:** there is today no type-level or
`SecretHandleKind`-level way to distinguish a Nostr-domain
`FedosProtocolRootHandle` from a Session/ATProto/Wallet-domain one at
rest — `kind()` returns the same `SecretHandleKind::ProtocolRootMaterial`
for all four. The only way to know which protocol a given handle
belongs to is to track which `derive_*_root_internal` function
produced it. This Arc's Objective does not ask for that distinction to
be resolved (it asks only that an opaque, convention-following Handle
exist, which it already does), so this Stage records the limitation
rather than silently fixing or silently ignoring it.

## 5. What this Stage does NOT do

- Does **not** introduce a `FedosNostrRootHandle` Rust type, or any
  other new `struct`/`enum`/`impl` block.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs` or any
  other file in `packages/`.
- Does **not** add a new `SecretHandleKind` or `HkdfDomain` variant.
- Does **not** implement secret key generation, public key generation,
  `npub`/`nsec` encoding, secp256k1 keypair creation, Nostr events, or
  Relay communication.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_151_protocol_root_handle.md`
- `docs/secure_runtime_alpha_152_nostr_root_derivation.md`
- `docs/secure_runtime_alpha_155_integration_completion.md`
