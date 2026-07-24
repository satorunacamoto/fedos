# Secure Runtime Alpha 6201–6280 — Pending-Review Durability Design Document

**FedOS Desktop Beta Privacy Controls and Safety Center Arc — Phase D.**

## The gap this closes

`FedosDeletionRequestInboundCoordinator`'s own `#pendingReviewCache`
(introduced at Alpha 6041-6120) holds a `"policy-pending"` request's real,
already-verified signed body **in memory only**. A process restart before
the human approves/rejects an `"always-review"` item made
`executeApprovedLocalDeletionById()` honestly return `"unknown-request"`
until the sender's own safe, idempotent redelivery — disclosed in
`docs/secure_runtime_alpha_6041_6120_completion_declaration.md` as a
"still-standing limitation."

## The chosen design

A new, additive, OPTIONAL durable side-channel:
`FedosDeletionRequestPendingReviewPersistence`
(`src/conversation/deletion_request/fedos_deletion_request_pending_review_persistence.ts`),
with an in-memory backend (tests) and an append-only NDJSON backend
(`append_only_fedos_deletion_request_pending_review_persistence.ts`,
production).

- **Additive, not replacing.** The in-memory `#pendingReviewCache` is
  UNCHANGED — this is a second, parallel write, never a replacement. Omitted,
  behavior is byte-for-byte identical to `6041-6120`/`50f80e8`.
- **Tombstone-based logical delete.** An append-only log cannot rewrite a
  byte, so consuming an entry (approve/reject/expired-approval-attempt)
  appends a NEW `{action:"tombstone"}` line rather than mutating the
  original. Replay always takes the LAST entry per `requestId` as
  authoritative.
- **Never resurrected.** Once a `requestId` has been tombstoned, a later
  `putPendingReview()` for the SAME id is `"conflict"`, never silently
  re-accepted — this closes a subtle replay risk a naive "insert if absent"
  check would have missed (a stale, already-decided request redelivered
  late must not become pending again).
- **Expiry re-checked on durable recovery.** `executeApprovedLocalDeletionById()`
  now re-checks `signed.record.expiresAt` against the current clock reading
  BEFORE granting — a restart never lets an expired request slip through
  just because its durable copy survived. This was a genuine, if narrow,
  gap this Arc closed alongside the primary durability fix (the in-memory
  cache had no such re-check either, but it also never survived long enough
  for the gap to matter in practice).
- **Resource-bounded.** `FEDOS_DELETION_REQUEST_PENDING_REVIEW_MAX_LIVE_ENTRIES = 500`
  — a small, transient human review queue, never an unbounded log; a 501st
  concurrently-live entry is refused (`"resource-limit-exceeded"`), never
  silently evicting an older one.
- **No protocol change.** No field, message type, or validation rule in the
  deletion-request protocol itself changed. What is stored is exactly the
  same `FedosSignedDeletionRequestV1` object the in-memory cache already
  held — structured metadata plus a real Nostr signature envelope, never
  message plaintext (deletion requests carry no message body at all) and
  never a private key.

## Wiring

One new optional field,
`FedosDeletionRequestInboundDependencies.pendingReviewPersistence`, threaded
through `FedosConversationDeletionRequestIntegrationDependencies.pendingReviewPersistence`
(`fedos_conversation_runtime.ts`) with no default — omitted, the domain's
behavior is unchanged. A real Desktop Runtime wiring (a future, narrow
follow-on, out of THIS Arc's own scope, mirroring `50f80e8`'s own precedent
for `conversationDeletionRequest` threading) would supply an
`AppendOnlyFedosDeletionRequestPendingReviewPersistence` pointed at a real
profile-scoped file path.

## Verification

Proven at the coordinator level (real BIP-340 Schnorr signatures via
`FedosNobleTestNostrSigningAuthority`, no WASM needed) in
`test/secure_runtime_alpha_6201_6280_real_vertical_slice.test.ts` Part 1: a
real signed request reaches `"policy-pending"`, a fresh coordinator instance
(simulated restart, same append-only log file) successfully approves it, a
second attempt for the same id correctly reports `"unknown-request"`
(tombstoned), and no secret appears in the durable log file. Additional
edge cases (expiry re-check, resource limit, conflicting duplicate, never
resurrected, corrupt log fails closed) are proven in
`test/secure_runtime_alpha_6201_6280_failure_matrix.test.ts`.
