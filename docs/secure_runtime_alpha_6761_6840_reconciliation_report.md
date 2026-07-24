# Secure Runtime Alpha 6761–6840 — Reconciliation Report

**FedOS Settings-to-Relay Production Wiring and Secure Runtime Reachability Arc — Phase A.**

## Ancestry

`f7c141d4` (Alpha 6681–6760, this Arc's own direct parent) already contains
both `70bbd6e8` (Alpha 6521–6600, Desktop Runtime Configuration
Unification) and `8a33045e` (Alpha 6601–6680, Secure Memory Store
Production Wiring) — reconciled by the immediately-prior Arc's own merge
commit `f876ff72`. `git merge-base --is-ancestor` confirms all three are
ancestors of `f7c141d4`; no further reconciliation merge is required or
performed by this Arc. This worktree (`C:\wt\fedos-settings-relay-secure-
runtime`, branch `arc/fedos-settings-relay-secure-runtime-reachability`)
was created directly from `f7c141d4`.

## Why the packaged entry point could not reach Secure Runtime (precise root cause)

`f7c141d4`'s own execution specification already narrowed this to one
finding: `FedosProfileInitializationCoordinator` has carried
`directRatchetEnabled`/`peerCapabilityEnabled`/`identityTransitionEnabled`/
`deletionRequestEnabled` since Alpha 6521–6600, but the canonical packaged
Beta entry point (`packages/fedos-desktop-electron-spike/src/
fedos_electron_beta_main.cts`) never passed any of them to its own
`Coordinator` construction. This Arc traced the reason precisely by direct
source inspection:

1. `startFedosDesktopRuntime()` (`src/desktop/runtime/fedos_desktop_runtime.ts:509-521`)
   requires `deviceTrustEnabled` (always `true`, unconditionally set by
   the Coordinator itself — never a blocker) AND `privateTransportEnabled:
   true` for all four subsystems, since they all send/receive control
   payloads through the real Private Transport.
2. `privateTransportEnabled: true` itself requires
   `conversationTransportObservationLogPath` (already auto-derived by the
   Coordinator from `paths` whenever `privateTransportEnabled` is set — no
   caller action needed), `conversationTransportRelays` (a real, non-
   empty array of `FedosRelay` instances), and
   `conversationTransportSigningAuthority` (a real Nostr signing
   authority — the beta main already constructs one, `signer`, for
   `accountSigningAuthority`, and can reuse it verbatim).
3. **The ONLY missing piece was `conversationTransportRelays`.** No
   packaged Electron entry point in this repository has ever constructed
   a real `FedosRelay` from a genuinely user-configured URL — the closed,
   already-existing Settings descriptor (`src/settings/
   fedos_settings_descriptor.ts`, Alpha 4901–4980) has carried `relays: readonly
   string[]`/`defaultRelay: string` fields for many Arcs, and this
   repository's own `fedos_settings_application_class.ts`
   (Alpha 4981–5060) already classifies both as `runtime-restart`
   ("`FedosConversationRelaySet` is constructed once, inside
   `startFedosDesktopRuntime()`... and is immutable thereafter") — but no
   Arc before this one ever closed the loop by having a packaged entry
   point actually READ that Settings field at Runtime-construction time.

## Production path inventory

| Path | Status before this Arc | Status after this Arc |
|---|---|---|
| Settings descriptor `relays`/`defaultRelay` | Real, persisted, closed vocabulary (Alpha 4901–4980) | Unchanged |
| Settings application classification (`runtime-restart`) | Real (Alpha 4981–5060) | Unchanged |
| `FedosDesktopSettingsController.load()` | Real, file-backed, stateless (Alpha 4901–4980) | Now ALSO read by `buildFreshCoordinator()` before Runtime construction (additive second stateless read of the SAME file, never a second owner) |
| `WebSocketRelay`/`createNodeWebSocketRelaySocketFactory` | Real, production-grade (Node 22+ global `WebSocket`, Alpha 705/213-238), used only by `src/worker.ts` (Cloudflare Worker) | Now ALSO compiled into the Beta Electron entry point's own `dist/` (2 lines added to `tsconfig.beta-runtime.json`'s explicit `include`) and constructed for real from configured relay URLs |
| `FedosProfileInitializationCoordinator`'s `directRatchetEnabled`/`peerCapabilityEnabled`/`identityTransitionEnabled`/`deletionRequestEnabled` | Real (Alpha 6521–6600), never threaded by any packaged entry point | Threaded by the Beta entry point WHEN a real relay is configured; honestly left disabled otherwise |
| `assembleFedosConversationProductionCryptoGraph()`/`FedosConversationProductionCryptoConfig` (Direct Ratchet's own crypto graph) | Real, but PERMANENTLY gated to `NODE_ENV === "development"` by `FedosWasmLoaderSkeleton`'s own Dev-only Gate (Alpha ~1273, explicitly documented "architecture-frozen forbids redesigning an already-reviewed security boundary") | Unchanged, unreachable through this or any packaged production entry point by design — see Finding below |

## Finding: Direct Ratchet's own unreachability is structural, not a wiring gap

`directRatchet()` on `FedosConversationRuntime` resolves only when
`config.conversationProductionCrypto !== undefined` AND the resulting
`assembleFedosConversationProductionCryptoGraph()` call succeeds. That
factory (`src/conversation/encryption/production/
fedos_conversation_production_crypto_authority_factory.ts`) **always**
constructs a brand-new `FedosWasmMasterSeedAuthority` — a SECOND,
independent Master Seed Authority, never reusing the ALREADY-ACTIVATED
one `activateFedosProductionProfileMasterSeed()` (the real, host-
attestation-gated production activation the rest of the Runtime already
uses) produces — and its own construction path runs through
`FedosWasmLoaderSkeleton#evaluateDevOnlyGate()`
(`src/runtime/fedos_wasm_loader.ts:4512`), which calls
`determineFedosRuntimeMode()` (`src/runtime/fedos_runtime_mode_authority.ts:62`):
`NODE_ENV === "development"` → allowed; `NODE_ENV === "production"` or
unset/anything else → **permanently denied** (`developmentAllowed:
false`). A packaged Electron Beta build does not set `NODE_ENV=development`
(and must not, to run this dev-only-gated path — doing so would be
exactly the "no mock production path" and "never weaken security"
violation this Arc's own absolute rules forbid).

Closing this would require either (a) supplying the SAME already-
activated production Master Seed Authority to `conversationProductionCrypto`
instead of letting the factory construct its own — a genuine, real
REDESIGN of `assembleFedosConversationProductionCryptoGraph()`'s own
API, explicitly out of this Arc's "no redesign" scope, or (b) weakening
the Dev-only Gate to also allow Production — an already-reviewed security
boundary this Arc's own absolute rules forbid touching. This Arc
therefore correctly does NOT attempt either. Direct Ratchet remains
honestly unreachable through the packaged Beta entry point, for a
disclosed, structural, non-environmental reason distinct from (and
strictly harder than) the Settings→Relay gap this Arc closes for the
other three subsystems.

## Overlap / conflict classification

This Arc touches exactly three files plus adds one new test file — no
merge is required (single-lineage continuation, no diverged branch to
reconcile). Classification: mechanical additive (2-line `tsconfig.
beta-runtime.json` include addition), additive (`fedos_electron_beta_main.cts`'s
new `secureRuntimeBundleConfig()` function and its call site), and a new,
independent test file. No existing test, guard, or documented behavior is
weakened.
