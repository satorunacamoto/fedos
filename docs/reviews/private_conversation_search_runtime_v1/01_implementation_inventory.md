# Review 01 — Implementation Inventory

Audit only. No production source change is made anywhere in this review.

## What this review is auditing

`review/private-conversation-search-v1` (commit `4721077`) is a
**specification review** — 20 documents evaluating, without building,
how private-conversation search should work, grounded against this
codebase's own real source as of base commit `8c48c95`. Its own Review
20 recommendation was explicit: implement **Option 1 (query-time
decrypt-and-scan)**, gated through `FedosPayloadRetentionAuthority`,
with a blind/searchable index (Option 3) named as a future evolution.
Option 2 (a persisted plaintext-derived index) was explicitly, by name,
**not recommended at any point** ("dominated by Option 3 on every axis
except implementation cost").

This review audits what actually landed since then: nine new files
under `src/conversation/search/` (staged, uncommitted at review time,
authored as "Secure Runtime Alpha 2501–2580: Conversation Search
Runtime") plus four new test files and two docs
(`docs/secure_runtime_alpha_2501_2580_execution_spec.md`,
`..._completion_declaration.md`). This is a source-code audit against a
prior specification review's own recommendation, not a second
from-scratch specification review — Reviews 01-03 here inventory what
was built; Reviews 04-19 check it against each of the prior review's 19
substantive topics; Review 20 synthesizes.

## What was built, file by file

- `fedos_conversation_search_document.ts` — `FedosConversationSearchEnvelopeDocument`, a type-only indexable unit. `text: string | null` is documented as caller-supplied, already-decrypted plaintext.
- `fedos_conversation_search_incremental_index.ts` — a `Set<string>` dedup guard (`shouldIndex`/`markIndexed`/`markRemoved`).
- `fedos_conversation_search_keyword_index.ts` — an inverted index: `Map<token, Set<envelopeId>>` plus the reverse `Map<envelopeId, tokens[]>`, built by tokenizing `doc.text` and retained until `removeDocument()` is called.
- `fedos_conversation_search_date_index.ts` — `Map<createdAt, Set<envelopeId>>`, range-queryable.
- `fedos_conversation_search_reply_index.ts` — parent/child maps over `replyToEnvelopeId`.
- `fedos_conversation_search_participant_index.ts` — resolves `senderMembershipId` via `FedosConversationMembershipAuthority.listMemberships()`, memoized in `#resolvedByMembershipId`, bucketed by participant.
- `fedos_conversation_search_mode_index.ts` — `Map<conversationId, mode>`, resolved via `FedosConversationDraftPersistence.getDraft()`.
- `fedos_conversation_search_archive_index.ts` — converts a `FedosConversationArchiveBundleV1`'s `envelopes` into search documents via the existing envelope codec, plus a `Map<conversationId, restoredAt>` tracking which conversations arrived via Archive.
- `fedos_conversation_search_index.ts` — `FedosConversationSearchIndex`, the facade composing all of the above.

## The one fact every later document in this review is built on

**None of these nine files imports from, or calls anything in,
`src/conversation/retention/`.** A direct grep of
`src/conversation/search/` for `retention`/`Retention` returns exactly
two hits, both in comments (`fedos_conversation_search_keyword_index.ts`
line 24-25, `fedos_conversation_search_reply_index.ts` line 16) citing
`FedosPayloadRetentionAuthority` rhetorically, as a precedent for an
unrelated discipline ("no field/method that overpromises," "no
cascading delete") — never as an actual dependency, gate, or call.
`FedosConversationSearchIndexDependencies` is a `Pick<...,
"draftPersistence" | "membershipAuthority">` — it has no third field for
a retention port of any kind. This is the load-bearing fact Reviews
02, 11, 17, and 18 trace through to concrete consequences.
