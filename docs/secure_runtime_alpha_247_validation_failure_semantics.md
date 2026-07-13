# Secure Runtime Alpha 247 — Validation Failure Semantics

**Status: this Stage is REVIEW ONLY. It makes NO further code change —
the fail-closed, indistinguishable-failure mechanism already exists,
built by Alpha 245/246 (landed in this same commit). This is Stage 7
of the Alpha 241–250 Nostr Inbound Event Validation Arc, following
Alpha 246's own Validated Subscription Delivery.**

## 1. Why now

This Arc's own Alpha 247 instruction requires EVERY failure cause it
lists be indistinguishable at the validated-event boundary. This Stage
reviews Alpha 243/244/245/246's own code against that FULL list
explicitly, confirming each cause collapses to the SAME outcome — the
SAME "review a capability's own semantics explicitly, never assume
they generalize" discipline Alpha 237/219 (prior Arcs) already applied
to EOSE's own lifecycle and `publish()`'s own "no ACK handling"
contract.

## 2. All eight listed causes, confirmed indistinguishable

Every one of the following causes `validateInboundNostrEvent` (Alpha
245) to return `null`, and `createValidatedEventListener` (Alpha 246)
to call the wrapped listener ZERO times — confirmed by direct
inspection and by Alpha 248/249's own real-execution tests:

- **Wrong event id** — `verifyNostrEventId` (Alpha 243) recomputes the
  hash and finds it does not equal `event.id`; returns `false`.
- **Malformed event id** — `verifyNostrEventId`'s own `HEX_64.test(event.id)`
  guard fails before hashing is even attempted; returns `false`.
- **Wrong signature** — `verifyNostrEventSignature` (Alpha 244)'s own
  `schnorr.verify` call returns `false`.
- **Malformed signature** — `verifyNostrEventSignature`'s own
  exact-length hex guard on `sig` fails before `schnorr.verify` is
  called; returns `false`.
- **Malformed x-only pubkey** — `verifyNostrEventSignature`'s own
  exact-length hex guard on `pubkey` fails; returns `false`. (This same
  malformed pubkey ALSO fails `verifyNostrEventId`, if it is checked
  first and the pubkey participates in canonicalization — either path
  reaches the SAME `null`.)
- **Unsupported key encoding** — `FedosNostrWireEvent.pubkey`
  (Alpha 234) is a plain `string`; any encoding other than 64-char
  lowercase hex (Bech32 `npub1...`, uppercase hex, a different byte
  length) fails the SAME exact-length lowercase-hex guard — there is
  no second code path that would accept, partially accept, or
  interpret an alternate encoding.
- **Canonicalization mismatch** — any divergence between the id a
  relay CLAIMS and the id `verifyNostrEventId`'s own NIP-01-exact
  serializer computes fails the SAME hash comparison as "wrong event
  id" above — there is no separate "canonicalization error" code path.
- **Cryptographic verifier exception** — `verifyNostrEventId` and
  `verifyNostrEventSignature` are EACH individually wrapped in their
  own outer `try`/`catch` (Alpha 243/244), converting ANY unexpected
  internal error (a malformed byte array `@noble/curves` itself
  rejects, for instance) into a plain `false` — never a thrown
  exception reaching `validateInboundNostrEvent`, and therefore never
  a code path distinguishable from an ordinary verification failure.

## 3. Result, confirmed for every cause above

- **Event is dropped.** `createValidatedEventListener` (Alpha 246)
  returns from its own function with no further action.
- **No listener call.** Confirmed: the wrapped `FedosValidatedEventListener`
  is invoked ZERO times for a `null` validation result.
- **No automatic NOTICE.** Nothing in this Arc's own code SENDS a wire
  message of any kind in response to a failed validation — validation
  is entirely LOCAL and READ-ONLY; `socket.send` is never called from
  `combined_inbound_event_validator.ts` or
  `validated_subscription_adapter.ts`.
- **No Relay disconnect.** Neither file references `#connected`,
  `#socket`, or `disconnect()` in any way — a failed validation has
  zero effect on `WebSocketRelay`'s own connection state.
- **No retry.** Neither file re-sends a REQ, re-invokes the validator,
  or schedules any future action for a rejected event.
- **No storage.** Neither file writes to any persistent or in-memory
  store of any kind beyond the transient function-call stack.
- **No log requirement.** Zero `console.*` call exists anywhere in
  Alpha 242–246's own five new files.
- **Later valid events still deliver.** Confirmed by Alpha 249's own
  real-execution test: an invalid EVENT immediately followed by a
  valid EVENT for the SAME subscription still delivers the valid one
  to the validated listener.

## 4. No second Observation Framework

This Arc's own Alpha 247 instruction states: "Do not create a second
Observation Framework." Nothing in Alpha 242–246 adds logging, metrics,
telemetry, or an event-bus mechanism of any kind — a failed validation
produces NO observable side effect beyond the `null`/dropped-message
return value itself. The repository's own Observation Framework
(frozen, per this Arc's own Boundary Requirements) is untouched —
confirmed by `grep`: zero reference to it anywhere in this Arc's own
new files.

## 5. Internal test-only distinctions are permitted, production is not

This Arc's own instruction: "Internal test-only decisions may
distinguish causes, but production delivery must remain fail-closed
and coarse." Alpha 248's own known-answer/tamper tests DO call
`verifyNostrEventId`/`verifyNostrEventSignature` INDIVIDUALLY, in
addition to `validateInboundNostrEvent`, specifically so the TEST SUITE
itself can confirm each cause independently (Alpha 247 §2's own list)
— this is legitimate test-only introspection, never a distinction
`validateInboundNostrEvent`'s own PRODUCTION return type or
`createValidatedEventListener`'s own PRODUCTION listener contract ever
exposes.

## 6. What this Stage does NOT do

- Does **not** modify `combined_inbound_event_validator.ts`,
  `validated_subscription_adapter.ts`, `nostr_event_id_verifier.ts`,
  `nostr_signature_verifier.ts`, or `fedos_validated_nostr_event.ts` —
  the mechanism reviewed here was already complete as of Alpha 246
  (same commit); no further code change.
- Does **not** add a NOTICE-sending, logging, or retry mechanism of any
  kind.
- Does **not** modify `src/nostr/*`, `src/sign/*`, `create_runtime.ts`,
  `types.ts`, `AppRuntime`, `worker.ts`, `src/identity/*`,
  `desktop_application.ts`, Storage, Observation, `Cargo.toml`, or
  `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_246_validated_subscription_delivery.md`
- `docs/secure_runtime_alpha_245_combined_inbound_event_validator.md`
- `docs/secure_runtime_alpha_237_eose_lifecycle.md`
- `docs/secure_runtime_alpha_219_relay_extensibility_review.md`
- `docs/secure_runtime_alpha_248_known_answer_tamper_verification.md`
