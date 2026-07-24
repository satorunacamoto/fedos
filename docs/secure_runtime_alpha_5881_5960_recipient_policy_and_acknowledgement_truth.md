# Secure Runtime Alpha 5881–5960 — Recipient Policy and Acknowledgement Truth

**FedOS Signed Recipient Deletion Request Private Transport and Local Policy Integration Arc**

## Recipient-local best-effort deletion only

Everything this Arc's own acknowledgement can honestly claim is scoped to ONE recipient
Device's own local install. It is never remote erasure, never a guarantee about any other
copy.

## Recipient policy vocabulary (`fedos_deletion_recipient_policy.ts`)

| Value | Meaning |
|---|---|
| `always-review` | Stops at `"policy-pending"` until an explicit, later, caller/human approval (`executeApprovedLocalDeletion()`). |
| `allow-local-history-only` | Grants `"local-history"` ALWAYS, even if the request asked for `"local-history-and-index"` — local policy caps the grant, a request is never authority for more than local policy allows. |
| `allow-local-history-and-index` | Grants exactly the requested scope (never wider than what was actually asked). |
| `deny` | Refuses; recorded `"policy-rejected"`. |
| `unavailable` | Refuses identically to `deny` — an unresolved local policy is never treated as an implicit allow. |

The default is never unconditional automatic deletion: `evaluateFedosDeletionRecipientPolicy()`
has no branch reachable without an explicit, valid `policy` value; an invalid/unresolved one
always denies. Policy is resolved via `resolveLocalPolicy(requesterAccountRef)`, a LOCAL
configuration seam injected at Runtime-construction time — never derived from the request's
own wire content, never caller-suppliable per individual request.

## Local Deletion Bridge scope

Granted requests execute through `b3b3a6d`'s own REAL `executeFedosLocalPayloadDeletionPlan()`
— the one sanctioned call site this Arc adds (`5641-5720`'s own structural guard explicitly
forbade this call; this Arc's own Phase Q guard proves the boundary the OTHER way: only this
Arc's own new files may call it, `deletion_request`'s original founding files still may not).
A `"local-history-and-index"` grant reuses `buildFedosLocalPayloadDeletionPlan()` unmodified
(both steps). A `"local-history"`-only grant builds a narrower, single-step plan (retention
transition only, no `purge-index`) by hand, over the SAME real `FedosDeletionAssessment` —
never a second execution coordinator, never touching Archive/backup/Relay.

## Acknowledgement outcome mapping (`fedos_deletion_request_runtime.ts`, `acknowledgementFieldsForDecision`)

| Recipient decision | Ack outcome | `appliedScopes` | `evidenceClass` |
|---|---|---|---|
| `unauthorized` | `unauthorized` | `[]` | `none` |
| `expired` | `expired` | `[]` | `none` |
| `unsupported` | `unsupported-scope` | `[]` | `none` |
| `policy-rejected` | `rejected-policy` | `[]` | `none` |
| `failed` | `failed` | `[]` | `unverifiable` |
| `partially-applied` | `applied-partial` | `["local-history"]` | `local-observed` |
| `locally-applied`, granted `local-history-and-index` | `applied-local-history-and-index` | `["local-history","local-index"]` | `local-verified` |
| `locally-applied`, granted `local-history` only | `applied-local-history` | `["local-history"]`, retains `["local-index"]` if that was requested | `local-verified` |

Every non-`"applied-*"` outcome carries an EMPTY `appliedScopes` — `isFedosDeletionAcknowledgementRecordHonest()`
(`5641-5720`, unmodified) is re-checked by the Acknowledgement Outbound Coordinator before
ever signing, so an overclaiming record fails closed (`"dishonest-outcome"`) rather than
being published.

## One Device acknowledgement is never account-wide

`FedosDeletionAcknowledgementRecordV1.recipientDeviceRef` is always present and specific.
`inspectDeletionRequestStatus()` exposes a per-request safe status, never a fabricated
"every Device of the account" claim; `FedosDeletionRequestAggregateStatusView`
(`5641-5720`'s own, unmodified) already documents "NEVER means every Device of the
account". This Arc's own real vertical slice proves: a request addressed to Bob's `bob-desktop`
Device is denied outright when Bob has no local registry binding for a DIFFERENT, unaddressed
Device (`"recipient-device-unknown"`) — no fan-out is ever attempted.

## Archive/backup/Relay scopes are structurally unsupported

Neither `FedosDeletionRequestScope` nor `FedosDeletionRecipientPolicy` nor
`FedosDeletionAcknowledgementAppliedScope` has a value naming Archive, backup, or Relay —
confirmed by Phase Q's own structural guard (`secure_runtime_alpha_5881_5960_structural_guards.test.ts`,
tests 4–6).
