# Secure Runtime Alpha 6921–7000 — Remediation Reconciliation Report

**FedOS Direct Ratchet Cryptographic Session Production Capability Arc — Phase A.**

## Ancestry / Alpha range

`4c1f27c` (base), `8bab343c`, `f3e0658`, `8a33045e`, `b8e9e062`, `080cb99`,
`be1bc0d9`, `f80889d` all confirmed ancestors of this Arc's own base via
`git merge-base --is-ancestor`. `git log --all --oneline` search for
`69[2-9][0-9]|70[0-0][0-9]` returns only unrelated hash-prefix/Stage-number
coincidences — **6921–7000 confirmed genuinely free**. The historical
5401–5480 collision (`be1bc0d9`/`b3b3a6d2`) remains on record, untouched.
This Arc does not amend, rebase, or renumber `4c1f27c`.

## Re-verification of the audit's normative findings (all confirmed true by direct read)

- `FedosProductionMasterSeedAuthority` correctly implements
  `FedosMasterSeedAuthority` and (since `4c1f27c`)
  `FedosDirectRatchetSealingAuthority` — confirmed, unchanged by this Arc.
- `directRatchetConfigured` (`fedos_electron_beta_main.cts:811`) is
  literally `cr.directRatchet() !== null` — a pure existence check, proves
  nothing about crypto operability.
- `FedosDirectRatchetCryptographicSession.createAsReceiver/createAsSender/restore`
  (`fedos_direct_ratchet_cryptographic_session.ts:143-231`) all call
  `primedLoader()` (line 119-125: `new FedosWasmLoaderSkeleton()` +
  `attemptDevOnlyJsGlueImport()` + `attemptDevOnlyWasmInitialization()`)
  unconditionally, then `accessWasmMasterSeedAuthorityHandle()`
  (line 337-341).
- `accessWasmMasterSeedAuthorityHandle()` does
  `if (!(masterSeedAuthority instanceof FedosWasmMasterSeedAuthority)) return null;`
  — a nominal check that rejects `FedosProductionMasterSeedAuthority`
  regardless of what it structurally implements.
- The failure is fully fail-closed: `establishSession()`
  (`fedos_direct_ratchet_outbound_integration.ts:200`) returns
  `{ outcome: "crypto-unavailable" }` — never a crash, never a fabricated
  session.
- No test in the repository (before this Arc) calls
  `initializeDirectRatchetSession`/`establishSession`/`createAsSender`/
  `createAsReceiver`/`FedosDirectRatchetCryptographicSession` against
  `FedosProductionMasterSeedAuthority`.

## Exact call paths (verified)

**Production-reachable path (today, broken):**
```
FedosDirectRatchetOutboundIntegration.establishSession() / FedosDirectRatchetInboundIntegration
  → FedosDirectRatchetCryptographicSession.createAsReceiver/createAsSender/restore(masterSeedAuthority, ...)
    → primedLoader()  [new FedosWasmLoaderSkeleton(), attemptDevOnlyJsGlueImport(), attemptDevOnlyWasmInitialization() — gated on NODE_ENV=development, silently no-ops outside dev]
    → accessWasmMasterSeedAuthorityHandle(masterSeedAuthority)  [instanceof FedosWasmMasterSeedAuthority → false for FedosProductionMasterSeedAuthority → null]
    → wasmAuthorityHandle === null → return null
  → establishSession() returns { outcome: "crypto-unavailable" }
```

**Dev-only path (unchanged, must remain fully intact):**
```
Test harness constructs FedosWasmMasterSeedAuthority directly, sets NODE_ENV=development
  → primedLoader() succeeds (dev gate open)
  → accessWasmMasterSeedAuthorityHandle() → instanceof check passes
  → real session established, real encrypt/decrypt/seal — proven by
    secure_runtime_alpha_5561_5640_real_vertical_slice.test.ts and siblings
```

## What `FedosDirectRatchetCryptographicSession` actually needs (from source, not assumption)

