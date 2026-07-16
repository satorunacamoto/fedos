# Secure Runtime Alpha 710 — Transport Success vs Relay Acceptance

Stage 10 of Phase B — the first internal phase gate this Arc's own
instruction asks for.

## Finding

`FedosRelayNostrBoardPublisher.publishOne()`'s own header (Alpha 456)
already honestly documents its own `true` as "the local transport attempt
completed without error" only — never Relay acceptance. Its own
`nostrPublishOneResultToOutboundPublishResult()` mapping (Alpha 497) says
so explicitly: "this repository has no OK-correlation mechanism
anywhere." That statement was accurate when written (Alpha 497) — Phase
A/B of THIS Arc changes the facts on the ground.

## Options compared

A. rename/coarsen the result to sent/failed. B. implement matching OK
correlation. C. retain current result with explicit transport-only
semantics.

## Decision: B (with C retained as a still-available, unchanged choice)

Alpha 701's own inventory found this codebase's `FedosRelay` foundation
(Alpha 236/238) already ships `onRelayMessage()`, delivering parsed
`["OK", eventId, accepted, message]` responses — built for the Relay
Message Reception Arc, never wired into the Publish pipeline. This is
exactly a "small, safe additive correlation" the current Relay inbound
architecture already supports (Alpha 711's own qualifying condition for
choosing B) — no broad Relay redesign is needed.

`FedosRelayOkCorrelatedNostrBoardPublisher` (Alpha 711) is a NEW, second
implementation of `FedosNostrBoardPublisher`. `FedosRelayNostrBoardPublisher`
(Option C) is completely untouched and remains available — a caller may
still choose transport-only semantics by wiring the older class instead.

No canonical vocabulary change was made: `FedosNostrBoardPublisher.publishOne(): Promise<boolean>`
is unchanged; `true` from the new class is simply a strictly stronger,
honest guarantee within that same boolean contract (see Alpha 711 for the
exact semantics and the one disclosed limitation this choice carries).
