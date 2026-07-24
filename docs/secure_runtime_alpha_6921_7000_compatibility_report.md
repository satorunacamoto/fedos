# Secure Runtime Alpha 6921–7000 — Compatibility Report

**FedOS Direct Ratchet Cryptographic Session Production Capability Arc.**

## Wire format / persistence schema / protocol

Byte-for-byte unchanged. Zero diff against this Arc's own base (`4c1f27c`)
for:

- `packages/fedos-core-rust` (all Rust source) — `git diff 4c1f27c --
  packages/fedos-core-rust` is empty (structural guard test 8).
- `src/conversation/ratchet/persistence/` and
  `fedos_direct_ratchet_session_record.ts` (structural guard test 11).
- `src/conversation/delivery/nostr/nip17/` (structural guard test 11).
- `src/conversation/identity_transition/` and
  `src/conversation/deletion_request/` (structural guard test 11).
- `src/conversation/ratchet/fedos_direct_ratchet_outbound_integration.ts`
  and `fedos_direct_ratchet_inbound_integration.ts` (structural guard test
  10) — every public call site into
  `FedosDirectRatchetCryptographicSession` needed zero edits, because this
  Arc changed none of that class's public method signatures.

## Public API surface

Zero change to any exported method signature on
`FedosDirectRatchetCryptographicSession` (`createAsReceiver`,
`createAsSender`, `restore`, `encrypt`, `decrypt`, `sealState`, and every
read-only accessor). One renamed PRIVATE function
(`primedLoader` → `developmentDirectRatchetLoaderBoundary`, not exported).
Two new PRIVATE/internal-only methods on
`FedosProductionMasterSeedAuthority` and
`FedosProductionMasterSeedFacade` — neither is on the public
`FedosMasterSeedAuthority` interface (verified: structural guard test 6).

## Dev/test path

Byte-for-byte behavior preserved. `developmentDirectRatchetLoaderBoundary()`'s
body is character-identical to the old `primedLoader()`'s body (same three
calls: `planLoad()` → `attemptDevOnlyJsGlueImport()` →
`attemptDevOnlyWasmInitialization()`); only the function's name changed,
plus an explanatory doc comment. Every dev-mode Ratchet test
(`secure_runtime_alpha_5481_5560_*`, `secure_runtime_alpha_6841_6920_production_direct_ratchet_sealing.test.ts`,
NIP-17 integration tests) passes unchanged.

## Real bugs found and fixed during this Arc's own testing (all in TEST
code, not production code)

1. **Placeholder counterparty public keys.** The first draft of the Phase
   I vertical slice used fabricated hex strings as `counterpartyPublicKeyHex`.
   `createAsReceiver`/`createAsSender` correctly returned `null` (fail
   closed on non-real key material) — this was a test-authoring bug, not a
   production defect. Fixed by deriving REAL Nostr public keys via each
   authority's own `accessForNostrSigningAuthorityInternalUse().public_key_hex_for_account(0)`.

2. **`generate()` reused for a "fresh generation" step that needed
   `restoreSealed()`.** The first draft constructed `aliceAuthorityGen2`
   via `realProductionAuthority()`, which internally calls `generate()` —
   producing a brand-new, unrelated random seed, not a restoration of
   Alice's original identity. `restore()` on the Ratchet session
   (sealed under the ORIGINAL seed) correctly failed AEAD authentication
   against the unrelated new seed. Fixed by restructuring the test to
   `seal()` the master seed BEFORE `clear()`, then `restoreSealed()` on
   the freshly-constructed authority instance — mirroring the EXACT
   restart contract `secure_runtime_alpha_6841_6920_real_production_vertical_slice.test.ts`
   already proves at the master-seed level alone.

3. **Stale `previousSendingChainLength`/`remoteRatchetPublicKeyHex` at
   `restore()`.** The first draft hardcoded `previousSendingChainLength: 0`
   and reused/omitted the remote ratchet public key at both `restore()`
   call sites, instead of querying the LIVE values from the sessions at
   the moment of sealing. The third post-restore message failed to
   decrypt as a direct, mechanical consequence (Double Ratchet's own
   header-authentication and skipped-key-derivation logic both depend on
   these exact values matching what was true at seal time). Fixed by
   querying `session.previousSendingChainLength()`/
   `session.remoteRatchetPublicKeyHex()` immediately before sealing and
   threading those live values into `restore()`. This mirrors
   `fedos_direct_ratchet_outbound_integration.ts`'s/`inbound_integration.ts`'s
   own established real snapshot/seal orchestration, which already does
   exactly this — the bug was confined to this Arc's own new test file,
   never in production code.

None of these three were production defects; each was caught by running
real cryptography against real WASM and observing a real failure, then
tracing it to its actual (test-side) cause — exactly this codebase's own
established "no fabricated pass" convention.

## Phase M — typecheck

`npm run typecheck:core` after this Arc's own change shows ONLY the two
already-documented, pre-existing baseline errors
(`secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts:189`
and `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121` —
both predate this Arc, confirmed unrelated to Direct Ratchet). The
specific target error this Phase existed to fix
(`FedosMasterSeedAuthority not assignable to
FedosProductionNostrSigningHandleSource`) is gone, closed by narrowing
`realProductionAuthority()`'s TEST-LOCAL return type to the concrete
`FedosProductionMasterSeedAuthority` class — no production interface was
widened.
