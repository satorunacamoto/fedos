# Secure Runtime Alpha 148 — Application Root Derivation

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 3 of the Alpha 146–150 Master Root
Derivation Foundation Arc, following Alpha 147's own Identity Root
Derivation.**

## 1. Why now

Alpha 147 added Identity Root derivation. This Stage adds the second
real derivation step: Application Root, derived from Identity Root —
completing the two-level chain this Arc's own instructions specify.

## 2. What was implemented

```rust
pub(crate) fn derive_application_root_internal(
    identity_root: &FedosIdentityRootHandle,
) -> ApplicationRootDecision
```

- A new `SecretHandleKind::ApplicationRootMaterial` variant (the
  tenth), mirroring the precedent Alpha 146/147 already established.
- A new `HkdfDomain::Application` variant (the SIXTH domain) — this
  Stage's own ONLY new domain, a fixed label
  (`b"fedos-hkdf-salt-application-v1"`/`b"fedos-hkdf-info-application-v1"`)
  selecting among the EXISTING, unchanged HKDF-SHA256 implementation
  — never a new algorithm.
- `FedosApplicationRootHandle` — a new opaque handle type, structurally
  identical to `FedosIdentityRootHandle`.
- `derive_application_root_internal` — the SAME chaining pattern
  Alpha 147 established: expose Identity Root's own bytes via its one
  narrow accessor, wrap in a transient `SecretHandle(HkdfInputMaterial)`,
  derive under `HkdfDomain::Application`, clear the transient, copy
  the output into the final `FedosApplicationRootHandle`.

## 3. A recorded hierarchy divergence

`docs/secure_runtime_alpha_142_root_hierarchy_decision.md`'s own
adopted diagram (Option C) drew `Application Root` as a Master-Seed-
direct SIBLING of `Identity Root` — both children of Master Seed. THIS
Arc's own instructions instead derive Application Root AS A CHILD of
Identity Root (`Identity Root → Application Root`). This Stage
implements exactly what this Arc specifies, and RECORDS — rather than
silently resolves — the divergence: a future Stage may revisit whether
`Storage Root`/`Wallet Root` (still unimplemented — neither exists
anywhere in this crate) should also become children of `Identity
Root`, or remain independent Master-Seed-direct siblings as originally
drawn.

## 4. Purity confirmed

- **No new HKDF implementation:** the SAME `derive_secret_handle_internal`
  function is called, unchanged.
- **One new domain, not a new algorithm:** `HkdfDomain::Application`
  is a fixed label; the underlying HKDF-SHA256 computation is
  unchanged.
- **No mutation of the input:** `identity_root` is borrowed, not
  consumed.
- **Deterministic:** the SAME Identity Root always produces the SAME
  Application Root — verified directly.
- **Domain-separated:** Application Root's own bytes differ from
  Identity Root's own bytes, and from any OTHER domain's output for
  the same input — verified directly.

## 5. What this Stage does NOT do

- Does **not** derive a Nostr Root, Session Root, ATProto Root,
  Storage Root, Wallet Root, Account Key, or Device Key — all remain
  future work (Alpha 150 records this list formally).
- Does **not** add a `#[wasm_bindgen]`-annotated item of any kind.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.
- Does **not** generate a Nostr secret key, public key, `npub`, or
  signature, and does **not** contact a Relay.

## 6. See also

- `docs/secure_runtime_alpha_147_identity_root_derivation.md`
- `docs/secure_runtime_alpha_142_root_hierarchy_decision.md`
- `docs/secure_runtime_alpha_143_domain_separation_decision.md`
