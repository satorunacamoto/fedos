# Secure Runtime Alpha 532 — Scope and Regression Guards

Stage 12 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

**Status: this Stage VERIFIES only.** No implementation. Grep/diff-based
guards confirming both the explicit prohibitions and the explicit
"変更禁止"/"変更最小" constraints of the Alpha 521–540 spec actually
hold across every file this Arc touches — new and modified alike.

## 1. Prohibited-topic guard (禁止: Ontology / P2P / GUI / Cloudflare /
Worker / Protocol追加)

None of this Arc's five new source files
(`fedos_delivery_attempt_subject_id.ts`,
`fedos_delivery_retry_reason_codec.ts`, `fedos_delivery_retry_registry.ts`,
`fedos_delivery_retry_query.ts`, and the modifications to
`fedos_host_delivery_controller.ts`/`fedos_desktop_host.ts`) reference
Ontology, P2P, any GUI/DOM/React token, Cloudflare, Worker, or any NEW
wire protocol identifier. The only "protocol" string this Arc ever
touches is the pre-existing `"nostr"`/`"activitypub"` literal already
present in Alpha-451/476-era code, read, never written or extended.

## 2. Untouched-contract guard (Publisher変更禁止 / Outbox変更禁止 /
Host API変更禁止 / Scheduler変更最小)

Confirmed via `git status --porcelain` (Alpha 531 §4) and re-confirmed
here structurally:

- `src/board/outbox/fedos_publish_scheduler.ts` — byte-for-byte
  unchanged (0 lines in `git diff`). "Scheduler変更最小" satisfied at
  its own floor of zero, per Alpha 522 §3.
- Every file under `src/board/publish/` — byte-for-byte unchanged.
  "Publisher変更禁止" satisfied absolutely, not minimally.
- Every file under `src/board/outbox/` other than this Arc's own
  READS of `entry.observations` — byte-for-byte unchanged.
  "Outbox変更禁止" satisfied absolutely.
- `FedosDesktopHost`'s PUBLIC API — `start()`, `stop()`,
  `startDelivery()`, `stopDelivery()`, `deliveryStatus()`,
  `observationQuery()` — every method signature and return type
  byte-for-byte unchanged (Alpha 522 §2 Correction). "Host API変更禁止"
  satisfied at the API-surface level, which is the level the
  prohibition names; the one new field is private state, not API.

## 3. Canonical Observation model guard (Alpha 462/494/495/465/466/467
stay byte-for-byte unchanged)

`fedos_delivery_observation.ts`,
`fedos_delivery_observation_transition_graph.ts`,
`fedos_delivery_observation_write_validator.ts`,
`fedos_delivery_observation_repository.ts`,
`fedos_delivery_observation_query.ts`,
`in_memory_fedos_delivery_observation_persistence.ts` — zero of these
six files appear in `git status --porcelain`'s output. The entire Arc's
`invalid-transition` fix lives at the subject-identity layer (Alpha
522 §4), reusing this model exactly as it already was.

## 4. What this Stage does NOT do

Does not add a new guard MECHANISM (no new lint rule, no new CI
script) — consistent with "追加のみ" scope discipline already
established in prior Arcs; guards here are ordinary Vitest assertions
over `git status`/source-content, matching the house style already used
by every prior Arc's own regression-guard Stage (e.g. Alpha 511/518,
Alpha 519's git-diff-confirmation pattern, reused directly by Alpha 539
later in this same Arc).

## 5. See also

- `docs/secure_runtime_alpha_531_ripple_review.md`
- `docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md`
- `docs/secure_runtime_alpha_519_git_diff_confirmation.md`
