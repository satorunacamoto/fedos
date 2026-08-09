/**
 * Secure Runtime Alpha 777 ("Public Capability Descriptor") — Stage 3 of
 * Phase B of the Alpha 761–790 Canonical Conversation Membership &
 * Capability Foundation Arc.
 *
 * `capabilityId` is a PUBLIC identifier — an Authority-assigned
 * reference the issuer can log, look up, and reason about. It is NEVER
 * the bearer secret a recipient redeems with (that is
 * `FedosConversationCapabilityBearerSecret`,
 * `./fedos_conversation_capability_bearer_secret.ts`, Alpha 778) — kept
 * as a structurally distinct branded type specifically so the two can
 * never be assigned to each other by accident. Mirrors
 * `FedosConversationId`'s own opaque-branded-string discipline (Alpha
 * 743): no random generation in this file, this file only brands an
 * already-chosen, non-empty string.
 */

export type FedosConversationCapabilityId = string & { readonly __brand: "FedosConversationCapabilityId" };

function isNonEmpty(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Brands an already-chosen, non-empty string as a `FedosConversationCapabilityId`. Returns `null` for anything else. */
export function toFedosConversationCapabilityId(value: string): FedosConversationCapabilityId | null {
  return isNonEmpty(value) ? (value as FedosConversationCapabilityId) : null;
}
