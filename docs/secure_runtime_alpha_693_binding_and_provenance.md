# Secure Runtime Alpha 693 — Binding and Canonical Author Provenance

Stage 13 of Phase A.

## Question

Is `publicIdentifier` equality alone sufficient for a local canonical
post, or must the post additionally be proven to have been authored
through the local signing-backed Public Author Authority rather than
merely imported from a Relay with the same public key?

## Finding

This question is structurally moot for this Arc's own scope.
`FedosBoardRuntime.createPublicThread()`/`replyToPublicThread()`
(`src/board/runtime/fedos_board_runtime.ts`) are the ONLY path this Arc's
Binding Authority is ever consulted from, and both methods ALWAYS
construct a brand-new `FedosBoardPostInput` themselves —
`source: { protocol: "fedos", reference: id }`, author resolved fresh via
the currently-configured `FedosPublicAuthorAuthority` at command-execution
time. There is no code path in this codebase, before or after this Arc,
where an already-persisted, imported `FedosBoardPost` (e.g. one ingested
from a Relay, `source.protocol === "nostr"`) is ever re-submitted through
`FedosBoardRuntime` as if newly, locally authored — "no automatic
source-based republication" remains an absolute prohibition this Arc does
not touch.

## Decision

No local-author provenance marker is introduced. `FedosBoardPost` is not
modified. The safety property Alpha 693 asks for is already satisfied by
construction: every post this Arc's Binding Authority ever gates was
authored THROUGH the currently-configured Public Author Authority, in the
same command, moments before the binding check — never read back from
storage and re-attributed.
