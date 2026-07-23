# Secure Runtime Alpha 6841–6920 — Reconciliation Report

**FedOS Direct Ratchet Production Crypto Graph Unification — Review-Gated Implementation Arc — Stage 1 / Phase A.**

## Ancestry and Alpha range

`git merge-base --is-ancestor` confirms all eleven named commits
(`70bbd6e8`, `8a33045e`, `ed5128f6`, `33f29f22`, `b8e9e062`, `080cb99`,
`be1bc0d9`, `f80889d`, `d825aa0`, `76f7fab6`, `f7c141d4`) are ancestors of
this Arc's own base, `f3e0658` — this is a linear continuation, no
reconciliation merge is required. Worktree `C:\wt\ratchet-production-
crypto-unification`, branch `arc/direct-ratchet-production-crypto-graph-
unification`.

`git log --all --oneline | grep -E "68[4-9][0-9]|69[0-1][0-9]|692[0]"`
returns no genuine claim on 6841–6920 (only unrelated hash-prefix/Stage-
number substring coincidences, e.g. `68545dbd`, `57096841`). `6681–6760`
(`f7c141d4`) and `6761–6840` (`f3e0658`) are both confirmed already used.
The historical **5401–5480 collision** (`be1bc0d9`/`b3b3a6d2`) remains on
record, untouched. **6841–6920 confirmed genuinely free** and reserved by
this Arc.

## Source inventory (Phase A table)

