# Secure Runtime Alpha 242 — Validated Nostr Event Model

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/desktop/fedos_validated_nostr_event.ts`. This is Stage 2 of the
Alpha 241–250 Nostr Inbound Event Validation Arc, following Alpha
241's own inventory and Decision.**

## 1. Why now

Alpha 245's own combined validator needs a concrete output type before
it can exist. This Stage decides exactly what a "validated" event
looks like, type-first, matching this Arc's own `FedosNostrWireEvent`
→ `parseRelayInboundMessage` sequencing one Arc ago (Alpha 234 → 233,
landed in the reverse numeric order within a single commit).

## 2. What was implemented

```ts
export interface FedosValidatedNostrEvent {
  readonly id: string;
  readonly pubkey: string;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
  readonly sig: string;
}
```

Field-for-field IDENTICAL to `FedosNostrWireEvent` (Alpha 234) — the
same seven NIP-01 wire names, verbatim.

## 3. "Structurally distinct" without a nominal type system, explained

TypeScript's type system is STRUCTURAL: two interfaces with identical
field sets are mutually assignable regardless of their names. This
Arc's own instruction is explicit about NOT closing that gap with a
brand: "no boolean valid field," "no optional validation status," "no
metadata bag" — every conceivable extra field would just be a
valid-flag in disguise, and this Arc's own candidate code shows none.

The distinction this Arc draws is therefore a NAMING and OWNERSHIP
convention, not a compiler-enforced one: **"construction allowed only
through the validator module by convention and module placement"**
(this Stage's own instruction, verbatim). Exactly one file,
`combined_inbound_event_validator.ts` (Alpha 245), ever writes an
object literal typed as `FedosValidatedNostrEvent` anywhere in this
repository — confirmed structurally by this Stage's own tests, and
reconfirmed by every later Stage's own tests through Alpha 250.

**"A parsed but unverified event must never be typed as validated. Do
not brand a plain object without performing real verification."**
Honored by NEVER writing a type assertion (`as FedosValidatedNostrEvent`)
anywhere in this Arc's own code outside `combined_inbound_event_validator.ts`
itself, and by that ONE file only ever returning a
`FedosValidatedNostrEvent` AFTER both `verifyNostrEventId` (Alpha 243)
and `verifyNostrEventSignature` (Alpha 244) have already succeeded
(Alpha 245's own required order).

## 4. Structural confirmation (real inspection, this Stage)

- `fedos_validated_nostr_event.ts` exports exactly one symbol,
  `FedosValidatedNostrEvent`.
- Field count: exactly 7, matching `FedosNostrWireEvent` field-for-field.
- Every field is `readonly`.
- Zero `valid`/`verified`/`status`/`ok` field, zero index signature,
  zero metadata bag of any kind.
- Zero import exists in this file — depends on nothing, matching
  `FedosNostrWireEvent`'s (Alpha 234) own zero-import precedent.
- Zero function, zero class, zero construction logic of any kind — this
  file defines a TYPE ONLY.

## 5. What this Stage does NOT do

- Does **not** implement `verifyNostrEventId`, `verifyNostrEventSignature`,
  or `validateInboundNostrEvent` — Alpha 243/244/245's own deliverables.
- Does **not** add a brand field, a `valid` flag, or any type-system
  mechanism to enforce the construction convention — deliberately
  convention-only, per §3.
- Does **not** modify `fedos_nostr_wire_event.ts`, `fedos_relay.ts`,
  `null_relay.ts`, `websocket_relay.ts`, `src/nostr/*`, `src/sign/*`,
  `create_runtime.ts`, `types.ts`, `AppRuntime`, `worker.ts`,
  `src/identity/*`, `desktop_application.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 6. See also

- `docs/secure_runtime_alpha_241_existing_inbound_validation_inventory.md`
- `docs/secure_runtime_alpha_245_combined_inbound_event_validator.md`
- `docs/secure_runtime_alpha_234_inbound_event_representation.md`
