/**
 * Secure Runtime Alpha 245 ("Combined Inbound Event Validator") — the
 * FOURTH new file of the Alpha 241–250 Nostr Inbound Event Validation
 * Arc, and the SINGLE entry point every caller in this repository
 * uses to turn a `FedosNostrWireEvent` (Alpha 234) into a
 * `FedosValidatedNostrEvent` (Alpha 242). This is the ONLY file in
 * this repository that ever constructs a `FedosValidatedNostrEvent`
 * value — the convention Alpha 242's own doc comment names explicitly.
 *
 * Required order, honored exactly (this Stage's own instruction):
 *
 *   1. structural assumptions already guaranteed by the parser — this
 *      function trusts `event`'s own seven fields already satisfy
 *      `FedosNostrWireEvent`'s own shape (`parseRelayInboundMessage`,
 *      Alpha 233, already enforced this before this function is ever
 *      reached); it performs no re-parsing of any kind.
 *   2. Event ID verification — `verifyNostrEventId` (Alpha 243).
 *   3. signature verification — `verifyNostrEventSignature` (Alpha
 *      244), reached ONLY if step 2 succeeded — matching this Arc's
 *      own "event ID verification must run first" / "invalid id means
 *      signature verification is not treated as sufficient"
 *      instruction: an event with a self-inconsistent id is REJECTED
 *      before its own (meaningless, since it signs the WRONG id) `sig`
 *      is ever examined.
 *   4. validated immutable output — a freshly-constructed, deep-frozen
 *      `FedosValidatedNostrEvent`, reached ONLY if both prior steps
 *      succeeded.
 *
 * ## Clone/freeze strategy, explicitly decided
 *
 * The returned object is a FRESH object literal (never `event` itself,
 * never a widened/cast reference to it) — `Object.freeze`d at the top
 * level. `tags`, a nested `readonly (readonly string[])[]`, is
 * DEEP-CLONED (each inner tag array copied via spread, then
 * `Object.freeze`d, then the outer array `Object.freeze`d) rather than
 * referenced from `event.tags` directly — this Arc's own "output
 * object must not reuse mutable nested tag arrays by unsafe reference"
 * instruction, honored exactly: even though `FedosNostrWireEvent`'s
 * own field type is already `readonly` at the TYPE level (compile-time
 * only), nothing prevents a caller holding the ORIGINAL `event` object
 * (constructed by `parseRelayInboundMessage`, which itself only
 * narrows an already-parsed JSON value — the underlying array objects
 * are ordinary, mutable JS arrays) from later mutating one of its own
 * `tags` sub-arrays in place. Deep-cloning severs that shared
 * reference; `Object.freeze` makes the validated copy itself
 * runtime-immutable, not merely type-level `readonly`.
 *
 * ## Failure semantics
 *
 * `null` for EVERY failure — a caller can never distinguish "bad id"
 * from "bad signature" from this function's own return value alone,
 * matching this Arc's own "no distinction exposed between bad id and
 * bad signature" / "no oracle-like detailed failure reason at the
 * public listener boundary" instruction (Alpha 247 reviews this
 * policy in full).
 *
 * HARD GUARDRAILS:
 *   - `validateInboundNostrEvent` is the ONLY export.
 *   - `verifyNostrEventId` (Alpha 243) is imported and called BEFORE
 *     `verifyNostrEventSignature` (Alpha 244) — confirmed by direct
 *     inspection of this function's own control flow (an early
 *     `return null` after the id check, before the signature check is
 *     ever reached).
 *   - `event` (the input) is NEVER mutated — no field assignment, no
 *     in-place array mutation, anywhere in this function.
 *   - The returned `FedosValidatedNostrEvent`'s own `tags` array (and
 *     every inner tag array) is `Object.freeze`d and holds NO shared
 *     reference to `event.tags`' own arrays.
 *   - NO storage, NO Registry, NO Runtime Identity mutation of any
 *     kind — this function is a pure, synchronous transform.
 *   - NO reference to `src/nostr/*` or `src/sign/*` anywhere in this
 *     file.
 */

import type { FedosNostrWireEvent } from "./fedos_nostr_wire_event.js";
import type { FedosValidatedNostrEvent } from "./fedos_validated_nostr_event.js";
import { verifyNostrEventId } from "./nostr_event_id_verifier.js";
import { verifyNostrEventSignature } from "./nostr_signature_verifier.js";

/**
 * Validates a parsed, structurally-sound `FedosNostrWireEvent` and
 * returns an immutable `FedosValidatedNostrEvent` only if BOTH its
 * Event ID and its BIP-340 signature verify. Returns `null` for any
 * failure, with no distinction exposed between the possible causes.
 */
export function validateInboundNostrEvent(
  event: FedosNostrWireEvent,
): FedosValidatedNostrEvent | null {
  if (!verifyNostrEventId(event)) return null;
  if (!verifyNostrEventSignature(event)) return null;

  const tags = Object.freeze(event.tags.map((tag) => Object.freeze([...tag])));

  return Object.freeze({
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags,
    content: event.content,
    sig: event.sig,
  });
}
