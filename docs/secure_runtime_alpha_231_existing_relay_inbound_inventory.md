# Secure Runtime Alpha 231 — Existing Relay Inbound Inventory

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 1 of the Alpha 231–240 Nostr Relay Message Reception Arc,
following the completed Nostr Subscription Foundation Arc (Alpha
221–230).**

## 1. Why now

This Arc's own Objective asks for "the inbound half of the existing
single-Relay transport" — `FedosRelay`/`WebSocketRelay` (Alpha
212–226) can connect, publish, and open/close a subscription, but
never reads a single byte back. Before Alpha 232 introduces anything
new, this Stage inspects every file named in this Arc's own Alpha 231
instruction, by direct reading, to answer the five questions that
instruction poses precisely — the SAME discipline Alpha 211/221
already applied before their own Arcs began.

## 2. Files inspected, by direct reading

- **`src/nostr/relay.ts`** — `NostrFilter`/`RelayAdapter`/
  `InMemoryRelayAdapter`. A request/response `query()` contract; no
  message-category union of any kind.
- **`src/nostr/ws_relay.ts`** — `WebSocketRelayAdapter`. Sends REQ,
  collects `EVENT` into an array, resolves on `EOSE` or timeout, then
  sends CLOSE and closes the socket — a short-lived, one-shot
  subscription, never a long-lived listener registration.
- **`src/nostr/publish.ts`** — `RelayPublisher`/`WebSocketRelayPublisher`.
  Sends `["EVENT", event]`, WAITS for `["OK", id, accepted, message]`,
  via `parseOkMessage` (a pure, small OK-only parser).
- **`src/nostr/messages.ts`** — `parseRelayMessage`. A pure, total
  parser turning a raw JSON string into a tagged `RelayMessage`
  (`"event"|"eose"|"notice"|"unknown"|"invalid"`). Never throws.
- **`src/desktop/fedos_relay.ts`** (current) — `FedosRelay` names
  `url`/`connect`/`disconnect`/`isConnected`/`publish`/`subscribe`/
  `unsubscribe` (Alpha 212–226). Zero inbound method of any kind.
- **`src/desktop/websocket_relay.ts`** (current) — `WebSocketRelay`
  registers `"close"`/`"error"` listeners in `connect()`; NO
  `"message"` listener exists anywhere (confirmed by Alpha 216 §7 and
  Alpha 226 §7's own structural checks, both still green as of this
  Stage).
- **Current subscription code** — `fedos_subscription.ts`
  (`FedosSubscription`, opaque `{id}`), `fedos_subscription_filter.ts`
  (`FedosSubscriptionFilter`, six NIP-01 fields),
  `subscription_messages.ts` (`buildReqMessage`/`buildCloseMessage`,
  pure outbound wire builders). None of the three has any inbound
  concept.
- **`src/nostr/types.ts`** — `NostrEvent` (seven wire-named fields:
  `id`/`pubkey`/`created_at`/`kind`/`tags`/`content`/`sig`).
- **`src/sign/types.ts`** — `SignedNostrEvent` (extends
  `UnsignedNostrEvent`; same seven fields, OUTBOUND-signing-shaped).
- **`src/desktop/fedos_event_descriptor.ts`** — `FedosEventDescriptor`
  (`id`/`provider`/`author`/`createdAt`/`kind`/`tags`/`content`/
  `signature` — RENAMED, protocol-neutral fields, PLUS a `provider`
  field with no wire source).
- **`src/nostr/event.ts`** — `validateEventStructure` (pure structural
  check: hex-length id/pubkey/sig, integer created_at/kind, string-array
  tags, string content) and `verifyEventId` (recomputes the sha256 id
  hash — proves self-consistency, NOT authorship).
- **`src/nostr/signature.ts`** / **`src/nostr/noble_signature.ts`** —
  `SignatureVerifier` interface, `NoopSignatureVerifier`,
  `NobleSignatureVerifier` (REAL Schnorr verification via
  `@noble/curves`, already a `package.json` dependency).
- **`src/sign/validate.ts`** — `isSignedEventLike` (structural type
  guard, same field set as `validateEventStructure`).
- **Socket factory abstraction** — `FedosRelaySocketFactory` (current):
  `(url) => FedosRelaySocket | Promise<FedosRelaySocket>`, injected,
  never a hardcoded `new WebSocket()`.
- **WebSocket message-event shape used in tests** — every existing
  `fakeSocket()` helper (Alpha 214/215/216/217/226 test files) types
  `addEventListener(type: "close" | "error", listener: () => void)` —
  NO `"message"` case exists in any test double today.

## 3. Answers to the five required questions

### 3.1 What existing inbound logic is reusable

None of it is reusable AS CODE. `parseRelayMessage`
(`src/nostr/messages.ts`) and `parseOkMessage` (`src/nostr/publish.ts`)
are the closest matches in SHAPE (a pure, total, never-throwing parser
returning a tagged union or `null`) but both operate on the legacy
`NostrEvent`/`RelayMessage` types this Arc's own Boundary Requirements
forbid silently mixing into the new Desktop boundary. The IDIOM —
exact-length hex regexes, explicit `Array.isArray`/length/type checks,
one failure aborts the whole parse, never throw — is reusable and IS
reused (Alpha 233).

