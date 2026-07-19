# Review 17 — Deleted Conversations: removeEnvelope() Is a Mechanism With No Attached Policy

Audit only. No production source change is made anywhere in this review.

## What the prior review required

The prior review's Review 17 requires, for the one retention meaning
with a real search-specific consequence
(`"local-payload-removed"`): "if a persisted index ... stores
index-derived data ... SEPARATELY from the payload bytes themselves,
that index-derived data must ALSO be actively removed at this
transition, not merely gated at query time" — because an index that
retains a plaintext excerpt or token set after this transition would
make the index a *stronger* disclosure vector than the now-inaccessible
ciphertext itself.

## What this implementation provides, and what it does not connect

`FedosConversationSearchIndex.removeEnvelope()` is a real, correctly
implemented mechanism satisfying exactly the "actively removed" half of
this requirement at the per-envelope level: it purges the id from the
keyword, date, reply, and participant sub-indexes and reopens the
Incremental guard, verified directly by this Arc's own delete test
suite (`test/secure_runtime_alpha_2541_2560_search_index_incremental_and_delete.test.ts`).
What is missing is the connective policy Review 17 also requires: **no
code anywhere in this Arc calls `removeEnvelope()` in response to a
`FedosPayloadRetentionAuthority` state transition.** The two systems
are not wired together at all — `FedosPayloadRetentionAuthority` has no
observer/event mechanism this module subscribes to, and this module
exposes no method (e.g. `onPayloadTombstoned(envelopeId)`) that a
retention-aware caller could call automatically rather than remembering
to call `removeEnvelope()` manually, in addition to, and in the same
moment as, a `tombstonePayload()`/`removeLocalPayload()` call.

## Why "the caller can just call both" is not sufficient here

Review 11 of this audit already establishes that neither the Archive
path nor the live-index path threads retention state through at
ingestion time. This document's finding is the mirror image at
deletion time: even a caller that diligently calls
`retentionAuthority.tombstonePayload(id)` has no structural signal from
this module that it must *also* call `searchIndex.removeEnvelope(id)`
— the two calls are two independent, easy-to-desynchronize steps a
caller must remember to perform together, with no shared transaction,
no shared event, and no test anywhere in this Arc's own suite
exercising the combination. `FedosConversationSearchArchiveIndex.forgetConversation()`
and `FedosConversationSearchModeIndex.removeConversation()` exist on
their respective sub-indexes but are never called by the facade
(`fedos_conversation_search_index.ts` has no `forgetConversation`/
`removeConversation` call anywhere) — conversation-level classification
and archive-provenance data is never purged by anything in this Arc,
even when every envelope of a conversation has been removed.

## What this review recommends

Name the caller obligation explicitly in this module's own
documentation (as Review 11 of this audit recommends for the ingestion
side), and consider exposing the two currently-dead sub-index methods
(`forgetConversation`/`removeConversation`) through the facade so a
future retention-aware caller has a complete, discoverable removal
surface rather than one that requires reaching into internal sub-index
instances the facade otherwise keeps private.
