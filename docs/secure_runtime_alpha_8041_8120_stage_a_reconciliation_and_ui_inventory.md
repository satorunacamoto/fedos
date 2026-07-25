# Secure Runtime Alpha 8041-8120 - Phase A: Reconciliation and UI Inventory Report

**FedOS Desktop Beta User-Facing Product UI Completion Arc.** Worktree
`C:/wt/fedos-desktop-product-ui`, branch
`arc/fedos-desktop-beta-user-facing-product-ui`, based on local `master`
(`97f26f0f`).

## Base verification

- Local `master` = `97f26f0f` (Secure Runtime Alpha 7961-8040 own final
  commit), confirmed via direct `git log`.
- No branch anywhere in this repository is ahead of `master` while
  containing it as an ancestor -- `97f26f0f` is the newest tip.
- `81b5f0d1` (Alpha 7881-7960, the Secure Runtime backend hardening tip)
  confirmed an ancestor of `master`.
- Read-only audit commits `9c238a11` (Desktop Beta UX Acceptance Review)
  and `dbc1386` (Public Documentation and Security-Claims Audit v1) both
  exist in the repository's object database, on their own
  `review/desktop-beta-ux-acceptance` and
  `review/public-docs-security-claims-audit` branches respectively --
  read via `git show`, their own worktrees never touched.
- Historical **5401-5480 collision** (`be1bc0d9`/`b3b3a6d2`) remains
  present and unrenumbered, per long-standing convention.
- **8041-8120 confirmed unused**: `git log --all --oneline | grep -E
  "80[4-9][0-9]-[0-9]{4}|81[0-2][0-9]-[0-9]{4}"` returns nothing.

## The UX review's own headline claim, independently re-verified

Directly re-read `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html`,
`fedos_electron_beta_renderer.ts`, and `fedos_electron_beta_preload.cts`
at `97f26f0f` (unchanged from `81b5f0d1`, the commit the review itself
audited). **Confirmed true, independently**: the real page has exactly
8 `<section>` elements (loading/welcome/create/unlock/initializing/
unlock-failed/recovery/ready); `window.fedosAcceptance` (12 real,
IPC-reachable methods: create/activate Direct Conversation, 4 Device
Pairing steps, establish Ratchet session, send/list/read message, Ratchet
status, create invitation, search, archive, Safety Center overview) is
referenced **zero times** in the renderer or HTML — confirmed by direct
`grep`, not by trusting the review's own prose. **This Arc does not
expose `fedosAcceptance` to the page** — a new, properly-named,
non-test-branded bridge is built instead (Phase B).

## Real backend capability inventory (`FedosDesktopApplicationShell`, `src/desktop/shell/fedos_desktop_application_shell.ts`)

Confirmed by direct method-signature reading, not assumed from prose:

| Workflow | Shell method(s) | Notes |
|---|---|---|
| Invitation (send) | `createConversationInvitation(invitee, expiresInMs?)` | Real, sends via NIP-17. |
| Invitation (accept) | **none — `redeemInvitation()` is a PERMANENT stub** (`FedosDesktopShellResult<never>`, always `"unavailable"`, per its own doc comment "Always unavailable on this base"). | Acceptance is REAL but AUTOMATIC: the invitee's own already-running, already-unlocked Runtime imports the Direct Conversation the moment the real relay delivers it (`conversationTransportInbound`/`receiveNip17Rumor`, already wired). **This Arc must not fabricate a manual "paste code to accept" UI the backend does not have** — the correct, honest design is a conversation list that reflects new conversations automatically. |
| Conversation list | `listConversations(filter?)` | Real. |
| Conversation detail | `getConversation(conversationId)` | Real. |
| Messaging | `listMessages`, `readMessage`, `sendMessage(conversationId, sender, body)`, `reply(...)` | Real; `sender` is the local `FedosConversationParticipantReference` (`{authority:"nostr", publicIdentifier}` — the SAME identity the Ready screen already displays). |
| Direct Ratchet status | `directRatchetStatus`, `establishDirectRatchetSession` | Real. |
| Search | `search(query)` | Real. |
| Archive | `archive(command)` | Real; `command.operation` is `"inspect"\|"export"\|"restore"\|"preflightRestore"`. |
| Devices | `devicesList()`, `deviceDetail(id)`, `deviceRevoke(id, publicKeyHex)`, `devicePairingCreate/Inspect/Approve/Complete`, `deviceSyncStatus()` | Real. `deviceStatus()` itself is a PERMANENT stub (always `"unavailable"`, per its own doc comment) — a DIFFERENT, narrower method than `devicesList()`; the UI must use `devicesList()`. |
| Identity Transition | `identityTransitionList/Open/InspectEvidence/RecordManualVerification/Accept/Reject/Defer/Status/RecordContinuity/AssessContinuity/AuthorizeRatchetReset` | Real, and NOT previously exposed via ANY IPC channel (confirmed: zero `fedos-acceptance:*` or `fedos-beta:*` channel references this domain) — this Arc adds the FIRST IPC surface for it. |
| Signed Deletion | `deletionRequestCreate/ListSentForTarget/AcknowledgementOutcome/ListReceived/AssessPolicy/Approve/Reject/Status` | Real, and NOT previously exposed via ANY IPC channel (same finding as Identity Transition — this Arc adds the first surface). |
| Safety Center | `activeAssembly.boundary.safetyCenter.refreshOverview([])`/`.overviewState` | Real, already wrapped once by the EXISTING (unreachable-from-page) `fedos-acceptance:safety-center-overview` handler. |
| Settings | `FedosDesktopSettingsController` via `activeAssembly.settingsCoordinator` (`previewPlan`/`apply`), already exposed as `fedos-beta:settings-plan`/`fedos-beta:settings-apply` — called by nothing in the renderer (confirmed by the UX review, re-confirmed by `grep`). **No "read current settings" channel exists yet** — this Arc adds one (`fedos-app:settings-load`, a thin wrapper over the existing, unmodified `FedosDesktopSettingsController.load()`/`FileFedosSettingsPersistence`, no new persistence). |

## Files this Arc expects to change

- `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html` — new sections, nav.
- `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts` — new screen logic.
- `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_preload.cts` — new `fedosApp` bridge (additive; `fedosProfile`/`fedosBeta`/`fedosAcceptance` remain byte-for-byte, Phase P "do not rename existing accepted surfaces").
- `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts` — new `fedos-app:*` IPC handlers, each a thin wrapper over an already-real Shell method (no new business logic), plus the first-ever Identity Transition/Deletion Request/Devices/Settings-load handlers.
- New test files under `test/` and `packages/fedos-desktop-electron-spike/test/`.
- New `docs/secure_runtime_alpha_8041_8120_*` documents.
- `README.md` (newest-first status update).

## No production edits before this report existed.
