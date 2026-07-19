# Review 07 — Local-Only Search: the Guarantee Has No Guardrail Against Future Wiring

Audit only. No production source change is made anywhere in this review.

## The gap this document names

Review 06 of this audit confirms local-only placement holds today,
because nothing outside `src/conversation/search/` yet consumes
`FedosConversationSearchIndex`. The execution and completion
declarations both name the natural next step explicitly: "Host-side
wiring exposing `FedosConversationSearchIndex` through the Desktop
Runtime alongside `boardRuntime()`/`conversationRuntime()`." Nothing in
this Arc's own code prevents a future Host-wiring Arc from doing the
one thing the prior review's Review 06/07 forbid: persisting this
index's own state to disk (e.g. serializing `#envelopesByToken` to a
file for faster cold-start) without separately re-deriving the
local-only, encrypted-at-rest, retention-gated discipline the prior
review attached to any *persisted* Option 2 index specifically.

## Why this is worth naming now, not only when a Host Arc lands

The prior review's own Review 07 named the correct precedent for a
future persisted index: `AppendOnlyFedosConversationPayloadStorage`'s
own "local file, fail-closed, no silent repair, no compaction"
discipline, implemented as "a new, dedicated port... never folded into
an existing port." `FedosConversationSearchIndex` does not currently
implement that port shape, and — because it is a plain class with
public mutable-by-construction sub-index state, not an interface a
Host layer must satisfy through an injected dependency — nothing
structurally requires a future persistence-adding change to go through
a review of this kind before landing. This is not a defect in what
exists today (Review 06 of this audit: today's implementation is
correctly local-only and non-persisted); it is a named, open risk for
what happens next, exactly the kind of boundary the execution spec's
own "deliberately out of scope" section names for other topics
(real decryption wiring, Host/GUI wiring) but does not name for this
one.

## What this review recommends here

Any future Arc that adds persistence to this index (disk-backed
caching, cross-restart durability) should be required to re-run the
prior review's own Reviews 04-09 reasoning explicitly against the
specific persisted form chosen, rather than treating "the in-memory
version already passed review" as sufficient — persistence changes the
answer to nearly every question those reviews ask.
