# Review 15 — Search Ranking: None Implemented, as the Prior Review Recommended — With One Ordering Gap

Audit only. No production source change is made anywhere in this review.

## What the prior review allowed, and what was built

The prior review's Review 15/16 did not require ranking to be built in
this Arc — Review 16 recommends "a ranking function ... defaulting to
recency (`createdAt` DESC, tie-broken deterministically)" only as a
future step, and the execution spec's own "deliberately out of scope"
section correctly names "ranking/relevance scoring beyond AND-semantics
token matching" as excluded. `FedosConversationSearchKeywordIndex.search()`
implements exactly AND-semantics token matching, nothing more — this
matches the prior review's own allowance precisely, and is not a
finding.

## The one gap: result ordering is deterministic but not the recommended default

`search()` returns `[...(candidates ?? new Set())].sort()` — a
lexicographic sort over `FedosConversationEnvelopeId`, which is an
opaque, randomly-generated string with no chronological meaning
(`fedos_conversation_envelope_id.ts`: "no protocol meaning," generated
via `randomBytes`/`bytesToHex`). The module's own stated guardrail is
"never insertion-order-dependent, never `Set` iteration order leaked
directly" — a determinism requirement, which this satisfies — but the
prior review's own Review 16 recommendation was specifically a
*recency-ordered* default ("the direct, low-risk private-domain
equivalent of `thread_query.ts`'s own `'new'` mode"), not merely a
deterministic one. `repliesTo()` and `envelopesByParticipant()` share
the same id-lexicographic sort. Only `envelopesBetween()` sorts by
`(createdAt, envelopeId)`, the recency-consistent order Review 16
recommends.

## Why this is a real, if minor, gap rather than a contract violation

This module never claims chronological ordering for `search()` — a
caller wanting recency-ordered results today must separately
cross-reference `envelopesBetween()`'s own `createdAtOf()` per result
id, which works but is an easy detail for a future UI implementer to
miss, producing search results in an order that looks arbitrary to a
user. This review recommends `search()` (and, for consistency,
`repliesTo()`/`envelopesByParticipant()`) sort by `(createdAt,
envelopeId)` rather than `envelopeId` alone, matching
`envelopesBetween()`'s own existing convention and the prior review's
Review 16 recommendation, at effectively zero implementation cost —
`createdAtOf()` already exists on the Date Index and is already
reachable from the facade.
