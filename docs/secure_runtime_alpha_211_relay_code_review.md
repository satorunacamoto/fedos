# Secure Runtime Alpha 211 — Existing Relay Code Review

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 1 of the Alpha 211–220 Nostr Relay Foundation Arc, following the
completed Nostr Event Runtime Exposure Arc (Alpha 201–210).**

## 1. Why now

This Arc's own Objective asks for "the first real Relay transport
foundation" — implying none exists yet at the Desktop Runtime Boundary
today. Before Alpha 212 introduces anything new, this Stage inventories
every Relay-shaped file already in this repository, by direct
inspection, to confirm that claim and to decide what (if anything) can
be reused, the SAME discipline Alpha 191/201 already applied to the
Event and Event-Runtime-Exposure Arcs before either began.

## 2. What already exists — `src/nostr/*`, confirmed by direct
   inspection

Four pre-existing files implement Relay-shaped behavior, none of them
touched by any Alpha-numbered Stage so far:

- **`src/nostr/relay.ts`** — `RelayAdapter`/`NostrFilter`/
  `InMemoryRelayAdapter`. A READ-ONLY, FILTER-and-QUERY-oriented
  contract: `query(filters: NostrFilter[]): Promise<NostrEvent[]>`.
  Built entirely around NIP-01 REQ filters (`ids`/`authors`/`kinds`/
  `#e`/`#p`/`since`/`until`/`limit`) — exactly the Filters vocabulary
  this Arc's own instruction list excludes.
- **`src/nostr/ws_relay.ts`** — `WebSocketRelayAdapter`. Opens a
  short-lived socket per call, sends `["REQ", subId, ...filters]`,
  collects `["EVENT", ...]` messages until `["EOSE", ...]` or a
  timeout, then sends `["CLOSE", subId]` and closes the socket. Built
  entirely around REQ/EOSE/CLOSE — exactly the vocabulary this Arc's
  own instruction list excludes (REQ, CLOSE, Subscription). Its own
  doc comment states plainly: "This adapter NEVER publishes events. It
  is read-only."
- **`src/nostr/publish.ts`** — `RelayPublisher`/`WebSocketRelayPublisher`/
  `MockRelayPublisher`. The write-path counterpart: sends
  `["EVENT", event]`, then WAITS for the relay's NIP-20
  `["OK", id, accepted, message]` acknowledgement before resolving.
  This Arc's own Alpha 216 instruction states plainly "No ACK
  handling" — the opposite of this file's own entire design, whose
  `PublishResult` type exists specifically to carry that ACK.
- **`src/nostr/messages.ts`** — `parseRelayMessage`/`isEventMessage`/
  `isEoseMessage`/`isNoticeMessage`. A pure EVENT/EOSE/NOTICE message
  parser feeding the two adapters above — inseparable from the
  REQ/EOSE/CLOSE subscription flow both exclude.

`src/sign/nip07.ts` also pre-exists (a NIP-07 browser-extension-signer
shape) — unrelated to Relay transport, and explicitly excluded from
this Arc's own scope regardless (NIP-07 is on this Arc's own "Do NOT
implement" list).

## 3. Why none of the four is reusable for this Arc

Every one of the four is built around a REQ/EOSE/CLOSE subscription
flow, a NIP-01 Filter vocabulary, or an OK/ACK-waiting publish
contract — all four explicitly EXCLUDED by this Arc's own instruction
list (REQ, CLOSE, Subscription, Filters; "No ACK handling"). None of
the four is reachable from, or references, the Desktop Runtime
Boundary this Arc must build against (`FedosEventDescriptor`, Alpha
202) — all four operate on the OLDER, pre-Alpha `NostrEvent`/
`SignedNostrEvent` shapes (`src/nostr/types.ts`, `src/sign/types.js`),
never the protocol-independent Descriptor the Desktop Runtime Boundary
Arc (Alpha 201–210) established. Reusing any of the four would mean
either (a) importing REQ/EOSE/CLOSE/Filter machinery this Arc's own
instruction forbids, or (b) coupling the new Desktop-owned Relay
boundary to the legacy `src/nostr/*`/`src/sign/*` stack — a coupling
every prior Arc's own HARD GUARDRAILS have consistently forbidden
(Alpha 101 §HARD GUARDRAILS, Alpha 202 §HARD GUARDRAILS: "NO reference
to `src/nostr/relay.ts`, `src/nostr/ws_relay.ts`, ... anywhere in this
file").

## 4. Decision

This Arc builds a NEW, minimal, Desktop-owned Relay boundary, entirely
independent of `src/nostr/*`/`src/sign/*`, mirroring the SAME
"TypeScript-only, mirror the established Reader precedent" decision
Alpha 201 §5 already made for the Event Reader boundary:

- `FedosRelay` (Alpha 212) — a protocol-independent interface naming
  exactly ONE connection target (a single `url`), never a pool.
- `NullRelay` (Alpha 213) — a dependency-free implementation, no
  networking.
- `WebSocketRelay` (Alpha 214/215/216) — a real implementation,
  connecting via an INJECTED socket factory (never a hardcoded
  `new WebSocket()` call), publishing `FedosEventDescriptor` values
  (Alpha 202, REUSED, not redesigned) as NIP-01 wire JSON — mapping
  `author`→`pubkey`, `createdAt`→`created_at`, `signature`→`sig`
  internally, since a Relay is, by definition, a Nostr-wire-protocol
  boundary, exactly as `NostrPublicIdentityReader` (Alpha 103) was
  legitimately Nostr-specific internally while conforming to a
  protocol-neutral interface.
- No REQ, CLOSE, Subscription, Filter, or ACK/OK-waiting vocabulary
  anywhere in any of the three new files.

All three new files live under `src/desktop/`, matching "Desktop owns
Relay" (this Arc's own Alpha 218 instruction, previewed here).

## 5. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement `FedosRelay`, `NullRelay`, or `WebSocketRelay`
  — Alpha 212/213/214's own deliverables.
- Does **not** modify `src/nostr/relay.ts`, `ws_relay.ts`,
  `publish.ts`, `messages.ts`, or `src/sign/*` — all four remain
  exactly as they were, confirmed unmodified.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, Storage,
  Observation, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_201_event_runtime_exposure_review.md`
- `docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md`
- `docs/secure_runtime_alpha_210_event_runtime_boundary_completion.md`
- `docs/secure_runtime_alpha_101_public_identity_reader_interface.md`
