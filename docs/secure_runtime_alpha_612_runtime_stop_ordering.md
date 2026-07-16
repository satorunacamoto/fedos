# Secure Runtime Alpha 612 — Runtime Stop Ordering

Stage 12 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## Required order, implemented exactly

`FedosRunningDesktopRuntime.stop()`: (1) a local `stopped` flag is set
FIRST, so a concurrent/repeat call is rejected before touching
anything; (2) if delivery was started, `await host.stopDelivery()` —
which itself already guarantees, unchanged, "no new tick starts, THEN
the in-flight tick completes" (Alpha 505/506/564); (3)
`await host.stop()`. This file adds no new ordering logic of its own
beyond SEQUENCING two already-correct, already-tested calls — it does
not reimplement or duplicate either one's own internal guarantee.

## Double-`stop()` policy — explicit, not silently absorbed

A second `stop()` call throws `"FedosRunningDesktopRuntime.stop() may
only be called once."` — deliberately mirroring `FedosDesktopHost.stop()`'s
own non-idempotent "may only be called once, from the ready state"
contract (Alpha 337, unchanged) rather than silently no-op'ing a
repeat call, per this Stage's own instruction ("Host自身の非idempotent
契約を無視しない").

## Verified, by real execution, in `test/secure_runtime_alpha_612_runtime_stop_ordering.test.ts`

`stop()` does not resolve before a gated, in-flight Publisher call
completes (an explicit "still not resolved" check mid-await, not
merely absence of an error); no further Publish occurs after `stop()`
resolves; a second `stop()` call rejects with the exact message above;
`stop()` with delivery disabled skips `stopDelivery()` entirely and
still stops the Host cleanly.

## See also

- `docs/secure_runtime_alpha_564_scheduler_stop_barrier.md`
- `docs/secure_runtime_alpha_606_runtime_assembly.md`
