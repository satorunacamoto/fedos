# Secure Runtime Alpha 5641–5720 — Execution Specification

**FedOS Signed Recipient Deletion Request Types, Validation, and Durable
State Foundation Arc**

Base: `arc/local-deletion-capability-state-foundation @ b3b3a6d`. Review:
`860a58e` (`review/fedos-signed-recipient-deletion-request-v1`), read via
`git show`, never merged. This Arc implements Doc 19's own Stage 1 scope
exactly: types, validation, canonical signing bytes, real signature
verification, durable request/recipient/acknowledgement state — **no
live Relay delivery, no live Wire Adapter/Outbox integration, no live
recipient-policy bridge to a production entry point.**

## 1. Module layout

Thirty files under `src/conversation/deletion_request/`, zero other
production changes:

| Concern | Files |
|---|---|
| Closed vocabularies (Phase B) | `fedos_deletion_request_scope.ts`, `_target_type.ts`, `_reason_code.ts`, `_lifecycle_state.ts`, `fedos_deletion_recipient_decision_state.ts`, `fedos_deletion_request_acknowledgement_outcome.ts`, `fedos_deletion_request_authorization_outcome.ts` |
| Request record (Phase C) | `fedos_deletion_request_record.ts`, `fedos_deletion_request_id.ts` |
| Canonical serialization (Phase D) | `fedos_deletion_request_canonical_bytes.ts` |
| Signing boundary (Phase F) | `fedos_deletion_request_signing.ts` (real sign/verify + `FedosNobleTestNostrSigningAuthority`) |
| Structural validation (Phase G, 1-4) | `fedos_deletion_request_validation.ts` |
| Authorization assessment (Phase G 5-12 / H) | `fedos_deletion_request_authorization_assessment.ts` |
| Durable request state (Phase I) | `fedos_persisted_deletion_request_state_record_v1.ts`, `fedos_deletion_request_state_persistence.ts`, `in_memory_*`, `append_only_*` |
| Recipient evaluation + durable state (Phase J) | `fedos_deletion_request_recipient_evaluation.ts`, `fedos_persisted_deletion_recipient_decision_record_v1.ts`, `fedos_deletion_recipient_decision_persistence.ts`, `in_memory_*`, `append_only_*` |
| Acknowledgement (Phase K) | `fedos_deletion_acknowledgement_record.ts`, `fedos_deletion_acknowledgement_signing.ts`, `fedos_persisted_deletion_acknowledgement_record_v1.ts`, `fedos_deletion_acknowledgement_persistence.ts`, `in_memory_*`, `append_only_*` |
| Retry planner (Phase L) | `fedos_deletion_request_retry_plan.ts` |
| Safe status (Phase M) | `fedos_deletion_request_safe_status.ts` |

## 2. Design decisions and why

**Signing reuses the real Nostr signing path unmodified.** Canonical
bytes (Phase D) become the `content` of a real `kind: 1`
`FedosNostrUnsignedEventRequest`, signed through the EXISTING, real
`FedosNostrSigningAuthority` interface — no new signing path. Real
verification (`verifyFedosSignedDeletionRequestV1`) composes the
EXISTING, pure-TypeScript, WASM-free `validateInboundNostrEvent` /
`verifyNostrEventId` / `verifyNostrEventSignature` chain (Alpha
243/244/245) plus ONE new check this Arc adds: that the verified event's
own `content` is byte-identical to the claimed record's own canonical
bytes — binding the signature to THIS record, not merely proving the
wire event is internally self-consistent.

