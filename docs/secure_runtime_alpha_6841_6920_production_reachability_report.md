# Secure Runtime Alpha 6841–6920 — Production Reachability Report

**FedOS Direct Ratchet Production Crypto Graph Unification Arc.**

## The second-authority path: eliminated for the production case

`assembleFedosConversationProductionCryptoGraph()`/`FedosWasmMasterSeedAuthority`
(the dev-gated path) are **not deleted** — they remain fully intact for
any dev/test caller that still explicitly supplies
`conversationProductionCrypto`. But the REAL production Coordinator
(`FedosProfileInitializationCoordinator`, the only Coordinator the
packaged Beta entry point ever constructs) now **never** relies on that
path for Direct Ratchet: `#buildRuntimeConfig()` unconditionally derives
`conversationDirectRatchetMasterSeedAuthority` from `this.#deps.masterSeedAuthority`
— the SAME, single, already-activated `FedosProductionMasterSeedAuthority`
instance every other production subsystem (Device Trust, Archive, account
signing) already shares. In the real, packaged production path, the
second, `NODE_ENV=development`-gated WASM instance is **never
constructed at all** — not merely unused, genuinely never instantiated,
because nothing in the real Coordinator's own call graph ever reaches
`assembleFedosConversationProductionCryptoGraph()`.

## Exact production owner graph (verified by real execution, not inference)

```
activateFedosProductionProfileMasterSeed()  [host-attestation + pinned manifest, NEVER NODE_ENV]
  → ONE WASM instance (Store-backed internally, unchanged since 8a33045e)
    → FedosProductionMasterSeedAuthority   [implements BOTH FedosMasterSeedAuthority
                                             AND FedosDirectRatchetSealingAuthority
                                             as of this Arc]
      → Coordinator({ masterSeedAuthority: <this>, ... })
        → #buildRuntimeConfig() threads the SAME object into:
            - conversationArchiveMasterSeedAuthority   (unchanged, Alpha 1691-1760)
            - conversationDirectRatchetMasterSeedAuthority   (NEW, this Arc)
            - deviceBindingAccountSigningAuthority (via accountSigningAuthority)
          → startFedosDesktopRuntime(config)
            → directRatchetSealingAuthority resolved (isFedosDirectRatchetSealingAuthority()
              confirms the SAME object genuinely implements the port)
              → conversationDirectRatchetDeps constructed
                → FedosConversationRuntime.directRatchet() -- NOW NON-NULL
```

**One authority. One Store generation. One WASM instance. Verified, not
assumed** — `test/secure_runtime_alpha_6841_6920_structural_guards.test.ts`'s
own test 7 confirms zero Rust source changed (`git diff` over
`packages/fedos-core-rust` is empty), and the real packaged run below
confirms only ONE `productionCryptoStatusOutcome: "ok"` is ever reported.

## Direct Ratchet packaged reachability — proven live

Real packaged run, `fedos_electron_beta_main.cjs`, real Electron 43.1.1,
real compiled WASM, a real relay configured via the real compiled Settings
controller, **zero Electron-main code changes**:

```
FEDOS_ELECTRON_BETA_AUTOTEST_UNIFIED_GRAPH:{"runtimeReachable":true,"deviceTrustReachable":true,
"directRatchetConfigured":true,"peerCapabilityConfigured":true,
"identityTransitionConfigured":true,"deletionRequestConfigured":true,
"productionCryptoStatusOutcome":"ok"}
```

Compare against the immediately-prior Arc's own real packaged run
(`f3e0658`'s own README status): `directRatchetConfigured` was `false`.
It is now `true` — the exact claim this Arc exists to prove, demonstrated
by actual process execution, not narrative.

## A real regression this Arc's own testing caught and fixed before commit

The first implementation draft gated `conversationDirectRatchetDeps`
construction on "some `masterSeedAuthority` is present" rather than "the
resolved authority genuinely implements the sealing port." Running the
EXISTING `test/secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`
(which deliberately uses `DevelopmentFedosMasterSeedAuthority` to prove
OTHER subsystems work without real WASM) caught this immediately: Direct
Ratchet's own status query started reporting `"ok"` instead of the
expected `"unavailable"` — because `DevelopmentFedosMasterSeedAuthority`
implements the full `FedosMasterSeedAuthority` interface (satisfying the
naive gate) but deliberately NOT the sealing port. Fixed by gating on
`isFedosDirectRatchetSealingAuthority()` specifically (the exact check the
codebase's own pre-existing pattern already used, now applied one level
earlier). This is exactly the "missing capability fails closed" /
"production caller cannot accidentally select a test factory" invariant
Stage 2's own Phase H names — caught by real testing, not assumed correct.
