# Secure Runtime Alpha 702 — Publisher Signing Authority Binding

Stage 2 of Phase B.

## Decision

Account identity belongs to **the runtime publisher configuration** — the
smallest of the three options the task compared (runtime publisher
config / Outbox intent / internal publisher registry entry), and the only
one that avoids changing the Outbox V1 wire format.

`FedosSigningAuthorityBoardPostEventSource`
(`src/board/publish/nostr/fedos_signing_authority_board_post_event_source.ts`,
Alpha 704) is constructed with ONE fixed `accountIndex` — the SAME value
`FedosBoardRuntime`'s own Binding Authority already checked (Alpha 689) —
for the entire lifetime of a running Local Runtime. There is no "publisher
registry" of multiple named entries in this V1: one Local Runtime, one
Nostr Publisher, one fixed account. This is a deliberate simplification of
the task's own "publisher registry entry owns a fixed local Nostr
account" language, applied at the granularity this Arc's own real test
coverage actually needs — introducing an unused multi-entry registry
abstraction ahead of a real, reviewed need would violate this codebase's
own "no accessor/abstraction added ahead of a real reviewed need"
discipline (e.g. `FedosNostrSignatureHandle`'s own Alpha 182 precedent).

Outbox intents never carry an account selector of any kind — a caller
cannot make an intent "select an arbitrary account" (the task's own
explicit prohibition), because no such field exists on
`FedosBoardOutboxIntent` before or after this Arc.
