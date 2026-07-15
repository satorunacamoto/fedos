# Secure Runtime Alpha 461 — Existing Observation Vocabulary Inventory

Stage 1 of the Alpha 461–470 Canonical Delivery Observation Arc. Review
only — no code change. Records, by direct inspection of the working
tree at the time this Stage was written, why this Arc builds a
standalone Observation vocabulary rather than extending an existing
one.

## 1. Committed-history vocabulary

`docs/secure_runtime_alpha_415_outbox_state_observation_separation.md`
(Alpha 415, committed) names six CANDIDATE observation kinds as
vocabulary only, deliberately unimplemented: `queued`,
`attempt-started`, `delivered`, `rejected`, `failed`, `abandoned`. No
code realizing any of them exists in any committed revision of this
repository.

## 2. Uncommitted working-tree findings

Two separate, uncommitted, in-progress threads already sit in this
working tree (`git status --short`, re-confirmed at the start of this
Stage):

- **`src/board/publish/nostr/*`** (labeled Alpha 451–460 in its own
  doc comments) — a transport-only `FedosNostrBoardPublisher`.
  `docs/secure_runtime_alpha_452_...md` explicitly REJECTS any
  `outcome`/result-object field as "Observation vocabulary... explicitly
  prohibited" under its own scope. It produces no Observation of any
  kind.
- **`src/board/outbox/fedos_board_outbox_observation.ts`** (labeled
  Alpha 475 in its own doc comment) — realizes FIVE of Alpha 415's six
  candidates (`attempt-started`/`delivered`/`rejected`/`failed`/
  `abandoned`) as `FedosBoardOutboxObservation`, consumed by the
  also-uncommitted `FedosPublishScheduler`
  (`src/board/outbox/fedos_publish_scheduler.ts`). Its own header states
  it is deliberately NOT persisted this (uncommitted) Arc.

Both threads are genuinely uncommitted (`git log` shows zero commits
touching either), only partially documented (docs exist through Stage 3
of the first thread and Stage 3 of the second, while the source files
themselves claim later Stage numbers), and have no test coverage for
the Stages their own source claims to implement.

## 3. This Arc's own scope decision

This Arc's own instructions (states `queued`/`publishing`/`accepted`/
`rejected`/`failed`, a name — `FedosDeliveryObservation` — distinct from
both `FedosBoardOutboxObservation` and Alpha 415's own candidate list,
plus an explicit `Publisher変更禁止`) do not name either uncommitted
thread and do not ask this Arc to reconcile, extend, or replace them.
Per this Arc's own explicit direction: **both uncommitted threads are
left completely untouched** (not read again after this Stage, not
imported, not modified, not deleted) — the same "acknowledged, not
adopted" treatment every prior Arc has given the pre-existing untracked
`p2p/` directory. `FedosDeliveryObservation` is therefore a THIRD,
independent Observation vocabulary, standing alone, with no dependency
edge to `FedosBoardOutboxObservation`, `FedosNostrBoardPublisher`, or
any Publisher/Scheduler of any kind — a real, acknowledged
inconsistency this doc records honestly rather than silently resolving.

Because no committed Publisher exists to produce results, this Arc's
own `subjectId` field (Alpha 462) is an OPAQUE, caller-supplied string
this Arc neither derives from nor validates against any real Outbox/
Publisher identifier. A future Arc, wiring a real, committed Publisher,
decides that pairing — not this one.

## 4. See also

- `docs/secure_runtime_alpha_415_outbox_state_observation_separation.md`
- `docs/secure_runtime_alpha_450_master_seed_authority_and_nostr_signing_activation_completion.md`
- `docs/secure_runtime_alpha_452_publisher_scope_and_return_contract_decision.md` (uncommitted thread, referenced for context only)
