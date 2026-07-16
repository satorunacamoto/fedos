# Secure Runtime Alpha 654 — Policy Identifier and Ownership

Stage 4. Compares:

- **A.** Embed full policy in every `FedosBoardPost` — rejected (would
  duplicate a changing field into an immutable, long-lived record).
- **B.** Separate immutable policy record keyed by Board/Conversation
  id — **ADOPTED**.
- **C.** `FedosBoardRuntime` constructor holds one global policy —
  rejected as the primary shape (too narrow for a future
  per-conversation policy), though in EFFECT this Arc's own
  `StaticFedosConversationPolicyAuthority` behaves this way today,
  reached through Option B's own interface rather than a bespoke field.
- **D.** Caller supplies arbitrary policy with every post — **REJECTED**
  (lets a caller forge write/federation eligibility).

## Decision: B, without unnecessary V1 persistence

`FedosConversationPolicyAuthority.resolvePolicy({ boardId, threadId })`
(Alpha 656) is the seam. `StaticFedosConversationPolicyAuthority`
resolves the SAME fixed `FEDOS_CONVERSATION_POLICY_PUBLIC_V1` value for
every input — no per-board configuration exists in this codebase today,
so a real persistence layer would store one row forever, which is not
worth building yet. A future Arc introducing per-Board policy
configuration replaces ONLY this one class — `FedosBoardRuntime`'s own
constructor and command methods need no change, since they already
depend on the interface, not the static implementation.

Policy mutation/versioning across multiple, independently-configured
Boards is explicit FUTURE WORK — see Alpha 659.
