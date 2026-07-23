# Secure Runtime Alpha 6841–6920 — Normative Crypto-Graph Decision and Ownership/Lifecycle Model

**Stage 1 / Phases E–F.**

## Normative decision (restated)

`FedosProductionMasterSeedAuthority` (the ONE canonical production Master
Seed Authority, constructed once per profile unlock by
`activateFedosProductionProfileMasterSeed()`) is extended to ALSO
implement `FedosDirectRatchetSealingAuthority` (two new methods,
`sealDirectRatchetSecret`/`restoreDirectRatchetSecret`, calling the
SAME already-Store-backed WASM handle methods
`FedosWasmMasterSeedAuthority` already calls). The resulting dual-
interface authority is threaded, by reference, from the Coordinator
(`this.#deps.masterSeedAuthority`, already held) into a new, additive,
optional `FedosDesktopRuntimeConfig` field
(`conversationDirectRatchetMasterSeedAuthority`), mirroring the EXISTING,
shipped `conversationArchiveMasterSeedAuthority` pattern exactly. Inside
`startFedosDesktopRuntime()`, the existing `conversationDirectRatchetDeps`
derivation is widened to accept this authority as an alternative to
(never a replacement of) `productionCryptoGraph.masterSeedAuthority` —
the dev/test path through `assembleFedosConversationProductionCryptoGraph()`
remains fully intact and untouched for callers that still use it.

## Phase E — ownership and lifecycle model (no ambiguous shared ownership)

