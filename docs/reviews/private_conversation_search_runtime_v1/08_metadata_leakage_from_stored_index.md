# Review 08 — Metadata Leakage: What This Implementation's Own Indexes Store

Audit only. No production source change is made anywhere in this review.

## Applying the prior review's framework to the actual sub-indexes

The prior review's Review 08 named three specific additive leaks a
stored index introduces beyond Envelope metadata's own pre-existing
exposure: term-frequency/co-occurrence structure, token linkability,
and index-size-as-activity-signal. This document checks each against
the seven sub-indexes actually built.

- **`FedosConversationSearchKeywordIndex`** carries the sharpest form
  of the first risk: `#envelopesByToken` is a direct term→message-id
  map over raw, unhashed, lower-cased plaintext tokens (Review 04 of
  this audit) — exactly "Option 2 in its least-careful form," which
  Review 08 of the prior review names as requiring its own
  encryption-at-rest "not merely 'store it locally and call it safe.'"
  Anyone with read access to a running process's memory (Review 05 of
  this audit) can enumerate every distinct term ever indexed and every
  message id containing it — full term-frequency and co-occurrence
  structure, in the clear.
- **`FedosConversationSearchDateIndex`/`FedosConversationSearchReplyIndex`**
  add nothing beyond the Envelope's own pre-existing `createdAt`/
  `replyToEnvelopeId` fields (Review 08 of the prior review's own
  finding: Envelope metadata exposure predates any index) — these two
  sub-indexes are a faithful, no-new-leak mirror of data already
  locally readable without this Arc.
- **`FedosConversationSearchParticipantIndex`** adds one genuinely new,
  small piece of state beyond Envelope/Membership data: `#resolvedByMembershipId`,
  a cache of resolved `FedosConversationParticipantReference` per
  membership id, which is **never cleared by `removeDocument()`** —
  confirmed by reading `removeDocument()`, which touches only
  `#envelopesByParticipantKey` and `#keyByEnvelope`. This is a
  reasonable memoization choice on its own terms (membership ids are
  deterministic, per the file's own header), but it means participant
  identity resolution outlives every envelope that ever referenced it,
  for the life of the index instance — a minor instance of the same
  "outlives a single query" pattern Review 05 of this audit names for
  the keyword index, on identity data rather than content.
- **`FedosConversationSearchModeIndex`/`FedosConversationSearchArchiveIndex`**
  classify conversations, not messages, and duplicate nothing the Draft
  and Archive domains do not already expose locally.

## Result

The keyword index is where the prior review's Review 08 concern lands
with full force in this implementation; the metadata sub-indexes
(date, reply, mode, archive) do not add meaningfully to what Envelope
persistence already exposes; the participant index adds one small,
long-lived identity-resolution cache worth naming but not urgent on
its own.
