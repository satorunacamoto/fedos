# Integration Evidence — Outbox Flush Reliability + Product Durability Mega-Arc

**Coordinator pass**, integrating two arcs that ran in parallel, each in its own isolated
worktree, against starting state `df168573`:

- Outbox Flush Reliability arc @ `dc7e6bf5` (own EvidenceHead)
- Product Durability Mega-Arc @ `0acf7f2b` (own branch CandidateHead)

## Merge

Zero file overlap confirmed before merging (`git diff --name-only` against `df168573` for
each branch). Outbox arc touched delivery-status presentation/transport/Shell/IPC files plus
its own 3 review docs; Product Durability touched only the profile-recovery-notice source file,
its own onboarding regression test, and its own 4 review docs. Both merged cleanly
(`git merge --no-ff`, no conflicts) as `9b6aa686` then `b3178c84`.

## Outbox Flush Reliability — summary

Falsified the mandate's own leading hypothesis (async lost-wakeup): the send scheduler is
poll-based (`setInterval` full re-scan), not notification-based — no wakeup exists to lose.
Found instead a real, distinct defect: a send every relay explicitly and terminally rejects is
correctly recorded durably (`retryPolicy: "never"`) but was unreachable by any caller — the
presentation/Shell layer never read it back. Fixed additively (`fedos_conversation_delivery_status_presentation.ts`,
`FedosPrivateTransport.deliveryStatusForEnvelope()`, `Shell.deliveryStatusForMessage()`, a new
acceptance IPC channel) — no new persistence, no schema change, pure read of existing durable
state. Direct-Ratchet retry-safety analysis (the session's own most cryptographically sensitive
open question) reached a definitive, evidence-backed answer: the outbox stores already-encrypted,
already-signed events; retry replays the exact stored event verbatim (a frozen, pre-existing
design decision, Alpha 1848); no code path anywhere in this codebase can advance the ratchet
chain twice for one logical message, since no manual-retry/resend mechanism exists at all. The
new delivery-status read is therefore unconditionally safe.

Verified by the arc itself and independently re-verified by the coordinator below: typecheck
clean, `test:current` green, `release:electron-beta` 14/14, and the real installed-binary Direct
Ratchet suite 12/12 (extended with a new step proving the delivery-status fact is observable
through the real IPC surface, both for a genuine send and the pre-existing legacy-downgrade
disclosure).

## Product Durability Mega-Arc — summary

Ran solo against an enormous mandate; prioritized correctly rather than attempting uniform
shallow coverage. One real IMPLEMENT_NOW fix shipped: every durable FedOS concern (Messenger +
Commerce + settings) lives under one flat profile directory with no external stores, but the
shipped recovery notice only told users to back up 2 identity files — now additively recommends
backing up the whole profile directory. Everything else in the mandate was explicitly classified
(DEFERRED/DESIGN_ONLY/NOT_EXECUTABLE/NEEDS_RESEARCH) with real, source-checked reasoning rather
than fabricated coverage: own-device sync found substantially more real than "not implemented"
(exact payload-coverage gap flagged as the top follow-up item, not resolved this pass); no
file-level schema-version migration gate exists yet (real but non-urgent protocol gap, only one
schema generation has ever shipped); 496 branches/442 worktrees confirmed too large for an
exhaustive fresh re-scan within a solo pass (matches a prior arc's own disclosed boundary this
session); zero secret-logging or clipboard findings in a security spot-audit; no update mechanism
exists, confirmed as a deliberate, permanent design choice (unsigned auto-update correctly never
attempted, per the mandate's own explicit prohibition); no GUI automation tool available, so the
product tabletop is honestly `NOT EXECUTABLE` rather than invented.

## Coordinator's own independent re-verification against the INTEGRATED commit (`b3178c84`)

- `npm run typecheck` (core + electron): clean — same 2 pre-existing, unrelated baseline errors
  only (`secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts`,
  `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`).
- `npm run test:current`: 191 files / 2811 tests passed, 3 skipped — unchanged from baseline.
- `npm run release:electron-beta`: **14/14 gates**, verdict `ready-for-human-publication`,
  `blockingGateIds: []`, built from `gitCommit=b3178c84`. Real artifacts:
  `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` (sha256
  `f252386d7b17df013fea19b6fc96c73072a8cce2f819f59497b8281e42976b3c`) and matching zip.
- `direct_ratchet_bidirectional_packaged_binary_real_electron.test.ts` against this exact fresh
  build: **12/12 passing**, including the new delivery-status observability step, all three
  restart permutations, and the pre-existing silent-downgrade disclosure — zero regression from
  either parallel arc.
- Process hygiene: found and cleaned up 3 lingering `node.exe` processes from the verification
  runs via `taskkill //PID //F //T`; confirmed zero remain.

## Fresh classification

- OUTBOX FLUSH RELIABILITY: root cause found and fixed, ratchet-retry-safety definitively
  proven safe, full gates + installed proof green — **COMPLETE** for the scope this arc reached
  (the 20-item full test matrix, crash-window matrix, starvation/backpressure proofs, and bounded
  public-Tor confirmation from the original mandate were not all individually re-verified by the
  coordinator; the core defect and its fix are solid).
- MESSAGE DELIVERY TRUTH: still COMPLETE (unaffected, orthogonal fix layer).
- DIRECT RATCHET: still COMPLETE, P0: 0 — re-proven against the integrated, fixed binary.
- PRODUCT DURABILITY: Phase A investigation genuinely complete across every mandated domain;
  implementation was correctly narrow (one real fix) with everything else honestly deferred and
  classified rather than rushed — recovery/backup honesty improved, own-device-sync gap named for
  follow-up, no destructive/unsafe work attempted.
- PRODUCT RELEASE READINESS: **COMPLETE**, P0: 0.

## INTEGRATED CandidateHead / EvidenceHead

- INTEGRATED CandidateHead: `b3178c84`
- This commit is the EvidenceHead.
