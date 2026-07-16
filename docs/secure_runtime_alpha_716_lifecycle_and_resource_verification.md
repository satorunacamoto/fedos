# Secure Runtime Alpha 716 — Lifecycle and Resource Verification

Stage 16 of Phase B.

- **One signer authority, one Publisher registry per runtime.** Each
  `buildPublisher`/runtime-assembly call in this Arc's own tests
  constructs exactly one `FedosNostrSigningAuthority`, one
  `FedosRelayOkCorrelatedNostrBoardPublisher`, and one
  `FedosSigningAuthorityBoardPostEventSource` — no shared module-level
  singleton of any kind (matching `FedosDesktopHost`/`startFedosDesktopRuntime()`'s
  own pre-existing "no shared singleton" guarantee, Alpha 618, unchanged).
- **No global socket, no global timer.** `createNodeWebSocketRelaySocketFactory()`
  constructs a fresh `WebSocket` per `connect()` call, never module-level
  state; `FedosRelayOkCorrelatedNostrBoardPublisher`'s own `setTimeout`
  calls are per-`publishOne()`, cleaned up on every settlement path.
- **`stop()` waits for in-flight tick.** Unchanged, pre-existing
  (`FedosHostDeliveryController`, Alpha 505/506/564) — this Arc adds no
  new Scheduler concurrency logic of any kind.
- **Listener cleanup.** `FedosRelayOkCorrelatedNostrBoardPublisher`'s own
  pending map is always emptied of a settled entry (Alpha 711).
- **No delivery after stop.** Verified by
  `test/secure_runtime_alpha_709_restart_delivery_verification.test.ts`
  — each runtime's own relay double only ever records activity while that
  SPECIFIC runtime instance is running.
- **Independent runtimes do not share state.** Verified by
  `test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts` test
  5 — two runtimes with separate Relays, separate signing identities,
  running concurrently; one's post never reaches the other's Relay.
- **Failed startup leaves no resource leak.** `startFedosDesktopRuntime()`'s
  own pre-existing synchronous config-validation throw (missing
  `observationLogPath`/`publisher` when `deliveryEnabled: true`, Alpha 609/610)
  happens BEFORE any Persistence/Host/Relay is ever constructed — unchanged
  by this Arc, so no new leak surface was introduced.
