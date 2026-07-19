# Review 13 — Group Search: the Mode Index Provides Labeling, Not Aggregation

Audit only. No production source change is made anywhere in this review.
Cross-branch grounding disclosure: as in Review 12, `src/conversation/group/`
remains absent from the current base; this document's Group-search
grounding is cited to the Sender-Key review (`5b55ed6`), unchanged from
the prior review's own disclosure.

## What "group index"/"direct index" actually means in this implementation

`FedosConversationSearchModeIndex` classifies each `conversationId` as
`"direct"` or `"private-group"` via `FedosConversationDraftPersistence.getDraft()`,
exposing `directConversationIds()`/`groupConversationIds()`. This
satisfies the execution spec's own scope item literally — it is a real,
correctly-deduplicated (one map, per the execution spec's own decision
2, itself a defensible application of `FedosConversationReader`'s Alpha
753 precedent) classification index. It is not, and does not claim to
be, the query-time aggregation across a Group's N pairwise Direct
children that the prior review's Review 13 describes as "the correct
architecture for Group search" — `FedosGroupDirectPathAuthority`
(cross-branch, `5b55ed6`) is never imported or referenced anywhere in
`src/conversation/search/`.

## Why this is not a defect given the current base

Since `src/conversation/group/` does not exist on the current base
(confirmed above), there is no `FedosGroupDirectPathAuthority` this Arc
could have integrated with even if it had chosen to — this document's
finding is not "the implementation should have built Group-search
aggregation," which the prior review's own Review 13 explicitly scopes
as a future, separate, application-layer concern requiring
infrastructure this codebase does not yet have.

## What is worth naming

`groupConversationIds()` returns every conversation classified
`"private-group"` this index instance has seen — a flat list, not
resolved into pairwise children. A future implementer reading this
method's name alone, without the prior review's own Review 13/14
context, could reasonably assume it already provides what "Group
search" needs. It does not, and neither the execution spec nor the
completion declaration names this gap explicitly (the closest is the
completion declaration's "Recommended next Arc" section, which names
"Host-side wiring" generally but not Group-aggregation specifically).
This review recommends a one-line addition to this module's own
documentation, on `groupConversationIds()` itself, stating plainly that
it returns conversation-level classification only, never a resolved
set of pairwise search targets — cheap to add, and consistent with this
codebase's own "named, not silently dropped" discipline.
