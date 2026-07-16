# 10 — One-Time Redemption Semantics

## Options compared

**A. Single-Authority atomic redemption.** One designated Authority
(the issuing node, or a fixed coordinator) is the sole arbiter of
redemption; a redemption request must reach it, and it atomically
decides accept/reject, online-required at redemption time.

**B. Relay consensus.** Multiple relays/nodes vote or agree before a
redemption is considered final — a distributed-consensus protocol.

**C. First-seen wins.** Any node that observes a redemption attempt
locally marks the capability used; no cross-node coordination at all.

**D. Multi-use capability + membership-side idempotency.** Allow
`maxUses` to be a soft, best-effort limit; rely on
`FedosConversationMembership`'s own idempotent join semantics (a
participant who redeems twice just ends up with one membership record,
not two) to make OVER-redemption harmless for membership purposes, even
if the capability itself was technically used more than `maxUses`
times.

**E. Cryptographic bearer token alone claims one-time-ness** (i.e., the
capability's own secret material is asserted to be "used up" the moment
anyone presents it, with no external state tracking redemption at
all). **REJECTED per this review's own instruction, explicitly: a
bearer token's possession proves nothing about WHETHER it has already
been redeemed — cryptography alone cannot make a value "self-destruct"
after first use without SOME external state (a ledger, a database row,
a consensus outcome) recording that the use happened. A protocol that
claims otherwise is making a promise it structurally cannot keep.**

## Evaluation, honest about what this architecture can actually implement

**B (Relay consensus) is not currently buildable from anything in this
codebase.** §01/§07 confirm no consensus/coordination protocol exists
anywhere in `src/` — building one would be a substantial, separate
undertaking (a real distributed-consensus algorithm, e.g. Raft/Paxos-
adjacent, or reliance on a specific external service) far outside a
Capability Invitation Arc's own reasonable scope. Named as
theoretically possible, practically out of scope for the foreseeable
implementation horizon.

**C (First-seen wins) provides no real guarantee in a genuinely
offline-capable/multi-node deployment** — two nodes that have not yet
synced can each independently believe they are "first" to see a given
redemption, exactly the failure mode the prior review's own §08 already
named for this exact problem.

**A (Single-Authority) gives a TRUE exactly-once guarantee**, at the
cost of requiring the issuing Authority to be reachable at redemption
time — a real, honest tradeoff, not a workaround. This is the
correct choice whenever `maxUses: 1` is a genuine security boundary
(§09's own `private-group`/`direct` capabilities, where over-redemption
IS a security failure, not an inconvenience).

**D (soft limit + membership-side idempotency) is the correct choice
for lower-stakes capabilities** — e.g. a `public`-mode invite where
over-redemption merely means slightly more join attempts succeeded than
intended, never a confidentiality failure, since `public` mode has no
confidentiality property to violate in the first place (prior review's
own §04/§05).

## Recommendation: **A for Private Conversation capabilities specifically; D remains correct for public-mode capabilities, unchanged from the prior review**

Because this review's own scope is Private Conversation, and because
§09's own `intendedRecipient`/`redemptionAuthority` fields already
presuppose SOME authority is consulted at redemption time (not merely
locally inferred), **Option A — single-Authority atomic redemption —
is this review's own recommendation for `private-group`/`direct`
capability redemption**, with the explicit, honestly-stated cost: a
capability cannot be redeemed while its issuing Authority (or whichever
node holds redemption authority, per §09's own field) is unreachable.
This is a real availability tradeoff this review names rather than
hides.

## What "exactly once, globally" cannot mean here

**No claim of "disappears from every Node in the world instantly" is
made anywhere in this review** — per this review's own explicit
instruction against such language. What Option A actually guarantees:
at the single Authority that holds redemption state, a `maxUses: 1`
capability is redeemed by at most one requester — full stop, no claim
beyond that boundary. If a future federated/multi-authority deployment
ever splits redemption authority across multiple independent nodes (not
designed by this review), the SAME distributed-exactly-once problem the
prior review's own §08 already named would reapply at that layer, and
would require choosing among these same five options again at that new
boundary — this review does not pre-solve a problem that does not yet
exist in this codebase's own single-authority-shaped design.

## See also

- `docs/reviews/private_conversation_security/09_capability_invitation.md`
- `docs/reviews/board_runtime_application_api_08_invitation_capability_model.md`
