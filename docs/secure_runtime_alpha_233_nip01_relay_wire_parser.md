# Secure Runtime Alpha 233 — NIP-01 Relay Wire Parser

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/relay_inbound_parser.ts`. This is Stage 3 of the Alpha
231–240 Nostr Relay Message Reception Arc, following Alpha 232's own
`FedosRelayInboundMessage` union and Alpha 234's own
`FedosNostrWireEvent` (both landed in this same commit).**

## 1. Why now

`WebSocketRelay`'s own future `"message"` handler (Alpha 235) needs a
PURE function turning an untrusted, already-JSON-decoded value into a
`FedosRelayInboundMessage` or `null`. This Stage builds exactly that,
before Alpha 235 wires it into a real socket callback.

## 2. What was implemented

```ts
export function parseRelayInboundMessage(
  input: unknown,
): FedosRelayInboundMessage | null
```

Supports exactly four shapes:

- `["EVENT", subscriptionId, event]` → `FedosRelayEventMessage`
- `["EOSE", subscriptionId]` → `FedosRelayEoseMessage`
- `["OK", eventId, accepted, message]` → `FedosRelayOkMessage`
- `["NOTICE", message]` → `FedosRelayNoticeMessage`

Anything else — non-array input, empty array, non-string tag, wrong
item count, wrong field type, malformed nested event object, an
unrecognized tag — returns `null`.

## 3. Validation performed, item by item (this Arc's own Alpha 233
   checklist)

- **Top-level array shape.** `Array.isArray(input) && input.length > 0`.
- **Exact message tag.** `input[0]` must be a `string` matching one of
  the four known labels via `switch`; anything else falls to `default:
  return null`.
- **Required item count.** Each branch checks `input.length` against
  the EXACT count NIP-01 defines (3 for EVENT, 2 for EOSE, 4 for OK, 2
  for NOTICE) — neither fewer NOR extra items are accepted.
- **Subscription ID type.** `typeof subscriptionId === "string" &&
  subscriptionId.length > 0` for both EVENT and EOSE.
- **Event ID type.** `typeof eventId === "string"` AND a 64-character
  lowercase-hex match, for OK's own `eventId`, and (inside
  `parseWireEvent`) for the nested event's own `id`.
- **Boolean `accepted` field.** `typeof accepted === "boolean"` — a
  truthy/falsy NON-boolean (e.g. `1`, `"true"`) is rejected, not
  coerced.
- **NOTICE/OK message field type.** `typeof message === "string"` for
  both.
- **Event object required fields.** `parseWireEvent` (private) checks
  all seven NIP-01 fields: `id`/`pubkey` (64-char hex),
  `created_at`/`kind` (non-negative integer), `tags` (array of
  string-arrays), `content` (string), `sig` (128-char hex) — the SAME
  per-field discipline `validateEventStructure` (`src/nostr/event.ts`)
  already established, reused as an IDIOM only (Alpha 231 §3.1).
- **No implicit coercion.** Every check uses `typeof`/`Number.isInteger`/
  exact-length regex — never `==`, never `Boolean(...)`, never
  `Number(...)`.
- **No thrown exception.** The entire function body is wrapped in one
  outer `try`/`catch` returning `null` on any unexpected error, on top
  of the fact that no branch performs an operation capable of throwing
  under normal conditions (defense in depth).
- **`null` for malformed input.** Confirmed: every failure path returns
  `null`, never `undefined`, never a partially-filled object.

## 4. Cryptographic verification — explicitly NOT implemented here

This Arc's own Alpha 233 instruction states: "Do not implement EVENT
cryptographic verification in this Stage unless an existing reusable
verifier is already available and its use is explicitly justified."
Alpha 231 §3.4 found `NobleSignatureVerifier` IS real and reusable —
but justifying its use here would require accepting the legacy
`NostrEvent` shape (or building an adapter) inside what this Arc's own
Boundary Requirements insist stays a clean, independent Desktop
boundary, and would contradict Alpha 240's own Completion Declaration,
which explicitly defers "cryptographic validation of received Events"
to the NEXT Arc. **Parsing success here means "structurally a NIP-01
message." It NEVER means the event's signature has been checked, or
that its `id` matches a recomputed hash of its own contents.** A
caller MUST treat every `FedosRelayEventMessage` this function returns
as unverified.

## 5. Structural confirmation (real inspection, this Stage)

- `parseRelayInboundMessage` is the ONLY export.
- Zero `await`, zero `Promise`, zero `async` keyword anywhere in this
  file — the function is fully synchronous.
- Zero reference to `schnorr`, `NobleSignatureVerifier`, `sha256`, or
  any hashing/signature primitive of any kind.
- Zero reference to `src/nostr/*` or `src/sign/*` anywhere in this
  file.

## 6. What this Stage does NOT do

- Does **not** perform cryptographic signature verification or event-id
  recomputation of any kind (§4).
- Does **not** wire this function into `WebSocketRelay` — Alpha 235's
  own deliverable.
- Does **not** decode a raw JSON string — the caller (Alpha 235) is
  responsible for `JSON.parse` and its own malformed-JSON handling.
- Does **not** modify `fedos_relay.ts`, `null_relay.ts`,
  `websocket_relay.ts`, `src/nostr/*`, `src/sign/*`,
  `create_runtime.ts`, `types.ts`, `AppRuntime`, `worker.ts`,
  `src/identity/*`, `desktop_application.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_232_relay_inbound_message_model.md`
- `docs/secure_runtime_alpha_234_inbound_event_representation.md`
- `docs/secure_runtime_alpha_231_existing_relay_inbound_inventory.md`
- `docs/secure_runtime_alpha_235_websocket_inbound_wiring.md`
