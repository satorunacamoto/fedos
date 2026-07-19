# Review 20 — Findings Summary and Recommendation

Audit only. No production source change is made anywhere in this review.
No Alpha number is assigned to this review or to the Arc it recommends.

## What this audit confirms was done correctly

- Domain separation is honored: everything lives under
  `src/conversation/search/`, nothing reuses `src/indexer/` or
  `src/vault/` (Review 03).
- Local-only placement holds: no network, no file, no disk persistence
  anywhere in the new directory (Review 06).
- Dependency reuse follows established conventions: the runtime
  dependency `Pick`, the archive codec reuse, the "no cascading delete"
  precedent are all genuinely present (Review 03).
- Sender-Key/Group-crypto agnosticism and recipient-asymmetry
  preservation both hold, for the same structural reason: this module
  performs no key-derivation-aware or Group-aware logic of any kind
  (Reviews 12-14).
- No ranking beyond AND-semantics token matching was built, matching
  what was actually authorized (Review 15-16).
- No vector/embedding search exists (Review 19).

## The findings, ranked by severity

1. **(High) No retention gating anywhere in the ingestion path.**
   `indexEnvelope()`, `indexEnvelopes()`, and `indexArchiveBundle()`
   never call `FedosPayloadRetentionAuthority.evaluatePayloadAccess()`
   or any equivalent gate, directly contradicting the prior
   specification review's own explicit, three-times-repeated
   requirement (Reviews 11, 17, 18 there; Review 11 here). This is not
   a hypothetical: Review 18 of this audit shows the exact failure mode
   is reproducible with this Arc's own existing test fixtures. This
   finding is silent, not named, in either the execution spec or the
   completion declaration, despite both documents otherwise carefully
   naming other deliberate boundaries.
2. **(High) The implementation is Option 2, the one option the prior
   review explicitly declined to recommend at any point**, and it
   carries that option's full leakage profile (raw plaintext tokens,
   in-process but long-lived, plaintext query arguments) with none of
   the mitigations (encryption-at-rest, or Option 3's blind tokens) the
   prior review discussed as the price of choosing it (Reviews 02,
   04-05, 08-09).
3. **(Medium) Deletion has no attached policy.** `removeEnvelope()` is
   mechanically correct but never invoked in response to a retention
   transition, and two sub-index removal methods
   (`forgetConversation`/`removeConversation`) are unreachable dead code
   from the facade (Review 17).
4. **(Low) Result ordering for `search()`/`repliesTo()`/
   `envelopesByParticipant()` is deterministic but not
   recency-consistent**, unlike `envelopesBetween()`'s own existing
   `(createdAt, envelopeId)` convention and unlike the prior review's
   own Review 16 recommendation (Review 15).
5. **(Low) `groupConversationIds()`'s own docstring does not disclose
   that it returns classification only, not resolved pairwise search
   targets** — cheap to fix, worth fixing before a future Arc
   misreads it (Review 13).
6. **(Informational) The in-memory-only guarantee has no structural
   guardrail against a future Host-wiring Arc adding disk persistence
   without re-deriving the local-only/retention discipline this audit
   and the prior review both require of any *persisted* Option 2/3
   index** (Review 07).

## Recommendation

**Before any Host-wiring Arc connects this module to live application
code**, resolve finding 1 (retention gating) and finding 2 together, by
one of two paths:

- **(a) Retrofit the recommendation, cheaply.** Add retention gating to
  `indexEnvelope()`/`indexArchiveBundle()` (accept an injected
  `FedosPayloadRetentionAuthority`-shaped dependency, call
  `evaluatePayloadAccess()` per envelope, skip denied payloads exactly
  as `readPayload()` already does for ordinary reads) and wire
  `removeEnvelope()` to fire on `tombstonePayload()`/
  `removeLocalPayload()` outcomes. This keeps Option 2's architecture
  but closes the two concrete, reproducible gaps this audit finds,
  and is a small, additive change to an otherwise well-structured
  module.
- **(b) Follow the prior review's own recommendation as originally
  written.** Replace the persisted keyword index with query-time
  decrypt-and-scan (Option 1), gated per-query through the same
  Retention Authority, deferring a persisted index to a future Arc that
  also specifies Option 3's token construction — closing the gap by
  removing the persisted artifact rather than gating it.

This audit does not choose between (a) and (b) — that is an
implementation-cost-versus-architecture decision for the next Arc,
exactly as the prior review's own Review 04 declined to specify Option
3's token construction for the same reason (security-critical design
work outside a review document's own authority). What this audit does
recommend unconditionally is that finding 1 not ship to any
caller-reachable Host wiring unresolved, in either direction, and that
whichever path is chosen be named explicitly in this module's own
documentation rather than left implicit.
