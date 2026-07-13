# Secure Runtime Alpha 241 — Existing Inbound Validation Inventory

**Status: this Stage is REVIEW ONLY. It makes NO code change of any
kind — no `src/` file, no `packages/` file, is modified. This is
Stage 1 of the Alpha 241–250 Nostr Inbound Event Validation Arc,
following the completed Nostr Relay Message Reception Arc (Alpha
231–240).**

## 1. Why now

Alpha 240 §3 (Relay Message Reception Arc) explicitly recommended this
exact Arc as its own next candidate: `parseRelayInboundMessage`
(Alpha 233) validates only STRUCTURE — a parsed `FedosNostrWireEvent`
is not yet trusted. Before Alpha 242 introduces anything new, this
Stage inspects every file this Arc's own Alpha 241 instruction names,
by direct reading, and answers all seven required questions precisely.

## 2. Files inspected, by direct reading

- **`src/nostr/crypto.ts`** — `webCryptoSha256Hex` (WebCrypto-backed
  SHA-256, injectable), `constantTimeHexEqual` (length-constant hex
  compare).
- **`src/nostr/noble_signature.ts`** — `NobleSignatureVerifier`,
  `isValidHex`. `verify(event: NostrEvent)`: validates hex shapes,
  RECOMPUTES the id via `serializeForId` and requires an exact match,
  THEN calls `schnorr.verify`. Real, working BIP-340 verification via
  `@noble/curves`.
- **`src/nostr/event.ts`** — `serializeForId` (builds the NIP-01
  five-element pre-image via `JSON.stringify`), `computeEventId`,
  `verifyEventId`. Its OWN doc comment already documents a real
  limitation (§3 below).
- **`packages/fedos-core-rust/src/lib.rs`** — `nostr_event_encoding`
  module (`serialize_nostr_event_canonical_internal`,
  `escape_json_string_internal`, `serialize_tags_internal`), `pub(crate)
  fn`, nested inside `master_root`. Implements NIP-01's own SIX-character
  escape rule exactly (Alpha 193). Every `k256::schnorr::...::verify_prehash`
  call in this file lives inside a `#[cfg(test)] mod tests` block —
  confirmed by direct inspection, none is `pub(crate)`, none is
  `#[wasm_bindgen]`.
- **Outbound canonical NIP-01 serialization** — Rust-side
  (`escape_json_string_internal`, Alpha 193) implements ONLY the six
  NIP-01 characters; everything else (including non-ASCII UTF-8)
  passes through verbatim.
- **Outbound Event ID derivation** — `derive_nostr_event_id_internal`
  (Alpha 194, Rust), SHA-256 of the Rust canonical serialization.
- **Outbound BIP-340 signing/verification tests** — `#[cfg(test)]`
  functions in `lib.rs` (Alpha 183/186/195/196) reconstruct a
  `k256::schnorr::VerifyingKey` and call `.verify_prehash(...)`
  ONLY to confirm the OUTBOUND signer's own correctness — never
  reachable outside the test module.
- **`FedosNostrWireEvent`** (`src/desktop/fedos_nostr_wire_event.ts`,
  Alpha 234) — the seven NIP-01 wire fields, verbatim names, no
  `provider`.
- **Legacy `NostrEvent`/`SignedNostrEvent`** (`src/nostr/types.ts`,
  `src/sign/types.ts`) — same seven fields; `SignedNostrEvent` extends
  `UnsignedNostrEvent`, shaped for the OUTBOUND signing flow.
- **Current `WebSocketRelay` inbound delivery path**
  (`src/desktop/websocket_relay.ts`, Alpha 235/236/238) —
  `#handleSocketMessage` parses via `parseRelayInboundMessage`, routes
  `"event"`/`"eose"` to `#subscriptionListeners` by subscription id, and
  `"ok"`/`"notice"` to `#relayListener`. Zero cryptographic verification
  of any kind exists anywhere in this path — confirmed structurally
  (Alpha 240 §3, reconfirmed here).

## 3. Answers to the seven required questions

### 3.1 Which existing validator can be reused?

**None of the two full validators as-is; one small pure helper could
be, but this Arc writes its own instead (§7).** `verifyEventId` and
`NobleSignatureVerifier` are both built around `serializeForId`'s own
`JSON.stringify`-based pre-image, which is WIDER than NIP-01's own
escaping rule (see §3.3). Reusing either directly would inherit that
divergence for inbound events from arbitrary Nostr clients.
`constantTimeHexEqual` is a genuinely reusable PURE helper in
principle, but comparing a locally-computed hash against a PUBLIC,
already-broadcast event id involves no secret material — a
constant-time compare is not a real requirement here, so this Arc's
own new files use a plain `===` and avoid importing from `src/nostr/*`
at all, keeping the Desktop boundary's zero-coupling discipline fully
intact (every new Desktop file across three prior Arcs already
maintains "NO reference to `src/nostr/*`").

### 3.2 Do TypeScript and Rust canonical serialization agree?

**No, not as they exist today.** Rust's `escape_json_string_internal`
(Alpha 193) escapes EXACTLY NIP-01's own six characters. TypeScript's
`serializeForId` (`JSON.stringify`) escapes those six PLUS every other
C0 control character as `\uXXXX`. For any event whose `content`/tags/
pubkey never contains such a rare control character, both agree; for
one that does, they diverge. This Arc's own new `verifyNostrEventId`
(Alpha 243) implements the Rust algorithm's own rule exactly in
TypeScript, independently, closing this gap for the inbound path —
confirmed by Alpha 248's own known-answer tests, including exactly the
canonicalization edge cases (quotes, backslash, newline, CR, tab,
backspace, form feed, non-ASCII UTF-8) this Arc's own Alpha 248
instruction lists.

