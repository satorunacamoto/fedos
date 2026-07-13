# Secure Runtime Alpha 221 — Existing Subscription Code Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 1 of the Alpha 221–230 Nostr Subscription Foundation Arc,
following the completed Nostr Relay Foundation Arc (Alpha 211–220).**

## 1. Why now

Alpha 220 §3's own "Next Arc recommendation" named exactly this Arc:
"Nostr Relay Subscription & REQ/CLOSE Foundation." Before Alpha 222
introduces anything new, this Stage inventories every Subscription-
shaped file already in this repository, by direct inspection, to
confirm what (if anything) can be reused — the SAME discipline Alpha
211 already applied one Arc ago before building the Relay Foundation.

## 2. What already exists — confirmed by direct inspection

Three pre-existing files under `src/nostr/` implement Subscription-
shaped behavior, none of them touched by any Alpha-numbered Stage so
far:

- **`src/nostr/relay.ts`** — `NostrFilter`/`RelayAdapter`/
  `InMemoryRelayAdapter`. `NostrFilter` names eight fields (`ids`,
  `authors`, `kinds`, `#e`, `#p`, `since`, `until`, `limit`) — a wider
  set than this Arc's own "minimum NIP-01 fields" instruction (Alpha
  223) asks for, and it is coupled to `RelayAdapter.query()`, a
  request/response shape this Arc's own Goals never name.
- **`src/nostr/ws_relay.ts`** — `WebSocketRelayAdapter`. Opens a
  short-lived socket per `query()` call, sends
  `["REQ", subId, ...filters]`, collects `["EVENT", ...]` until
  `["EOSE", ...]` or a timeout, then sends `["CLOSE", subId]`. This is
  the CLOSEST pre-existing analog to this Arc's own REQ/CLOSE
  generation (Alpha 224/225), but it is inseparable from its own
  short-lived, auto-closing `query()` contract, and from `NostrEvent`
  (`src/nostr/types.ts`) rather than the Desktop Runtime Boundary's own
  `FedosEventDescriptor` (Alpha 202).
- **`src/nostr/messages.ts`** — `parseRelayMessage`/`isEventMessage`/
  `isEoseMessage`/`isNoticeMessage`. A pure `EVENT`/`EOSE`/`NOTICE`
  parser. This Arc's own Goals list names no event-delivery capability
  at all — "REQ message generation," "CLOSE message generation,"
  "Subscription lifecycle," and "Filter representation" are every one
  an OUTBOUND or bookkeeping concern, never an inbound-message-parsing
  one. `messages.ts` therefore has no counterpart to be built THIS Arc.

`src/desktop/fedos_relay.ts`/`null_relay.ts`/`websocket_relay.ts`
(Alpha 212–216, the Relay Foundation) also pre-exist and are directly
relevant: `FedosRelay` already names `connect`/`disconnect`/
`isConnected`/`publish`, and Alpha 219 §3 (Relay Foundation Arc) already
previewed exactly how a Subscription capability would extend it — an
ADDITIVE method pair, never a reshaping of the four existing methods.

## 3. Why the `src/nostr/*` three are not reusable for this Arc

All three are built around a REQUEST/RESPONSE `query()` contract, an
eight-field Filter vocabulary wider than this Arc's own "minimum"
instruction, and (for `ws_relay.ts`/`messages.ts`) full `EVENT`/`EOSE`
message processing this Arc's own Goals list never asks for. All three
operate on `NostrEvent`/`RelayAdapter` (`src/nostr/types.ts`,
`src/nostr/relay.ts`), never the Desktop-owned `FedosRelay`/
`FedosEventDescriptor` boundary (Alpha 212/202). Reusing any of the
three would mean either (a) importing an inbound-message-parsing
machinery this Arc's own Goals list never names, or (b) coupling the
NEW Desktop-owned Subscription boundary to the legacy `src/nostr/*`
stack — a coupling every prior Arc's own HARD GUARDRAILS have
consistently forbidden (Alpha 211 §3, reconfirmed here).

## 4. Decision

This Arc builds a NEW, minimal, Desktop-owned Subscription boundary,
entirely independent of `src/nostr/*`, extending the EXISTING
`FedosRelay` (Alpha 212–216) additively, exactly as Alpha 219 §3
already previewed:

- `FedosSubscription` (Alpha 222) — an opaque identifier-only type,
  mirroring `FedosRelay`'s own original "one field, nothing else yet"
  shape (Alpha 212).
- `FedosSubscriptionFilter` (Alpha 223) — a NEW, independent type
  naming the minimum NIP-01 REQ filter fields (`ids`, `authors`,
  `kinds`, `since`, `until`, `limit`) — no `#e`/`#p`/generic tag field.
- `buildReqMessage`/`buildCloseMessage` (Alpha 224/225,
  `subscription_messages.ts`) — pure wire-message builders, transport
  only, no event processing.
- `FedosRelay.subscribe()`/`unsubscribe()` (Alpha 226) — an ADDITIVE
  method pair, implemented by `WebSocketRelay` (real `socket.send`,
  Alpha 226) and `NullRelay` (in-memory bookkeeping, Alpha 226).
- No inbound `EVENT`/`EOSE`/`NOTICE` parsing, no `RelayAdapter.query()`
  request/response shape, and no Relay Pool anywhere in this Arc's own
  three/four new or extended files.

All new files live under `src/desktop/`, matching "Desktop owns
subscriptions" (this Arc's own Alpha 228 instruction, previewed here).

## 5. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement `FedosSubscription`, `FedosSubscriptionFilter`,
  `buildReqMessage`, `buildCloseMessage`, `subscribe()`, or
  `unsubscribe()` — Alpha 222–226's own deliverables.
- Does **not** modify `src/nostr/relay.ts`, `ws_relay.ts`,
  `messages.ts`, `publish.ts`, or `src/sign/*` — all four remain
  exactly as they were, confirmed unmodified.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/desktop_application.ts`,
  `create_desktop_application.ts`, Storage, Observation, `Cargo.toml`,
  or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_220_relay_foundation_completion.md`
- `docs/secure_runtime_alpha_219_relay_extensibility_review.md`
- `docs/secure_runtime_alpha_211_relay_code_review.md`
- `docs/secure_runtime_alpha_212_relay_interface.md`
