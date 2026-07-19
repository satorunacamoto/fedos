# Review 02 — Deviation From the Prior Review's Recommendation

Audit only. No production source change is made anywhere in this review.

## Which option was actually built

The prior review's own Review 04 named three structurally available
designs. `FedosConversationSearchKeywordIndex` is unambiguously
**Option 2**: a persisted (in-process, long-lived, queryable — see
Review 04 of this audit for why "in-memory" does not mean "not
persisted" in the sense that matters here) index mapping plaintext
terms directly to message ids, built once per document and queried
cheaply thereafter via `#envelopesByToken.get(token)`. It is not
Option 1 (`FedosConversationDecryptionAuthority.decrypt()` is never
called anywhere in this directory, and no candidate is ever
scanned/discarded at query time — `search()` is a direct map lookup
against already-built state). It is not Option 3 either (tokens are
raw, lower-cased, `\p{L}\p{N}` substrings — `tokenize()` in
`fedos_conversation_search_keyword_index.ts` — never an HMAC or any
other keyed, deterministic-but-unrecoverable construction).

## Why this matters: Option 2 was the one option the prior review named as never recommended

The prior review's Review 20 states, verbatim: *"Option 2 is
explicitly NOT recommended, at any point, as a persisted
plaintext-derived default: it combines Option 1's implementation cost
(still needs the full gating/hook machinery) with Option 3's
storage-artifact burden, while having the worst leakage profile of the
three."* This is not an ambiguous or soft recommendation this
implementation could be read as satisfying; it is a named rejection of
the exact shape this implementation took. Review 20 also states Option
2 "combines Option 1's implementation cost (still needs the full
gating/hook machinery)" — Review 11 of this audit finds that the
gating/hook machinery Option 2 was already known to require was not
built either, so this implementation carries Option 2's full leakage
profile (Reviews 04/08-09 of the prior review) without even the
gating discipline the prior review assumed any Option 2 implementation
would still need.

## What is not being claimed here

This review does not claim the prior specification review's
recommendation was binding in a way that made deviating from it a
process violation, or that Option 2 is unconditionally unsafe — Review
20 of the prior review itself frames Option 2 as dominated on
technical merits, not forbidden outright. What this review does claim,
and substantiates in Reviews 04-19, is narrower and directly
verifiable: the specific risks the prior review attached to Option 2
(stored-index leakage, query-time plaintext exposure, an
actively-maintained deletion obligation, a retention-gating
requirement) are exactly the risks this implementation carries, and
none of them is named, mitigated, or flagged as a remaining boundary
anywhere in `docs/secure_runtime_alpha_2501_2580_execution_spec.md` or
`..._completion_declaration.md` — both documents name four other
deliberate boundaries (real decryption, search UI/ranking, a durable
index, cross-conversation authorization) using this codebase's own
"named, not silently dropped" convention, but retention gating is
absent from that list entirely, in either document.
