# Review 4 — Conversation Record V1

## Candidate record

```ts
interface FedosConversationRecordV1 {
  readonly id: FedosConversationId;
  readonly mode: FedosConversationMode;      // V1 validator accepts "public" only
  readonly createdAt: number;                 // Unix seconds, same convention as FedosBoardPost.createdAt
  readonly boardId: FedosBoardId;             // root Board reference
  readonly threadId: FedosThreadId;           // root Thread reference; together with boardId, this IS the conversation in V1
  readonly policyRef: "public-v1";             // see 05_policy_reuse.md — a version tag, not an embedded policy value
}
```

Every field is justified by something that is already true today:

- `id` — per `03_conversation_identity.md`, deterministic from
  `(boardId, threadId)`. Justified: without it, nothing downstream
  (membership, capability, private envelope, when they eventually ship)
  has a stable foreign key to reference.
- `mode` — justified because `FedosConversationMode` already exists
  (Policy Arc) and a record with no mode field would silently assume
  "public" forever, making a future Arc's job harder, not easier, when
  it needs to distinguish record rows by mode.
- `createdAt` — justified because it is a genuine point-in-time fact
  (when the underlying thread root was created) that cannot be
  recomputed on demand, unlike `mode`/policy which are currently static
  for every conversation.
- `boardId`/`threadId` — justified because, per `03`, these ARE the
  conversation's root reference in V1; omitting them would make the
  record un-derivable from anything.
- `policyRef` — justified as a version tag only (see `05`), not a
  reason to duplicate policy data into this record.

## Explicitly excluded, and why

- **Encryption key** — no encryption authority exists (`07`); a field
  for it would be either always-null (dead weight) or a standing
  invitation for a future Arc to populate it with something not yet
  real.
- **Member list** — membership is not implemented (`10`); a field here
  would have no authority to populate or enforce it, i.e. exactly the
  "fake allow-all membership" the task explicitly forbids.
- **Invite token** — invitation is not implemented (`12`); same
  reasoning.
- **Delivery status** — delivery status belongs to `FedosBoardOutboxIntent`/
  `FedosDeliveryObservation`, which already exist as their own records;
  duplicating it onto Conversation would create two sources of truth
  for the same fact.
- **Arbitrary metadata** — no bag-of-extra-fields field of any kind,
  matching `FedosBoardPost`'s own "no speculative fields" discipline
  (`fedos_board_post.ts`'s header: *"speculative fields are explicitly
  disallowed by this Arc's own instruction"*) and `FedosBoardOutboxIntent`'s
  identical rule.
- **Mutable `deleted`/`private` boolean** — this is the specific anti-
  pattern both prior reviews name as the one thing never to do to a
  canonical model (AAR's own governing constraint: *"no boolean bolted
  onto the existing Board model"*). `mode` already expresses
  public/private as a closed enum; a second boolean would let the two
  disagree.
- **Lifecycle state** — see `09_lifecycle_deletion.md`. Not included in
  V1: nothing in this spec's scope produces a state transition (no
  create-Conversation-explicitly command, no close command), so a
  stored lifecycle field would have no writer and would either sit
  permanently at one value (dead weight, same objection as the
  encryption-key field above) or invite a future Arc to start writing
  to it without the enforcement semantics `09` requires being decided
  first.

## Immutability

Every field is `readonly`; the record carries no setter or mutation
method, matching `FedosBoardPost`/`FedosBoardOutboxIntent`'s own
established discipline. A record is either fully absent (never
observed) or exists exactly as constructed — there is no partial or
in-progress record state in V1.
