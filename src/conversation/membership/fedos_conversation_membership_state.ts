/**
 * Secure Runtime Alpha 765 ("Membership State Vocabulary") — Stage 5 of
 * the Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * Three states only: `"active" | "revoked" | "left"`. No `"pending"`/
 * `"invited"` value — per this Arc's own instruction, an invitation is a
 * Capability-domain fact (`../capability/fedos_conversation_capability_descriptor.ts`,
 * Alpha 777), never a Membership state; Membership begins ONLY at
 * successful admission (Alpha 770's own `admit()`), so there is no
 * intermediate state for it to occupy. No mutable boolean field exists
 * anywhere in `FedosConversationMembership` (Alpha 766) — `state` is the
 * ONLY lifecycle signal, matching `FedosConversationRecord`'s own "no
 * second boolean that could disagree with an enum" discipline (Alpha
 * 745).
 */

export type FedosConversationMembershipState = "active" | "revoked" | "left";

export const FEDOS_CONVERSATION_MEMBERSHIP_STATES: readonly FedosConversationMembershipState[] = ["active", "revoked", "left"];
