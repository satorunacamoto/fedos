# 03 — Conversation Identifier and Message Identity

## Required id types

```ts
// Design shape only. Not implemented by this review.
type FedosConversationId = string & { readonly __brand: "FedosConversationId" };
type FedosConversationMessageId = string & { readonly __brand: "FedosConversationMessageId" };
type FedosConversationMemberId = string & { readonly __brand: "FedosConversationMemberId" };
type FedosConversationCapabilityId = string & { readonly __brand: "FedosConversationCapabilityId" };
type FedosConversationKeyEpoch = number & { readonly __brand: "FedosConversationKeyEpoch" };
```

Five distinct branded types, mirroring `src/board/fedos_board_identifiers.ts`'s
own established discipline (re-confirmed unmodified this pass):
"protocol-independent... structurally distinct from the others and
from a plain `string`... no random ID generator exists anywhere in
this file; nothing here mints a new id; every function only BRANDS an
already-chosen, already-non-empty string." A future implementation
should follow the SAME split the Public Board Runtime Arc (Alpha
621-640, source-verified this pass to still exist at
`src/board/runtime/fedos_board_runtime_id_generator.ts`) already
established for `FedosBoardPostId`: minting is a separate, injectable
`FedosBoardRuntimeIdGenerator`-shaped concern from branding.

`FedosConversationKeyEpoch` is deliberately typed as `number` (a
monotonically increasing counter), not a branded opaque string — see
§06: an epoch must be orderable (a later epoch is unambiguously "after"
an earlier one), a property an opaque string id cannot express without
an auxiliary ordering field, which a plain counter provides for free.

## Can `FedosBoardId`/`FedosThreadId` be reused for Private Conversation?

**No — evaluated and rejected.** Three independent reasons, each
sufficient alone:

1. **Structural mismatch with `FedosBoardPost`'s own thread discipline.**
   `FedosThreadId` exists specifically so `FedosBoardService`'s
   precheck (`src/board/repository/fedos_board_service.ts`, re-verified
   unmodified this pass) can enforce "a root post's `threadId` equals
   its own `id`; a reply inherits its parent's `threadId`" — a rule
   that presumes every post sharing a `threadId` is mutually
   cross-readable and belongs to the SAME public, unencrypted
   Persistence table. A `FedosConversationId` carries none of that
   coupling; reusing `FedosThreadId`'s own branded type for it would
   either (a) let a Private Conversation message accidentally satisfy
   `FedosBoardService`'s own thread-integrity checks and get accepted
   into the PUBLIC Board repository, or (b) require `FedosBoardService`
   itself to grow private-conversation-awareness it has no business
   holding (prior review's own §02 recommendation: Conversation-mode
   logic lives in `FedosBoardRuntime`, never in Host/`FedosBoardService`
   itself).
2. **`FedosBoardId` names a discoverable grouping.** `FedosBoardQuery.recentFeed(boardId)`
   (re-verified unmodified) is a public, filterable, paginated read
   over everything sharing a `boardId` — the opposite of what a Private
   Conversation id must guarantee (membership-gated, never a generic
   query target). Reusing the same branded type risks a future
   maintainer writing `query.recentFeed(privateConversationId)` and
   getting it to compile, when it must never be callable at all.
3. **Two-participant DM has no "board" concept to begin with.** A DM
   between two participants is not a board with exactly one thread —
   see §12's own rejection of "DM = a 2-person Board."

## Do NOT define DM as "a Board with 2 members"

Named explicitly per this review's own instruction. A `FedosBoardId`
groups posts by a shared, public, queryable namespace; a DM's identity
is the PAIR of participants (or, more precisely, the Conversation
record naming them), never a namespace either participant "owns" or
that a third party could enumerate by guessing a board-shaped id. Even
setting aside the encryption question entirely, modeling DM as
`{boardId: "dm-alice-bob", ...}` would make the DM's own existence
discoverable via the SAME public `FedosBoardQuery` surface public
boards use — precisely the leak §14 (Operator Non-Linkability) exists
to prevent.

## Conversation Identity vs. Protocol Conversation ID — kept separate

A `FedosConversationId` (canonical, FedOS-internal, Authority-derived)
must never be conflated with whatever identifier a given outbound
protocol uses for the "same" conversation on its own side — because,
per §18's own findings, not every protocol even HAS a stable
conversation-level identifier (a Nostr NIP-44 DM has no group/thread
concept at the protocol level at all; each event stands alone,
addressed by pubkey). Mapping table:

```
FedosConversationId (canonical, this review's own scope)
    |
    v  (protocol mapping, §18 — lossy, per-protocol, NOT stored on the canonical record)
Nostr: no native conversation id -- addressing is per-event, by recipient pubkey
ActivityPub: an Actor's own addressed-conversation convention (protocol-specific, unverified this pass -- §18 flags as requiring official-spec research)
AT Protocol: unknown -- §18 flags as requiring official-spec research
Session: a Session-native session/room identifier, IF SESSION EXPOSES ONE
   (§01's own inventory of the Session adapter found no DM-vs-group
   distinction modeled anywhere in this codebase today -- confirmed by
   direct source reading, not assumed)
```
This mirrors `FedosBoardSourceReference`'s own existing "canonical id,
opaque protocol-native reference, never conflated" discipline
(`src/board/fedos_board_source.ts`, re-verified unmodified) — applied
here one layer up, at the conversation level rather than the
individual-post level.

## See also

- `docs/reviews/private_conversation_security/12_dm_group_separation.md`
- `docs/reviews/private_conversation_security/18_protocol_mapping.md`
- `docs/reviews/board_runtime_application_api_04_conversation_mode_model.md`
