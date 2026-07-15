# Secure Runtime Alpha 442 — Nostr Signing Request Model

Phase B, Stage 2. Finalizes `FedosNostrUnsignedEventRequest`
(`src/nostr/sign/fedos_nostr_signing_authority.ts`), matching this
Arc's own candidate exactly:

```ts
export interface FedosNostrUnsignedEventRequest {
  readonly accountIndex: number;
  readonly createdAt: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
}
```

## V1 policy, enforced by `isWellFormedFedosNostrUnsignedEventRequest()`

- `kind` is fixed to `1` — Alpha 424's own scope decision, unchanged;
  no prior decision approved more.
- `accountIndex` validated as a `u32` (integer, `0..=4294967295`).
- `createdAt` validated as Unix seconds — finite, non-negative integer.
- No `pubkey`/`id`/`sig` field exists on this type at all (not merely
  "ignored if present" — the validator rejects any object with more
  than exactly these five keys, so a caller cannot even smuggle an
  extra field through).
- No Relay destination, no Outbox data — this type carries only what a
  signature needs.
- No arbitrary metadata — the five-key-exact check above forbids it.
- `freezeFedosNostrUnsignedEventRequest()` deep-copies and
  `Object.freeze`s the request (each `tags` sub-array copied and frozen
  individually), severing any shared reference to the caller's own
  still-mutable array, matching `combined_inbound_event_validator.ts`'s
  own established deep-freeze discipline for a structurally analogous
  problem.
- Malformed requests are rejected — `isWellFormedFedosNostrUnsignedEventRequest`
  returns `false` (never throws) for wrong types, extra/missing keys,
  out-of-range `accountIndex`/`createdAt`, `kind !== 1`, an empty tag,
  or a tag field containing this Arc's own reserved wire separator
  (U+0001 — see below).

## Wire encoding across the WASM boundary

`wasm-bindgen`'s natively-supported vector type is `Vec<String>`, not a
nested `Vec<Vec<String>>` — `tags` is flattened to `string[]` by
joining each tag's own fields with U+0001 (a control character no
legitimate Nostr tag field can contain) before crossing into
`sign_nostr_event()`, and parsed back into `Vec<Vec<String>>` inside
Rust (`fedos_parse_nostr_tags_wire_format`, `lib.rs`) — verified
round-trip in `sign_nostr_event_multi_field_tags_round_trip_through_the_wire_separator`.
The TypeScript-side validator rejects any tag field that already
contains U+0001 BEFORE flattening, so Rust never has to guess whether a
split point was real content or the delimiter.
