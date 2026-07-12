# Secure Runtime Alpha 155 — Integration Completion

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `packages/` file, no `src/` file, is modified. This is
Stage 5, the closing Stage, of the Alpha 151–155 Protocol Root
Derivation Arc.**

## 1. Why now

Alpha 151 added the Protocol Root Handle. Alpha 152 derived the Nostr
Root. Alpha 153 derived the Session/ATProto/Wallet Roots, recording a
second deliberate divergence from Alpha 142's own diagram (Wallet
Root as Application Root's own child rather than a Master-Seed-direct
sibling). Alpha 154 added constant-time, Handle-only verification,
confirmed by real execution. This Stage issues the Arc's own closing
Completion Declaration.

## 2. The Foundation, confirmed complete

```rust
FedosApplicationRootHandle       (Alpha 148: SecretHandle(ApplicationRootMaterial))
        │
        │  derive_nostr_root_internal    (Alpha 152, HkdfDomain::Nostr)
        │  derive_session_root_internal  (Alpha 153, HkdfDomain::Session)
        │  derive_atproto_root_internal  (Alpha 153, HkdfDomain::ATProto)
        │  derive_wallet_root_internal   (Alpha 153, HkdfDomain::Wallet)
        ↓
FedosProtocolRootHandle          (Alpha 151: SecretHandle(ProtocolRootMaterial),
                                   ONE type, FOUR domain-separated instances)
```

All four derivations reuse the SAME, EXISTING
`kdf_core::derive_secret_handle_internal` (Stage 147) via the SAME
private `derive_protocol_root_internal` helper (Alpha 152) — zero new
HKDF implementation, zero new cryptographic algorithm, across the
whole Arc. The only new domains are `HkdfDomain::Nostr`/`Session`/
`ATProto`/`Wallet` (Alpha 152/153) — fixed labels, not new algorithms.
`FedosProtocolRootHandle::matches_for_internal_verification` (Alpha
154) confirms, by real execution, that the SAME Master Seed
deterministically reconstructs the SAME Protocol Root for a given
domain, that DIFFERENT protocol domains from the SAME Application Root
never produce a matching Root, and that this is verified by Handle
comparison, never by raw secret byte comparison.

## 3. Completion Declaration

**The Protocol Root Derivation Foundation is COMPLETE. One opaque
Handle type — `FedosProtocolRootHandle` — and four derivation
functions — `derive_nostr_root_internal`, `derive_session_root_internal`,
`derive_atproto_root_internal`, `derive_wallet_root_internal` — exist,
entirely `pub(crate)`, entirely inside
`packages/fedos-core-rust/src/lib.rs`'s own `master_root` module, with
ZERO WASM exposure (the crate's own WASM-export attribute count
remains fixed at 13), ZERO Desktop access, and ZERO Identity Layer
access. The full chain `Master Seed → Identity Root → Application Root
→ Protocol Root` (Nostr/Session/ATProto/Wallet) now has a real,
executable, tested implementation for the first three levels of
`docs/secure_runtime_alpha_142_root_hierarchy_decision.md`'s own
adopted hierarchy.**

**The following do NOT exist yet, by this Arc's own explicit scope:**

- **Nostr Secret Key** — no Nostr signing-key derivation from Nostr
  Root exists; no `generateSecretKey`/`npub`/signature path exists
  anywhere in this crate.
- **Session Key** — no per-session key derivation from Session Root
  exists.
- **Wallet Key** — no wallet signing/spending key derivation from
  Wallet Root exists.
- **Account Index** — no Account-index parameterization exists yet
  (Alpha 143 §3's own fixed-width binary encoding rule is DESIGNED but
  not implemented).
- **Device Index** — same, for Device index.
- **Export** — no path of any kind exists to export a raw secret byte
  from any Handle in this Arc; none is planned by this Arc either.
- **Mnemonic** — no BIP-39/mnemonic encoding or decoding of the Master
  Seed exists anywhere in this crate.

**These are explicitly NEXT Arc's own scope, not this one's.**

## 4. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` or any
  other file in `packages/`.
- Does **not** derive an Account Key, Device Key, or any further level
  below Protocol Root.
- Does **not** implement Secret Export or Mnemonic encoding of any
  kind.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.
- Does **not** generate a Nostr secret key, public key, `npub`, or
  signature, and does **not** contact a Relay.

## 5. See also

- `docs/secure_runtime_alpha_151_protocol_root_handle.md`
- `docs/secure_runtime_alpha_153_session_atproto_wallet_root.md`
- `docs/secure_runtime_alpha_154_protocol_separation_verification.md`
- `docs/secure_runtime_alpha_150_integration_completion.md`
