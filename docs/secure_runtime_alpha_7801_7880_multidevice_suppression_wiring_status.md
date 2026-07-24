# Secure Runtime Alpha 7801–7880 — Multi-Device Suppression Wiring Status

**FedOS Direct Conversation Archive Product Completion and Parallel-Lineage Integration Arc — Phase G.**

## Real, disclosed wiring gap found and partially closed

`e048ff63` (FedOS Archive Multi-Device Suppression Propagation Arc)
fully implemented and tested `suppressionAuthority` as an optional
dependency of `restoreFedosConversationArchiveBundle()` — but no caller
anywhere in `FedosConversationArchiveRuntime`,
`assembleFedosConversationArchiveRuntime()`, or
`fedos_desktop_runtime.ts`'s own production construction, ever passed
one through. That Arc's own "real multi-Device vertical slice" test
calls `restoreFedosConversationArchiveBundle()` directly, bypassing the
Runtime entirely — so the gap was invisible to its own (otherwise
genuinely real, BIP-340-signed) tests.

## What this Arc closes

1. `FedosConversationArchiveRuntimeDependencies.suppressionAuthority`
   (NEW, optional, additive) — threaded into
   `restoreConversationArchive()`'s own call to
   `restoreFedosConversationArchiveBundle()`.
2. `FedosConversationArchiveRuntimeAssemblyConfig.suppressionAuthority`
   (NEW, optional, additive) — threaded straight through to (1).

A caller who now explicitly constructs/injects a real
`FedosArchiveSuppressionObservationAuthority` gets correct restore-time
suppression enforcement through the real Runtime, for the first time.

## What remains open, honestly

`fedos_desktop_runtime.ts` itself — the real packaged product's own
construction site — still constructs NO
`FedosArchiveSuppressionObservationAuthority` of any kind, and no
Device Sync outbound/inbound wiring exists for the suppression `kind:1`
route in the real running application (confirmed: zero references to
`ArchiveSuppression` anywhere in that file). This means Multi-Device
Suppression Propagation, while fully implemented, fully tested, and now
correctly THREADABLE through the Runtime layer this Arc fixed, remains
UNREACHABLE end-to-end in the real packaged Electron app until a future
Arc:

1. Constructs a real `FedosArchiveSuppressionObservationAuthority` in
   `fedos_desktop_runtime.ts`, over a real durable
   `FedosArchiveSuppressionObservationPersistence` log path (mirroring
   this Arc's own `conversationArchiveDraftPersistence` construction
   pattern).
2. Wires the real `FedosArchiveSuppressionOutboundCoordinator`/
   `InboundHandler` into the real Device Sync relay transport
   (subscribing to and publishing the proprietary `kind:1` suppression
   route over the SAME relay connection Device Pairing/Sync already
   uses) — a substantially larger integration than this Arc's own
   narrow "thread an existing optional dependency through" fix, and
   explicitly out of THIS Arc's own scope (this Arc's own mission is
   Direct Conversation Archive product completion; full production
   Device Sync transport wiring is its own, separately-scoped
   integration effort).

This is disclosed here precisely so it is never mistaken for "already
shipped" — the domain is real and correct, the Runtime-level plumbing
this Arc fixed is real and correct, but the full chain from a real
sibling Device's own relay event to a real suppression decision inside
the packaged app is not yet connected end-to-end.

## No new suppression schema

This Arc creates no new suppression fact type, no new persistence port,
no new evaluation method — `evaluateSuppression()` (`e048ff63`'s own,
unmodified) is the ONE method threaded through, exactly as that Arc
already designed it.
