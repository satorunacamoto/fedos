# Review 18 — Restored Conversations: the Prior Review's Predicted Gap Is Realized Exactly as Described

Audit only. No production source change is made anywhere in this review.

## The prior review's own prediction, restated

The prior review's Review 18 predicted, by composing Review 11
(Archive bypasses retention) with Review 17 (any index build must gate
through retention), that "an index rebuild that runs immediately after
an Archive restore ... will index every restored payload as if it were
`'active'`" — and that this is not fixable by sequencing ("index after
restore completes" does not help), because the Archive bundle format
itself never carries retention history (Review 11 of the prior review).
Its own recommendation was an honest-labeling interim position: index
built from Archive-restored content should be understood as reflecting
"the RESTORING device's own local retention history only."

## What this implementation actually does

`FedosConversationSearchIndex.indexArchiveBundle(bundle,
plaintextByEnvelopeId, restoredAt)` indexes every envelope
`fedosConversationSearchDocumentsFromArchiveBundle()` can deserialize
from `bundle.envelopes`, unconditionally (Review 11 of this audit), and
separately calls `#archive.recordRestoredConversation(conversationId,
restoredAt)` — which records only a timestamp, never a retention
decision or provenance flag of any kind. This confirms the prior
review's own prediction precisely: a message tombstoned on the
exporting device before that device's most recent export will be
indexed as fully active, and fully searchable, on the restoring device,
with the only trace of the restore event being an unrelated
`restoredAt` timestamp that carries no retention information.

## Why `isFromArchive()` does not close this gap

`FedosConversationSearchIndex.isFromArchive(conversationId)` answers
"did this conversation arrive via Archive Restore," which is a real,
useful, correctly-implemented capability the prior review's own Review
10/13 origin-tracking discussion did not explicitly require but is a
reasonable addition — but it answers a different question from "was
this specific message's retention state ever reconciled." A caller
could, in principle, use `isFromArchive()` as a signal to treat
restored conversations' search results with extra caution, but nothing
in this Arc does so today, and nothing in the execution or completion
declarations names this connection as intended future use.

## Result

This is the same underlying gap as Review 11 of this audit, observed
from the restore-ordering angle the prior review's own Review 18
specifically anticipated. This document adds no new remediation beyond
Review 11's own recommendation — it confirms that recommendation's
urgency, since the predicted failure mode is not hypothetical against
this implementation; it is directly reproducible with the test
fixtures this Arc's own `test/secure_runtime_alpha_2561_2580_archive_index_and_large_dataset.test.ts`
already constructs (a real Bundle round-tripped through the existing
collector/restore path), simply by tombstoning a payload before export
and observing that `searchKeyword()` still returns it after restore.
