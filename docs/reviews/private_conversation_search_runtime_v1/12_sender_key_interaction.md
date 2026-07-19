# Review 12 — Sender-Key Interaction: No Change From the Prior Review's Analysis

Audit only. No production source change is made anywhere in this review.
Cross-branch grounding disclosure: `src/conversation/group/` and
`src/conversation/delivery/` are confirmed absent from the current base
(`c889562`) by direct listing — identical to the prior review's own
base commit (`8c48c95`). This document's Sender-Key grounding is
therefore cited, unchanged, to the Sender-Key review (commit `5b55ed6`,
`review/private-group-crypto-v2`), matching the prior review's own
disclosure discipline.

## Why this implementation's own design is agnostic to the question, exactly as predicted

The prior review's Review 12 predicted that a decrypt-time indexing
hook would be "agnostic to whether the underlying conversation key
came from today's static pairwise NIP-44 derivation ... or, in the
future, from a Sender-Key chain key," because search consumes
already-decrypted plaintext and never performs or inspects key
derivation itself. This implementation goes one step further than the
hypothetical the prior review evaluated: it has no decrypt-time hook of
any kind (Review 02 of this audit), and instead consumes plaintext
supplied entirely by the caller via
`FedosConversationSearchEnvelopeInput.text`/
`plaintextByEnvelopeId`. It therefore has zero code path that touches,
inspects, or depends on `encryptionSuite`, `keyEpoch`, or any
key-derivation concept at all — `FedosConversationSearchEnvelopeDocument`
explicitly excludes both fields (its own header: "`payloadId`/
`encryptionSuite`/`keyEpoch` carry nothing a search index needs and are
left out"). The prior review's own conclusion — that search has
"exactly one dependency on the Group-crypto scheme question `5b55ed6`
already answers: it needs SOMETHING to call `decrypt()` successfully" —
holds for this implementation in an even weaker form, since this
implementation does not even require that; it requires only that its
caller eventually supply plaintext by whatever means.

## Rotation and re-indexing

The prior review's Review 12 finding — that an index entry, once built
from successfully decrypted content, never needs rebuilding merely
because a key was later rotated — applies unchanged: nothing in
`FedosConversationSearchIncrementalIndex`'s dedup guard is keyed to, or
invalidated by, any key-epoch concept, consistent with the document
model excluding `keyEpoch` entirely.

## Result

No new finding. This implementation's relationship to Sender-Key
adoption is unchanged from, and slightly simpler than, what the prior
review already evaluated.
