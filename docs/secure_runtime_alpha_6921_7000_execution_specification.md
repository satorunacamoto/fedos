# Secure Runtime Alpha 6921–7000 — Execution Specification

**FedOS Direct Ratchet Cryptographic Session Production Capability Arc.**

Records what was actually implemented, in order, against the design in
`secure_runtime_alpha_6921_7000_production_session_capability_design.md`.

## Files changed (implementation)

1. `src/desktop/production_activation/fedos_production_wasm_master_seed_facade.ts`
   — added `FedosProductionDirectRatchetSessionModule` interface,
   `isDirectRatchetSessionModuleShape()` structural validator, and
   `constructDirectRatchetSessionModule()` on `FedosProductionMasterSeedFacade`
   plus its implementation (reads `moduleRef.FedosDirectRatchetSession`,
   validated, `null` on any shape mismatch — never throws).

2. `src/desktop/production_activation/fedos_production_master_seed_authority.ts`
   — added `accessDirectRatchetSessionModuleInternalUse()`, mirroring
   `accessForNostrSigningAuthorityInternalUse()`'s exact discipline
   (internal-only, `#cleared`-gated, delegates to the facade).

3. `src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts`
   (the core fix):
   - `primedLoader()` renamed to `developmentDirectRatchetLoaderBoundary()`,
     body byte-for-byte unchanged — now explicitly named dev-only.
   - Added `FedosProductionDirectRatchetSessionAuthority` structural
     interface + `hasProductionDirectRatchetSessionCapability()` type
     guard.
   - Added `callProductionDirectRatchetSessionMethod()` generic method
     dispatcher.
   - Added `productionDirectRatchetLoaderBoundary(sessionModule)` — a full
     19-method `FedosDirectRatchetWasmLoaderBoundary` implementation built
     directly against the production session module, never
     `FedosWasmLoaderSkeleton`.
   - Added `resolveDirectRatchetSessionAccess()` — the ONE shared resolver
     `createAsReceiver`/`createAsSender`/`restore` all now call, replacing
     the old unconditional `primedLoader()` + nominal
     `accessWasmMasterSeedAuthorityHandle()` pair.
   - Replaced `accessWasmMasterSeedAuthorityHandle()` (nominal, `instanceof
     FedosWasmMasterSeedAuthority`-only) with `accessSessionCryptoWasmHandle()`
     (structural, used only by `sealState()`, which already has its own
     `#loaderBoundary` from construction time and only needs the handle
     re-derived per call).
   - **Zero change to any public method signature.** Every caller
     (`fedos_direct_ratchet_outbound_integration.ts`,
     `fedos_direct_ratchet_inbound_integration.ts`) needed no edit — confirmed
     by `git diff 4c1f27c` returning empty for both files.

## Test files added

- `test/secure_runtime_alpha_6921_7000_production_session_vertical_slice.test.ts`
  — Phase I, the real Node-level vertical slice (20 proof points, see the
  compatibility report for the full list).
- `test/secure_runtime_alpha_6921_7000_failure_matrix.test.ts` — Phase K,
  7 tests covering missing/partial/cleared/malformed capability shapes.
- `test/secure_runtime_alpha_6921_7000_structural_guards.test.ts` — Phase
  L, 12 tests, direct source inspection.

## Test files corrected (pre-existing, narrowly updated, not widened)

- `test/secure_runtime_alpha_6841_6920_real_production_vertical_slice.test.ts`
  — `realProductionAuthority()`'s return type narrowed from the broad
  `FedosMasterSeedAuthority` interface to the concrete
  `FedosProductionMasterSeedAuthority` class, matching the `toBeInstanceOf`
  assertion already present two lines above it. Test-local type-only fix;
  no production interface was widened.
- `test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`
  — Phase F's own capability-limited-facade guard (`Object.keys(result.facade)`)
  extended from a single-entry allowlist to a two-entry allowlist, since
  this Arc deliberately, narrowly extended that SAME facade with one
  additional named capability. This is the SAME "extend a prior Arc's own
  structural-guard allowlist across generations" precedent already
  established by earlier sessions in this repository's history — not a
  weakening, since the guard still fails on any THIRD, unreviewed key.

## Order of operations actually followed

1. Phase A: reconciliation report written FIRST (`secure_runtime_alpha_6921_7000_remediation_reconciliation_report.md`),
   before any source edit, re-verifying the audit's own findings by direct
   `grep`/read against `4c1f27c`.
2. Phase B/C: this design recorded, decision made (structural port,
   two-accessor split, facade-closure reuse).
3. Phase D/E/F: the three implementation files above, in the order listed.
4. Phase G/H (proof): real Node-level testing, iterating through three
   self-caught test-authoring bugs (placeholder public keys; `generate()`
   vs `restoreSealed()` for the "fresh generation" step; stale
   `previousSendingChainLength`/`remoteRatchetPublicKeyHex` values at
   `restore()` — all three documented in the compatibility report) before
   the slice went green.
5. Phase K: failure matrix.
6. Phase L: structural guards.
7. Phase J: packaged-level investigation — concluded, and documented in
   the packaged Ratchet acceptance report, that a full IPC-level
   crypto-operational probe is not safely constructible within this Arc's
   own prohibitions (see that report for the full reasoning); the packaged
   entry point (`fedos_electron_beta_main.cts`) was therefore left
   byte-for-byte untouched, consistent with the immediately-prior Arc's own
   disclosed scope boundary.
8. Phase M: the one pre-identified typecheck fix, confirmed via `npm run
   typecheck:core`.
9. Documentation, README, full verification sequence, single implementation
   commit.
