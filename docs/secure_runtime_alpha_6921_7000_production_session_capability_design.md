# Secure Runtime Alpha 6921–7000 — Production Session Capability Design

**FedOS Direct Ratchet Cryptographic Session Production Capability Arc.**

This is the Phase B/C design document: the minimum safe capability surface
that lets `FedosDirectRatchetCryptographicSession` reach the REAL
`FedosProductionMasterSeedAuthority`, decided and recorded BEFORE any
source edit was made (see the companion reconciliation report for the
audit re-verification this design responds to).

## Target graph (already achieved, this document records why it is
correct)

```
FedosProductionMasterSeedAuthority (unchanged: seal/restore/generate/clear)
        |
        +-- accessForNostrSigningAuthorityInternalUse()   [existed since 4741-4820]
        |        -> opaque FedosMasterSeedAuthorityHandle (WASM)
        |
        +-- accessDirectRatchetSessionModuleInternalUse()  [NEW, this Arc]
                 -> FedosProductionDirectRatchetSessionModule
                      (FedosDirectRatchetSession's own 3 static ctors)
                 -> backed by fedos_production_wasm_master_seed_facade.ts's
                    constructDirectRatchetSessionModule(), reading the
                    SAME already-initialized moduleRef closure
                    constructMasterSeedAuthority() already reads.

FedosDirectRatchetCryptographicSession
        |
        +-- resolveDirectRatchetSessionAccess(masterSeedAuthority)  [NEW]
                 structural check FIRST:
                   hasProductionDirectRatchetSessionCapability()
                     -> productionDirectRatchetLoaderBoundary(sessionModule)
                 else nominal fallback (UNCHANGED):
                   instanceof FedosWasmMasterSeedAuthority
                     -> developmentDirectRatchetLoaderBoundary()
                 else null (fail closed, unchanged for
                   DevelopmentFedosMasterSeedAuthority and anything else)
```

## Why a structural capability port, not `instanceof`

`FedosDirectRatchetCryptographicSession` lives in
`src/conversation/ratchet/`, a layer that has never imported anything from
`src/desktop/production_activation/` (and must not start now — that would
invert this codebase's own established dependency direction: `desktop/`
depends on `conversation/`, never the reverse). An `instanceof
FedosProductionMasterSeedAuthority` check would require exactly that
reverse import. The established, already-shipped precedent for solving
this exact shape of problem is
`isFedosDirectRatchetSealingAuthority()` (Alpha 5401-5480,
`fedos_direct_ratchet_sealing_authority.ts`): a structural (duck-typed)
capability check consumed one layer up, in `fedos_desktop_runtime.ts`, not
inside `conversation/ratchet/` itself. This Arc mirrors that same
discipline, but the check has to live INSIDE
`fedos_direct_ratchet_cryptographic_session.ts` itself because — unlike
the sealing port, which is provided to the Runtime by the caller — the
loader-boundary resolution is this class's own internal responsibility,
invoked from its own static factories.

## Why two internal accessors, not one combined method

`accessForNostrSigningAuthorityInternalUse()` already existed (Alpha
4741-4820) and returns the opaque `FedosMasterSeedAuthorityHandle` every
`FedosDirectRatchetSession` static constructor's own FIRST argument
expects (`masterSeedAuthority: unknown` in the Rust-generated glue
signature — confirmed by direct inspection of
`fedos_wasm_loader.ts`'s own `attemptDevOnlyDirectRatchetInitializeAs*Call`
call sites, which pass the SAME handle shape). `accessDirectRatchetSessionModuleInternalUse()`
is new and returns something categorically different: not a per-instance
handle, but the STATIC CONSTRUCTOR SURFACE itself
(`FedosDirectRatchetSession.initialize_as_receiver`/`initialize_as_sender`/`restore`).
Merging these into one accessor would conflate "an authority instance" with
"a class of session objects" — two different WASM export shapes — and
would make the structural capability check ambiguous (a dev/test
`FedosWasmMasterSeedAuthority` legitimately has the first but never the
second). Keeping them separate lets `hasProductionDirectRatchetSessionCapability()`
require BOTH, closing exactly the shape Section "Why not a partial match"
below describes.

## Why not a partial match

An object exposing only one of the two accessors is not accepted (see
`test/secure_runtime_alpha_6921_7000_failure_matrix.test.ts`, cases 2 and
3). This matters because a future, unrelated capability might coincidentally
name a method `accessForNostrSigningAuthorityInternalUse` without meaning
to grant Direct Ratchet session access — requiring the FULL closed pair
narrows the coincidental-collision surface as much as a structural check
reasonably can.

## Why the facade reuses the SAME closure (no second WASM instance)

`createFedosProductionMasterSeedFacade(initializedGlueModule: object)`
(Phase F, Alpha 4741-4820) already captures the ONE production glue module
`authorizeAndActivateFedosProductionDesktopMasterSeed()` initializes via a
single `initSync()` call, in a private closure (`moduleRef`). Adding
`constructDirectRatchetSessionModule()` as a SECOND method on the SAME
returned facade object, reading `moduleRef.FedosDirectRatchetSession` (a
sibling export on the identical module object `moduleRef.FedosMasterSeedAuthority`
is already read from), costs zero new imports, zero new `initSync`/
`WebAssembly.instantiate` calls, and zero new module references. This is
verified structurally, not just narratively, by
`test/secure_runtime_alpha_6921_7000_structural_guards.test.ts` test 5.

## What is explicitly NOT exposed

- No raw `moduleRef` or `initializedGlueModule` reference ever crosses the
  facade boundary — only the two narrow, function-shaped read-outs.
- No Ratchet root/chain/message key ever appears in a return type anywhere
  in this Arc's new code — `FedosProductionDirectRatchetSessionModule`'s
  own three methods return `unknown` (an opaque session handle), never key
  material.
- No new WASM export — `FedosDirectRatchetSession` was already a real,
  already-compiled Rust/WASM class before this Arc (confirmed: `git diff
  4c1f27c -- packages/fedos-core-rust` is empty).
