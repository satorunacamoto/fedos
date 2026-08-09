/**
 * Secure Runtime Alpha 768 ("Membership Transition Contract") — Stage 8
 * of the Alpha 761–790 Canonical Conversation Membership & Capability
 * Foundation Arc.
 *
 * Allowed: `nonexistent → active` (admit), `active → revoked`,
 * `active → left`. Forbidden: `revoked → active`, `left → active`,
 * `revoked → left`, `left → revoked` — a revoked or left membership
 * never silently reactivates; re-admission (if ever needed) must create
 * a new explicit membership generation, out of this Arc's own scope.
 *
 * A pure decision function, consulted by
 * `InMemoryFedosConversationMembershipAuthority` (Alpha 771) before ANY
 * mutation — never itself reads or writes state.
 */

import type { FedosConversationMembershipState } from "../../../../conversation/membership/fedos_conversation_membership_state.js";

export type FedosConversationMembershipTransition = "admit" | "revoke" | "leave";

/**
 * `current === null` means "no membership record exists yet" (the
 * `nonexistent` state). Returns `true` only for the six explicitly
 * allowed transitions named in this file's own header.
 */
export function isFedosConversationMembershipTransitionAllowed(
  current: FedosConversationMembershipState | null,
  transition: FedosConversationMembershipTransition,
): boolean {
  if (transition === "admit") return current === null;
  if (transition === "revoke") return current === "active";
  if (transition === "leave") return current === "active";
  return false;
}
