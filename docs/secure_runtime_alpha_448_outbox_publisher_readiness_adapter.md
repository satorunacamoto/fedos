# Secure Runtime Alpha 448 — Outbox Publisher Readiness Adapter

Phase B, Stage 8. Review-and-types-only, as this Stage's own preferred
candidate states — no `FedosNostrBoardPublisher` is created.

## Reviewed

- **Board Reader** (`src/board/repository/fedos_board_reader.ts`) —
  read-only, no signing/transport concern; a future publisher would
  read a canonical post through it.
- **Outbox Persistence** (`src/board/outbox/`) — `FedosBoardOutboxIntent`
  carries `postId`/`protocol`/`destination`, never a body duplicate,
  never a secret. Confirmed unchanged by this Arc (`git diff --stat`
  shows no `src/board/outbox/*` file touched).
- **Nostr Signing Authority** (Alpha 445) — confirmed to contain no
  transport concern: no `Relay`/`WebSocket`/`fetch` import anywhere in
  `fedos_nostr_signing_authority.ts`/`fedos_wasm_nostr_signing_authority.ts`
  (grep-verified).
- **`FedosRelay`** (`src/nostr/relay.ts`) — untouched by this Arc;
  confirmed it has no awareness of `FedosMasterSeedAuthority`/
  `FedosNostrSigningAuthority` (no import either direction).

## Confirmed

Signing authority contains no transport concern — `FedosNostrSigningAuthority.signEvent()`
takes a request and returns a signed event; it does not know what a
Relay is, does not know what an Outbox is, and makes exactly one call
per invocation with no retry loop.

## Not built this Stage

- `FedosNostrBoardPublisher` — not created, per this Stage's own
  "Preferred: review and types only" instruction; a future Publisher
  Arc (Alpha 451+, see Alpha 450's own recommendation) is the correct
  place to wire `Board Reader → Nostr Signing Authority → FedosRelay`
  into an actual publish flow, including delivery-observation and
  retry policy this Arc explicitly does not decide.
- No compile-time boundary skeleton was added either — this Arc found
  no gap that required one: `FedosNostrSigningAuthority`'s own
  `signEvent(request): Promise<FedosNostrWireEvent | null>` signature
  is already the exact shape a future Publisher needs to depend on,
  with zero additional adapter code required to make that dependency
  type-check.
