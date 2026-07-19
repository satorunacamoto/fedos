# Review 05 — Encrypted Indexing: The Plaintext Lifetime Invariant Is Extended, Not Preserved

Audit only. No production source change is made anywhere in this review.

## The invariant the prior review's Review 01 established as load-bearing

"Plaintext, today, exists only for the duration of one call stack,
once per read, and is never written to any port" — the prior review's
own central finding, cited by nearly every one of its 20 documents.
This implementation does not reintroduce plaintext at rest (Review 03
of this audit: no disk write anywhere), but it does something the
prior review's own vocabulary does not have a clean name for, because
Option 1/2/3 were evaluated as mutually exclusive designs, not as a
spectrum: it holds plaintext-**derived** data (tokenized terms, one
`Set<envelopeId>` per distinct term) for a lifetime measured in
"however long this process's `FedosConversationSearchIndex` instance
stays alive," which is categorically longer than "one call stack, once
per read." Whether that duration is "the app's session" or "until
process exit" is a caller/host-wiring decision this Arc does not make
— but the module itself provides no mechanism (TTL, size bound, or
periodic clear) that would cap it at anything shorter, and the
execution spec's own "deliberately out of scope" section does not name
"how long indexed tokens live" as a boundary at all.

## Why "it's just in memory" undersells the actual exposure surface

The prior review's own Review 08 already establishes, in the abstract,
why a plaintext-derived inverted index is a real leak vector
independent of where it lives: "Anyone who obtains the raw index file
... learns approximate content shape (common terms, their relative
frequency) without decrypting anything." An in-process `Map` is not
immune to this — it is reachable by anything with access to the
process's own memory: a debugger attached to the running process, a
core dump taken after a crash, a heap snapshot (Node's own
`--inspect`/`v8.writeHeapSnapshot()`), or swapped-out memory pages on a
device without full-disk encryption. None of these require the
attacker to have defeated `FedosConversationPayloadStorage`'s own
ciphertext-at-rest protection — they only require access to a
long-lived, plaintext-token-bearing data structure the ciphertext
protection was never designed to defend, because nothing in this
domain held one before this Arc.

## What this review is not claiming

This is not a claim that in-memory state is uniquely dangerous in a
way that makes this implementation unshippable, or that every
in-memory cache in this codebase needs the same scrutiny — ordinary,
short-lived, request-scoped plaintext (the kind `decrypt()` already
produces) is exactly what the prior review's own Review 01 already
found acceptable. The distinction this document draws is between
transient, call-stack-scoped plaintext (already accepted) and a
standing, queryable, growing index built from it (a new category this
Arc introduces, evaluated by the prior review under the name "Option
2," and left, by that review's own recommendation, for a future Arc to
build only alongside the gating and encryption-at-rest treatment
Reviews 08/11/17 require).
