# Secure Runtime Alpha 7721–7800 — Multi-Device Status and Non-Guarantees (Phase I)

## What this Arc does NOT build

**No return-acknowledgement protocol.** A receiving Device signaling "I
received and applied this fact" back to the sender would be a second
wire flow entirely outside this Arc's own narrow scope (fanout →
suppress-on-restore). `"relay-accepted"` is therefore the **strongest**
per-Device status `aggregateFedosArchiveSuppressionFactStatus()` can
honestly report from the SENDING Device's own vantage point — it means
"a Relay took the event," never "the target Device actually imported
it." This is the same Relay-ACK-is-not-receipt distinction this codebase
already enforces everywhere else (Signed Deletion's own Relay ACK
semantics, Phase A reconciliation report).

## Per-Device status vocabulary

Deliberately per-Device, never a single account-wide boolean (Phase I's
own explicit instruction — a UI must never collapse "3 of 4 Devices
informed, 1 unknown" into one misleading "synced" flag):

| Status | Meaning |
|---|---|
| `"unknown"` | The Registry has no record of this candidate deviceId at all. |
| `"revoked"` | Currently revoked — checked LIVE; overrides any historical observation. A revoked Device may still hold a pre-revocation copy, but is never a future fanout target. |
| `"never-attempted"` | Currently trusted, but no fanout attempt was ever recorded for this exact fact — e.g. this Device paired AFTER the fact was created and broadcast (Phase B's own named "missing Device" edge case; no resend-on-late-pairing mechanism exists). |
| `"pending"` | A fanout attempt is in flight, outcome not yet known. |
| `"relay-accepted"` | A Relay accepted the outbound event. **Not** "the target imported it." |
| `"relay-rejected"` | Every configured Relay rejected the outbound event. |
| `"relay-failed"` | The attempt failed before/during publish (signing failure, every Relay unreachable, correlation timeout). |

`localSuppressionActive` is included separately on the aggregate result —
the ONE honest "is this actually working, right now, on THIS Device"
signal, distinct from any remote Device's own delivery status, sourced
directly from `FedosArchiveSuppressionObservationAuthority.evaluateSuppression()`.

## What is never claimed, anywhere in this Arc

- **No global/physical erasure.** Suppression fact propagation is a
  local, per-Device restore-time gate — it never claims any remote
  Device's own storage was altered, let alone physically erased.
- **No "all Devices informed."** The aggregate model exposes exactly
  what the Registry and Delivery Observation log can prove and nothing
  more; a genuinely offline or never-paired Device shows
  `"never-attempted"`, never a fabricated `"informed"`.
- **No recipient-deletion acknowledgement.** This is a same-account,
  Device-to-Device fact, structurally unrelated to Signed Deletion's own
  cross-account Acknowledgement record — see
  `secure_runtime_alpha_7721_7800_signed_deletion_relationship_separation.test.ts`
  for the real, behaviorally-proven separation.

## The one disclosed, permanent limitation this Arc leaves standing

A genuinely foreign profile, or a same-account Device that was never
paired (or was offline) at the moment a suppression fact was fanned out,
has no basis to suppress a pre-deletion Archive's content on restore —
proven directly in the Phase K real vertical slice (Device C: not yet a
Registry member at fanout time, receives nothing, legitimately restores
the pre-deletion content in full). This is the mirror image of
`feff676`'s own disclosed limitation this Arc was built to narrow, and it
is **intentionally not closed further here** — doing so would require
either a resend-on-late-pairing mechanism or a return-acknowledgement
protocol, both explicitly out of this Arc's own scope.

## Safety Center wiring (Phase J)

Three new warning codes added to the closed
`FedosSafetyCenterWarningCode` union
(`fedos_safety_center_warning_codes.ts`), every mention of a
potentially-overclaiming term inside them verified negated by Phase N's
own structural guard (test 12):

- `"archive-suppression-sync-does-not-guarantee-all-devices-informed"`
- `"archive-suppression-sync-is-not-recipient-deletion-acknowledgement"`
- `"archive-suppression-requires-local-receipt-to-take-effect"`