**`FedosNobleTestNostrSigningAuthority` produces genuinely real
signatures**, isolated from the absent WASM/Master-Seed production path
— it duplicates NIP-01's own six-character canonical-string escape rule
(Alpha 243's own established precedent for this exact duplication) and
signs with `@noble/curves`' `schnorr.sign`, the SAME primitive
`verifyNostrEventSignature` already calls (`.verify`) — not a new crypto
primitive. Mirrors `MockFedosBoardOutboxPublisher`'s own precedent
(Alpha 473) for living directly in `src/`, never imported by any
production entry point.

**Canonical serialization is explicit, fixed-field-order string
concatenation** — never `JSON.stringify(record)` on the whole object at
once (whose own key order would depend on how the input happened to be
constructed). `JSON.stringify` is used only per leaf string value, for
its own well-defined escaping.

**Device identity is honestly advisory-only, everywhere.** No real
per-Device signing key exists anywhere in this codebase
(`FedosSyncDeviceBinding`'s own header: "no real device attestation").
`requesterDeviceRef`/`recipientDeviceRef` are opaque, non-cryptographically-bound
labels; a KNOWN mismatch against this evaluating instance's own local
Device is reported (`device-mismatch`), but an absent claim on either
side never fails — there is nothing cryptographic to fail. This is a
deliberate, source-grounded deviation from the review's own suggested
"account-authorized Device signature" framing, justified in the
reconciliation report §3.

**Authorization resolves conversation existence, target existence, and
requester authorship as ONE combined lookup** (`assessFedosDeletionRequestAuthorization`),
whose only externally-visible outcome (after `coarsenFedosDeletionRequestAuthorizationOutcome`)
is `"unauthorized"` for any of the three — the target-existence-oracle
prevention the review's own Doc 11 requires.

**Durable state is append-only with monotonic-transition enforcement.**
Request-state and recipient-decision are multi-snapshot domains (a
request's own lifecycle genuinely progresses over time) — each write is
validated against a closed, reachable-transition table
(`isFedosDeletionRequestLifecycleTransitionReachableByThisArc` /
`isFedosDeletionRecipientDecisionTransitionReachableByThisArc`) shared,
via one function, between the in-memory and append-only backends, so the
rule can never silently drift between them. Acknowledgement is a single
terminal fact per `requestId` — mirrors `b3b3a6d`'s own
`FedosDeletionExecutionPersistence` insert-once shape exactly.

**Idempotency is checked FIRST**, before any write is attempted —
`evaluateFedosDeletionRequestForRecipient` calls
`persistence.getRecord(requestId)` before writing `"received"`, mirroring
`b3b3a6d`'s own `persistence.getRecord(planId)`-first discipline. This is
what makes a repeat delivery of an identical `requestId` safe.

**This Arc never calls `b3b3a6d`'s execution coordinator.**
`evaluateFedosDeletionRequestForRecipient` stops at `"policy-pending"`
(authorized, awaiting local policy) or a terminal denial.
`markFedosDeletionRecipientLocalPlanReady` and
`recordSuppliedFedosDeletionRecipientLocalOutcome` are the ONLY two
functions that can advance a `"policy-pending"` request further, and
BOTH require the caller to supply an already-computed fact — the caller
(a future transport Arc, or this Arc's own Phase O test) runs
`b3b3a6d`'s real `buildFedosLocalPayloadDeletionPlan`/
`executeFedosLocalPayloadDeletionPlan` itself.

**Acknowledgement honesty is a structural, checkable property.**
`isFedosDeletionAcknowledgementRecordHonest` closes the "overclaim"
class: an `"applied-*"` outcome must carry a non-empty `appliedScopes`;
every other outcome must carry an empty one.

## 3. What this Arc reuses unmodified

`FedosNostrSigningAuthority`, `validateInboundNostrEvent`/
`verifyNostrEventId`/`verifyNostrEventSignature`,
`FedosConversationMembershipAuthority`,
`FedosConversationMessageEnvelopePersistence`,
`FedosConversationPersistence`, and every `b3b3a6d` deletion type
(`FedosDeletionCapabilityDescriptor`, `assessFedosLocalPayloadDeletion`,
`buildFedosLocalPayloadDeletionPlan`,
`executeFedosLocalPayloadDeletionPlan`, `FedosDeletionEvidence`). Not one
of these files is modified by this Arc.

## 4. What this Arc does not build

No Relay event, publisher, or subscription. No NIP-17 wiring, no new NIP
number. No `FedosPrivateTransport` import or `sendDirectMessage` change.
No automatic local deletion — `deletion_request/` imports nothing from
`fedos_deletion_execution_coordinator.ts` or
`fedos_deletion_archive_file_authority.ts`. No Group or attachment
support (the closed vocabularies have no field to express either). No
Ratchet dependency. `p2p/`/`.tmp_gen/` untouched — verified structurally
in `test/secure_runtime_alpha_5641_5720_structural_no_live_wire_guards.test.ts`.

## 5. Test coverage

Nine new test files (132 new tests): vocabulary/record/canonical-bytes
(24), signing/verification (12), authorization assessment (12), durable
state and replay across all three domains (30), retry planner and safe
status (17), recipient evaluation pipeline (8), a Phase P failure matrix
closing gaps not covered elsewhere (13), Phase N structural proof (15),
and one real Phase O vertical slice (1 comprehensive test covering all
20 required items) — no mock for the headline flow; the ONE test-only
component (`FedosNobleTestNostrSigningAuthority`) produces genuinely real
BIP-340 Schnorr signatures verified by the same real, unmodified,
production verification chain.

See `docs/secure_runtime_alpha_5641_5720_request_and_acknowledgement_schema.md`
for the exact wire shapes and
`docs/secure_runtime_alpha_5641_5720_completion_declaration.md` for the
verification run and completion criteria.
