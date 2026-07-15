# Secure Runtime Alpha 446 — Cryptographic Verification

Phase B, Stage 6. Real-execution proof for every property this Stage's
own instruction lists.

## Honest scope statement

No `pkg/` WASM build exists in this repository (by design — Alpha 431
§10, and every prior Arc's own README status entries confirm the same:
nothing is generated/committed by any Arc). Verification therefore
happens at TWO independent, real-execution layers, and this doc does
not claim a third that was not actually run:

1. **Rust-native** (`cargo test`, real execution, no mock) — the
   authoritative layer, since it is the SAME code the WASM export
   wraps unchanged, verified via `k256`'s own Schnorr verifier, entirely
   independent of this crate's own signing path.
2. **TypeScript adapter plumbing** (`vitest`, real execution, mocked
   `FedosMasterSeedWasmLoaderBoundary`/`FedosNostrSigningWasmLoaderBoundary`) —
   proves `FedosWasmMasterSeedAuthority`/`FedosWasmNostrSigningAuthority`
   correctly validate, translate, and normalize data on both sides of
   the loader call, WITHOUT re-proving Rust's own cryptography (that
   would require a real `pkg/` build and a JS-capable WASM runtime,
   neither available in this environment — see Alpha 431 §10).

## Layer 1 — Rust, real execution, `cargo test`

- **Same authority/request → same event**:
  `sign_nostr_event_same_account_is_deterministic_across_calls`.
- **Account 0/1/u32::MAX separation**:
  `sign_nostr_event_accounts_zero_one_and_u32_max_all_derive_different_pubkeys`.
- **Content separation**:
  `sign_nostr_event_different_content_derives_different_id_and_signature`.
- **`createdAt` separation**:
  `sign_nostr_event_different_created_at_derives_different_id_and_signature`.
- **Tags separation**:
  `sign_nostr_event_different_tags_derive_different_id_and_signature`.
- **Unsupported kind rejection**:
  `sign_nostr_event_rejects_every_kind_other_than_one`.
- **Malformed input rejection**: `sign_nostr_event_rejects_malformed_created_at`
  (Rust-side; the TypeScript-side `accountIndex`/`kind`/tag-shape
  rejection is Layer 2's own responsibility, see below).
- **Cleared authority rejection**:
  `sign_nostr_event_fails_closed_on_an_empty_authority`,
  `clear_on_an_available_authority_prevents_further_signing`.
- **Event ID validates with an independent verifier, BIP-340 signature
  validates**: `sign_nostr_event_produced_id_and_signature_independently_verify`
  — recomputes the NIP-01 canonical pre-image and its `Sha256` digest
  independently, and verifies the signature via `k256::schnorr`'s own
  `VerifyingKey::verify_prehash`, entirely separate from this crate's
  own `sign_nostr_event_internal` code path.
- **No raw secret is exposed**: every assertion above extracts only
  `id`/`pubkey`/`sig`/`kind`/`created_at` from the returned JSON string
  — never a Handle, never raw key bytes.

## Layer 2 — TypeScript, real execution, `vitest`

`test/secure_runtime_alpha_442_nostr_signing_request_model.test.ts`
and `test/secure_runtime_alpha_445_typescript_nostr_signing_authority_adapter.test.ts`
exercise `isWellFormedFedosNostrUnsignedEventRequest()` (malformed-index/
kind/tag rejection) and `FedosWasmNostrSigningAuthority.signEvent()`
(request validation, tag flattening, result normalization, deep-freeze)
against a real, in-memory mock loader boundary that returns a REAL
`k256`-signed event fixture (captured from an actual `cargo test` run,
not fabricated), so `validateInboundNostrEvent()` — this repository's
own existing, unmodified, `@noble/curves`-backed independent verifier —
is exercised against it in the SAME test file, proving Layer 1's own
output is independently re-verifiable by a COMPLETELY separate
TypeScript-side cryptographic implementation.

## Not claimed

A literal `npm`-driven call into a compiled `.wasm` binary was not
performed in this environment (no `pkg/` exists to call). This is the
SAME honest limitation every prior Arc in this repository's own README
history has already documented for its own WASM-adjacent claims.
