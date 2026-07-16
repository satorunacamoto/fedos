# Secure Runtime Alpha 704 — Local Runtime Publisher Construction

Stage 4 of Phase B. When delivery is enabled, a caller assembles, outside
`startFedosDesktopRuntime()` itself (which constructs no Signing
Authority/Relay of its own, Alpha 610, unchanged):

- a `FedosNostrSigningAuthority` (`createFedosWasmNostrSigningAuthority()`
  in production, or a test double);
- a `FedosRelay` (`WebSocketRelay` + `createNodeWebSocketRelaySocketFactory()`,
  Alpha 705, or `NullRelay`/a fake in tests);
- a `FedosNostrBoardPublisher` (`FedosRelayOkCorrelatedNostrBoardPublisher`,
  Alpha 710/711, wrapping the Relay);
- a `FedosSigningAuthorityBoardPostEventSource` (Alpha 702/703), whose
  `boardReaderAccessor` is a THUNK, `() => host.board()` — resolving the
  ONE real construction-order constraint this Arc's inventory found: a
  `FedosBoardOutboxPublisher` must exist before `FedosDesktopHost` is
  constructed, yet `host.board()` itself returns `null` until after
  `host.start()`. The thunk defers the read to call time, when the
  Scheduler actually invokes it — always after `start()`.
- a `FedosNostrBoardPublisherAdapter` wrapping the above two as the final
  `FedosBoardOutboxPublisher`.

All of this is then passed to `startFedosDesktopRuntime()`'s existing
`publisher`/`observationLogPath`/`deliveryEnabled` fields (Alpha 610/611,
unchanged) alongside the new `nostrAuthorBindingAuthority`/`nostrAccountIndex`
(Alpha 697). No hidden network connection occurs at module import — every
active resource (Relay connection, Scheduler, Publisher) belongs to the
running runtime's own lifecycle, started only by `start()`/`startDelivery()`.

Verified end to end in
`test/secure_runtime_alpha_707_real_nostr_outbox_processing.test.ts` and
`test/secure_runtime_alpha_709_restart_delivery_verification.test.ts`
(the latter via `startFedosDesktopRuntime()` directly).
