# Secure Runtime Alpha 6041–6120 — Execution Specification

**FedOS Signed Deletion Request Multi-Device Aggregation and User Consent UI Arc**

Base: `8981f81` (no merge required — see the reconciliation report §1).

## New files

| File | Phase | Role |
|---|---|---|
| `src/conversation/deletion_request/fedos_deletion_request_inbox_summary.ts` + append-only backend | D | additive, insert-only safe-display-field port for the recipient's own restart-safe Inbox |
| `src/desktop/presentation/deletion_request/fedos_deletion_request_device_status.ts` | B | pure per-Device + account aggregate closed vocabularies |
| `src/desktop/presentation/deletion_request/fedos_deletion_request_screen_model.ts` | C/D/E/F | pure screen-content builders (consent detail, Inbox item, sent status, warnings) |
| `src/desktop/presentation/deletion_request/fedos_deletion_request_navigation_state.ts` | J | screen/selection state, non-durable |
| `src/desktop/presentation/deletion_request/fedos_deletion_request_controller.ts` | C/D/E/H | the ONE Deletion Request controller, delegates entirely to the Shell |
| `src/desktop/renderer/deletion_request/fedos_deletion_request_renderer.ts` | I | pure render-model projection |

## Additive changes to existing shared files

- `fedos_deletion_request_runtime.ts` (`5881-5960`) — six new methods: `listSentRequestsForTarget`,
  `getAcknowledgementOutcome`, `listReceivedRequestSummaries`, `approveReceivedDeletionRequest`,
  `rejectReceivedDeletionRequest`. Each is a thin, safe accessor over already-real durable state.
- `fedos_deletion_request_inbound_coordinator.ts` (`5881-5960`) — an optional
  `inboxSummaryPersistence` dependency (Phase D), an in-memory pending-review cache plus
  `hasPendingReviewRequest()`/`executeApprovedLocalDeletionById()`/`rejectReceivedDeletionRequest()`
  (Host/Renderer-safe, id-only entry points — no raw signature ever crosses the Host Command
  boundary), and the `"always-review"`-grants-on-explicit-approval fix (reconciliation report §4).
- `fedos_conversation_runtime.ts` — one new optional field,
  `FedosConversationDeletionRequestIntegrationDependencies.inboxSummaryPersistence`, threaded
  through unchanged otherwise.
- `fedos_desktop_application_shell.ts` — nine new methods (`deletionRequestCreate`,
  `deletionRequestListSentForTarget`, `deletionRequestAcknowledgementOutcome`,
  `deletionRequestListReceived`, `deletionRequestAssessPolicy`, `deletionRequestApprove`,
  `deletionRequestReject`, `deletionRequestStatus`), delegating entirely to
  `conversationRuntime().deletionRequest()`; `"unavailable"` when that facade is `null`.
- `fedos_desktop_host_command.ts` — nine new closed command types (Phase G), structurally
  validated (bounded strings, closed enums, bounded Device-id lists) before ever reaching the
  Shell.
- `fedos_desktop_host_bridge.ts` — nine new dispatch cases, each a thin delegation.
- `fedos_desktop_conversation_ui_presentation_boundary.ts` /
  `fedos_desktop_renderer.ts` — one new field each (`deletionRequests`).

## Phase B — aggregation math

See the aggregation truth document for the full precedence rule and closed vocabularies.

## Phase C — consent

See the consent/warning UX document.

## Phase G/L — Host Command surface

`deletion-request-create`, `-list-sent`, `-list-received`, `-open`, `-approve`, `-reject`,
`-status`, `-device-outcomes`, `-dismiss`. Every command carries only canonical ids/closed enum
values/bounded strings — never a raw path, raw signature, or the execution coordinator directly.
Device-id lists are bounded to 64 entries.

## Phase K — Notifications

Closed in the gap-closing follow-up — see the completion declaration's own "Gap-closing
follow-up" section. Five new, additive, fixed-template `FedosDesktopNotificationKind` values;
`FedosDeletionRequestController` composes the existing, unmodified
`FedosDesktopNotificationCoordinator` (defaulting to the safe Noop backend), firing
once-per-newly-seen-item on Inbox refresh plus three explicit sender-side triggers. No
notification ever carries a request id, requester ref, reason code, or content — only the closed
kind, an opaque `targetConversationId`, and a short bounded `detail`.

## Phase M — Electron

Closed in the gap-closing follow-up — see the completion declaration's own "Gap-closing
follow-up" section. The existing frozen preload/Main pattern
(`packages/fedos-desktop-electron-spike/`) required no redesign: the generic
`window.fedos.invoke()` transport already dispatched any validated Host Command, including this
Arc's own nine. Four new self-test steps and a real spawned Electron subprocess assertion now
prove all nine commands are reachable end to end.

## Verification

- `npx tsc --noEmit -p .` — clean except the two pre-existing baseline errors, confirmed
  identical on the unmodified `8981f81` base.
- This Arc's own 4 original test files: aggregation/screen-model unit tests (21), Host command/
  structural-guard tests (14), and the REAL end-to-end multi-Device vertical slice (1) — **all
  passing**, the vertical slice against a genuinely-built WASM artifact.
- Gap-closing follow-up: Notification Coordinator wiring tests (8), desktop-runtime
  `conversationDeletionRequest` config-threading tests (4, through the real production
  `startFedosDesktopRuntime()`/`FedosDesktopApplicationShell.start()` path), and the pre-existing
  Electron adapter acceptance file's 4 new self-test assertions (folded into its own 21, run
  against a real spawned Electron subprocess) — **all passing**.
- Every pre-existing `5641-5720`/`5881-5960`/`5721-5800` test file (including their own real WASM
  vertical slices) and every pre-existing Desktop Shell/Presentation/Renderer/Host-Bridge test
  file (98 tests across 6 files) — unchanged, all still passing.
