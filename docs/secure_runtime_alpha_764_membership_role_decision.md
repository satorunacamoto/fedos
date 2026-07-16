# Secure Runtime Alpha 764 — Membership Role Decision

Compared: A. `member | moderator | owner` (closed, coarse). B. `reader | writer | inviter | administrator` (permission-shaped). C. capability-based independent permissions (no role). D. single generic member role (no distinction).

**Adopted: Option A.** `src/conversation/membership/fedos_conversation_role.ts`. Matches this Arc's own preferred direction and the prior review's own sketch (`docs/reviews/private_conversation_security/04_membership_authorization.md` — "owner | admin | member... TBD by a future Arc"); this Arc names the set `owner | moderator | member`, choosing `"moderator"` over `"admin"` to avoid implying system-administration authority this Arc never grants.

Option B rejected: `writeAuthority`/`inviteAuthority` are already independent `FedosConversationPolicy` axes (Alpha 653) — Option B would duplicate Policy's own axis model inside Membership. Option C rejected as premature: no consumer in this Arc's scope needs per-action capability grants finer than a role. Option D rejected: `revoke()` needs some notion of "who may act on another member," which an undifferentiated role cannot express.

`SpaceRole` (`src/community/types.ts`) is NOT reused — five values, pubkey-allowlist-keyed, no fail-closed validator, a different, older Community/Nostr-specific model. A role carries no permission-enforcement logic itself in V1 — that is a future Policy consumer's responsibility (Alpha 773).
