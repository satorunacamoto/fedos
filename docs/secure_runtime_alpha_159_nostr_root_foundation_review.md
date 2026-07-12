# Secure Runtime Alpha 159 — Nostr Root Foundation Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `packages/` file, no `src/` file, is modified. This is
Stage 4 of the Alpha 156–160 Nostr Root Foundation Arc, following
Alpha 156–158's own confirmation that `FedosProtocolRootHandle`/
`derive_nostr_root_internal`/`matches_for_internal_verification`
already satisfy this Arc's opaque-Handle, HKDF-only, and
constant-time-verification requirements.**

## 1. Why now

This Arc's own Objective requires confirming that
`Master → Identity Root → Application Root → Protocol Root → Nostr
Root` is now fully connected, and that no Runtime/Desktop/API exposure
exists. This Stage performs that end-to-end confirmation directly
against the current source and the current test suite's own real
execution, rather than against prose claims alone.

## 2. The chain, as actually implemented

```rust
FedosMasterSeedHandle::new_from_32_bytes_for_internal_use(bytes)   (Alpha 146)
        │
        │  derive_identity_root_internal                          (Alpha 147, HkdfDomain::Identity)
        ↓
FedosIdentityRootHandle                                           (Alpha 147)
        │
        │  derive_application_root_internal                       (Alpha 148, HkdfDomain::Application)
        ↓
FedosApplicationRootHandle                                        (Alpha 148)
        │
        │  derive_nostr_root_internal                              (Alpha 152, HkdfDomain::Nostr)
        ↓
FedosProtocolRootHandle  (the Nostr Root instance)                 (Alpha 151/152)
```

**One divergence from this Arc's own Objective diagram, recorded
rather than silently resolved:** the Objective draws `Protocol Root`
and `Nostr Root` as two separate levels/hops. In the actual
implementation there is only ONE hop from Application Root: calling
`derive_nostr_root_internal` produces a `FedosProtocolRootHandle`
value that IS the Nostr Root directly — there is no intermediate,
generic "Protocol Root" instance that a further step then specializes
into a Nostr Root. `FedosProtocolRootHandle` is simultaneously the
type-level name for the LEVEL ("Protocol Root") and the concrete value
for a specific protocol INSTANCE ("Nostr Root", "Session Root", etc.),
distinguished only by which `HkdfDomain` produced it — Alpha 151's own
deliberate one-type-many-instances design (§2 of
`docs/secure_runtime_alpha_151_protocol_root_handle.md`), reaffirmed
by Alpha 156. This mirrors the SAME kind of recorded divergence Alpha
148 §3 and Alpha 153 §3 each already logged for their own hierarchy
levels.

## 3. Full-chain connection confirmed by real execution

`same_master_seed_and_same_protocol_domain_yields_matching_protocol_roots_across_two_independent_derivations`
(`packages/fedos-core-rust/src/lib.rs`, `master_root::tests`, Alpha
154) builds the ENTIRE chain above, twice, independently, from the
same Master Seed bytes — `FedosMasterSeedHandle` →
`derive_identity_root_internal` → `derive_application_root_internal`
→ `derive_nostr_root_internal` (among the four `ALL_PROTOCOL_ROOT_DERIVE_FNS`)
— and confirms both derivations yield a matching Nostr Root via
`matches_for_internal_verification`. This is the full chain, connected
end to end, confirmed by real execution rather than by inspection
alone.

## 4. No Runtime/Desktop/API exposure

- **WASM:** the crate's own `#[wasm_bindgen]` count remains fixed at
  13 — unchanged since Alpha 145, before the Master Root Derivation
  Foundation Arc began. No Root Handle type or derivation function
  carries a `#[wasm_bindgen]` attribute.
- **Desktop:** `src/desktop/desktop_application.ts` and
  `src/desktop/create_desktop_application.ts` carry no reference to
  any Root Handle type, any `derive_*_root_internal` function, or any
  doc from this Arc or the Alpha 146–155 Arcs before it.
- **Runtime API:** `src/runtime/types.ts`'s `AppRuntime` interface has
  no `deriveKey`/`nostrRoot`/`protocolRoot` field of any kind — its
  shape is unchanged since Alpha 141's own inventory confirmed this.
- **Worker:** `src/worker.ts` carries no reference to any Root Handle
  type or derivation function.
- **Identity Layer:** `src/runtime/fedos_runtime_identity.ts` is
  byte-for-byte unchanged across the whole Alpha 146–159 span.

## 5. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` or any
  other file in `packages/`.
- Does **not** derive an Account Key, Device Key, or any further level
  below Nostr Root.
- Does **not** implement secret key generation, public key generation,
  `npub`/`nsec` encoding, secp256k1 keypair creation, Nostr events, or
  Relay communication.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_156_nostr_root_handle.md`
- `docs/secure_runtime_alpha_157_nostr_root_derivation.md`
- `docs/secure_runtime_alpha_158_nostr_root_verification.md`
- `docs/secure_runtime_alpha_151_protocol_root_handle.md`
- `docs/secure_runtime_alpha_155_integration_completion.md`
