# Review 8 — Storage and Migration Plan

## Coexistence with existing logs

Three durable/semi-durable logs exist today, each with its own port and
each already independent of the others:

- **Board append-only log** — `FedosBoardPersistence`
  (`putPost`/`getPost`/`listPosts`), backed by
  `AppendOnlyFedosBoardPersistence`. No `delete` method (confirmed
  directly, `fedos_board_persistence.ts` header: *"No `delete` method —
  deliberately excluded this Arc"*).
- **Outbox log** — `FedosBoardOutboxPersistence`
  (`putIntent`/`getIntent`/`listIntents`), same shape, same absence of
  deletion.
- **Observation log** — `FedosDeliveryObservationPersistence`, currently
  **in-memory only** (no durable implementation exists at all, per both
  prior reviews' independent confirmation).

## Does the Conversation record need its own persistence port?

**Yes.** `FedosConversationPersistence` — a fourth, minimal port
mirroring the exact shape already established by the other two durable
logs:

```ts
interface FedosConversationPersistence {
  putConversation(record: FedosConversationRecordV1): FedosConversationPersistenceWriteResult;
  getConversation(id: FedosConversationId): FedosConversationRecordV1 | null;
  listConversations(): readonly FedosConversationRecordV1[];
}
type FedosConversationPersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";
```

Reasoning: `04`'s record captures `createdAt`, a fact that cannot be
recomputed from the Board/Outbox logs on demand. A separate port (not a
field bolted onto `FedosBoardPersistence`) matches this codebase's own
established discipline — Board, Outbox, and Observation are three
separate ports precisely because each represents a distinct durable
fact with its own write/read pattern, never merged into one port for
convenience. `FedosConversationId`'s deterministic construction (`03`)
gives `putConversation` the same idempotent
inserted/already-present/conflict semantics the other two ports already
have, for free.

An alternative — deriving the record on the fly from
`(boardId, threadId)` with no persistence at all — was considered and
rejected specifically because `createdAt` would then have to be read
from the underlying thread-root post's own `createdAt` instead of being
a Conversation-level fact. That is a legitimate simplification *if* a
Conversation record is later found to add nothing beyond what the root
post already states; this spec does not choose that shortcut, because
`04` requires an immutable record with its own identity for future Arcs
(membership, capability) to hold a real foreign key against — a
"derived, not stored" Conversation cannot be referenced by a future
`FedosConversationMembership.conversationId` in the same way a real
persisted row can.

## Future private ciphertext store

Explicitly **not** designed by this spec (`11_private_message_envelope.md`
states which fields are blocked). SEC §07's own recommendation — a
dedicated, private-only backend, separate file/schema/retention policy,
never a reuse of `AppendOnlyFedosBoardPersistence` — is adopted as the
eventual direction, but no port, backend, or schema is introduced here.
`FedosConversationPersistence` above must never be extended to carry
ciphertext or key material; when a private storage backend is built, it
references `FedosConversationId` as a foreign key exactly like every
other log, but lives in its own file/port, matching the "never place
secret material in policy/metadata records" constraint below.

## No secret material in policy/metadata records

`FedosConversationRecordV1` (`04`) and `FedosConversationPolicy`
(reused unchanged, `05`) never carry a key, ciphertext, or capability
secret. This is not a new rule invented here — it is the same
discipline already enforced on `FedosBoardOutboxIntent` (*"No access
token, private key... anywhere in this file"*) and
`FedosBoardAuthorReference` (*"NO private key, Master Seed,
authentication token... of any kind"*), extended to the one new record
this spec adds.
