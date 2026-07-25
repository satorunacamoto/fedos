# Secure Runtime Alpha 8041-8120 — Security-Copy Specification

Every user-facing sentence about a security/trust property this Arc's UI
displays, and the real source fact it is derived from. No sentence here
claims more than the cited source actually guarantees.

| Screen | Copy | Source fact |
|---|---|---|
| Invitation | "There is no code for your contact to paste — the conversation appears in their own list automatically once they are unlocked and connected." | `redeemInvitation()` is a permanent stub; real acceptance is automatic NIP-17 delivery. |
| Search | "This is not an encrypted blind index — see Safety Center for details." | `shell.search()` is a plaintext-derived keyword index (Content Accessor, unmodified). |
| Archive export | "Exporting does not remove or invalidate your live, active encrypted session — restoring history later never resumes that live session automatically." | `fedosArchiveExportWorkflowWarnings()` (unmodified, Alpha 7481-7560). |
| Archive restore | "A Device that never received a related deletion/suppression fact remains outside this guarantee." | Archive Suppression Sync's own disclosed limitation (Alpha 7721-7880). |
| Devices | "Revoking a Device removes its trust for future messages — it does not delete copies that Device already has, and does not affect Relay-side or foreign Archive copies." | `fedosSafetyCenterBuildConfirmationContent()`'s own `"device-revocation-does-not-erase-copies"`/`"other-devices-may-retain-copies"` warning text (unmodified). |
| Identity Replacement | "Never auto-accepted — review it yourself before trusting it." / "The old identity's signature alone is not treated as sufficient here — manual verification is recommended before accepting" (shown only when `oldKeyOnlyInsufficientWarning` is true). | `FedosIdentityTransitionDetailContent.oldKeyOnlyInsufficientWarning`/`warningText` (unmodified). |
| Signed Deletion | Per-item warning text sourced verbatim from the existing `FedosDeletionRequestWarningCode` → text table (`recipient-may-reject`, `other-devices-may-retain`, `archive-backup-may-remain`, `relay-ciphertext-may-remain`, `external-copies-unverifiable`, `not-physical-erasure-proof`). | `fedos_deletion_request_screen_model.ts`'s own `WARNING_TEXT` (unmodified; renderer keeps a verbatim copy since the Electron package never statically imports `src/`). |
| Safety Center | Section list rendered as independent `ready`/`attention`/`warning`/`blocked`/`unavailable` states with a glyph prefix (✓/⚠/✗/–), plus the full `standingWarnings` list. No single score anywhere. | `FedosSafetyCenterSummaryV1.sections`/`standingWarnings` (unmodified). |
| Recovery | Diagnostic-code-specific explanation (`RECOVERY_EXPLANATIONS`) for `recovery-required`/`corrupt`/`seed-unavailable`/`unsupported-version`; generic honest fallback otherwise. Never a fabricated Master Seed recovery code. | The Coordinator's own real, closed outcome vocabulary. |

## Error/state vocabulary (`OUTCOME_TEXT`, Phase N)

One function, `describeOutcome(outcome: string): string`, maps every closed
backend outcome string this renderer ever receives to one safe sentence
(`unavailable`, `seed-unavailable`, `locked`, `stopped`, `invalid-input`,
`not-configured`, `relay-offline`, `retrying`, `denied`, `conflict`,
`duplicate`, `unsupported-version`, `unsupported`, `corrupted`,
`restart-required`, `partial`, `not-found`, `busy`, `cancelled`, `failed`,
`requires-activation`, `requires-unlock`, `acceptance-only`). No stack
trace, exception string, or provider-internal detail is ever shown; an
unmapped code falls back to the same generic "Something went wrong" text a
mapped `failed` outcome gets — never a raw value.
