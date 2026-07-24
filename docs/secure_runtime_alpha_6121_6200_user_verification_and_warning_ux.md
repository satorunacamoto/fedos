# Secure Runtime Alpha 6121–6200 — User Verification and Warning UX Document

## The lifecycle a user actually sees

1. **Inbox** — a bounded, deterministic list of pending identity
   transitions this local Device has observed. Each row shows
   `evidenceOutcome` and `acceptanceState` — never one collapsed
   "verified" flag.
2. **Detail (also Evidence Review / Peer Device Evidence)** — opening a
   row is a pure read. It shows: old/new public identity, revision,
   evidence outcome, acceptance state, whether superseded, the
   per-Device evidence list, any manual-verification fact already on
   file, and the FULL, centralized warning text for the current state.
   Opening this screen NEVER accepts, rejects, or resets anything —
   proven directly in the real vertical slice (step 6).
3. **Manual Verification** — an explicit, separate action recording a
   closed method + timestamp + coarse note code. This is a LOCAL trust
   decision, never a proof broadcast anywhere.
4. **Accept / Reject / Defer** — three explicit, separate actions.
   `"defer"` is recorded as a fact but never changes `acceptanceState`
   away from its evidence-only baseline — deferring is not a decision.
   A later decision always supersedes an earlier one (accept after
   reject, or reject after accept, both work — see the failure-matrix
   test "latest explicit decision always wins").
5. **Continuity** — once (and only once) accepted, the user may
   explicitly link the transition to a specific Direct Conversation.
   This is a SEPARATE action from acceptance itself.
6. **Ratchet Reset Confirmation** — two more separate steps:
   `assessContinuity()` (read-only — reports current safe status per
   named session, never mutates) then `authorizeRatchetReset()` (the
   ONE action in this whole Arc that can mutate Ratchet state, and only
   for an already-`"accepted"` transition).

## Why `verified` is never shown as `trusted`

`FedosIdentityTransitionEvidenceOutcome` and
`FedosIdentityTransitionAcceptanceState` are always two distinct
fields on every DTO this Arc renders. A transition whose new-key proof
is cryptographically valid but whose old-key continuity is absent
(`"continuity-unproven"`) is never displayed the same way as one that
reached `"locally-acceptable"` — and neither is ever displayed as
`"trusted"`, a word that does not appear anywhere in this Arc's own
closed vocabularies.

## The 10 centralized warning codes (`fedos_identity_transition_warning_codes.ts`)

| Code | Text |
|---|---|
| `replacement-not-rotation` | This is a replacement claim, not an in-place key rotation. |
| `old-key-signature-may-be-forged` | A valid old-key signature may be forged if the old key was compromised. |
| `device-corroboration-not-proof` | Device corroboration is additional evidence, not universal proof. |
| `continuity-acceptance-is-local-decision` | Accepting continuity is a local trust decision. |
| `historical-messages-remain-attributed-to-old-identity` | Historical messages remain attributed to the old identity. |
| `existing-ratchet-keys-will-not-move` | Existing Ratchet keys will not move to the new identity. |
| `new-secure-session-required` | A new secure session must be established. |
| `other-devices-may-decide-independently` | Other Devices may make independent decisions. |
| `conflicting-claims-require-manual-review` | Conflicting replacement claims require manual review. |
| `archive-restore-does-not-establish-trust` | Archive Restore does not establish trust. |

`fedosIdentityTransitionWarningsFor(evidenceOutcome, acceptanceState,
superseded)` is the ONE pure function that decides which of these apply
to a given transition's current state — every screen (Detail, Ratchet
Reset Confirmation) resolves through it or through
`fedosIdentityTransitionWarningText()` directly; no screen ever writes
its own inline security copy.

## What this Arc explicitly does NOT claim

- It never says an identity was "securely rotated" — that phrase, and
  the underlying claim, do not exist anywhere in this Arc's output.
- It never implies one Device's corroboration is a quorum.
- It never implies opening a screen changed anything.
- It never implies a Ratchet reset happened just because it was
  "authorized" if the underlying Runtime honestly reports
  `"unavailable"` (this worktree's own disclosed WASM boundary — see
  the completion declaration).
