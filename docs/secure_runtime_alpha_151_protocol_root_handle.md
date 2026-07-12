# Secure Runtime Alpha 151 — Protocol Root Handle

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 1 of the Alpha 151–155 Protocol Root
Derivation Arc, opening on top of the Alpha 146–150 Master Root
Derivation Foundation.**

## 1. Why now

Alpha 146–150 built `Master Seed → Identity Root → Application Root`.
This Arc's own Objective adds the next level — Protocol Root — under
Application Root. This Stage adds ONLY the opaque Handle type; no
derivation exists yet (that is Alpha 152's own deliverable).

## 2. What was implemented

```rust
pub(crate) struct FedosProtocolRootHandle {
    inner: SecretHandle,
}
```

— a NEW `SecretHandleKind::ProtocolRootMaterial` variant (the 11th
variant), and a NEW private accessor on the EXISTING
`FedosApplicationRootHandle`,
`expose_bytes_for_internal_protocol_root_derivation`, named for its own
sole reviewed future caller.

Unlike `FedosMasterSeedHandle`/`FedosIdentityRootHandle`/
`FedosApplicationRootHandle` — one Rust type per hierarchy LEVEL —
`FedosProtocolRootHandle` is a SINGLE type representing every Protocol
Root INSTANCE (Nostr/Session/ATProto/Wallet). All four share an
identical shape and differ only in which `HkdfDomain` variant derived
them; domain separation lives entirely in each domain's own fixed
salt/info, not in the Rust type or the `SecretHandleKind` label. This
mirrors `SecretHandleKind::HkdfOutputMaterial`'s own existing
single-kind-many-domains precedent exactly.

`FedosProtocolRootHandle` exposes the same three non-sensitive methods
as every prior Root Handle type: `kind()`, `is_cleared()`, `clear()`.
It has no public byte-exposing accessor.

## 3. Purity confirmed

- **Opaque Handle only:** `FedosProtocolRootHandle` wraps a
  `SecretHandle`, never a raw `[u8; 32]`/`Vec<u8>` field.
- **No secret byte exposed:** no `pub`/`pub(crate)` method on
  `FedosProtocolRootHandle` returns a byte.
- **No derivation yet:** this Stage adds no `derive_*_root_internal`
  function of any kind — `FedosProtocolRootHandle` cannot yet be
  constructed from a real Application Root (only from this module's
  own unit tests, which construct one directly via its
  crate-internal-only constructor).
- **No WASM exposure:** no WASM-export attribute (wasm_bindgen) is
  applied anywhere in this Stage — the crate's own total count of such
  annotations stays fixed at 13.

## 4. What this Stage does NOT do

- Does **not** derive a Nostr Root, Session Root, ATProto Root, or
  Wallet Root — no derivation function of any kind exists yet.
- Does **not** generate a Nostr secret key, public key, `npub`, or
  signature, and does **not** contact a Relay.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_146_master_seed_handle.md`
- `docs/secure_runtime_alpha_148_application_root_derivation.md`
- `docs/secure_runtime_alpha_142_root_hierarchy_decision.md`