- **Constructs the production WASM module**: `authorizeAndActivateFedosProductionDesktopMasterSeed()`, exactly once per Electron-main unlock attempt, host-attestation gated. Unchanged.
- **Constructs `FedosMasterSeedAuthority` (authority A)**: `activateFedosProductionProfileMasterSeed()` → `new FedosProductionMasterSeedAuthority(facade)`. Unchanged; exactly one call site.
- **Owns `SecretHandleStore`**: entirely inside Rust, behind the WASM handle authority A wraps. Unchanged.
- **Owns the capability-limited Ratchet authority**: authority A itself — no new object, no new class instance. The "capability" is simply the two new methods on the SAME object.
- **Constructs Ratchet Runtime**: `startFedosDesktopRuntime()`'s own existing `conversationDirectRatchetDeps` block, unchanged structurally (only its authority SOURCE is widened).
- **Owns Ratchet sessions**: unchanged — `FedosDirectRatchetConversationRuntime`/session objects, entirely Rust-state-owned per (conversationId, remoteDeviceRef), as today.
- **Destroys sessions**: unchanged — this Arc adds no new destruction path; Ratchet session lifecycle (reset, revocation) is untouched.
- **On profile lock**: `Coordinator#lock()` (line 550, unchanged) calls `authority A.clear()`. Since Ratchet's own `sealingAuthority`/`masterSeedAuthority` fields are references to authority A, EVERY subsequent call through them (`sealDirectRatchetSecret`, `restoreDirectRatchetSecret`, `resolveConversationKey`) hits `#ensure()` → `#cleared === true` → returns `null`/`false`, matching the SAME fail-closed contract every other authority-consuming call already has. Independently, `conversationRuntime()` itself throws once the Runtime's `stopped` flag is set, so the stale reference is never even reachable through the normal Shell path.
- **On Runtime restart**: a fresh `buildFreshCoordinator()` call (Electron main, unchanged) constructs a fresh authority A′ via a fresh `activateFedosProductionProfileMasterSeed()` call — a genuinely NEW WASM instance, NEW Store generation, NEW `FedosProductionMasterSeedAuthority` object. The new Coordinator's own `#buildRuntimeConfig()` call derives `conversationDirectRatchetMasterSeedAuthority` from A′, never from the stale A. No old capability is ever reused across a restart, because the ENTIRE Coordinator (and everything it constructs, including the config it hands to a fresh `startFedosDesktopRuntime()` call) is freshly built.
- **On process exit**: unchanged — `performCleanShutdown()` (Electron main) calls `coordinator.lock()`, which clears authority A exactly as above.
- **What becomes stale**: authority A itself (post-`clear()`), and any `FedosConversationRuntime`/Shell reference obtained before `stop()`.
- **What may be restored**: sealed Ratchet secret material, via `restoreDirectRatchetSecret()` against the FRESH authority A′ after a genuine unlock — requires the exact original binding tuple (unchanged AEAD contract), so cross-generation restoration is impossible by construction (a different authority instance's own key material differs, and even if it somehow matched, the binding tuple enforcement is orthogonal to which authority instance performs the call).
- **Store generation validation**: delegated entirely to Rust (`SecretHandleStore`'s own generation-safe handle checks, unchanged by `8a33045e` and untouched by this Arc) — the TS layer never needs to validate a generation number itself, because a cleared/stale authority object already fails closed at the TS↔WASM call boundary.
- **Capability objects carrying generation binding**: not needed — there is no separate "capability object" distinct from authority A itself; the object reference's own lifetime IS the generation binding (a fresh Coordinator attempt always produces a fresh object, never reuses one across generations).
- **Concurrent stop/use resolution**: unchanged — the Coordinator already serializes create/unlock/lock via its own `inFlight`-style guards (Electron main) and internal state machine (`#state`); this Arc introduces no new concurrent-access surface.

## Phase F — decision gate

| Condition | Status |
|---|---|
| Exactly one model selected | YES — Option H |
| No architecture conflict remains | YES |
| No raw-secret boundary required | YES — zero new raw-secret exposure; the two new methods mirror an already-shipped, already-reviewed implementation verbatim |
| Production gate remains strong | YES — `FedosWasmLoaderSkeleton`'s Dev-only Gate is entirely untouched; authority A's own gate (host attestation + pinned manifest) is also untouched |
| Packaged Beta can consume the model | YES — `secureRuntimeBundleConfig()` (this session's own prior Arc) already sets `directRatchetEnabled: true` when a relay is configured; zero Electron-main change needed once the Coordinator threads the new field |
| Existing Ratchet vectors/state remain compatible | YES — zero wire/schema change |
| Lock/restart ownership deterministic | YES — see Phase E, verified by direct source read of `Coordinator#lock()` and `stopped` gate |

**All seven conditions pass. Proceeding to Stage 2 implementation.**

## Exact files expected to change

- `src/desktop/production_activation/fedos_production_master_seed_authority.ts` — add two methods, add `implements FedosDirectRatchetSealingAuthority`.
- `src/desktop/runtime/fedos_desktop_runtime_config.ts` — add one optional field, `conversationDirectRatchetMasterSeedAuthority?: FedosMasterSeedAuthority`.
- `src/desktop/onboarding/fedos_profile_initialization_coordinator.ts` — one line in `#buildRuntimeConfig()`, mirroring `conversationArchiveMasterSeedAuthority`'s own existing line exactly.
- `src/desktop/runtime/fedos_desktop_runtime.ts` — widen the `conversationDirectRatchetDeps` authority-source derivation (one local `const`, condition change); zero change to the guard/throw blocks above it, zero change to any other subsystem's derivation.
- `test/secure_runtime_alpha_6521_6600_structural_guards.test.ts` — update test 8's own regex to reflect the new, still-secure derivation (still asserts `not.toMatch(/DevelopmentFedosMasterSeedAuthority/)`; the `productionCryptoGraph !== null` literal-match assertion is widened to match the new condition).
- New test file(s) for this Arc's own structural guards and real vertical slice.
- Documentation.

## Exact files that remain frozen (explicitly verified untouched)

- `FedosWasmLoaderSkeleton`/`fedos_wasm_loader.ts`'s own Dev-only Gate logic.
- `assembleFedosConversationProductionCryptoGraph()`/`fedos_conversation_production_crypto_authority_factory.ts`.
- `FedosWasmMasterSeedAuthority`/`fedos_wasm_master_seed_authority.ts`.
- `FedosDirectRatchetSealingAuthority`'s own interface shape.
- `isFedosDirectRatchetSealingAuthority()`'s own type-guard logic.
- All Rust source (`packages/fedos-core-rust/**`) — zero change; the needed WASM methods already exist.
- Every Ratchet protocol/wire/session-state file.
- `fedos_electron_beta_main.cts` (the packaged Beta entry point) — zero change required.
- `p2p/`, `.tmp_gen/`.

## Compatibility / migration / test / rollback strategy

- **Compatibility**: purely additive TypeScript-side wiring; no schema, no wire format, no WASM export surface change.
- **Migration**: none required — no persisted data shape changes.
- **Test strategy**: extend the existing production-authority test file with real seal/restore-through-the-production-wrapper coverage (mirroring the existing dev-wrapper test suite for the same two methods, if one exists — verified in Phase G below); add a new structural-guard test proving `FedosProductionMasterSeedAuthority` now implements the sealing port; add a real packaged vertical slice extending this session's own prior Arc's own test file.
- **Rollback strategy**: revert the five changed files (a small, self-contained diff); no persisted state depends on the new capability, so rollback is a pure code revert with no data migration.

## Open blocker list

None identified that would prevent proceeding to Stage 2.
