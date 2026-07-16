# Secure Runtime Alpha 815 — Runtime Ownership Review

Stage 25. Compares:

**A. Implement port/backends only, no Runtime wiring.** ADOPTED.

**B. Allow an optional injected backend but expose no operations.**
Rejected — would add a dead, unused constructor parameter to
`FedosDesktopRuntimeConfig`/`startFedosDesktopRuntime()` for a
capability nothing consumes, purely for symmetry with Conversation
persistence's own wiring (Alpha 758). This Arc's own instruction: "Do
not add dead production ownership merely for symmetry."

**C. Wire a future-unused backend by default.** Rejected for the same
reason, more strongly — an unused DEFAULT construction (e.g. always
creating an `InMemoryFedosConversationPayloadStorage` inside
`startFedosDesktopRuntime()` whether or not anything uses it) is
pure waste and, per this Arc's own "never touch unrelated layers"
rule, unjustified.

## Why A

No private-message consumer exists anywhere in this codebase — no
Membership, no Capability, no Private Message Envelope (all
prerequisites this Arc does not implement, per its own Absolute
Prohibitions). `startFedosDesktopRuntime()`/`FedosDesktopRuntimeConfig`
(Alpha 758) are confirmed byte-for-byte UNCHANGED by this Arc
(`test/secure_runtime_alpha_816_no_duplication_guard.test.ts` item 9).
`src/board/runtime/` is likewise confirmed untouched (item 8) — no
`FedosBoardRuntime` change of any kind.

Wiring belongs to whichever future Arc introduces the first real
consumer (most likely the Private Message Envelope Arc, per Alpha 820's
own next-Arc recommendation) — at that point, real test consumer
justifies Option B/C's own reasoning; today, nothing does.