### 3.3 Is current TS escaping behavior safe for inbound verification?

**No.** `serializeForId`'s own doc comment already states the
divergence is acceptable only because "Edge cases around exotic
escaping can be hardened ... if we ever compute ids for outbound
events" (Stage 1's own words) — i.e., it was scoped to VERIFYING THIS
REPOSITORY'S OWN, freshly-generated outbound events, which this
repository's own signer would never construct with an unusual C0
control character. An INBOUND event may come from any Nostr client
implementation, and NIP-01 itself does not forbid content containing a
literal, unescaped-in-the-six-character-sense control byte — using
`JSON.stringify`-based serialization here could cause a valid event to
FAIL id verification. This is exactly the divergence this Arc's own
Alpha 243 instruction requires be "explicitly reconciled" — reconciled
here by writing a NEW, correct implementation rather than reusing the
unsafe one.

### 3.4 Can signature verification remain TypeScript-side?

**Yes.** `@noble/curves`'s own `schnorr.verify` is a pure function over
three byte arrays (signature, message, x-only pubkey) — it has no
canonicalization step of its own and is therefore NOT affected by the
escaping divergence found in §3.2/§3.3 (that divergence only affects
RECOMPUTING the id from the event body, a step this Arc's own Alpha 244
verifier deliberately does NOT perform — see Alpha 244's own doc
comment). Calling it directly with an already-verified `event.id`
(Alpha 243's own job) and `event.pubkey`/`event.sig` is safe, and
requires no Rust boundary.

### 3.5 Is a Rust boundary needed?

**No.** §2 already confirms no `pub(crate)`, let alone `#[wasm_bindgen]`,
Schnorr-verification function exists anywhere in `lib.rs` reachable
from TypeScript. Building one would require a NEW wasm export — this
Arc's own instruction requires stopping and reporting before doing
that, and no inventory finding here proves it necessary: `@noble/curves`
(already present) provides the exact same primitive.

### 3.6 Is any dependency change required?

**No.** `@noble/curves` and `@noble/hashes` are BOTH already-declared
`package.json` dependencies (unchanged since before Alpha 8, the
Schnorr signature verification Stage). `package.json`'s own
`dependencies` count stays fixed at 2 across this whole Arc.

### 3.7 Which existing code is read/verify-only versus outbound-signing-oriented?

**Read/verify-only:** `verifyEventId`/`computeEventId`/`serializeForId`
(`src/nostr/event.ts`), `NobleSignatureVerifier`/`isValidHex`
(`src/nostr/noble_signature.ts`), `constantTimeHexEqual`
(`src/nostr/crypto.ts`) — all verify an ALREADY-CONSTRUCTED event; none
signs or derives a key. **Outbound-signing-oriented:**
`packages/fedos-core-rust/src/lib.rs`'s own `nostr_event_encoding`/
`derive_nostr_event_id_internal`/`derive_nostr_signature_internal`
chain (Alpha 192–195) and `src/sign/*` (`EventSigner`,
`UnsignedNostrEvent` → `SignedNostrEvent`, NIP-07 delegation) — both
exist to PRODUCE a signed event, never to validate one received from a
relay.

## 4. Decision

This Arc builds a NEW, minimal, Desktop-owned validation boundary,
entirely independent of `src/nostr/*`/`src/sign/*`, consuming ONLY the
already-present `@noble/curves`/`@noble/hashes` primitives:

- `FedosValidatedNostrEvent` (Alpha 242) — a distinct, convention-owned
  type.
- `verifyNostrEventId` (Alpha 243) — a NEW, correct canonical
  serializer + SHA-256 comparison, reconciling the `JSON.stringify`
  divergence found in §3.2/§3.3.
- `verifyNostrEventSignature` (Alpha 244) — calls `schnorr.verify`
  directly (Option C, §3.4), never wraps `NobleSignatureVerifier`.
- `validateInboundNostrEvent` (Alpha 245) — the single combined entry
  point, id-then-signature, `null` on any failure.
- `createValidatedEventListener` (Alpha 246) — an external adapter over
  the EXISTING `onSubscriptionMessage()` (Alpha 236, unchanged), never
  a new `FedosRelay` method or a change inside `WebSocketRelay`.
- Zero Rust/Cargo change, zero new dependency, zero reference to
  `src/nostr/*`/`src/sign/*` anywhere in this Arc's own new files.

## 5. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement `FedosValidatedNostrEvent`,
  `verifyNostrEventId`, `verifyNostrEventSignature`,
  `validateInboundNostrEvent`, or `createValidatedEventListener` —
  Alpha 242–246's own deliverables.
- Does **not** modify `src/nostr/*`, `src/sign/*`, or
  `packages/fedos-core-rust/src/lib.rs` — all remain exactly as they
  were, confirmed unmodified.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/websocket_relay.ts`,
  `fedos_relay.ts`, `null_relay.ts`, `desktop_application.ts`, Storage,
  Observation, `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_240_relay_reception_completion.md`
- `docs/secure_runtime_alpha_234_inbound_event_representation.md`
- `docs/secure_runtime_alpha_233_nip01_relay_wire_parser.md`
- `docs/secure_runtime_alpha_193_canonical_event_serialization.md`
- `docs/secure_runtime_alpha_191_nostr_event_model_inventory.md`
