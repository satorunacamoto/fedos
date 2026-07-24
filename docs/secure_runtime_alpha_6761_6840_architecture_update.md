# Secure Runtime Alpha 6761–6840 — Architecture Update

**FedOS Settings-to-Relay Production Wiring and Secure Runtime Reachability Arc.**

## What changed

One canonical production graph, now genuinely closed end to end for three
of the four subsystems the mission names:

```
Profile
  → Settings (relays/defaultRelay, real, persisted, Alpha 4901-4980)
  → Coordinator (FedosProfileInitializationCoordinator, unchanged)
  → Desktop Runtime (startFedosDesktopRuntime(), unchanged)
  → Conversation Runtime (unchanged)
  → Peer Capability   ── NOW REACHABLE through the packaged Beta entry point
  → Identity Transition ── NOW REACHABLE
  → Deletion Request  ── NOW REACHABLE
  → Safety Center (productionCryptoStatus() proven "ok" live)
  → Direct Ratchet    ── STILL UNREACHABLE (structural, disclosed, see below)
```

The ONLY new code path is `secureRuntimeBundleConfig()` in
`fedos_electron_beta_main.cts` — a pure, additive function that reads the
already-existing Settings descriptor and, when a real relay is genuinely
configured, supplies the already-existing Coordinator dependency fields
(`privateTransportEnabled`, `conversationTransportRelays`,
`conversationTransportSigningAuthority`, `directRatchetEnabled`,
`peerCapabilityEnabled`, `identityTransitionEnabled`,
`deletionRequestEnabled`, plus their already-established sub-config
defaults). No new class, no new protocol, no new crypto, no new Nostr
kind, no new persistence format. `tsconfig.beta-runtime.json` gained two
lines (compiling the already-existing `WebSocketRelay`/
`createNodeWebSocketRelaySocketFactory` classes into the packaged
`dist/`, since nothing in the beta-runtime graph previously imported the
CONCRETE relay classes, only the `FedosRelay` type).

## What did NOT change

- No redesign of `FedosProfileInitializationCoordinator`,
  `startFedosDesktopRuntime()`, the Settings descriptor, or any crypto
  primitive.
- No new Runtime, Shell, Host Bridge, or Electron main — `fedos_electron_
  beta_main.cts` remains the ONE canonical packaged entry point,
  unchanged in every respect except the one additive config-threading
  function.
- No weakening of the Dev-only Gate (`FedosWasmLoaderSkeleton#
  evaluateDevOnlyGate()`) — Direct Ratchet's own `conversationProductionCrypto`
  path remains permanently denied in any non-`NODE_ENV=development`
  process, exactly as before this Arc.
- `NullRelay` (test-only, no real network I/O) is never used in this
  entry point — only the real, production-grade `WebSocketRelay`.

## The one remaining, disclosed architectural gap

Direct Ratchet's own crypto graph (`FedosConversationProductionCryptoGraph`,
via `assembleFedosConversationProductionCryptoGraph()`) is architecturally
SEPARATE from the real, host-attestation-gated production Master Seed
Authority (`activateFedosProductionProfileMasterSeed()`) every other
subsystem in this graph already shares. The former always constructs its
OWN, second, independent `FedosWasmMasterSeedAuthority`, gated to
`NODE_ENV === "development"` only. Unifying these two systems — so
`conversationProductionCrypto` could accept an ALREADY-ACTIVATED
production authority instead of always deriving a second, dev-gated one
— is a genuine, real, well-scoped piece of future work, but it is a
REDESIGN of `assembleFedosConversationProductionCryptoGraph()`'s own
public contract, explicitly out of this Arc's "no redesign" mandate. This
Arc names it precisely rather than attempting it.
