# Secure Runtime Alpha 6201–6280 — Warnings and Non-Guarantees Truth Document

**FedOS Desktop Beta Privacy Controls and Safety Center Arc — Phase G.**

## The 12 centralized warning codes (`fedos_safety_center_warning_codes.ts`)

| Code | Text |
|---|---|
| `device-revocation-does-not-erase-copies` | Revoking a Device does not erase secrets that Device already copied before revocation. |
| `ratchet-reset-does-not-erase-history` | Resetting a Ratchet session does not erase historical plaintext already delivered. |
| `relay-ack-is-not-recipient-delivery` | A Relay accepting an event is not proof the recipient received or read it. |
| `identity-replacement-evidence-is-not-automatic-trust` | Identity Replacement evidence is not automatic trust — acceptance is always an explicit local decision. |
| `old-key-signature-insufficient-under-compromise` | A valid old-key signature is insufficient proof of continuity if the old key was compromised. |
| `deletion-acknowledgement-is-a-claim-not-physical-proof` | A deletion acknowledgement is a Device's own signed claim, not proof of physical erasure. |
| `other-devices-may-retain-copies` | Other Devices of the same account may still retain a copy. |
| `archives-and-backups-may-retain-copies` | Archives and backups may still retain a copy. |
| `relay-ciphertext-may-remain` | Encrypted ciphertext may remain stored on Relays this application does not control. |
| `external-copies-cannot-be-verified` | Screenshots, exports, notifications, and other external copies cannot be verified or recalled. |
| `secure-memory-zeroization-is-best-effort-or-unavailable` | Secure-memory zeroization of secrets in this build is currently best-effort, or unavailable, according to real source status. |
| `os-kernel-hypervisor-compromise-is-out-of-scope` | A compromised operating system, kernel, or hypervisor is outside this application's own security guarantee. |

Every screen resolves through `fedosSafetyCenterWarningText(code)` — no
screen ever writes its own inline security copy.

## Why the Secure Memory warning is deliberately non-committal

`secure-memory-zeroization-is-best-effort-or-unavailable` is worded to
neither claim zeroization IS implemented nor that it categorically is NOT —
this Arc runs in parallel with (and never touches) "FedOS Secure Memory
Secret Buffer and Zeroization Foundation," a separate active Arc in its own
worktree. Overclaiming secure-memory guarantees before that Arc integrates
would be fabrication; this warning is written to remain accurate regardless
of that Arc's own outcome.

## What the Safety Center never claims

- It never shows a single overall numeric "security score" (structurally
  proven, guard test #15).
- It never shows `"secure"`/`"100% safe"`/`"all protected"` for the whole
  application (structurally proven, guard test #15).
- It never displays one subsystem's `"unavailable"` state as if it were
  `"ready"` — every section's state is independent (Phase B).
- It never implies a Ratchet reset erases history, a Device revocation
  erases already-copied secrets, or a deletion acknowledgement is physical
  proof of erasure — all three are explicit, standing warnings (above).
- Opening any Safety Center screen never mutates anything — every mutating
  action requires a separate, explicit confirmation
  (`FedosSafetyCenterNavigationState.requestConfirmation()` →
  `confirmPendingAction()`).
- A manual Ratchet-reset confirmation outside the Identity Replacement flow
  honestly reports `"unsupported"` rather than fabricating a reset this Arc
  does not implement (see the execution spec's own Phase F note).

## Relationship to prior Arcs' own warning vocabularies

This is a NEW, separate closed vocabulary
(`FedosSafetyCenterWarningCode`) — it does not import or extend
`FedosIdentityTransitionWarningCode` (`6121-6200`) or
`FedosDeletionRequestWarningCode`-equivalent text
(`6041-6120`/`fedos_deletion_request_screen_model.ts`'s own six codes).
Some concepts legitimately overlap in MEANING (e.g. "old-key signature
insufficient under compromise" restates Identity Transition's own warning
in this domain's own vocabulary) — this is intentional restatement for a
DIFFERENT screen's own audience, not a redesign or a fork of the earlier
Arc's own vocabulary, which remains completely unmodified.
