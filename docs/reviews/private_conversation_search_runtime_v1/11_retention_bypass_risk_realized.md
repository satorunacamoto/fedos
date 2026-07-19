# Review 11 — Archive Search: the Predicted Retention-Bypass Risk Is Now Realized in Shipped Code

Audit only. No production source change is made anywhere in this review.
This is this audit's single highest-severity finding.

## What the prior review found and required

The prior review's Review 11 found, by direct inspection of
`fedos_conversation_archive_collector.ts`/`fedos_conversation_archive_restore.ts`,
that Archive export/restore bypasses `FedosPayloadRetentionAuthority`
entirely — a locally tombstoned or removed payload's ciphertext is
exported and restored exactly as if it had never been touched, because
neither file calls `evaluatePayloadAccess()`/`readPayload()`, both
reading/writing the raw `payloadStorage` port directly. Its own
recommendation, restated by Review 17 (general rule) and Review 18
(restore-ordering consequence), and repeated a third time in Review
20's dependency graph, was unconditional: **"Any indexing hook ...
must gate through `FedosPayloadRetentionAuthority.evaluatePayloadAccess()`
before indexing a payload, exactly as `readPayload()` already does
before returning bytes for ordinary reads — never iterate
`FedosConversationPayloadStorage` directly."**

## Confirmed unchanged on the current base

This audit re-verified Review 11's own finding against the current
tip (`c889562`), not merely trusted it: `git grep -n
"retention\|Retention" src/conversation/archive/` returns no matches in
either `fedos_conversation_archive_collector.ts` or
`fedos_conversation_archive_restore.ts`; `payloadStorage.getPayload(id)`
and `payloadStorage.putPayload(...)` are still the only payload-byte
calls in either file. The bypass the prior review found is real,
current, and unchanged by anything landed since.

## What this implementation adds on top of that pre-existing bypass

`fedosConversationSearchDocumentsFromArchiveBundle()` iterates
`bundle.envelopes` directly and indexes every one it can deserialize,
with `text: plaintextByEnvelopeId.get(envelope.id) ?? null` — no
retention check of any kind, and no parameter through which one could
be threaded even by a careful caller (the function's signature has no
retention-authority argument, no per-payload access-decision input).
`FedosConversationSearchIndex.indexArchiveBundle()` calls this
function and then `#ingest()`s every resulting document unconditionally.
The identical gap exists for the live path: `indexEnvelope()`/
`indexEnvelopes()` accept a `FedosConversationSearchEnvelopeInput`
(envelope + already-decrypted text) from the caller with no retention
gate either.

**Concretely, per the prior review's own Review 17 scenario:** a
payload the user tombstoned via
`FedosPayloadRetentionAuthority.tombstonePayload()`
(`"application-hidden"`/`"logically-tombstoned"`) remains physically
present in `FedosConversationPayloadStorage` — the retention domain's
own documented behavior, never disputed by this audit. If that
payload's plaintext is ever re-obtained by any means (the same
Archive-export-then-restore round-trip Review 11 of the prior review
already demonstrated works today, or simply a caller that already held
the plaintext from before the tombstone), nothing in
`src/conversation/search/` refuses to index it. It is indistinguishable,
to this module, from an ordinary active message.

## Why this is not closed by "the caller is responsible for gating"

A caller-gating requirement is a legitimate design (Option 1 in the
prior review's own framing puts the gate at query time, per-decrypt,
which is inherently caller-adjacent). What makes this a genuine gap,
not merely an unstated assumption, is that **the prior review already
named this exact requirement, in writing, three times, before this Arc
was built** — and neither `docs/secure_runtime_alpha_2501_2580_execution_spec.md`
nor `..._completion_declaration.md` names "callers must gate through
`FedosPayloadRetentionAuthority` before calling `indexEnvelope`/
`indexArchiveBundle`" as a requirement, a caller contract, or even a
named boundary anywhere. The execution spec's own "Deliberately out of
scope (named, not silently dropped)" section lists four boundaries;
retention gating is not a fifth. This is the one boundary this audit
finds silently dropped rather than named.

## What this review recommends

Before any Host-wiring Arc connects live application code to
`FedosConversationSearchIndex.indexEnvelope()`/`indexArchiveBundle()`,
either (a) the module itself should accept and call
`FedosPayloadRetentionAuthority.evaluatePayloadAccess()` per envelope
before ingesting it, refusing (not merely skipping) a denied payload,
or (b) if the gating is to remain a caller responsibility by design,
that contract must be stated explicitly in this module's own
documentation, in the same "named, not silently dropped" register the
execution spec already uses for its other four boundaries — silence on
this specific point is the actual defect this review identifies, not
merely the absence of gating code.
