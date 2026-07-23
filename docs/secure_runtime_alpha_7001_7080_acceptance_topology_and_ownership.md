# Secure Runtime Alpha 7001–7080 — Packaged Acceptance Topology and Ownership

**FedOS Desktop Beta Final Runtime Validation and End-to-End Messaging
Acceptance Arc.** Phase B.

## Headline approach chosen: **C — one packaged Electron process + one real Node Runtime peer**, both driven through real production code paths

Rejected alternatives, with reasons grounded in Phase A's findings:

- **A (two packaged processes, existing user-facing commands)** — rejected
  as the FIRST attempt: no existing user-facing IPC command reaches
  conversation creation, session establishment, or Device trust at all
  (Phase A inventory); building this now would require inventing BOTH a
  new closed command vocabulary AND a first-ever concurrent-two-Electron-
  process test pattern in the same step, compounding two unproven risks.
- **B (two packaged self-test processes, closed command vocabulary)** —
  the correct SECOND step once the one-Electron path is proven; deferred
  to a follow-on validation within this same Arc if time and the RC
  matrix allow, never claimed as the headline proof unless actually run.
- **D (one process, two profile generations)** — rejected: two profiles in
  one process share one Electron main's module-level `activeCoordinator`/
  `activeAssembly` singletons (`fedos_electron_beta_main.cts`'s own
  documented "OWNERSHIP... at most ONE ready coordinator + ONE assembly
  exist at a time" invariant) — running two profiles concurrently in one
  process would require weakening that invariant, which is an accepted
  security/lifecycle boundary this Arc must not redesign.
- **E (`webContents.executeJavaScript`)** — rejected: bypasses the
  preload/contextBridge boundary Electron security depends on; the
  mission's own prohibitions list forbids weakening Electron security,
  and driving the app through injected script text is exactly that kind
  of bypass even if only used for testing.

**Chosen (C):** Alice runs as a REAL packaged Electron process (main +
preload + renderer IPC boundary + Desktop Runtime + Conversation Runtime
+ Direct Ratchet, exactly the same chain Phase A inventoried). Bob runs as
a REAL Node-level `FedosProfileInitializationCoordinator` /
`startFedosDesktopRuntime()` instance — the SAME production classes,
SAME production WASM activation, SAME `FedosProductionMasterSeedAuthority`,
SAME `FedosDirectRatchetCryptographicSession` Phase I already proved at
Alpha 6921-7000 — never a fake peer, never a test double standing in for
a second identity. Both sides connect to the SAME real local WebSocket
relay server (Phase F). This satisfies the mission's own explicit
carve-out: "A one-Electron/one-Node arrangement is acceptable only if the
Electron side travels through the complete packaged production chain and
the Node side uses the real production Runtime rather than a fake peer" —
both conditions are met and will be verified by the structural guards
(Phase Q).

**Two genuinely independent identities, confirmed possible without any
shared state:** each side calls `activateFedosProductionProfileMasterSeed()`
independently (Alice via the packaged Electron main's own existing
call chain, Bob via a direct Node call to the SAME function) — this
constructs an independent `FedosProductionMasterSeedAuthority`, an
independent generated Master Seed, and an independent Nostr/account
identity per call (proven at Alpha 6921-7000 Phase I already, reused
here for the second identity instead of re-proven).

## Relay fixture decision

No real WebSocket relay SERVER exists anywhere in this repository (Phase
A). No `ws`-style server package is an available dependency in this
environment. Decision: implement one minimal, real, RFC 6455-compliant
WebSocket server as a **test/acceptance fixture** (`test/support/`, never
under `src/`), built on `node:http` + `node:crypto` only (no new
dependency). It performs a genuine TCP accept, a genuine HTTP Upgrade
handshake (`Sec-WebSocket-Accept` computed per RFC 6455 §1.3), and genuine
WebSocket framing (text frames only — the only frame type
`WebSocketRelay`'s own client factory sends/expects) — real bytes over a
real local socket, not an in-memory bookkeeping object like the existing
`FakeRelayServer` test double. It relays opaque published event JSON
between subscribers exactly as a real Nostr relay would (no plaintext
visibility beyond what a real relay already sees: encrypted Gift Wrap
envelopes). This keeps the change entirely on the test/fixture side of
the boundary — zero `src/` production file is touched to build it, and
`WebSocketRelay`/`createNodeWebSocketRelaySocketFactory` (the real
production CLIENT) are consumed completely unmodified, proving the real
production transport boundary rather than replacing it.

## Ownership summary (per this topology)

| Actor | Master Seed Authority | Store generation | Desktop Runtime | Conversation Runtime | Electron main |
|---|---|---|---|---|---|
| Alice | 1 (packaged, real production) | 1 | 1 (packaged) | 1 (packaged) | 1 (the canonical `fedos_electron_beta_main.cts`, unmodified) |
| Bob | 1 (Node, real production, same classes) | 1 | 1 (Node, `startFedosDesktopRuntime()`) | 1 (Node) | 0 (no Electron process for Bob in the headline slice) |

No second Master Seed Authority/Store/Desktop Runtime/Conversation
Runtime/Electron main is ever created for either peer individually — one
of each, per peer, matching Phase Q's structural guard requirement
exactly.
