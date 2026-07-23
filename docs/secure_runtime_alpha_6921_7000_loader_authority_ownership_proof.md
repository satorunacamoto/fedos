# Secure Runtime Alpha 6921–7000 — Loader/Authority Ownership Proof

**FedOS Direct Ratchet Cryptographic Session Production Capability Arc.**

Direct evidence (grep/read against the real files, not narrative claim
alone) that: (1) production Direct Ratchet sessions are now owned by the
SAME `FedosProductionMasterSeedAuthority`/WASM module the profile-unlock
path already activates; (2) the dev-only loader is never reachable from a
production-capable path; (3) exactly one resolution path exists per
authority kind.

## 1. One production WASM module, read twice, initialized once

```
$ grep -n "moduleRef" src/desktop/production_activation/fedos_production_wasm_master_seed_facade.ts
129:  const moduleRef = initializedGlueModule as { FedosMasterSeedAuthority?: unknown; FedosDirectRatchetSession?: unknown };
132:      const Ctor = moduleRef.FedosMasterSeedAuthority;
142:      const Ctor = moduleRef.FedosDirectRatchetSession;
```

One `moduleRef` binding, captured once at `createFedosProductionMasterSeedFacade()`
call time, read from by BOTH `constructMasterSeedAuthority()` and
`constructDirectRatchetSessionModule()`. Neither method calls `import()`,
`initSync`, or `WebAssembly.instantiate` — those all happen exactly once,
upstream, in `authorizeAndActivateFedosProductionDesktopMasterSeed()`
(unchanged by this Arc — confirmed: `git diff 4c1f27c --
src/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.ts`
is empty).

## 2. The dev-only loader is never constructed on a production-capable path

```
$ grep -n "new FedosWasmLoaderSkeleton" src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts
140:  const loader = new FedosWasmLoaderSkeleton();
```

Exactly one construction site, inside `developmentDirectRatchetLoaderBoundary()`
— reached ONLY via the `else` branch of `resolveDirectRatchetSessionAccess()`,
which is reached ONLY when `hasProductionDirectRatchetSessionCapability()`
returns `false`. `FedosProductionMasterSeedAuthority` always returns `true`
from that check (it implements both required accessors unconditionally,
even the `null` returned once cleared still satisfies "is a function" —
the STRUCTURAL check is about method presence, not the live value), so a
production authority NEVER reaches this branch.

## 3. `attemptDevOnly*` is never called from the production loader boundary

```
$ grep -n "attemptDevOnlyJsGlueImport\|attemptDevOnlyWasmInitialization" src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts
50:  attemptDevOnlyJsGlueImport(): Promise<unknown>;
51:  attemptDevOnlyWasmInitialization(): Promise<unknown>;
142:  await loader.attemptDevOnlyJsGlueImport();
143:  await loader.attemptDevOnlyWasmInitialization();
202:  async attemptDevOnlyJsGlueImport(): Promise<unknown> {
203:    return null;
205:  async attemptDevOnlyWasmInitialization(): Promise<unknown> {
206:    return null;
```

Lines 142-143 (the REAL calls) are inside `developmentDirectRatchetLoaderBoundary()`
only. Lines 202-206 (the production branch's own same-named methods, kept
identically named ONLY to satisfy the shared `FedosDirectRatchetWasmLoaderBoundary`
interface both branches implement) are no-ops that return `null` and touch
no dev-only machinery whatsoever. The remaining
`attemptDevOnlyDirectRatchetInitializeAs*`/`...Encrypt`/`...Decrypt`/etc.
methods on the production branch call `sessionModule.initialize_as_*`/
`callProductionDirectRatchetSessionMethod()` directly — never
`FedosWasmLoaderSkeleton`'s own private dev-only dispatcher.

## 4. Structural, never nominal, acceptance

```
$ grep -n "instanceof" src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts
357:  if (!(masterSeedAuthority instanceof FedosWasmMasterSeedAuthority)) return null;
```

The ONLY `instanceof` in the file gates the DEV/TEST fallback (unchanged
from before this Arc). The production branch is reached exclusively
through `hasProductionDirectRatchetSessionCapability()`'s duck-typed check
— no `instanceof FedosProductionMasterSeedAuthority` exists anywhere in
this file (confirmed by structural guard test 1).

## 5. Exactly one resolver, three call sites, no parallel path

```
$ grep -n "resolveDirectRatchetSessionAccess" src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts
347:async function resolveDirectRatchetSessionAccess(
388:    const access = await resolveDirectRatchetSessionAccess(masterSeedAuthority);
413:    const access = await resolveDirectRatchetSessionAccess(masterSeedAuthority);
443:    const access = await resolveDirectRatchetSessionAccess(masterSeedAuthority);
```

One definition, three call sites (`createAsReceiver`, `createAsSender`,
`restore`) — the full set of entry points that previously called
`primedLoader()` directly. No second, independent production-detection
path exists anywhere else in this file or in any caller.

## 6. Lock invalidates the production capability, not just the master seed

```
$ grep -n "accessDirectRatchetSessionModuleInternalUse" src/desktop/production_activation/fedos_production_master_seed_authority.ts
214:  accessDirectRatchetSessionModuleInternalUse(): FedosProductionDirectRatchetSessionModule | null {
215:    if (this.#cleared) return null;
216:    return this.#facade.constructDirectRatchetSessionModule();
```

`#cleared` is the SAME private flag `clear()` sets and every other method
on this class already checks — a locked profile's authority cannot mint a
fresh production Direct Ratchet session capability, proven live by Phase I
step 13-14 (freshSessionAfterClear === null) and by failure-matrix test 7.
