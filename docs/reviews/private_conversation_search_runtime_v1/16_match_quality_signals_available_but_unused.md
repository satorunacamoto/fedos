# Review 16 — Search Ranking: Match-Quality Signals Are Available but Deliberately Unused

Audit only. No production source change is made anywhere in this review.

## What the prior review's Option comparison predicted

The prior review's Review 16 found that match-quality scoring (term
frequency, term proximity) is "computable locally with no new leakage
beyond what indexing the content at all already implies" under Option
1/2, but unavailable under Option 3 (a blind index cannot preserve
frequency without leaking it). Because this implementation is Option 2
(Review 04 of this audit), match-quality signals are, in principle,
fully available to it: `tokenize()` already computes a token set per
document (deduplicated via `new Set(matches)`, so exact frequency is
discarded at index-build time, but token presence/absence per document
is fully known).

## What was actually built

`search()` returns a boolean AND-match result set with no scoring,
weighting, or ordering by match quality of any kind — the "smallest
honest contract" the module's own header claims. This is a
deliberate, and reasonable, choice consistent with the execution spec's
own out-of-scope declaration, not a leakage risk: returning an
unscored, unordered-by-relevance result set discloses nothing beyond
which documents matched, which the query itself already discloses by
construction.

## Result

No finding beyond Review 15's ordering note. This implementation
correctly declines to build ranking it was not asked to build, and the
underlying Option 2 data model would support real match-quality scoring
later without requiring a redesign — worth noting as a genuine
capability this implementation preserves for a future Arc, not
something it needs to add now.
