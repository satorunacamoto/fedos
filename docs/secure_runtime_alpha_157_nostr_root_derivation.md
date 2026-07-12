# Secure Runtime Alpha 157 — Nostr Root Derivation

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `packages/` file, no `src/` file, is modified. This is
Stage 2 of the Alpha 156–160 Nostr Root Foundation Arc, following
Alpha 156's own confirmation that `FedosProtocolRootHandle` already
serves as the Nostr Root Handle.**

## 1. Why now

This Arc's own Objective calls for `derive_nostr_root_internal(...)`,
using ONLY the existing HKDF infrastructure, with no new crypto and no
new label outside the protocol-domain already established. Alpha 152
already named its own deliverable "Nostr Root Derivation" and already
added a function of exactly that name. This Stage reviews that
existing function against this Arc's own three requirements, rather
than writing a second one.

## 2. What already exists

```rust
fn derive_protocol_root_internal(
    application_root: &FedosApplicationRootHandle,
    domain: HkdfDomain,
) -> ProtocolRootDecision {
    let bytes = match application_root.expose_bytes_for_internal_protocol_root_derivation() {
        Some(bytes) => bytes,
        None => return ProtocolRootDecision { status: RootDerivationStatus::InvalidInput, output: None },
    };
    let mut transient_input = SecretHandle::new_from_32_bytes_for_internal_use(
        SecretHandleKind::HkdfInputMaterial,
        bytes,
    );
    let decision = derive_secret_handle_internal(&transient_input, domain);
    transient_input.clear();
    // ... wraps the HKDF output in a FedosProtocolRootHandle on success
}

pub(crate) fn derive_nostr_root_internal(
    application_root: &FedosApplicationRootHandle,
) -> ProtocolRootDecision {
    derive_protocol_root_internal(application_root, HkdfDomain::Nostr)
}
```

(`packages/fedos-core-rust/src/lib.rs`, `master_root` module, Alpha
152.) `HkdfDomain::Nostr`'s own fixed salt/info,
`b"fedos-hkdf-salt-nostr-v1"`/`b"fedos-hkdf-info-nostr-v1"`, were fixed
at Alpha 152 and have not changed since.

## 3. Requirement-by-requirement review

- **"using ONLY the existing HKDF infrastructure":** confirmed.
  `derive_protocol_root_internal` calls
  `kdf_core::derive_secret_handle_internal` — the SAME, single
  production HKDF-SHA256 call site every prior Root derivation in this
  crate uses (`derive_identity_root_internal`, Alpha 147;
  `derive_application_root_internal`, Alpha 148). No second HKDF
  implementation, no alternate KDF, exists anywhere in this function.
- **"No new crypto":** confirmed. No new cryptographic primitive,
  algorithm, or library is introduced by `derive_nostr_root_internal`
  or by `derive_protocol_root_internal` beneath it.
- **"No new labels outside the protocol-domain already established":**
  confirmed. `HkdfDomain::Nostr` and its fixed salt/info pair are
  UNCHANGED from Alpha 152 — this Stage adds no new `HkdfDomain`
  variant and no new salt/info literal of any kind.

## 4. Purity reconfirmed

- **Zero new cryptographic algorithm:** the same conclusion Alpha
  152's own design doc already reached, reconfirmed here against the
  current source.
- **Deterministic:** the same `FedosApplicationRootHandle` always
  derives the same Nostr Root — unchanged since Alpha 152, exercised
  again by Alpha 154's own real-execution tests.
- **No mutation of the input:** `application_root` is borrowed, never
  consumed, in the current implementation, exactly as documented at
  Alpha 152.
- **Transient input cleared:** `transient_input.clear()` runs
  immediately after the HKDF call, before the function returns,
  mirroring the SAME pattern used by `derive_identity_root_internal`
  and `derive_application_root_internal`.

## 5. What this Stage does NOT do

- Does **not** add a second `derive_nostr_root_internal`-shaped
  function, or rename/replace the existing one.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs` or any
  other file in `packages/`.
- Does **not** add a new `HkdfDomain` variant or a new salt/info label.
- Does **not** implement secret key generation, public key generation,
  `npub`/`nsec` encoding, secp256k1 keypair creation, Nostr events, or
  Relay communication.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_156_nostr_root_handle.md`
- `docs/secure_runtime_alpha_152_nostr_root_derivation.md`
- `docs/secure_runtime_alpha_147_identity_root_derivation.md`
