# Secure Runtime Alpha 152 — Nostr Root Derivation

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 2 of the Alpha 151–155 Protocol Root
Derivation Arc, following Alpha 151's own Protocol Root Handle.**

## 1. Why now

Alpha 151 added the opaque `FedosProtocolRootHandle` with no way to
construct one from real material. This Stage adds the FIRST real
derivation into that type — Nostr Root, the first Protocol Root named
in `docs/secure_runtime_alpha_142_root_hierarchy_decision.md`'s own
adopted hierarchy.

## 2. What was implemented

```rust
fn derive_protocol_root_internal(
    application_root: &FedosApplicationRootHandle,
    domain: HkdfDomain,
) -> ProtocolRootDecision

pub(crate) fn derive_nostr_root_internal(
    application_root: &FedosApplicationRootHandle,
) -> ProtocolRootDecision
```

`derive_protocol_root_internal` is a private helper — reused by every
fixed-domain wrapper this Arc adds — that follows the SAME
transient-input chaining pattern established at Stage 201
(`hkdf_bridge::derive_message_key_from_conversation_key_internal`) and
reused by every prior Root derivation in this crate: expose the
source's own bytes via its narrow accessor, wrap them in a TRANSIENT
`SecretHandle(HkdfInputMaterial)`, call the crate's ONE production
HKDF-SHA256 call site (`kdf_core::derive_secret_handle_internal`),
`clear()` the transient immediately, and wrap the output bytes in the
target type's own dedicated constructor.

`derive_protocol_root_internal` itself is deliberately **never**
`pub(crate)` — only its fixed-domain wrapper functions are — so no
caller anywhere in this crate can pass an arbitrary `HkdfDomain` into a
Protocol Root derivation. `derive_nostr_root_internal` is the first
such wrapper, fixed to a NEW `HkdfDomain::Nostr` (its own fixed salt
`b"fedos-hkdf-salt-nostr-v1"` / info `b"fedos-hkdf-info-nostr-v1"`) —
the ONLY domain it ever requests.

## 3. Purity confirmed

- **Zero new cryptographic algorithm:** `derive_protocol_root_internal`
  calls the SAME, EXISTING `kdf_core::derive_secret_handle_internal` —
  no new HKDF implementation, no new algorithm.
- **One new domain, not a new algorithm:** `HkdfDomain::Nostr` is a
  fixed label selecting among the existing HKDF-SHA256 implementation.
- **No mutation of the input:** `application_root` is borrowed, never
  consumed, and is left exactly as it was after the call returns.
- **Deterministic:** the same `FedosApplicationRootHandle` always
  derives the same Nostr Root.
- **Fixed-domain-only entry point:** the only `pub(crate)` function is
  `derive_nostr_root_internal`, which internally requests
  `HkdfDomain::Nostr` and nothing else — no caller-selectable domain.

## 4. What this Stage does NOT do

- Does **not** generate a Nostr secret key, public key, `npub`, or
  signature, and does **not** contact a Relay.
- Does **not** derive a Session Root, ATProto Root, or Wallet Root —
  those are Alpha 153's own deliverable.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_151_protocol_root_handle.md`
- `docs/secure_runtime_alpha_147_identity_root_derivation.md`
- `docs/secure_runtime_alpha_142_root_hierarchy_decision.md`
