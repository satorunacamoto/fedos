# Secure Runtime Alpha 6041–6120 — Multi-Device Aggregation Truth

**FedOS Signed Deletion Request Multi-Device Aggregation and User Consent UI Arc**

## Per-Device status vocabulary (`fedos_deletion_request_device_status.ts`)

Seventeen closed values: `not-requested`, `draft`, `pending-delivery`, `relay-acknowledged`,
`recipient-received`, `awaiting-recipient-decision`, `approved`, `rejected`,
`applied-local-history`, `applied-local-history-and-index`, `partially-applied`, `expired`,
`failed`, `revoked-device`, `unknown-device`, `offline-or-unobserved`, `unverifiable`.

Precedence, always: **Device Registry trust wins first** (`revoked` → `revoked-device`,
no binding at all → `unknown-device`, checked BEFORE any request/ack fact is even consulted).
Then a real, received **acknowledgement outcome wins over lifecycle state** (an ack is the
strongest fact this local sender can have). Only with neither does the sender's own local
`lifecycleState` drive the status — and `"acknowledged"` with no ack outcome supplied is mapped
to `"unverifiable"`, never fabricated as applied.

## Account aggregate vocabulary

Seven closed values: `no-device-requests`, `some-devices-pending`, `some-devices-applied`,
`all-known-devices-responded`, `mixed-outcomes`, `no-known-device-confirmed`,
`remote-copies-unverifiable`. **No branch of `fedosDeletionRequestAggregateAccountStatus()` can
ever produce `"deleted-everywhere"`/`"account-deleted"`/`"all-copies-erased"`/
`"cryptographically-erased"`** — those strings do not exist in the function's own closed return
type at all; this is a structural guarantee (Phase Q, tests 6/7), not a runtime check.

One Device's own `"applied-*"` status is real, and REPORTED as such — but the aggregate NEVER
collapses that into an account-wide claim: with exactly one known Device that applied,
the aggregate is `"all-known-devices-responded"` (every Device THIS SENDER KNOWS ABOUT has
responded), explicitly not `"deleted-everywhere"`. A caller rendering this aggregate must pair it
with the per-Device rows themselves — the aggregate alone never implies coverage of any Device
not present in the row set.

## Real proof (vertical slice)

The real vertical slice creates two Device-specific requests (Bob Device A, Bob Device B). Device
A applies for real; Device B is left genuinely pending (never separately resolved in that slice).
The resulting aggregate is `"some-devices-applied"` — proven distinct from
`"all-known-devices-responded"` by direct assertion. Bob's own single Nostr identity receives
BOTH Gift Wraps (NIP-17 delivery is per-account, not per-Device); Device A's own real Runtime
independently, correctly rejects the Device-B-addressed request as a device-mismatch
(`"authorization-failed"` in the Inbox) — proving real Device isolation rather than a silent
accept, silent drop, or fabricated fan-out.

## Restart safety

Every fact `fedosDeletionRequestDeviceStatus()`/`fedosDeletionRequestAggregateAccountStatus()`
consumes comes from real, disk-durable state: `FedosDeletionRequestStatePersistence` /
`FedosDeletionAcknowledgementPersistence` (`5641-5720`, unmodified) for the sender side, and this
Arc's own new `FedosDeletionRequestInboxSummaryPersistence` plus
`FedosDeletionRecipientDecisionPersistence` (`5641-5720`, unmodified) for the recipient side.
Proven directly: the real vertical slice rebuilds both Runtimes from the SAME log files after a
full stop/restart and the Shell/Renderer reconstruct byte-identical status.
