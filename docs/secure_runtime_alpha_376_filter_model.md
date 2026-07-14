# Secure Runtime Alpha 376 — Filter Model

**Status: this Stage fixes the filter Decision, refining
`matchesFilter()`'s own implementation inside `fedos_board_query.ts`
(Alpha 373/374's own shared helper) — no new public method.** Stage 6
of the Alpha 371–380 Canonical Board Query Foundation Arc.

## 1. The four dimensions, and why exactly these

| Field | Matches against | Why it exists |
|---|---|---|
| `protocol` | `post.source.protocol` | The Board is explicitly protocol-neutral (Alpha 253) — filtering "show me only Nostr posts" or "only ActivityPub posts" is a natural, directly-supported query over an already-indexed-adjacent field, with real value confirmed by Alpha 379's own four-protocol verification. |
| `authorPublicIdentifier` | `post.author.publicIdentifier` | "Show me this author's posts" is the single most common filter any social/board application needs; the field is already a plain, directly-comparable string on every post. |
| `since` | `post.createdAt >= since` | Time-range queries are a baseline expectation for any chronological feed; `createdAt` is already a plain Unix-seconds number. |
| `until` | `post.createdAt <= until` | The other half of a time range; symmetric with `since`. |

## 2. What was considered and explicitly rejected

- **Text/body search.** REJECTED: no search index exists anywhere in
  the Board layer — `FedosBoardIndex`'s own Alpha 305 guardrail states
  directly, "no search engine." Implementing text matching here would
  mean a linear `.includes()` scan with no index behind it, silently
  encouraging callers to depend on a "feature" that does not scale
  and was never reviewed for that purpose.
- **Reply-count / engagement threshold.** REJECTED: no such
  aggregation exists anywhere in the Board layer; `FedosBoardFeed`'s
  own Alpha 308 guardrail already forbids "engagement score" as a
  FEED-ordering concern, and this Stage extends the same prohibition
  to filtering, for the identical underlying reason — no ranking
  signal of any kind belongs in this Arc's own scope.
- **`identityId` filter.** REJECTED: `author.identityId` is `string |
  null` and explicitly NOT a stable public handle (Alpha 254's own
  design) — filtering on it would leak an internal linkage concept
  this layer has no business exposing as a public query dimension.
- **`replyTo` filter (e.g. "direct replies to post X").** REJECTED for
  THIS Arc specifically: `thread()` already answers "everything in
  this thread," and a narrower "direct children only" filter is a
  real, plausible FUTURE capability, but not one any Stage in this
  Arc's own instruction names — adding it now would be exactly the
  "speculative shell" this repository's own Arcs consistently avoid.

## 3. AND-only combination semantics

Every supplied filter field narrows the result — there is no OR
mode, no "match any of these protocols" list, no negation. Two
filters supplied together (e.g. `protocol` AND `since`) match ONLY
posts satisfying BOTH. This is the simplest possible combination rule,
and matches `filterThread()`'s own established behavior
(`src/query/thread_query.ts`, Stage 4) for its own, structurally
similar set of independent filter fields.

## 4. Implementation: one function, called by both query methods

```ts
function matchesFilter(post: FedosBoardPost, filter: FedosBoardQueryFilter | undefined): boolean {
  if (filter === undefined) return true;
  if (filter.protocol !== undefined && post.source.protocol !== filter.protocol) return false;
  if (filter.authorPublicIdentifier !== undefined && post.author.publicIdentifier !== filter.authorPublicIdentifier) return false;
  if (filter.since !== undefined && post.createdAt < filter.since) return false;
  if (filter.until !== undefined && post.createdAt > filter.until) return false;
  return true;
}
```

No filter dimension is evaluated twice, in two places, with two
chances to drift apart — `recentFeed()` and `thread()` both call this
SAME function, unconditionally, before sorting.

## 5. `undefined` filter is a genuine no-op, not an empty-match filter

Calling `recentFeed(boardId)` with no `filter` argument at all behaves
IDENTICALLY to calling it with `filter: {}` — both match every post,
confirmed directly by `matchesFilter()`'s own short-circuit on
`filter === undefined` and by every individual field's own
`!== undefined` guard. A caller can never accidentally filter out
everything by omitting the parameter.

## 6. Conclusion

Four filter dimensions, chosen because each maps to an already-plain,
already-existing `FedosBoardPost` field with a clear, common use case
— never a speculative capability this repository has no evidence of
needing. AND-only combination, evaluated in one shared function, used
identically by both query methods.

## 7. See also

- `docs/secure_runtime_alpha_375_pagination_policy.md`
- `docs/secure_runtime_alpha_372_canonical_board_query_contract.md`
- `docs/secure_runtime_alpha_305_board_thread_index.md`
- `docs/secure_runtime_alpha_254_canonical_board_author.md`
