# Secure Runtime Alpha 234 — Inbound Event Representation

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/fedos_nostr_wire_event.ts`. This is Stage 4 of the Alpha
231–240 Nostr Relay Message Reception Arc — though, as with Alpha 219's
own forward reference one Arc ago, its own type is consumed by Alpha
232's `FedosRelayInboundMessage`, both landing in this Arc's single
commit.**

## 1. Why now

Alpha 232's own `FedosRelayEventMessage.event` field needs a concrete
type. This Stage decides exactly which one, comparing the four options
this Arc's own Alpha 234 instruction names.

## 2. Options compared

**A. Reuse `FedosEventDescriptor` directly.** REJECTED. Alpha 231 §3.3
confirmed two independent problems: it requires a `provider: string`
field with NO source on the wire (a NIP-01 `EVENT` payload carries
exactly seven fields; synthesizing an eighth would be a guess dressed
as a fact), and it RENAMES every field (`pubkey`→`author`,
`created_at`→`createdAt`, `sig`→`signature`) — directly against this
Arc's own instruction, "Do not rename away protocol semantics at the
parser boundary."

**B. Introduce a dedicated `FedosNostrWireEvent`.** **ADOPTED.**

**C. Reuse the legacy `SignedNostrEvent`
(`src/sign/types.ts`).** REJECTED. `SignedNostrEvent` is owned by the
`src/sign`/`src/nostr` stack this Arc's own Boundary Requirements
forbid silently mixing into the Desktop boundary ("keep ownership and
types explicit"). It is also shaped for the OUTBOUND signing flow
(`extends UnsignedNostrEvent`), never inbound reception — reusing it
would blur two directions of data flow that should stay visibly
distinct.

**D. Expose the raw `unknown` object.** REJECTED. This would throw away
the exact structural guarantee `parseRelayInboundMessage` (Alpha 233)
just spent seven field checks establishing — every downstream consumer
(a subscription listener, Alpha 236) would need to re-validate the
shape itself, or trust an unvalidated value. "Parsing success must not
imply cryptographic validity" (Alpha 233 §4) is not the same claim as
"parsing success implies nothing at all" — structural validity is a
real, useful, already-paid-for guarantee that Option D would discard.

## 3. What was implemented

```ts
export interface FedosNostrWireEvent {
  readonly id: string;
  readonly pubkey: string;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
  readonly sig: string;
}
```

All seven NIP-01 field NAMES preserved verbatim — no rename, no drop,
no synthesized field. This is a SEPARATE, independent type from
`FedosEventDescriptor` (Alpha 202) — this Arc builds NO adapter mapping
one onto the other, since doing so would misrepresent an UNVALIDATED
wire event as `FedosEventDescriptor`'s own documented "already-signed
Event data." Alpha 240 §3 (this Arc's own completion) states plainly:
"A later adapter may map it to `FedosEventDescriptor`" — a FUTURE
Stage's own job, once cryptographic validation exists to make that
mapping honest.

## 4. Structural confirmation (real inspection, this Stage)

- `FedosNostrWireEvent` is the ONLY export.
- Field count: exactly 7, matching NIP-01's own wire shape exactly.
- Every field is `readonly`.
- Zero `provider` field, zero synthesized/derived field of any kind.
- Zero import exists in this file — depends on nothing, matching
  `FedosSubscription`'s (Alpha 222) own zero-import precedent.
- Zero function, zero class, zero validation logic of any kind — this
  file defines a TYPE ONLY.

## 5. What this Stage does NOT do

- Does **not** implement `parseRelayInboundMessage` or
  `FedosRelayInboundMessage` — Alpha 232/233's own deliverables (landed
  in the same commit).
- Does **not** build an adapter from `FedosNostrWireEvent` to
  `FedosEventDescriptor` — explicitly deferred to a future,
  validation-capable Stage (§3).
- Does **not** perform any structural or cryptographic validation of
  its own — that is exclusively `relay_inbound_parser.ts`'s concern
  (Alpha 233).
- Does **not** modify `fedos_event_descriptor.ts`, `fedos_relay.ts`,
  `null_relay.ts`, `websocket_relay.ts`, `src/nostr/*`, `src/sign/*`,
  `create_runtime.ts`, `types.ts`, `AppRuntime`, `worker.ts`,
  `src/identity/*`, `desktop_application.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_232_relay_inbound_message_model.md`
- `docs/secure_runtime_alpha_233_nip01_relay_wire_parser.md`
- `docs/secure_runtime_alpha_231_existing_relay_inbound_inventory.md`
- `docs/secure_runtime_alpha_202_desktop_facing_event_reader_abstraction.md`
