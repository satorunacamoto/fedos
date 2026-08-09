/**
 * Secure Runtime Alpha 242 ("Validated Event Model") — the FIRST new
 * file of the Alpha 241–250 Nostr Inbound Event Validation Arc.
 * `FedosValidatedNostrEvent` names the shape a `FedosNostrWireEvent`
 * (Alpha 234) takes AFTER it has passed BOTH Event ID verification
 * (Alpha 243) and BIP-340 signature verification (Alpha 244) — the
 * ONLY value this repository ever calls "validated."
 *
 * Field-for-field, this type is IDENTICAL to `FedosNostrWireEvent` —
 * the same seven NIP-01 wire names, verbatim (`id`, `pubkey`,
 * `created_at`, `kind`, `tags`, `content`, `sig`). TypeScript's own
 * type system is STRUCTURAL, not nominal: no field-shape difference
 * could make these two interfaces mutually un-assignable, and this
 * Stage's own instruction explicitly forbids inventing one anyway ("no
 * boolean valid field," "no optional validation status," "no metadata
 * bag" — a "brand" field would just be a valid-flag by another name).
 * The distinction this Arc draws is therefore NOT a type-system
 * guarantee — it is a NAMING and OWNERSHIP convention, enforced by
 * WHERE a value of this type is ever constructed: "construction allowed
 * only through the validator module by convention and module
 * placement" (this Stage's own instruction, verbatim). Exactly one
 * file in this repository, `combined_inbound_event_validator.ts`
 * (Alpha 245), ever writes an object literal typed as
 * `FedosValidatedNostrEvent` — confirmed structurally, this Stage and
 * every later Stage of this Arc, by `grep`.
 *
 * A `FedosNostrWireEvent` is NEVER silently re-typed as
 * `FedosValidatedNostrEvent` anywhere in this Arc's own code (no `as
 * FedosValidatedNostrEvent` cast, no return-type widening) — the ONLY
 * way to obtain one is to call `validateInboundNostrEvent` (Alpha 245)
 * and receive a non-`null` result, which means real Event ID AND
 * signature verification already ran.
 *
 * HARD GUARDRAILS:
 *   - `FedosValidatedNostrEvent` is the ONLY export.
 *   - Every field is `readonly` — no mutation method or setter of any
 *     kind, and no field may ever be reassigned after construction.
 *   - Exactly the seven NIP-01 wire field names, matching
 *     `FedosNostrWireEvent` field-for-field — no `valid`/`verified`/
 *     `status` field, no metadata bag, no index signature.
 *   - This file defines a TYPE ONLY — no function, no class, no
 *     construction logic, no validation logic of any kind (that is
 *     `combined_inbound_event_validator.ts`'s own exclusive concern,
 *     Alpha 245).
 *   - NO reference to `src/nostr/*` or `src/sign/*` anywhere in this
 *     file.
 */

export interface FedosValidatedNostrEvent {
  readonly id: string;
  readonly pubkey: string;
  readonly created_at: number;
  readonly kind: number;
  readonly tags: readonly (readonly string[])[];
  readonly content: string;
  readonly sig: string;
}
