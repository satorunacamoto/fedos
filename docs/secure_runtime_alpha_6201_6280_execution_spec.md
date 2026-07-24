# Secure Runtime Alpha 6201–6280 — Execution Specification

**FedOS Desktop Beta Privacy Controls and Safety Center Arc.**

## Phase A — live source inventory (summary)

Mapped every real facade this Arc composes: `FedosDesktopApplicationShell`'s
own ~50 existing methods; `FedosProfileInitializationCoordinator.status()`;
`FedosRunningDesktopRuntime.conversationProductionCryptoCapability()`;
`FedosDeviceTrustRuntime`/`FedosDevicePairingFacade`/`FedosDeviceSyncOperationalFacade`
(all already Shell-reachable); `FedosDirectRatchetConversationRuntime.getDirectRatchetStatus()`
(NOT Shell-reachable before this Arc); `FedosRatchetPeerCapabilityRuntime.listObservedPeerDevices()`/
`getPeerDeviceCapabilityStatus()` (NOT Shell-reachable before this Arc);
`FedosIdentityTransitionPeerRuntime`'s own 11 Shell methods (fully reachable);
`FedosDeletionRequestRuntime`'s own 8 Shell methods (fully reachable) plus
the in-memory-only `#pendingReviewCache` (Phase D's own target); the
Retention/Search domain (no existing warning-composition facade — this
Arc's own standing disclosure fills that gap); `FedosDesktopNotificationCoordinator`
(a real, closed 14+5-kind vocabulary, reachable only from inside
`FedosDeletionRequestController`, not the Shell); `window.fedos.invoke()`
(the one generic Electron transport, unmodified).

## Phase B — closed Safety Center model

`fedos_safety_center_state.ts`: 13 closed sections, 7 closed per-section
states (`loading|ready|attention|warning|blocked|unavailable|error`). No
single numeric score anywhere (structurally proven, Phase Q).

## Phase C — safe security summary

`fedos_safety_center_summary.ts`: `fedosSafetyCenterBuildSummary()`, a pure
function over `FedosSafetyCenterRawFacts` (every field gathered by the
Controller from a real Shell/sibling-facade call). Section-state rules are
severity-ranked (`ready < unavailable < attention < warning < blocked/error`),
never averaged or weighted into one score. `overview`'s own state is the
worst of every other section's state.

## Phase D — pending-review durability closure

See the dedicated design document,
`docs/secure_runtime_alpha_6201_6280_pending_review_durability.md`.

## Phase E — security event timeline

`fedos_safety_center_event_timeline.ts`: a bounded (200), sorted
(newest-first), paginated pure projection over already-real, already-durable
per-domain facts (Device registration/trust/revocation timestamps, Identity
Transition inbox entries, Deletion Request received summaries). No new
audit-log persistence was created — every entry is a live re-read.

## Phase F — explicit confirmed actions

Exactly two dangerous actions exist in this domain:
`revoke-device`/`authorize-ratchet-reset`, both requiring
`FedosSafetyCenterNavigationState.requestConfirmation()` before
`FedosSafetyCenterController.confirmPendingAction()` can execute anything.
The Ratchet-reset branch is deliberately a stub reporting `"unsupported"` —
see the reconciliation report and completion declaration for why a real
manual Ratchet reset (distinct from the Identity Replacement flow's own
two-step `assessContinuity`/`authorizeRatchetReset`) is out of this Arc's
scope.

## Phase G — warnings and non-guarantees

See `docs/secure_runtime_alpha_6201_6280_warnings_and_non_guarantees.md`.

## Phase H — Shell commands

Eight new closed Host Command kinds (see the reconciliation report's own
"Decisions" section for why not nine): `safety-center-overview`,
`safety-center-events`, `safety-center-section`, `safety-center-device-action`,
`safety-center-ratchet-action`, `safety-center-confirm-action`,
`safety-center-cancel-action`, `safety-center-settings-action`. Every field
structurally validated before reaching `FedosSafetyCenterController`.

## Phase I/J — Presentation/Renderer

`FedosSafetyCenterController` (one Controller, one `overviewState`/`eventsState`/`confirmationState`
triple, reusing `FedosDesktopViewModelState<T>`). `FedosSafetyCenterRenderer`
(one Renderer, reusing `fedosRenderModel()`). No business logic, crypto, or
persistence in either file (structurally proven).

## Phase K — navigation

`FedosSafetyCenterNavigationState`: 13 sections, one-level `goto`/`goBack`,
restart-safe default (`"overview"`), one `pendingConfirmation` slot for the
Safety Confirmation Dialog. No shared central Navigation Registry exists in
this codebase (confirmed again); none created here.

## Phase L — notifications

Five new closed notification kinds
(`device-revoked`/`ratchet-reset-required`/`peer-capability-conflict`/
`identity-replacement-pending-review`/`safety-center-attention-summary`),
fired at most once per fact per process lifetime
(`#notifiedFacts`, mirrors `FedosDeletionRequestController.#notifiedRequestIds`).
Deliberately does NOT re-fire for pending deletion-consent items —
`FedosDeletionRequestController` already raises `"deletion-request-received"`
for that same underlying fact.

## Phase M — Host Bridge / Electron

Zero new Electron entry points. The existing generic
`window.fedos.invoke()` → `ipcRenderer.invoke("fedos:invoke", ...)` →
`FedosDesktopHostBridge` channel dispatches all 8 new commands, validated by
the SAME `validateFedosDesktopHostCommand()`. One new selftest step
(`dispatch-safety-center-overview`) added to
`fedos_electron_host_adapter_selftest.ts`, proving a real, non-fabricated
`"ok"` response end to end through a real spawned Electron subprocess (where
the environment supports it — see the completion declaration for this
worktree's own disclosed gap running that specific test).

## Phase N — settings

`FedosSafetyCenterController.updateNotificationsEnabled()`/`updateBackgroundSyncEnabled()`
delegate to the pre-existing `FedosDesktopSettingsController.load()`/`save()`
for the two already-existing fields this domain needs. No new field, no
second settings system.

## Phase O/P/Q

See the real vertical slice, failure matrix, and structural guard test
files themselves plus the completion declaration.