### 3.2 What is tied to the legacy relay stack

`src/nostr/relay.ts`/`ws_relay.ts`/`publish.ts`/`messages.ts` are ALL
tied to `NostrEvent` (`src/nostr/types.ts`) and to a request/response
(`query()`) or wait-for-ACK (`WebSocketRelayPublisher`) shape this
Arc's own Objective does not ask for — this Arc wants a long-lived
listener registration on an ALREADY-OPEN `WebSocketRelay`, not a new
one-shot adapter. `src/sign/types.ts`/`validate.ts` are tied to the
OUTBOUND signing flow (`UnsignedNostrEvent` → `SignedNostrEvent`).

### 3.3 Can `FedosEventDescriptor` honestly represent an inbound event?

**No.** Two independent problems, confirmed by direct reading of
`fedos_event_descriptor.ts`: (a) it requires a `provider: string` field
with NO source anywhere in a NIP-01 `["EVENT", subId, event]` payload —
inventing one at the parser boundary would be a guess, not a wire fact;
(b) it renames every field (`pubkey`→`author`, `created_at`→
`createdAt`, `sig`→`signature`), directly contradicting this Arc's own
Alpha 234 instruction, "Do not rename away protocol semantics at the
parser boundary." Alpha 234 §2 (this Arc) formalizes this finding and
adopts a dedicated `FedosNostrWireEvent` instead.

### 3.4 Does signature/event-ID validation already exist?

**Yes, both, but neither is reused THIS Arc.** `verifyEventId`
(`src/nostr/event.ts`) recomputes and compares the sha256 id hash.
`NobleSignatureVerifier` (`src/nostr/noble_signature.ts`) performs REAL
Schnorr signature verification using `@noble/curves` (already a
`package.json` dependency — reusing it would add NO new dependency).
Both are real, working, reusable-in-principle. This Arc does NOT wire
either in: Alpha 233's own instruction states "Do not implement EVENT
cryptographic verification in this Stage unless ... its use is
explicitly justified," and Alpha 240's own Completion Declaration
explicitly lists "cryptographic validation of received Events" as
still out of scope, naming the NEXT Arc (Nostr Inbound Event
Validation) as where that wiring belongs. Reusing `NobleSignatureVerifier`
here would also require accepting a legacy `NostrEvent` value where
this Arc's own `FedosNostrWireEvent` (Alpha 234) is a structurally
identical but INDEPENDENT type — a small, real adapter cost better
paid deliberately, in its own reviewed Stage, than folded silently into
this Arc's parser.

### 3.5 Can message parsing be implemented without dependencies?

**Yes.** Every check `parseRelayInboundMessage` (Alpha 233) needs —
`Array.isArray`, `typeof`, exact-length lowercase-hex regexes,
`Number.isInteger` — is plain JavaScript/TypeScript, matching
`validateEventStructure`'s own zero-dependency precedent exactly.
`package.json`'s own `dependencies` count stays fixed at 2 across this
whole Arc.

## 4. Decision

This Arc builds a NEW, minimal, Desktop-owned inbound message layer,
entirely independent of `src/nostr/*`/`src/sign/*`, extending the
EXISTING `FedosRelay`/`WebSocketRelay`/`NullRelay` (frozen connection
lifecycle/publish/subscribe/unsubscribe, per this Arc's own "MUST NOT
be redesigned" list) additively:

- `FedosNostrWireEvent` (Alpha 234) — dedicated, protocol-honest wire
  event representation (Option B of four compared).
- `FedosRelayInboundMessage` (Alpha 232) — a closed, four-member,
  fully-`readonly` discriminated union (EVENT/EOSE/OK/NOTICE).
- `parseRelayInboundMessage` (Alpha 233) — a pure, total, never-throwing
  parser, zero cryptographic verification.
- `WebSocketRelay` gains a `"message"` listener inside `connect()`
  (Alpha 235), and two ADDITIVE registration methods,
  `onSubscriptionMessage()`/`onRelayMessage()` (Alpha 236/238).
- No REQ/CLOSE/Subscription/Filter/publish/connect/disconnect/isConnected
  behavior is reshaped anywhere in this Arc.

All new files live under `src/desktop/`, matching "Desktop owns Relay
and subscription consumers" (this Arc's own Boundary Requirements).

## 5. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement `FedosRelayInboundMessage`,
  `parseRelayInboundMessage`, `FedosNostrWireEvent`, or any
  `WebSocketRelay` wiring — Alpha 232–238's own deliverables.
- Does **not** modify `src/nostr/*` or `src/sign/*` — all files remain
  exactly as they were, confirmed unmodified.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/desktop_application.ts`,
  Storage, Observation, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_230_subscription_foundation_completion.md`
- `docs/secure_runtime_alpha_226_subscription_lifecycle.md`
- `docs/secure_runtime_alpha_221_subscription_code_review.md`
- `docs/secure_runtime_alpha_211_relay_code_review.md`
