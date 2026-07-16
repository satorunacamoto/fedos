# Review 9 — Lifecycle and Deletion Contract

## V1 honest vocabulary

Of the four candidate states, exactly **zero** are given a stored field
on the V1 Conversation record — and that omission is itself the honest
V1 answer, not an oversight:

| Candidate state | Distinct enforceable meaning today? | Verdict |
|---|---|---|
| `active` | No enforcement exists or is needed — every Conversation record that exists (`04`) IS, by construction, the only kind V1 ever produces. "Active" would be a permanently-true tautology field. | Not stored. Implicit: a record's existence means what "active" would have meant. |
| `closed` | No `closeConversation` command exists in this spec's scope (`06` adds no new commands). A stored `closed` value with nothing to ever write it would be dead weight — the exact objection `04` raises against including an unjustified field. | Reserved future vocabulary only — see below. |
| `archived` | Same objection as `closed`, and additionally: AAR §02's own foundation-pass model uses exactly two states (`active`/`closed`) and never needed `archived` as distinct from `closed`. No V1 use case distinguishes them. | Not adopted unless a future Arc defines a real behavioral difference from `closed`. |
| `tombstoned` | This is a message/content-level concept (SEC §08's meaning #3, "logical tombstone"), not a Conversation-level one. Conflating it with Conversation lifecycle would blur the two. | Belongs to Message lifecycle, not Conversation lifecycle — see below. |

## Lifecycle belongs to Conversation, deletion belongs to Message

These are two different axes, and V1 implements neither as a stored,
enforced state — but the spec is explicit about which future Arc each
belongs to, so a later Arc does not conflate them the way a single
`deleted` boolean would:

- **Conversation lifecycle** (`active`/`closed`, matching AAR §02's
  frozen two-state design) governs whether new messages/replies may
  still be written into a Conversation. This is a Conversation-level
  fact. When a real `closeConversation` command is ever added, it
  should follow AAR's own already-frozen rule: closing is
  forward-looking only (already-created Outbox intents for pre-closure
  posts still complete delivery), and it never deletes the Conversation
  record or its history.
- **Message/content deletion** (SEC §08's eight meanings) governs
  whether a specific message's content remains readable/present. This
  is confirmed today by `fedos_board_moderation.ts`'s own real,
  checked-out source: `FedosBoardModerationRecord` is types-only, has
  **no** `deleted` boolean anywhere, and is kept structurally separate
  from `FedosBoardPost` (`postId` is the only link). This spec adds
  nothing here — the existing discipline already matches SEC §08's
  recommendation and needs no change.

## No physical or remote deletion is promised

Consistent with both prior reviews and with the real, checked-out
persistence layer (`08`): neither `FedosBoardPersistence` nor a future
`FedosConversationPersistence` has, or is planned in this spec to gain,
a `delete` method. Nothing in this document, or any other in this
review, claims that closing a Conversation, or any future moderation
action, removes a record from disk, from a federated peer, or from a
backup. Any future product surface making a "delete" claim must specify
which of SEC §08's eight meanings it performs — this spec inherits that
prohibition rather than relaxing it.
