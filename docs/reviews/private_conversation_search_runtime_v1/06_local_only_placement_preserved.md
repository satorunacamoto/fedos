# Review 06 — Local-Only Search: Placement Is Genuinely Preserved

Audit only. No production source change is made anywhere in this review.

## What the prior review required, and what this implementation does

The prior review's Review 06 required that no plaintext-derived data
leave the local device — "never synced to a server, never included in
any relay-facing publish path, and never queryable by any account
other than the one whose Master Seed produced the key material that
built it." This audit confirms, by direct source inspection, that
`src/conversation/search/` contains no network call of any kind: a
grep across all nine files for `fetch`, `XMLHttpRequest`,
`WebSocket`, `axios`, and any import from a transport/relay module
(`src/conversation/transport/`) returns zero matches. The execution
spec's own "no network, no file, no timer, no `process.env` read"
guardrail (stated in `fedos_conversation_search_index.ts`'s own header)
is accurate.

## Why this is not the same as saying the placement question is closed

Local-only *placement* (this document's subject) and local-only
*safety* (Reviews 04-05, 08-09, 11 of this audit) are different axes,
exactly as the prior review's own Review 06 states: "'Local-only'
constrains WHERE any index lives, never WHAT FORM it takes." This
implementation gets the WHERE question right — nothing it builds is
reachable off-device by construction, because nothing it builds is
reachable off-device at all, today. Review 07 of this audit addresses
the one way that guarantee is weaker than it looks.

## Cross-account queryability

The prior review's Review 03 named cross-account queryability as one
of the three properties that make the public indexer wrong for private
content. This implementation has no cross-account query surface of any
kind: every accessor (`searchKeyword`, `envelopesByParticipant`,
`conversationsByParticipant`, `envelopesBetween`) operates over one
`FedosConversationSearchIndex` instance's own already-ingested state,
with no account/identity parameter accepted anywhere that could
broaden a query beyond what was fed into that specific instance. This
correctly inherits the constraint the prior review named, without
needing new code to enforce it — there is simply no code path capable
of violating it.
