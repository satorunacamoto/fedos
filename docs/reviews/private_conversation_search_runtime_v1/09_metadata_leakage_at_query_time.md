# Review 09 — Metadata Leakage at Query Time

Audit only. No production source change is made anywhere in this review.

## The prior review's own comparison, applied to this implementation's actual query method

The prior review's Review 09 found Option 2 strictly worse than Option
1 or 3 on exactly one axis: "the query argument IS the plaintext term."
`FedosConversationSearchIndex.searchKeyword(query: string)` confirms
this precisely — `query` is accepted and tokenized as a raw string
(`fedos_conversation_search_keyword_index.ts`'s own `tokenize()`), with
no hashing, wrapping, or transformation before being used as a `Map`
lookup key. Any local-process observer of a call to `searchKeyword()`
— a logging layer, a debugger, a future telemetry hook added by an
unrelated Arc — sees the user's literal search term in plaintext, at
the moment of the search, exactly the exposure the prior review's
Review 09 identifies as Option 2's own distinguishing weakness relative
to Option 1 (whose "query" is inseparable from a bulk decrypt whose
output is not automatically observable) and Option 3 (whose query is a
token, not a term).

## What is not affected

`envelopesBetween()`, `repliesTo()`, `envelopesByParticipant()`,
`conversationsByParticipant()`, and `modeOf()` all accept structured,
non-content arguments (timestamps, ids, participant references) —
none of these carries the "query argument is plaintext content" risk
`searchKeyword()` does, because none of them was ever a content-search
method in the first place. This document's finding is scoped to
`searchKeyword()` specifically, not the facade as a whole.

## Result-size signal

Consistent with the prior review's own Review 09 finding ("inherent to
any search feature, not specific to this codebase's own design
choices"), `search()`'s return value length is itself a coarse
match-count signal to any caller — unavoidable under any of the three
options and not a finding specific to this implementation.
