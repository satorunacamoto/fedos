/**
 * Secure Runtime Alpha 853 ("Envelope Identity") — Stage 3 of Phase A of
 * the Alpha 851–890 Private Message Envelope and Encryption Authority
 * Activation Arc.
 *
 * `FedosConversationEnvelopeId` mirrors `FedosConversationPayloadId`'s
 * own discipline exactly (`../payload_storage/fedos_conversation_payload_id.ts`,
 * Alpha 802): branded, opaque, no protocol meaning, no path characters
 * accepted, no secret-bearing value, generated through an injected
 * generator (an Envelope has no natural deterministic key the way
 * `FedosConversationId` does — many Envelopes legitimately belong to the
 * same Conversation, exactly like Payload ids).
 *
 * Collision behavior is explicit and lives at the persistence port level
 * (`./persistence/fedos_conversation_message_envelope_persistence.ts`),
 * never here — this file only brands an already-chosen string.
 *
 * No `FedosConversationKeyEpochId` is introduced — Alpha 853's own
 * "optionally" clause is declined: `keyEpoch` (Alpha 854) is a plain,
 * non-negative `number`, matching the review's own `04_envelope_v1.md`
 * finding that no real epoch-identity type exists anywhere in this
 * codebase to justify a second branded id type for it.
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";

export type FedosConversationEnvelopeId = string & { readonly __brand: "FedosConversationEnvelopeId" };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function containsPathCharacters(value: string): boolean {
  return value.includes("/") || value.includes("\\") || value.includes("..");
}

/** Brands an already-chosen, non-empty, path-character-free string. Returns `null` for anything else. */
export function toFedosConversationEnvelopeId(value: string): FedosConversationEnvelopeId | null {
  if (!isNonEmptyString(value)) return null;
  if (containsPathCharacters(value)) return null;
  return value as FedosConversationEnvelopeId;
}

/** Mints a fresh, opaque raw string suitable for `toFedosConversationEnvelopeId()` to brand. Mirrors `FedosConversationPayloadIdGenerator`'s own pure-interface shape. */
export interface FedosConversationEnvelopeIdGenerator {
  generateEnvelopeId(): string;
}

/** The default generator: 16 bytes (128 bits) of `@noble/hashes/utils.js`'s own `randomBytes()`, hex-encoded — identical margin to `FedosSecureRandomConversationPayloadIdGenerator` (Alpha 802). */
export class FedosSecureRandomConversationEnvelopeIdGenerator implements FedosConversationEnvelopeIdGenerator {
  generateEnvelopeId(): string {
    return bytesToHex(nobleRandomBytes(16));
  }
}
