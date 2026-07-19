# Review 10 — Archive Search: Corpus Compatibility Confirmed

Audit only. No production source change is made anywhere in this review.

## The prior review's prediction

The prior review's Review 10 predicted that Archive-restored content
would be "mechanically indexable with zero new code," because Archive
payloads are the identical wire shape as live payloads, and any
indexing hook placed at the right point would cover them automatically
via the existing envelope codec.

## What was actually built, and why the prediction holds

`fedosConversationSearchDocumentsFromArchiveBundle()` in
`fedos_conversation_search_archive_index.ts` reuses
`deserializeFedosConversationMessageEnvelope`
(`../envelope/persistence/fedos_conversation_message_envelope_codec.ts`)
directly, exactly matching Archive Restore's own "deserialize via the
record's own existing codec, never re-implement validation" discipline
the execution spec names. A malformed record is skipped (`continue`),
never thrown — consistent with Archive Restore's own established "a
partially-invalid Archive should not block the rest" precedent. This
part of the prior review's own prediction is accurate and the
implementation follows it correctly.

## The one way this implementation differs from the prior review's own architecture

The prior review's Review 05 required a single hook point — the
Decryption Authority's own call site — as "the only legitimate place"
plaintext-derived indexing may originate, specifically so an indexing
process is always a "consumer of an already-authorized decrypt
result," never an independent decryption trigger. This implementation
has no hook at the Decryption Authority at all (Review 02 of this
audit: it is Option 2, built from caller-supplied plaintext, not a
decrypt-time observer). For the Archive path specifically, this means
`indexArchiveBundle()` accepts an arbitrary `plaintextByEnvelopeId`
map from its caller, with no verification that the caller obtained
that plaintext through any authorized decrypt path at all, membership
readiness included. This is not a defect distinct from Review 02's
central finding — it is the same finding, restated for the Archive
entry point specifically, and it is what makes Review 11's finding
possible.
