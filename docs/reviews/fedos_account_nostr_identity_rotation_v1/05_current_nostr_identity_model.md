# 05 — Current Nostr Identity Model

## Derivation chain (verified directly in `packages/fedos-core-rust/src/lib.rs`)

```
Master Seed
  -> derive_identity_root_internal            (fixed HkdfDomain::Identity,   lib.rs:4752)
  -> derive_application_root_internal          (fixed HkdfDomain::Application, lib.rs:4678)
  -> derive_nostr_root_internal                (fixed HkdfDomain::Nostr,       lib.rs:3518)
  -> derive_nostr_secret_key_internal(root, accountIndex)
       fixed HKDF salt "fedos-hkdf-salt-nostr-secret-key-v1"
       fixed HKDF info prefix "fedos-hkdf-info-nostr-secret-key-v1" + accountIndex (4 BE bytes)
       (lib.rs:3761-3800)
  -> derive_nostr_public_key_internal           (secp256k1, lib.rs:3885)
```

Orchestrated end-to-end by `sign_nostr_event_from_master_seed_internal`
(`lib.rs:4816-4903`) and `derive_nostr_public_key_hex_from_master_seed_internal`
(`lib.rs:4904-4949`). No randomness anywhere after the Master Seed itself
— every stage is a fixed-label HKDF-SHA256 expansion. Rust's own tests
prove this exactly: `same_nostr_root_and_same_account_index_derive_matching_secret_keys`
(`lib.rs:6251`), `same_master_seed_and_same_account_index_encode_identical_hex_and_npub`
(`lib.rs:6488`), `sign_nostr_event_same_account_is_deterministic_across_calls`
(`lib.rs:12613`), `restore_sealed_round_trips_to_the_identical_signing_identity`
(`lib.rs:12446`).

## Signing authorities

`FedosNostrSigningAuthority` (`src/nostr/sign/fedos_nostr_signing_authority.ts:133-146`)
is the one interface — `signEvent()`, `publicIdentityForAccount()`. Two
real implementations, `FedosWasmNostrSigningAuthority` (dev/gated) and
`FedosProductionNostrSigningAuthority` (production), both pure adapters
over the SAME Rust methods (`sign_nostr_event`, `public_key_hex_for_account`,
`lib.rs:11413`, `11476`). The production adapter's own header states
verbatim: "the derived account identity always reflects the seed
currently held ... and is therefore STABLE across a real process relaunch
(the seed is the account)" (`fedos_production_nostr_signing_authority.ts:26-29`)
— this codebase's own words for exactly the fact this review must not
contradict.

## `accountIndex` is real, multi-identity-capable at the primitive level, unused as such in practice

The Rust primitive genuinely supports deriving distinct, independent
Nostr keypairs from ONE Master Seed by varying `accountIndex` — this is
NOT a limitation of the cryptography. The limitation is entirely at the
TypeScript wiring layer: `FixedFedosConversationLocalAccountIndexAuthority`
(`src/conversation/encryption/identity/fedos_conversation_local_account_index_authority.ts:37-47`)
fixes it to `0` everywhere, and every other production call site
(`FedosProfileInitializationCoordinator`, `FedosBoardRuntimeDependencies`,
`FedosDesktopRuntimeConfig`) does the same, defaulting to `0`. This was a
deliberate Alpha 689 security decision (documented in
`docs/secure_runtime_alpha_689_account_index_authority.md`), not an
oversight — allowing a caller to select `accountIndex` per call was
explicitly rejected as letting a caller silently choose which identity a
given operation binds against.

## Conclusion this review relies on

The Nostr keypair is a pure, hardcoded, deterministic function of
`(Master Seed, accountIndex)`, with **no independent "current active
key" indirection layer of any kind**. There is no stored "key
generation," "key version," or key registry anywhere this review's own
recommendation (`20`) could point at to mean "the same account, a
different key" without a genuinely new mechanism. This is why `06`
defines "rotation" (same logical identity, new key) as **architecturally
unavailable in V1** without inventing that missing indirection layer —
and why this review recommends **replacement**, not rotation, as the V1
answer (`18`, `20`).
