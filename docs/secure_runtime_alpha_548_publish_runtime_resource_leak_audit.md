# Secure Runtime Alpha 548 — Resource Leak Audit

Stage 8 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only.

## Real OS-level resources in the reviewed stack

Exactly two: a `setInterval` timer handle (`FedosPublishScheduler`) and
a `WebSocket` connection (`WebSocketRelay`, reachable only through the
Nostr-specific Publisher family). Every other structure in this stack
is pure in-memory data (Alpha 547) — not a leak category, a memory-growth
category.

## Timer: correctly managed, when `stop()` is actually called

`FedosPublishScheduler.start()` stores its `setInterval` handle in
`#timerHandle`; `stop()` calls `#clearIntervalFn(this.#timerHandle)` and
clears the field. This is CORRECT and LEAK-FREE — but only if `stop()`
is ever called. Given Alpha 541's own finding (no production caller
exists yet) and Alpha 546's own finding (nothing in the current Host
shutdown path calls Scheduler's `stop()` either, since Host doesn't own
a Scheduler reference at all today), **the timer itself cannot leak
TODAY simply because nothing ever calls `start()` in production.** This
is a real, but currently dormant, requirement for whichever future Arc
wires the Scheduler under Host: `Host.stop()` MUST call
`scheduler.stop()` (per the (unmerged) Host Ownership Review's own
Alpha 03 shutdown-ordering design) or every process exit leaves a live
timer referencing a Scheduler no one can reach anymore.

## WebSocket: no leak today, real leak risk once wired

`WebSocketRelay.connect()` opens a real socket and registers three
listeners (`close`/`error`/`message`, `websocket_relay.ts:251-259`).
`disconnect()` (existing, correct, idempotent) removes the reference
and closes it. Per Alpha 546, **nothing in the reviewed stack currently
calls `disconnect()` from any shutdown path** — because nothing
currently constructs a `WebSocketRelay` in production either (Alpha
541). The risk is identical in shape to the timer: dormant today,
real the moment a Publisher wiring Arc connects a live `WebSocketRelay`
without ALSO wiring its `disconnect()` into whatever shutdown path Host
gains.

## Event listeners

`socket.addEventListener("close"/"error"/"message", ...)` — three
listeners per connection, attached inside `connect()`
(`websocket_relay.ts:251-259`). `disconnect()`'s own `socket.close()`
call causes the browser/runtime's own WebSocket implementation to fire
the `"close"` listener itself (standard `WebSocket` semantics) — the
listeners are not separately removed via `removeEventListener`, but
since `disconnect()` also drops the class's own `#socket` reference
(`this.#socket = undefined`, confirmed in the `close`/`error` handlers
themselves) and the socket object itself becomes unreachable once
closed and dereferenced, this does NOT constitute a leak under normal
garbage collection — the listeners die with the socket object they are
attached to. No separate cleanup step is missing here specifically.

## No other resource-holding code found

Searched (`grep -rn "setInterval\|setTimeout\|new WebSocket\|addEventListener\|fs\.\|readFile\|createReadStream"`)
across every file table §1 of Alpha 541 names — the ONLY matches are
the two already named above, plus `AppendOnlyFedosBoardOutboxPersistence`/
`AppendOnlyFedosBoardPersistence`'s own synchronous, open-read-close-per-call
file access (no held file handle between calls — confirmed by their own
"replay-on-every-call" design, Alpha 542), which holds no resource
between calls by construction.

## Summary

Zero ACTIVE leaks today (nothing runs in production, Alpha 541). Two
NAMED, concrete future requirements: Scheduler's timer and
WebSocketRelay's socket both need an explicit place in whatever
shutdown chain a future Host-ownership Arc builds — not two NEW pieces
of cleanup code to invent, since both `stop()`/`disconnect()` already
exist correctly; only the CALL from a real shutdown path is missing.

## See also

- `docs/secure_runtime_alpha_546_publish_runtime_shutdown_audit.md`
- `docs/secure_runtime_alpha_547_publish_runtime_memory_audit.md`
