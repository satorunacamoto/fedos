# Secure Runtime Alpha 5881–5960 — Execution Specification

**FedOS Signed Recipient Deletion Request Private Transport and Local Policy Integration Arc**

Base: `decda87` (Phase A integration merge of `22f9277` + `d825aa0`, see the reconciliation
report). Worktree: `C:\wt\signed-deletion-private-transport`. Branch:
`arc/signed-deletion-private-transport-local-policy`.

## New files — `src/conversation/deletion_request/`

| File | Phase | Role |
|---|---|---|
| `fedos_deletion_request_control_payload.ts` | B | protocol-neutral wire envelope (two discriminators), mirrors `d825aa0`'s own precedent |
| `fedos_deletion_request_outbound_coordinator.ts` | C | sender-side: preflight, build/sign, self-check, persist, publish |
| `fedos_deletion_recipient_policy.ts` | E | closed, locally-configured recipient policy vocabulary |
| `fedos_deletion_request_inbound_coordinator.ts` | D/E/F | recipient-side: classify → (reuse `5641-5720`'s real evaluation) → policy → real `b3b3a6d` execution |
| `fedos_deletion_acknowledgement_outbound_coordinator.ts` | G/H | recipient-side: persist-then-publish a caller-supplied, honesty-checked acknowledgement |
| `fedos_deletion_acknowledgement_inbound_coordinator.ts` | H | requester-side: verify, correlate, persist, advance lifecycle |
| `fedos_deletion_request_conversation_existence_adapter.ts` | A | narrow adapter closing the `FedosConversationPersistence` gap (see reconciliation report §4) |
| `fedos_deletion_request_runtime.ts` | M | narrow safe Runtime facade, composes all four coordinators |

## Additive changes to `5641-5720`'s own founding files (never a redesign)

- `fedos_deletion_request_lifecycle_state.ts` — `REACHABLE_TRANSITIONS` gains
  `signed→pending-delivery→delivered→recipient-evaluating→acknowledged` (plus `→expired`/
  `→failed`/`→cancelled` branches at each live stage) — the exact set that file's own header
  named as "requires a real transport send/receive this Arc does not build," now built.
- `fedos_deletion_request_recipient_evaluation.ts` — one additive export,
  `recordFedosDeletionRecipientPolicyRejection()`, mirroring
  `markFedosDeletionRecipientLocalPlanReady()`'s own "records, never decides" shape.
- `fedos_persisted_deletion_request_state_record_v1.ts` — one additive field,
  `recipientDeviceRef: string | null`, needed for a DURABLE (restart-safe) wrong-Device
  denial check on the acknowledgement-receive path (JSON-serialized generically by the
  existing append-only backend; no codec changed).
- `fedos_deletion_request_authorization_assessment.ts` — `accountAuthority` becomes an
  OPTIONAL parameter (default `"fedos"`, 100% source-compatible with every existing call
  site/test) — see the reconciliation report §4 for why this was a real, necessary fix.

## Phase C — Outbound Request Coordinator, exact ordering

1. Preflight: `runtime-stopped` → local Device revoked → recipient Device unknown/revoked
   (all fail closed BEFORE any signing/publish attempt, mirroring `d825aa0`'s own
   `#preflight()`).
2. Build canonical record, 256-bit nonce (`@noble/hashes` `randomBytes`, matching
   `5641-5720`'s own convention).
3. Sign via the real, injected `FedosNostrSigningAuthority` (`5641-5720`'s own signing
   boundary, unmodified).
4. Pre-publish self-check: `assessFedosDeletionRequestAuthorization()` run against the
   just-signed request from the sender's own vantage (`localDeviceRef: null` — Device
   binding is the recipient's own job) — a request this Arc's own future recipient-side
   evaluation would immediately reject as unauthorized is never even queued.
5. Persist `draft → signed` (both real, monotonic writes).
6. Publish via `sendMailboxNip17Control(requestId, conversationId, plaintext, issuedAt)` —
   `requestId` reused verbatim as the Outbox `controlId` (exact-event retry, never a second
   logical send).
7. Persist `signed → pending-delivery` (best-effort; a write failure here does not undo the
   already-real publish — the caller's own `published.requestId` remains the source of
   truth for a later `inspectDeletionRequestStatus()` call).

Relay ACK (`sendResult.outcome`) is returned to the caller as its own field, never conflated
with recipient processing.

## Phase D/E/F — Inbound Request Coordinator, exact ordering

Steps 1–13 are entirely delegated, unmodified, to `evaluateFedosDeletionRequestForRecipient()`
(`5641-5720`) — schema, signature, expiry/replay (via durable-state idempotency),
Conversation/target/authorship (steps 7–9, oracle-avoidance-combined), requester Membership,
recipient binding, local-capability compatibility. This Arc's own real, additive work:

14. **Policy decision** (Phase E) — `resolveLocalPolicy()` + `evaluateFedosDeletionRecipientPolicy()`.
    `deny` → `recordFedosDeletionRecipientPolicyRejection()`. `await-review` → stops at
    `policy-pending`, unexecuted. `grant` → step 15.
15. **Plan construction** (Phase F) — `assessFedosLocalPayloadDeletion()` (real, read-only)
    then `buildFedosLocalPayloadDeletionPlan()` (full grant) or a hand-built narrower
    single-step plan (`local-history`-only grant).
16. `markFedosDeletionRecipientLocalPlanReady()` — recorded BEFORE execution, unconditionally
    once granted (keeps the recipient-decision transition chain valid even on the
    structurally-unreachable-in-practice envelope-not-found path).
17. **Real execution** — `executeFedosLocalPayloadDeletionPlan()` (`b3b3a6d`, unmodified) —
    this Arc's own ONE sanctioned call site.
18. `recordSuppliedFedosDeletionRecipientLocalOutcome()` — the real, already-produced
    terminal status (`completed`/`partially-deleted`/`failed`), mapped 1:1 onto
    `locally-applied`/`partially-applied`/`failed`.

`executeApprovedLocalDeletion()` is the explicit, separate entry point for a
`policy-pending` (`always-review`) request a human/caller later approves — it re-derives the
grant through the SAME `resolveLocalPolicy()` at approval time (never a bare rubber stamp;
proven by the coordinator-integration test flipping a mutable policy reference mid-test).

## Phase G/H — Acknowledgement construction and transit

`FedosDeletionRequestRuntime.publishDeletionAcknowledgement()` maps a terminal recipient
decision onto an honest `FedosDeletionAcknowledgementRecordV1` (see the recipient-policy/
acknowledgement-truth doc for the exact table), then `FedosDeletionAcknowledgementOutboundCoordinator`
signs (real), persists the recipient's OWN durable copy BEFORE publish, and sends via the
SAME `sendMailboxNip17Control()` seam (`controlId: "ack:" + requestId`). The requester's own
`FedosDeletionAcknowledgementInboundCoordinator` verifies the real signature/content-binding,
correlates by `requestId` against its own durable outbound-request state (never a wire-
supplied Conversation claim — see the acknowledgement-inbound file's own header), rejects
wrong recipient-account/Device, persists, and advances the request's own lifecycle through
every intermediate live state to `acknowledged` (never a single illegal jump).

## Verification

- `npx tsc --noEmit -p .` — clean except the two pre-existing baseline errors
  (`secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts:189`,
  `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`), confirmed identical on
  the unmodified `decda87` base.
- This Arc's own 4 new test files: control-payload/policy unit tests (15), coordinator
  integration (5, real signing + real `b3b3a6d` execution, in-process wire), structural
  guards (18), and the REAL end-to-end vertical slice (1) — **all passing**, including the
  vertical slice against a genuinely-built `packages/fedos-core-rust/pkg/` WASM artifact
  (real Master Seeds, real WASM signing/AEAD, real in-process Relay, real NIP-17 Gift Wrap).
- Full `npx vitest run`, compared via a sorted-JSON-report diff against the SAME `decda87`
  base (both runs with the WASM artifact present, to avoid the unrelated "artifact not
  built" milestone-test class flipping asymmetrically): **zero net regressions** — the only
  11 newly-failing tests are the well-known `git status --porcelain -- src` self-check
  pattern belonging to prior, unrelated design reviews (self-resolving once this Arc's own
  commit lands and the tree returns clean); 2 unrelated, pre-existing flaky tests differed
  in the opposite direction between runs.
- `5641-5720`'s own full test suite (172 tests across 9 files) — unchanged, all still
  passing after this Arc's own additive field/transition/export changes.
