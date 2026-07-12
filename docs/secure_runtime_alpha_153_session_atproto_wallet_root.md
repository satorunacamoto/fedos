# Secure Runtime Alpha 153 — Session / ATProto / Wallet Root

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 3 of the Alpha 151–155 Protocol Root
Derivation Arc, following Alpha 152's own Nostr Root Derivation.**

## 1. Why now

Alpha 152 proved the `derive_protocol_root_internal` pattern with
Nostr Root. This Stage reuses the SAME private helper for three more
fixed-domain wrappers, completing this Arc's own named Protocol Root
set.

## 2. What was implemented

```rust
pub(crate) fn derive_session_root_internal(
    application_root: &FedosApplicationRootHandle,
) -> ProtocolRootDecision

pub(crate) fn derive_atproto_root_internal(
    application_root: &FedosApplicationRootHandle,
) -> ProtocolRootDecision

pub(crate) fn derive_wallet_root_internal(
    application_root: &FedosApplicationRootHandle,
) -> ProtocolRootDecision
```

Each is a thin fixed-domain wrapper over Alpha 152's own
`derive_protocol_root_internal` private helper — zero duplicated
derivation logic — fixed respectively to three NEW `HkdfDomain`
variants: `Session` (`fedos-hkdf-salt-session-v1`/
`fedos-hkdf-info-session-v1`), `ATProto`
(`fedos-hkdf-salt-atproto-v1`/`fedos-hkdf-info-atproto-v1`), and
`Wallet` (`fedos-hkdf-salt-wallet-v1`/`fedos-hkdf-info-wallet-v1`).
`HkdfDomain` now has TEN variants total (`RootKey`/`Identity`/
`Storage`/`Conversation`/`Application`/`Nostr`/`Session`/`ATProto`/
`Wallet`/`TestOnly`) — the crate's own exhaustive-match regression
test was renamed and re-verified accordingly.

## 3. A second recorded hierarchy divergence

`docs/secure_runtime_alpha_142_root_hierarchy_decision.md`'s own
adopted hierarchy diagram drew `Session Root`/`ATProto Root` correctly
as children of `Application Root` — this Stage's derivation of those
two matches that diagram exactly, with zero divergence.

`Wallet Root` is different. Alpha 142's own diagram drew it as a
Master-Seed-direct **SIBLING** of `Application Root`, alongside
`Identity Root`/`Storage Root` — NOT a Protocol Root nested under
Application Root. THIS Arc's own instructions instead group `Wallet
Root` together with `Session Root`/`ATProto Root` as a Protocol Root,
derived from `Application Root` via `derive_wallet_root_internal`.

This Stage implements exactly what this Arc specifies, and RECORDS —
rather than silently resolves — the divergence. This resolves Alpha
148 §3's own open question ("a future Stage may revisit whether
`Storage Root`/`Wallet Root` should also become children of Identity
Root [Application Root]") for `Wallet Root` specifically: it is now a
child of Application Root. `Storage Root` remains unresolved — it is
still not implemented anywhere in this crate, and this Arc does not
touch it.

## 4. Purity confirmed

- **Zero new cryptographic algorithm:** all three wrappers call the
  SAME `derive_protocol_root_internal` private helper — no new HKDF
  implementation.
- **Three new domains, not a new algorithm:** `Session`/`ATProto`/
  `Wallet` are fixed labels selecting among the existing HKDF-SHA256
  implementation.
- **No mutation of the input:** `application_root` is borrowed, never
  consumed, for all three.
- **Deterministic:** each wrapper derives the same output for the same
  `FedosApplicationRootHandle`, every time.
- **Domain-separated:** Nostr/Session/ATProto/Wallet Roots derived
  from the SAME Application Root are pairwise distinct — confirmed by
  this Stage's own tests via raw output comparison, and re-confirmed
  by Alpha 154's own Handle-only comparison.

## 5. What this Stage does NOT do

- Does **not** generate a Nostr/Session/ATProto/Wallet secret key,
  public key, `npub`, or signature, and does **not** contact a Relay
  or connect to a wallet backend.
- Does **not** add `matches_for_internal_verification` to
  `FedosProtocolRootHandle` — that is Alpha 154's own deliverable.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_152_nostr_root_derivation.md`
- `docs/secure_runtime_alpha_142_root_hierarchy_decision.md`
- `docs/secure_runtime_alpha_148_application_root_derivation.md`
