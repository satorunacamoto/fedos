# Secure Runtime Alpha 426 — Signed Event Output Model

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file is added,** for the same reason as
Alpha 425 (Phase B does not proceed past Alpha 427; an unconsumed
exported type would be dead code). Stage 5 of the Alpha 422–430 Arc,
Phase A. Defines the exact output shape a future Option A/D authority
must return, and settles the Arc's own reuse-vs-duplicate question.

## 1. Existing candidates reviewed for reuse (Alpha 422 §9)

Three existing TypeScript types already match `{id, pubkey, created_at,
kind, tags, content, sig}` field-for-field:

- `src/nostr/types.ts:NostrEvent` — legacy read-only-ingest era.
- `src/desktop/fedos_nostr_wire_event.ts:FedosNostrWireEvent` — the
  active `src/desktop/*` inbound wire shape, as parsed from a relay
  `["EVENT", ...]` payload.
- `src/desktop/fedos_validated_nostr_event.ts:FedosValidatedNostrEvent`
  — the active `src/desktop/*` post-verification shape, structurally
  identical to `FedosNostrWireEvent`, distinguished only by
  provenance/ownership convention (only `validateInboundNostrEvent`
  constructs it).

`FedosEventDescriptor` (`src/desktop/fedos_event_descriptor.ts`) does
**not** match — it deliberately renames every field
(`author`/`createdAt`/`signature`) for its own protocol-neutral read
purpose, and is out of scope here.

## 2. Decision — reuse the `FedosNostrWireEvent` shape; no fourth type

A brand-new `FedosSignedNostrEventDescriptor` type, field-for-field
identical to `FedosNostrWireEvent`, would be this repository's
**fourth** copy of the same seven-field shape. The Arc's own
instruction is explicit: "Do not introduce a fourth duplicate
signed-event model without inventory justification." No such
justification exists — the shapes are identical.

**A future implementation (if a Master Seed authority ever makes Alpha
427 unblockable — see the Alpha 430 doc) should have its signing
authority return a value structurally identical to
`FedosNostrWireEvent`**, either by importing that exact type from
`src/desktop/fedos_nostr_wire_event.ts` or, if that file's own
ownership boundary makes a direct import awkward for the new adapter
module, a `type FedosSignedNostrEventDescriptor = FedosNostrWireEvent`
alias — never a structurally independently redefined interface.

## 3. Candidate shape (for reference — matches `FedosNostrWireEvent` exactly)

```ts
export interface FedosSignedNostrEventDescriptor {
  readonly id: string;
  readonly pubkey: string;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
  readonly sig: string;
}
```

Field names are exactly the NIP-01 wire names (`snake_case` for
`created_at`), not the camelCase convention used elsewhere in
`src/desktop/*` (e.g. `FedosEventDescriptor.createdAt`) — required
because `verifyNostrEventId`/`verifyNostrEventSignature`/`validateInboundNostrEvent`
(Alpha 422 §12) already operate on exactly this field-name shape, and a
signed event produced by a future authority must be independently
verifiable through that SAME existing verifier without any field
renaming or adapter step.

## 4. Requirements carried forward (binding on whichever future Stage implements this)

- Immutable, deep-frozen at construction.
- No secret handle, no private byte, and no `npub` (a separate,
  already-existing encoder, Alpha 422 §2's `nostr_identifier_encoding`
  module) unless a future caller separately needs one.
- `id`/`sig` generated only by the Rust signing authority — never
  computed or recomputed in TypeScript before being trusted.
- Independently verifiable by the existing, unmodified
  `validateInboundNostrEvent` (Alpha 422 §12) — the strongest possible
  proof that the Rust-produced output and the TypeScript-side inbound
  verifier agree on the exact same wire format, byte for byte.
- No Relay metadata, no Outbox ID — the authority's output is a signed
  event only, never a delivery record.

## 5. See also

- `docs/secure_runtime_alpha_425_nostr_signing_input_model.md`
- `docs/secure_runtime_alpha_422_nostr_signing_boundary_inventory.md`
