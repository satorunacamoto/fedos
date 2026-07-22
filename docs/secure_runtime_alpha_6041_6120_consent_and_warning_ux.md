# Secure Runtime Alpha 6041–6120 — Recipient Consent and Warning UX

**FedOS Signed Deletion Request Multi-Device Aggregation and User Consent UI Arc**

## Consent modes

Reuses `5881-5960`'s own frozen `FedosDeletionRecipientPolicy` vocabulary verbatim: `always-review`,
`allow-local-history-only`, `allow-local-history-and-index`, `deny`, `unavailable`. No new value
is invented at the UI layer.

## No request executes solely because the UI opened it

`FedosDeletionRequestController.openReceivedRequest()` is a pure, read-only render of already-
durable facts — it calls `deletionRequestListReceived()`/`deletionRequestAssessPolicy()` only,
never `deletionRequestApprove()`. Proven directly in the real vertical slice: opening the
`"policy-pending"` item, then independently re-querying `deletionRequestStatus()`, shows the
request is STILL `"policy-pending"` — unchanged by the read.

## No countdown-based automatic approval

`executeApprovedLocalDeletion()`/`executeApprovedLocalDeletionById()` require an explicit caller
invocation — no timer, no polling loop, anywhere in `src/desktop/presentation/deletion_request/`
or `src/conversation/deletion_request/`'s own new files (Phase Q, structural guard).

## Explicit actions

`approve` / `reject` / `dismiss` / `open` (inspect) map 1:1 to Host commands
(`deletion-request-approve`/`-reject`/`-dismiss`/`-open`). `approve`/`reject` both require the
item's own current decision state to be `"policy-pending"` — a terminal item cannot be
re-approved or re-rejected (`"unknown-request"`/`"conflicting-duplicate"`, never silently
re-applied).

## The `"always-review"` fix (see the reconciliation report §4)

Reaching `executeApprovedLocalDeletion()` at all already IS the human review `"always-review"`
requires. That ONE policy value now grants exactly the request's own requested scope on explicit
approval, capped at nothing wider — `"allow-local-history-only"` still caps every grant (approved
or automatic) to `"local-history"`, and `"deny"`/`"unavailable"` still refuse outright, even on an
explicit approval attempt.

## Centralized warnings (`FEDOS_DELETION_REQUEST_STANDARD_WARNINGS`)

Every consent/detail screen shows the SAME six closed warning codes, never an ad hoc subset:
recipient may reject, other Devices may retain, Archive/backup may remain, Relay ciphertext may
remain, external copies unverifiable, not physical-erasure proof. Text lives in ONE place
(`fedosDeletionRequestWarningText()`) — no inconsistent wording scattered across ViewModels.

## Safe display fields only

`FedosDeletionRequestConsentDetailContent` never carries a raw signature, raw path, or the target
message's own plaintext (the target's own body is never read by this domain at all — confirmed by
Phase Q's own structural guard: no import of `FedosPayloadRetentionAuthority`/message-read methods
in the presentation layer). `requesterDeviceRef` is shown when known (advisory-only, per `5641-5720`'s
own documented limitation — no real per-Device signing key exists in this lineage).

## Disclosed limitation: pending-review durability

An `"always-review"` item's own signed wire object is held IN-MEMORY ONLY by
`FedosDeletionRequestInboundCoordinator` (never written to disk, to avoid ever persisting a real
signature unencrypted merely for UI convenience). The Inbox DISPLAY (safe summary + decision
state) is fully restart-safe; only the "click approve" action itself is not, until the request is
naturally redelivered by the sender's own real retry semantics (safe/idempotent by this
protocol's own design — `5641-5720`).
