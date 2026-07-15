# Secure Runtime Alpha 546 — Shutdown Audit

Stage 6 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only. Confirms whether flush/await exists in the current
implementation, per the Arc's own required question.

## Direct answer: no flush/await exists anywhere in the reviewed shutdown paths today

- **`FedosDesktopHost.stop()`** — `async` in signature only; contains
  zero internal `await` (re-confirmed this Arc,
  `test/secure_runtime_alpha_546_...test.ts` §1, by both source
  inspection and real execution timing). It cannot flush anything
  because none of the objects it holds (`DesktopApplication`,
  `FedosBoardService`, `FedosBoardQuery`) exposes a close/dispose/flush
  method (re-confirmed: `grep -c "close\|dispose\|flush"` across all
  three source files returns zero).
- **`FedosPublishScheduler.stop()`** — synchronous, not even declared
  `async`. Clears its own `setInterval` handle only. Does NOT await, or
  even reference, any in-flight `tick()` `Promise` — confirmed by the
  prior (unmerged) Host Ownership Review's own Alpha 03 finding,
  re-verified fresh this Arc directly against the current source
  (`fedos_publish_scheduler.ts:144-150`, unchanged).
- **`WebSocketRelay.disconnect()`** — the ONE component in the entire
  reviewed stack that DOES perform a real, meaningful close operation
  (`socket.close()`, `fedos_relay.ts`/`websocket_relay.ts:302-310`) —
  but nothing calls it. `FedosDesktopHost` holds no Relay reference at
  all (Alpha 543); no Publisher implementation's own `stop()`-adjacent
  method exists to call it either (`FedosRelayNostrBoardPublisher` has
  no `stop()`/`close()`/`dispose()` method of any kind — confirmed,
  `test/secure_runtime_alpha_546_...test.ts` §2).

## Consequence

Given Alpha 541's own finding (nothing in this stack has a production
caller yet), this is currently a LATENT gap, not an observed incident.
But it is a real, concrete requirement for whichever future Arc wires a
real Publisher: **a real `WebSocketRelay` connection, once opened by a
wired Publisher, has no shutdown path anywhere in this reviewed stack
that would ever call `disconnect()` on it.** This is the single most
concrete Resource Leak precursor this Arc finds (see Alpha 548) and is
directly caused by the Shutdown gap this Stage documents.

## What a correct shutdown sequence requires (design-level restatement, not implemented by this review)

1. Stop accepting new work (Scheduler `stop()` — already correct,
   already idempotent).
2. Await any in-flight `tick()` — **missing**: `FedosPublishScheduler`
   exposes no accessor for its own current in-flight `Promise`.
3. Disconnect any open transport (`WebSocketRelay.disconnect()`) —
   **missing**: no caller in the reviewed stack ever reaches it.
4. Durable Observation write — already synchronous/durable-on-write
   once wired (Alpha 545), so no separate flush step is needed once
   Step 2 resolves.
5. `state → "stopped"` — already correct today for the parts of the
   state machine that exist (Board/Query nulling).

This restates, and re-confirms against the CURRENT (unchanged) source,
exactly the same two gaps the (unmerged) Host Ownership Review already
named in its own Alpha 03 — this Arc's own contribution is confirming
neither gap has been closed since, and adding the WebSocketRelay
resource-leak consequence that review did not fully trace through.

## See also

- `docs/secure_runtime_alpha_337_desktop_host_shutdown_contract.md`
- `docs/secure_runtime_alpha_548_publish_runtime_resource_leak_audit.md`
