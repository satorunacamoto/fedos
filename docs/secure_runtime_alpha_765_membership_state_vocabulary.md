# Secure Runtime Alpha 765 — Membership State Vocabulary

`FedosConversationMembershipState = "active" | "revoked" | "left"` (`src/conversation/membership/fedos_conversation_membership_state.ts`). Three states only.

`"pending"`/`"invited"` evaluated and excluded from Membership: per this Arc's own instruction, an invitation is a Capability-domain fact (`src/conversation/capability/fedos_conversation_capability_descriptor.ts`, Alpha 777) — Membership begins ONLY at successful admission (`admit()`, Alpha 770), so there is no intermediate membership state for a pending invite to occupy. A capability that has been issued but not yet redeemed has no corresponding Membership record at all.

No mutable boolean field exists anywhere on `FedosConversationMembership` (Alpha 766) — `state` is the only lifecycle signal, matching `FedosConversationRecord`'s own "no second boolean that could disagree with an enum" discipline (Alpha 745).
