# Review 06 — Creator Membership

## The construction sequence

1. Resolve creator identity (`02` axis 2) to a
   `FedosConversationParticipantReference`. This step is IDENTICAL in
   shape to `FedosBoardRuntime.createPublicThread()`'s own
   `#authorAuthority.resolvePublicAuthor()` call
   (`src/board/runtime/fedos_board_runtime.ts`) — resolved before any
   durable write is attempted, never supplied by the caller (`04`).
2. Once the Conversation record itself is durably written (`10`'s own
   ordering — Conversation record first, matching
   `FedosBoardRuntime`'s established "Board write first, then
   Conversation" precedent extended one layer deeper here), call
   `FedosConversationMembershipAuthority.admit(conversationId,
   creatorParticipant, "owner", now)`.
3. `admit()`'s own real, already-shipped behavior
   (`PersistedFedosConversationMembershipAuthority.admit()`,
   `src/conversation/membership/persistence/persisted_fedos_conversation_membership_authority.ts`)
   ALREADY provides everything this sequence needs: deterministic
   membership id (`toFedosConversationMembershipId(conversationId,
   participant)` — same `(conversationId, authority, publicIdentifier)`
   triple every time, so a retried `admit()` call for the SAME creator
   is naturally idempotent), `role: "owner"`, `state: "active"`,
   `joinedAt: now`, `endedAt: null`.

## Deterministic Membership identity

No new id-derivation scheme is needed or introduced — `toFedosConversationMembershipId()`
already exists, is already deterministic, and already gives creator
Membership construction the exact idempotency property `10`'s
persistence-coordination model needs: replaying the SAME construction
attempt after a crash calls `admit()` again with the identical
`(conversationId, creatorParticipant, "owner", now')` tuple (`now'`
possibly different) and reaches the SAME membership id, so
`PersistedFedosConversationMembershipAuthority.admit()`'s own existing
`existing !== null && existing.state === "active"` branch already
returns `{ outcome: "already-present", membership }` rather than a
conflict, PROVIDED the role matches — verified directly against the
implementation in `01`.

## Role: always `"owner"`, never caller-chosen

`FedosConversationRole` (`"member" | "moderator" | "owner"`) is a
closed vocabulary; construction's own creator-Membership call fixes
`"owner"` unconditionally — never accepted from the command (`04`'s
own "caller must NOT be able to supply creator Membership state").
This matches the existing role file's own stated intent ("`revoke()`
... needs SOME notion of who may act on another member") — an owner
role is the only sensible starting point for the ONE participant who
exists before any other Membership record does.

## No invitation required for the creator

`FedosConversationMembershipState` has exactly three values (`"active"
| "revoked" | "left"`) with NO `"pending"`/`"invited"` state
(`src/conversation/membership/fedos_conversation_membership_state.ts`'s
own header: "an invitation is a Capability-domain fact... never a
Membership state"). Creator Membership therefore begins directly at
`"active"` via `admit()` — there is no Capability to redeem, since the
creator is not joining an already-existing Conversation, they are
BRINGING it into existence. This is not a special-cased shortcut this
review invents; it falls directly out of `isFedosConversationMembershipTransitionAllowed()`'s
own rule (`nonexistent → active` is `admit`'s only legal transition,
`src/conversation/membership/fedos_conversation_membership_transition.ts`)
— the creator's Membership simply IS the first `admit()` call for that
Conversation id, with no different code path from any other `admit()`
call.

## Failure handling

If `admit()` returns anything other than `"admitted"`/`"already-present"`
(i.e. `"conflict"`/`"invalid-transition"`/`"unavailable"`) AFTER the
Conversation record itself was already durably written in step 2, the
system is left with a real Conversation record and no owner — an
honest partial-construction state, never silently hidden. `10`/`14`
give this the explicit `"membership-unavailable"` outcome (`03`) rather
than rolling back the Conversation write (no such rollback exists for
ANY append-only-backed port in this codebase — `01` confirms zero
`delete` methods anywhere in this domain) or pretending success.

## Why creator Membership must be durable BEFORE the command returns "created"

Unlike `FedosBoardRuntime`'s own Conversation-association step (which
may legitimately return `"created"` for the Board post even if the
associated Conversation record write itself fails, because a Board
post is independently useful without one), a Conversation with NO
owner Membership is not independently useful — Authorization (`15`)
cannot resolve who may act as owner, Revocation (`16`) has nothing to
revoke against, and a caller who received `{ outcome: "created" }`
without an owner Membership would be handed a Conversation they cannot
actually administer. This is why `04`'s/`05`'s own result vocabularies
only report `"created"` once BOTH the Conversation record and the
owner Membership are durably confirmed, not merely the record alone —
a deliberate, stricter choice than `FedosBoardRuntime`'s own precedent,
justified by the different stakes (`10` elaborates the ordering this
implies).
