# Secure Runtime Alpha 494 — State Transition Contract

Stage 4 of the Alpha 491–500 Canonical Publisher & Delivery Observation
Contract Reconciliation Arc.

## 1. The graph, fixed

```
queued
  ↓
publishing
  ├── accepted   (terminal)
  ├── rejected   (terminal)
  └── failed     (terminal)
```

Encoded as a plain, exported data table
(`fedos_delivery_observation_transition_graph.ts`, Alpha 495) — never a
scattered set of `if` statements duplicated per caller.

## 2. First-observation rule

A subject with NO prior recorded observation may legally begin at
EITHER `queued` OR `publishing` — not only `queued`. Reason: `queued`
is authored at Outbox-intent-creation time (Alpha 415), a moment
outside this Arc's own scope; a Scheduler-sourced bridge (Alpha 497)
never records an explicit `queued` fact at all and legitimately starts
a subject's history at `publishing`. Both are therefore valid first
facts; `accepted`/`rejected`/`failed` as a FIRST fact are not (this
Arc's own explicit prohibition: "publishingなしのterminal
observation").

## 3. Forbidden transitions (this Arc's own explicit list, all enforced)

- `accepted → publishing`
- `rejected → accepted`
- `failed → accepted`
- `queued → accepted` (must pass through `publishing`)
- any terminal state (`accepted`/`rejected`/`failed`) as a first fact
  with no prior `publishing`
- **any observation at all after a terminal state** — this Arc adopts a
  single-attempt-per-`subjectId` model (§4).

## 4. Multi-attempt / retry re-entry — explicitly NOT designed this Arc

The instruction conditionally allows re-entry ("再試行を別attemptとして
扱う設計なら、attempt identityを明示すること") — this Arc does not
choose that design. `subjectId` names ONE delivery attempt's lifecycle,
full stop; a second attempt for the same logical post/target requires
either a fresh `subjectId` (the caller's own responsibility, entirely
outside this file) or a future Arc that adds an explicit attempt
identity to the vocabulary. Choosing this now, rather than
half-designing attempt identity as a side effect of the validator
(Alpha 495), keeps this Arc's own "no new retry algorithm" boundary
unambiguous: nothing here decides how or whether to re-attempt.

## 5. Staleness — a second, independent check

Alpha 483 §3's own demonstrated gap: a chronologically-later fact can
silently override a genuinely-later fact if `observedAt` values race.
The validator (Alpha 495) additionally rejects any candidate whose
`observedAt` is STRICTLY LESS than the subject's current latest
recorded `observedAt` — independent of whether the state-name
transition itself would otherwise be legal.

## 6. Enforcement point

Per this Arc's own instruction ("単なるコメントではなく、書き込み境界
で検証可能にする"), this is a checkable, callable boundary
(`validateFedosDeliveryObservationTransition`, Alpha 495) — not prose.
`test/secure_runtime_alpha_494_*.test.ts` exercises the full table
mechanically against the exported graph.

## 7. See also

- `docs/secure_runtime_alpha_483_delivery_state_transition_closure_review.md`
- `docs/secure_runtime_alpha_493_canonical_delivery_observation_vocabulary.md`
