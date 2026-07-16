# Review 20 — Normative Next Arc

This document is the single normative reference for "what should be
built next." Where it repeats a conclusion from `01`–`19`, this
document governs; the numbered reviews are its supporting derivation.

## Confirmed state of the world, as of this review, checked directly (not assumed)

- `git log --all --oneline` and `git branch -a` from this worktree
  confirm **no `Alpha 851` (or any `851`–`890`) commit exists anywhere
  in this repository's object database** — not on `master`, not on any
  Arc branch, not on any review branch. This review states that
  plainly, per its own required instruction, rather than assuming a
  future Arc's scope or outcome.
- One sibling branch, `arc/private-message-envelope-encryption-activation`
  (tip `5f418ab`), exists, branched directly from this review's own
  base commit `d8bbfae` plus one merge
  (`f86deea`, "Add Private Message Envelope and Encryption Activation
  V1 Specification Review") — **this is a REVIEW-ONLY specification
  document set, not an implementation.** No production source differs
  between `d8bbfae` and `5f418ab` beyond that review's own
  `docs/`/`test/` additions (confirmed by this branch's own log:
  its only non-merge commit is the review-doc commit itself). This
  review does not read that sibling review's content (per this
  review's own instruction not to depend on it) but DOES confirm,
  structurally, that it names no shipped implementation.
- `08`'s own six-sub-check encryption-readiness finding, re-confirmed
  directly against this worktree's checked-out `src/runtime/`,
  `src/crypto/`, `src/vault/` at the time of writing this document:
  `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED = false` (fixed, no override),
  `fedosWasmArtifactGenerated()` fixed `false`, Master Seed Authority's
  one real implementation gated to Development Runtime and further
  blocked by the same absent WASM artifact. **Rust/WASM activation
  remains blocked**, unchanged from the prior Security review's own
  BLOCK-1/2/3 findings, unchanged again at this later commit.

## Three conditional recommendations, one applicable today

**If a future Alpha 851–890 (or equivalently-scoped) Arc fully
succeeds** — meaning a real WASM artifact is built and loaded, a real
`RuntimeCryptoProvider` implementation flips `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`
to `true`, and `08`'s six sub-checks all resolve ready: recommend the
following Arc implement `17`'s Option B in FULL, including `09`'s
Option B lifecycle immediately reaching `"active"` (not merely
`"draft"`) for every correctly-constructed Conversation, since
encryption readiness would no longer be the blocking axis.

**If only Envelope types succeed** — meaning a private message
envelope SHAPE (per the sibling `private_message_envelope_v1` review's
own scope, not read here) is specified and perhaps even
type-constructible, but `08`'s underlying Rust/WASM activation is
STILL blocked: recommend the following Arc implement `17`'s Option B
with `09`'s Option B lifecycle producing `"draft"` Conversations
ONLY — construction proceeds fully (identity, membership, policy,
capability, storage/retention all real and wired), but no Conversation
this Arc constructs is ever presented as `"active"`, honestly matching
`19`'s own "NOT end-to-end encrypted unless verified" prohibition.

**If Rust/WASM activation remains blocked entirely** — meaning `08`'s
findings are unchanged from what this review itself just confirmed:
recommend the following Arc implement ONLY `17`'s two named
prerequisite steps (widen `validateFedosConversationRecord()` to admit
`private-group`/`direct`; add a real per-Conversation Policy Authority
plus widen `validateFedosConversationPolicy()`'s closed vocabularies
per `07`) PLUS `04`/`05`/`06`/`10`/`11`(construction paths
only)/`12`/`13` — i.e. `17`'s full Option B MINUS any claim of
`"active"` lifecycle, which is structurally impossible while `08`
remains blocked. Every Conversation this Arc's own construction
produces is `lifecycleState: "draft"` UNCONDITIONALLY, not merely by
policy choice — `09`'s Option A/B distinction collapses to Option B's
draft-only outcome for the same reason the "only Envelope types
succeed" branch above does, but WITHOUT even a specified envelope
shape to eventually activate against.

## The applicable branch, right now

**The third branch applies.** Confirmed above: no Alpha 851–890
implementation exists in any form, anywhere in this repository, as of
this review's own commit; the one adjacent sibling artifact
(`arc/private-message-envelope-encryption-activation`) is itself
review-only and does not move `08`'s findings at all; and this
review's own direct re-check of `src/runtime/fedos_runtime_crypto_provider.ts`
and `src/runtime/fedos_wasm_artifact.ts` confirms Rust/WASM activation
remains exactly as blocked as `01`/`08` found it.

**Normative recommendation: the next Arc should implement the
Conversation Construction Foundation — `17`'s two named prerequisite
validator-widening steps, plus `04`/`05`/`06`/`10`/`11`/`12`/`13` in
full, with `09`'s Option B lifecycle fixed to `"draft"`
unconditionally for every Conversation it constructs, and NO
Conversation this Arc's own code ever reports as `"active"`.** This is
the largest package that is honestly buildable today, matching `17`'s
own "largest safe package" framing, and it makes no claim `19`
prohibits. Message sending, encryption activation, and per-target
protocol delivery all remain explicitly out of this Arc's scope,
matching `17`'s own rejection of Option E and `18`'s own boundary.

## Dependency graph

```
This review's own scope (04-06, 09-13, 17's prerequisite steps)
    -> a future "Rust/WASM Activation" Arc (independent, not blocked by anything here)
        -> once BOTH complete: a future Arc lifts every constructed
           Conversation's lifecycleState from "draft" to "active"
           for newly-constructible ones, and offers an explicit
           draft-to-active transition operation (09's own "future
           command, not designed here") for ones constructed while
           still blocked.
```

The Conversation Construction Foundation and the Rust/WASM Activation
work are independent and may proceed in parallel — construction never
imports `src/crypto`/`src/runtime` beyond calling `08`'s own read-only
gate function, and Rust/WASM activation never needs to know anything
about Conversation/Membership/Capability. This mirrors the prior
Foundation review's own dependency graph precedent (`docs/reviews/conversation_foundation_v1/15_normative_v1_specification.md`'s
own "Package A ... needs nothing from ... BLOCK-1/2/3 ... and is
therefore buildable in parallel").