Every instance/static operation routes through `this.#loaderBoundary`
(captured once at construction, type `FedosDirectRatchetWasmLoaderBoundary`,
`fedos_direct_ratchet_cryptographic_session.ts:29-90`) — an ALREADY
NARROW, ALREADY CLOSED capability interface (13 methods: 3 static-style
factory calls + `encrypt`/`decrypt`/6 status accessors/5 seal methods).
Its ONLY current implementation is `FedosWasmLoaderSkeleton` cast to this
shape. Direct source inspection of the loader's own implementation
(`fedos_wasm_loader.ts:3897-4095`) proves every one of these methods is a
thin, already-minimal passthrough to `module.FedosDirectRatchetSession`
(a real Rust/WASM class, a SIBLING export on the SAME generated glue
module `FedosMasterSeedAuthority` is exported from — confirmed by
`#directRatchetSessionModule()` at `fedos_wasm_loader.ts:3887-3890`
reading `this.#jsGlueModule`, the identical module reference
`attemptDevOnlyJsGlueImport()` populates):

- `module.FedosDirectRatchetSession.initialize_as_receiver(masterSeedAuthorityHandle, accountIndex, counterpartyPublicKeyHex, sessionId, localDeviceRef, generation)` — static.
- `module.FedosDirectRatchetSession.initialize_as_sender(masterSeedAuthorityHandle, ..., remoteRatchetPublicKeyHex)` — static.
- `module.FedosDirectRatchetSession.restore(...)` — static, 15 positional args.
- Instance methods (via `#attemptDevOnlyDirectRatchetSessionMethodCall`, `fedos_wasm_loader.ts:3965-3980`, a single generic dispatcher): `encrypt`, `decrypt`, `local_ratchet_public_key_hex`, `remote_ratchet_public_key_hex`, `is_ready_to_send`, `send_counter`, `receive_counter`, `skipped_key_count`, `previous_sending_chain_length`, `seal_root_key`, `seal_sending_chain_key`, `seal_receiving_chain_key`, `seal_local_ratchet_private_key`, `seal_all_skipped_keys`.

**Both static factories take the SAME opaque `masterSeedAuthorityHandle` shape** `accessWasmMasterSeedAuthorityHandle()` already extracts via
`masterSeedAuthority.accessForNostrSigningAuthorityInternalUse()` — an
internal accessor `FedosProductionMasterSeedAuthority` **already
implements identically** (added at Alpha 4741-4820, confirmed unmodified,
`fedos_production_master_seed_authority.ts:~133-135`). The Rust side has
exactly ONE `FedosMasterSeedAuthority` WASM class; whichever TS wrapper
constructed the handle, the handle itself is the same Rust type, so
`FedosDirectRatchetSession::initialize_as_receiver` accepts it
identically regardless of caller.

**The one thing missing**: a way to reach `module.FedosDirectRatchetSession`
itself — a DIFFERENT export from the SAME already-initialized module —
from `FedosProductionMasterSeedAuthority`. Its own facade
(`fedos_production_wasm_master_seed_facade.ts`) currently exposes only
`constructMasterSeedAuthority()`; the `moduleRef` closure it already
holds is never otherwise reached.

## Minimum safe capability surface (Phase B/C decision)

No new WASM export. No Rust change. The fix is TS-only:

1. Widen `FedosProductionMasterSeedFacade` (one new method,
   `constructDirectRatchetSessionModule()`) to expose a narrow,
   shape-validated reference to the SAME closure-captured `moduleRef`'s
   `FedosDirectRatchetSession` static constructor — mirroring
   `constructMasterSeedAuthority()`'s own exact pattern (shape check,
   `try`/`catch`, never exposes the raw module).
2. Add one new internal accessor to `FedosProductionMasterSeedAuthority`,
   `accessDirectRatchetSessionModuleInternalUse()`, mirroring
   `accessForNostrSigningAuthorityInternalUse()`'s exact pattern (not on
   the public `FedosMasterSeedAuthority` interface — internal-use-only,
   matching established precedent).
