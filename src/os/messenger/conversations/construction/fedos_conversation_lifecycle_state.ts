/**
 * Secure Runtime Alpha 893 ("Conversation Lifecycle Vocabulary") — Stage
 * 3 of Phase A of the Alpha 891–930 Private Conversation Draft
 * Construction and Readiness Runtime Arc.
 *
 * The smallest ENFORCEABLE lifecycle vocabulary. Four values are NAMED so
 * a validator can be future-safe (reject an unknown/illegal state
 * explicitly rather than silently), but this Arc may CONSTRUCT only
 * `"draft"` — every constructor in this Arc fixes `"draft"`
 * unconditionally, and `"active"` in particular can NEVER be produced by
 * any code path here (this Arc's own Absolute Prohibition; a future
 * reviewed activation operation owns the `draft → active` transition,
 * only after proving every readiness axis).
 *
 * Rules this vocabulary obeys (Alpha 893's own list):
 *   - `"active"` cannot be produced by this Arc.
 *   - mode does not imply active — a `private-group`/`direct` record is
 *     `"draft"` regardless of mode (Alpha 895/896).
 *   - `"draft"` does not imply encrypted — lifecycle and encryption are
 *     independent axes (Alpha 898/899).
 *   - `"closed"`/`"tombstoned"` transitions remain UNIMPLEMENTED — they
 *     are named only so a persisted-record validator can recognize and
 *     reject an attempt to CONSTRUCT one in this Arc, never because any
 *     transition into them is enforceable yet.
 *   - NO `isActive`/`isPrivate`/`isEncrypted` boolean anywhere — a
 *     lifecycle is a closed enum, exactly as `FedosConversationMode`'s
 *     own header already argues against parallel booleans.
 */

export type FedosConversationLifecycleState = "draft" | "active" | "closed" | "tombstoned";

export const FEDOS_CONVERSATION_LIFECYCLE_STATES: readonly FedosConversationLifecycleState[] = [
  "draft",
  "active",
  "closed",
  "tombstoned",
];

/** The ONLY lifecycle state this Arc's construction paths ever produce. */
export const FEDOS_CONVERSATION_CONSTRUCTIBLE_LIFECYCLE_STATE: FedosConversationLifecycleState = "draft";

export function isFedosConversationLifecycleState(value: unknown): value is FedosConversationLifecycleState {
  return typeof value === "string" && (FEDOS_CONVERSATION_LIFECYCLE_STATES as readonly string[]).includes(value);
}
