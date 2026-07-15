# Secure Runtime Alpha 537 — README Status Update

Stage 17 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

**Status: this Stage UPDATES the README only.** The top-level `README.md`
status banner is replaced with the Alpha 521–540 summary; the prior
Alpha 501–520 banner is preserved beneath it as "Prior status", the
same nesting convention every previous Arc's own README update has
used (e.g. Alpha 500 → Alpha 517 → Alpha 520).

## 1. What changed

`README.md`'s top status block now leads with "Secure Runtime Alpha
521–540 — Durable Delivery Retry Coordination Arc (complete)",
summarizing: the attempt-scoped subject-identity fix, the four new
files (`fedos_delivery_attempt_subject_id.ts`,
`fedos_delivery_retry_reason_codec.ts`, `fedos_delivery_retry_registry.ts`,
`fedos_delivery_retry_query.ts`), the `FedosHostDeliveryController`
rewiring, the honestly-disclosed registry-persistence bug and its
one-field fix, the unchanged-file guarantees (Scheduler/Publisher/Outbox/
canonical Observation model/Host public API), and the three named
Verification case groups. Everything below it — the older Alpha
501–520 block through the very first Alpha status entries — is
untouched, just pushed one level deeper under "Prior status:".

## 2. What did NOT change

No other section of `README.md` (`## What is implemented`, `## Security
scope`, `## Commands`, `## Roadmap (stages)`, the numbered Stage log)
is touched by this Stage — the numbered Stage log's own most recent
entries (Alpha 056/059 etc.) remain exactly where they were; this
Arc's own per-Stage record lives in `docs/`, not inline in the
numbered list, matching the convention Alpha 501–520's own README
update already established.

## 3. See also

- `docs/secure_runtime_alpha_531_ripple_review.md`
- `docs/secure_runtime_alpha_517_readme_status_update.md`
- `docs/secure_runtime_alpha_538_final_verification.md`
