# Review 04 — Encrypted Indexing: The Keyword Index Is Option 2, Not Query-Time Scan

Audit only. No production source change is made anywhere in this review.

## What "persisted" means for the purpose of the prior review's Option 1 vs Option 2 distinction

The execution spec's own "no new persistence" claim
(`docs/secure_runtime_alpha_2501_2580_execution_spec.md`, decision 3)
is narrowly true: nothing in `src/conversation/search/` writes to
disk. But the prior review's own Option 1/Option 2 distinction was
never about disk durability — Review 01 of the prior review frames it
as "does a proposed search mechanism require plaintext to exist
somewhere it does not exist today, and if so, ... for how long." The
answer for `FedosConversationSearchKeywordIndex` is unambiguous: every
token derived from `doc.text` is written into
`#envelopesByToken`/`#tokensByEnvelope` in `indexDocument()` and
remains there — queryable, in process memory, across arbitrarily many
subsequent `search()` calls, for the lifetime of the
`FedosConversationSearchIndex` instance — until an explicit
`removeDocument()`/`removeEnvelope()` call. This is categorically
different from Option 1's own defining property (Review 04 of the
prior review: "discarding it immediately after" each query) and is,
instead, exactly Option 2's defining property (Review 01: "a durable
store mapping search terms to message ids, built once ... and queried
cheaply thereafter") — "durable" there means "outlives a single query,"
not "written to disk," and process memory satisfies that reading
precisely.

## Concrete evidence from the source

`fedos_conversation_search_keyword_index.ts`:

```ts
indexDocument(doc: FedosConversationSearchEnvelopeDocument): void {
  if (doc.text === null) return;
  const tokens = tokenize(doc.text);
  this.#tokensByEnvelope.set(doc.envelopeId, tokens);
  for (const token of tokens) {
    let bucket = this.#envelopesByToken.get(token);
    ...
    bucket.add(doc.envelopeId);
  }
}
```

There is no expiry, no TTL, and no bound on how many documents'
tokens accumulate in `#envelopesByToken`. A caller that indexes a
device's full local message history (exactly the "large dataset"
scenario the implementation's own test suite exercises — 3,000
Envelopes across 20 conversations) produces an inverted index over
every token in every locally-decrypted message, held for the process's
entire lifetime.

## Why this is not automatically disqualifying, and what it does require

The prior review's own Review 20 did not forbid Option 2; it declined
to recommend it as the default, specifically because it "combines
Option 1's implementation cost ... with Option 3's storage-artifact
burden, while having the worst leakage profile of the three." Reviews
08-09 and 11/17-18 of this audit trace each of those three costs
through to this specific implementation, to establish whether they
were paid for or left outstanding.