3. In `fedos_direct_ratchet_cryptographic_session.ts`, replace the single
   `primedLoader()` + `accessWasmMasterSeedAuthorityHandle()` sequence
   (duplicated across `createAsReceiver`/`createAsSender`/`restore`/
   `sealState`) with ONE shared private resolver that:
   - First checks STRUCTURALLY (never `instanceof`) whether
     `masterSeedAuthority` exposes BOTH
     `accessDirectRatchetSessionModuleInternalUse` AND
     `accessForNostrSigningAuthorityInternalUse` as functions — the FULL
     closed capability shape, so an object with only one of the two names
     never bypasses validation. If so: build a production-safe
     `FedosDirectRatchetWasmLoaderBoundary` implementation directly from
     the returned module reference — **zero `FedosWasmLoaderSkeleton`,
     zero `attemptDevOnly*`, zero second import, zero second
     `initSync`**.
   - Else, fall back to the EXISTING, UNCHANGED dev path:
     `instanceof FedosWasmMasterSeedAuthority` + `primedLoader()` — byte-
     for-byte the current behavior, so `FedosWasmMasterSeedAuthority` and
     the entire existing dev/test test suite are unaffected.
   - Else (neither matches — e.g. `DevelopmentFedosMasterSeedAuthority`,
     or any other unrecognized authority): return `null` — the EXISTING
     fail-closed behavior, unchanged.

The existing `FedosDirectRatchetWasmLoaderBoundary` interface shape is
**reused verbatim**, not redesigned — it is already the narrow,
already-closed capability port this Arc's own mission asks for (Phase B:
"prefer a capability-limited structural port... consistent with the
established `isFedosDirectRatchetSealingAuthority()` precedent"). The
production implementation just becomes its second, real implementer.

## Exact files expected to change

- `src/desktop/production_activation/fedos_production_wasm_master_seed_facade.ts` — one new interface method + implementation.
- `src/desktop/production_activation/fedos_production_master_seed_authority.ts` — one new internal accessor method.
- `src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts` — internal refactor only (new production-boundary builder, new structural-capability check, one shared resolver used by all 4 entry points); public API (constructor arg lists, return types, method names) **unchanged**.
- `test/secure_runtime_alpha_6841_6920_real_production_vertical_slice.test.ts` — Phase M narrow local type fix (test-only, non-security).
- New test files for this Arc's own Node-level and packaged vertical slices, structural guards, failure matrix.
- Documentation, README.

## Exact frozen files (verified untouched by this Arc's own diff at completion)

- All Rust source (`packages/fedos-core-rust/**`).
- `FedosWasmLoaderSkeleton`/`fedos_wasm_loader.ts`'s own Dev-only Gate logic and every `attemptDevOnly*` method body.
- `fedos_direct_ratchet_outbound_integration.ts` / `fedos_direct_ratchet_inbound_integration.ts` (callers — confirmed their calls to `FedosDirectRatchetCryptographicSession.createAsReceiver/createAsSender/restore/sealState` need zero changes, since the public API is preserved).
- `fedos_direct_ratchet_state_runtime.ts`, `fedos_direct_ratchet_reset_coordinator.ts`, and every other Ratchet Runtime/protocol file.
- `assembleFedosConversationProductionCryptoGraph()`/`FedosWasmMasterSeedAuthority` (the dev/test path remains fully intact, unmodified, explicitly separate).
- `fedos_electron_beta_main.cts` — no change expected; reachability closes purely through the Coordinator/Runtime/session layer (to be verified empirically, not assumed).
- `fedos_desktop_runtime.ts` / `fedos_desktop_runtime_config.ts` / `fedos_profile_initialization_coordinator.ts` — the `4c1f27c` config-threading layer is already correct; no further change expected there.
- Settings-to-Relay wiring (`f3e0658`), Identity Transition, Signed Deletion, `SecretHandleStore` (Rust).

## Compatibility requirements

Ratchet message/header format, sealed-state schema, session IDs, counters,
skipped-key bounds, Device-pair isolation, NIP-17 framing, Session Reset
semantics — all untouched by construction (this Arc only changes WHICH
loader-boundary implementation gets selected and stored in `#loaderBoundary`;
every method that consumes it is unmodified).