| Class/function | File | Owner | Production reachable? | Test only? | Dev-gated? | Creates authority? | Consumes authority? | Owns secret? | Owns Store? | Required change? |
|---|---|---|---|---|---|---|---|---|---|---|
| `activateFedosProductionProfileMasterSeed()` | `desktop/production_activation/fedos_production_profile_activation.ts` | Electron main (via Coordinator construction) | YES | no | **NO** — host-attestation + pinned-manifest gated, never reads `NODE_ENV` | YES (the ONE canonical production authority) | — | no (delegates) | no (delegates) | untouched |
| `authorizeAndActivateFedosProductionDesktopMasterSeed()` | `desktop/production_activation/fedos_production_desktop_crypto_activation_authority.ts` | same | YES | no | NO | — | — | no | no | untouched |
| `FedosProductionMasterSeedFacade`/`createFedosProductionMasterSeedFacade()` | `desktop/production_activation/fedos_production_wasm_master_seed_facade.ts` | same | YES | no | NO | constructs ONE opaque WASM handle per call | — | no | no | untouched |
| `FedosProductionMasterSeedAuthority` | `desktop/production_activation/fedos_production_master_seed_authority.ts` | Coordinator (`masterSeedAuthority` dep) | YES — the canonical production authority | no | NO | no (wraps one facade-constructed handle) | — | holds the handle, never exports raw bytes | delegates to the WASM handle (Store-backed internally per `8a33045e`, TS-side API unchanged) | **YES — add `sealDirectRatchetSecret`/`restoreDirectRatchetSecret`** |
| `FedosMasterSeedAuthorityHandle` (WASM binding) | `runtime/fedos_wasm_loader.ts` (type only; real impl in `packages/fedos-core-rust`) | Rust/WASM | YES | no | n/a | n/a | n/a | YES — Store-backed since `8a33045e` | YES | untouched — `seal_direct_ratchet_secret`/`restore_direct_ratchet_secret` already declared and already Store-backed (confirmed, `8a33045e`'s own README: "Ten production methods... `seal_direct_ratchet_secret`, `restore_direct_ratchet_secret`... resolve the Master Seed through... `SecretHandleStore::use_handle`") |
| `FedosProfileInitializationCoordinator` | `desktop/onboarding/fedos_profile_initialization_coordinator.ts` | canonical profile unlock owner | YES | no | NO | no | YES (`this.#deps.masterSeedAuthority`, injected once) | no | no | **YES — `#buildRuntimeConfig()` gains one new field derivation** |
| `FedosWasmMasterSeedAuthority` | `runtime/master_seed/fedos_wasm_master_seed_authority.ts` | dev/test callers only | via `assembleFedosConversationProductionCryptoGraph()` only | effectively yes (never constructed by the real production Coordinator) | **YES** — every method routes through `FedosWasmLoaderSkeleton`'s `attemptDevOnly*Call()` boundary | constructs its OWN WASM handle via the Dev-only Gate | — | holds a SECOND handle | a SECOND, independent Store generation | untouched — remains the dev/test implementation, unchanged |
| `FedosWasmLoaderSkeleton#evaluateDevOnlyGate()` | `runtime/fedos_wasm_loader.ts:4512` | dev/test loader | NO (by design) | — | itself IS the gate | — | — | — | — | **untouched — must remain permanently denied outside `NODE_ENV=development`** |
| `determineFedosRuntimeMode()` | `runtime/fedos_runtime_mode_authority.ts:62` | — | — | — | — | — | — | — | — | untouched |
| `assembleFedosConversationProductionCryptoGraph()` | `conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.ts` | dev/test callers only | via `conversationProductionCrypto` config field, never set by the real Coordinator | effectively yes | YES (transitively, via `FedosWasmMasterSeedAuthority`) | YES — a SECOND, independent `FedosWasmMasterSeedAuthority` | — | holds a second handle | a second Store generation | **untouched — remains available for dev/test/Direct-mode-message callers that explicitly opt in** |
| `FedosConversationProductionCryptoGraph`/`Config` | same file | — | — | — | — | — | — | — | — | untouched (type/shape unchanged) |
| `FedosDirectRatchetSealingAuthority` (port) | `conversation/ratchet/fedos_direct_ratchet_sealing_authority.ts` | narrow interface, already established (Alpha 5401–5480) | — | — | — | — | — | — | — | untouched — this Arc's whole point is to make `FedosProductionMasterSeedAuthority` ALSO implement it |
| `isFedosDirectRatchetSealingAuthority()` (type guard) | `desktop/runtime/fedos_desktop_runtime.ts:400` | — | — | — | — | — | — | — | — | untouched — structural duck-typing, works unmodified for any object exposing the two methods |
| `conversationDirectRatchetDeps` derivation | `desktop/runtime/fedos_desktop_runtime.ts:804-824` | `startFedosDesktopRuntime()` | the exact site currently gated on `productionCryptoGraph !== null` | — | transitively (only reachable via the dev-gated graph today) | no | reads `productionCryptoGraph.masterSeedAuthority` | no | no | **YES — widen the authority source, see Phase D** |
| `conversationArchiveMasterSeedAuthority` | `desktop/runtime/fedos_desktop_runtime_config.ts:276` + `fedos_desktop_runtime.ts:1258` | **existing, exact precedent** — Coordinator already reuses `this.#deps.masterSeedAuthority` directly for Archive, bypassing `conversationProductionCrypto` entirely | YES | no | NO | no | reuses the SAME already-activated authority | no | no | untouched — the pattern this Arc mirrors |
| `FedosDesktopConversationRuntime.conversationRuntime()`/`stopped` gate | `desktop/runtime/fedos_desktop_runtime.ts:~1291` | Runtime | YES | — | — | — | — | — | — | untouched — already throws post-`stop()`, already the mechanism that makes ANY stale Ratchet facade reference unreachable after lock |
| `FedosProfileInitializationCoordinator#lock()` | same coordinator file, line 533 | canonical lock owner | YES | — | — | — | calls `this.#deps.masterSeedAuthority.clear()` (line 550) | — | — | untouched — already invalidates the SAME authority object this Arc reuses for Ratchet |
| `fedos_electron_beta_main.cts` (`secureRuntimeBundleConfig()`) | `packages/fedos-desktop-electron-spike/src/` | canonical packaged Beta entry point (this session's own prior Arc, `f3e0658`) | YES | — | — | no | already sets `directRatchetEnabled: true` when a relay is configured | no | no | untouched — no Electron-main change is needed; the Coordinator-level fix alone closes the gap |

Do-not-rely-on-docs check: every row above was confirmed by direct source
read, not by any prior Arc's own README prose (several prior README
blurbs describe `productionCryptoGraph` requirements slightly differently
than the actual guard code at `fedos_desktop_runtime.ts:509-532`; this
report cites line numbers and verbatim code, not paraphrase).
