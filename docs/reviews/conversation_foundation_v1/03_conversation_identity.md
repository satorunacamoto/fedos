# Review 3 — Canonical Conversation Identity

## Candidate types

```ts
/** Opaque, Authority-derived. Never caller-supplied, never randomly minted independent of a Board/Thread pair in V1. */
type FedosConversationId = string & { readonly __brand: "FedosConversationId" };

/** Frozen (01). Identical to the Policy Arc's own fedos_conversation_mode.ts. */
type FedosConversationMode = "public" | "private-group" | "direct";

/** V1 constructible value only — mirrors FEDOS_CONVERSATION_MODE_V1_SUPPORTED. */
const FEDOS_CONVERSATION_MODE_V1_SUPPORTED: FedosConversationMode = "public";
```

**`FedosConversationPolicyId` is not needed.** The Policy Arc's
`FedosConversationPolicy` is a value type, not an entity with its own
identity — it is resolved fresh from `FedosConversationPolicyAuthority`
per call, never stored and looked up by its own id. Introducing a
`FedosConversationPolicyId` would mint an identity for something that
has no independent lifecycle of its own in V1 (there is exactly one
policy value, `FEDOS_CONVERSATION_POLICY_PUBLIC_V1`, referenced by every
conversation). If a future Arc ever needs per-conversation policy
divergence (Review 5's "future private-group/direct migration"), that
Arc is the right place to introduce a policy identity — not this one.

## Relationship to `FedosBoardId` and `FedosThreadId`

**Each Board is not a Conversation.** A `FedosBoardId` names a
discoverable, queryable grouping (`FedosBoardQuery.recentFeed()` reads
across an entire board) — the opposite of the containment a Conversation
identity needs to express. A Board routinely contains many independent
threads with unrelated authors and policies; collapsing Board into
Conversation would force every thread on a board to share one
Conversation identity, which is not true today and would not become
true by fiat.

**Each Thread is a Conversation, for V1's one constructible mode.**
`FedosBoardPost.threadId` already uniquely identifies a root post and
every reply chained under it (`threadId === id` for a root, per
`fedos_board_runtime.ts`'s own `createPublicThread()`). A public-mode
Conversation is, in V1, exactly the set of posts sharing one
`(boardId, threadId)` pair — nothing more is known about it, and
nothing more needs to be to satisfy Option C's scope.

**`FedosConversationId` wraps, rather than replaces, the existing pair.**

```ts
function toFedosConversationId(boardId: FedosBoardId, threadId: FedosThreadId): FedosConversationId {
  return `${boardId}::${threadId}` as FedosConversationId;
}
```

Deterministic, not randomly minted — this deliberately mirrors
`makeFedosBoardOutboxId()`'s own existing convention (`postId + protocol
+ destination`, joined with the same `::` separator, in
`fedos_board_outbox_types.ts`) rather than inventing a second
id-construction idiom. Two calls with the same `(boardId, threadId)`
always produce the identical `FedosConversationId`, giving the record
in `04_conversation_record_v1.md` "already-present" idempotency for
free, exactly as `FedosBoardOutboxIntent` gets it today.

**Direct conversation is structurally different, and this matters for
what `FedosConversationId` can and cannot do — but not for V1.** SEC §03
and §12 are correct that a `direct` conversation has no Board at all
(two participants, no discoverable grouping, no thread-integrity
precheck to reuse) and that member count is not a sufficient
discriminant between `direct` and `private-group`. This is precisely why
`toFedosConversationId()` above is written to accept `(boardId,
threadId)` rather than being declared as the *only* way a
`FedosConversationId` can ever be produced: the type itself is opaque
(a branded string), and a future Arc introducing `direct`/`private-group`
support supplies its own construction path (e.g. keyed by a stable
sorted-participant-pair hash, or an Authority-issued identifier with no
Board/Thread involved at all) without needing to touch this type or any
V1 code that already holds a `FedosConversationId` value. V1 itself
never constructs a `direct` or `private-group` id — only documents that
the type does not structurally prevent one.

## Avoiding duplicate identities

`FedosConversationMessageId`, `FedosConversationMemberId`,
`FedosConversationCapabilityId`, and `FedosConversationKeyEpoch` (SEC
§03) are all **out of V1** — none of the entities they would identify
(a private message, a membership record, an invitation capability) is
persisted by this spec. Introducing their id types now, with nothing to
attach them to, would be exactly the kind of speculative vocabulary
Review 4 forbids for the record itself. They belong to the Arc that
actually implements `10_membership_boundary.md`/`11_private_message_envelope.md`/
`12_invitation_capability.md`, not this one.
