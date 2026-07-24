# Secure Runtime Alpha 6041–6120 — Phase A Reconciliation Report

**FedOS Signed Deletion Request Multi-Device Aggregation and User Consent UI Arc**

Worktree: `C:\wt\signed-deletion-consent-ui`. Branch: `arc/signed-deletion-multidevice-consent-ui`.

## 0. Range verification

`git log --oneline --all | grep -E "59[6-9][0-9]-|6[01][0-9][0-9]-"` found no commit anywhere in
5961–6120 — genuinely free. Per the coordination instructions, 5961–6040 is reserved for the
concurrently-active Identity Transition Arc (`arc/identity-transition-peer-notification-ratchet-reset`,
confirmed running in a SEPARATE worktree, `C:\wt\identity-transition-peer-reset`, never touched by
this Arc); **this Arc claims 6041–6120**.

## 1. Base selection — no merge required

Required protocol/runtime base: `8981f81` (`arc/signed-deletion-private-transport-local-policy`,
this repository's own prior Arc, Secure Runtime Alpha 5881–5960).

Required Desktop architecture: `FedosDesktopApplicationShell`, Host Bridge, Presentation/ViewModel
boundary, Renderer boundary, navigation/window registry, canonical Electron Main/Preload adapter.
Direct ancestry check (`git merge-base --is-ancestor <commit> 8981f81`) confirmed every named
canonical Desktop/Beta/Electron commit (`8548845`, `3a7db86`, `6b47730`, `8b74dbc`, `4b7fcf7`,
`3f32e6e`, `2f591cb`, `ac09bc0`) is **already an ancestor of `8981f81`** — the full canonical
Desktop Shell/Presentation/Renderer/Navigation/HostBridge/Electron-spike lineage merged into
`master` via `8548845` (Secure Runtime Alpha 5161–5240, "Canonical Desktop Composition") long
before the Signed Deletion Request protocol lineage was built on top of it.

**Decision: `8981f81` is this Arc's own, single, unmodified integration base — no merge, no
reconciliation between divergent Desktop/protocol lineages is needed.** This is confirmed by
direct inspection of the base worktree's own file tree: `src/desktop/shell/`,
`src/desktop/host_boundary/`, `src/desktop/presentation/`, `src/desktop/renderer/`,
`src/desktop/navigation/`, and `packages/fedos-desktop-electron-spike/` are all already present
and real.

## 2. What is already present in `8981f81` vs. what this Arc adds

| Capability | Present in base? | This Arc's own addition |
|---|---|---|
| `FedosDesktopApplicationShell` | Yes, real | Nine new deletion-request methods, delegating entirely to `FedosConversationRuntime.deletionRequest()` |
| `FedosDesktopHostBridge` command dispatch | Yes, real | Nine new closed command types + dispatch cases |
| `FedosDesktopConversationUiPresentationBoundary` | Yes, real | One new field, `deletionRequests: FedosDeletionRequestController` |
| `FedosDesktopRenderer` | Yes, real | One new field, `deletionRequests: FedosDeletionRequestRenderer` |
| `FedosConversationRuntime.deletionRequest()` | Yes, real (`5881-5960`) | Six new read-only/id-based methods (aggregation + Host-safe approve/reject) |
| Per-Device request/acknowledgement facts | Yes, real, durable | NOTHING new is persisted about the PROTOCOL itself |
| Recipient Inbox display facts | **No** — `5641-5720`'s own decision record carries state only, never the request's own safe display fields | A new, additive, insert-only `FedosDeletionRequestInboxSummaryPersistence` port (Phase D) |
| Desktop Runtime production bootstrap (`fedos_desktop_runtime.ts`) wiring `deletionRequest` deps | **Yes, real, as of the gap-closing follow-up** — `FedosDesktopRuntimeConfig` gained one new optional `conversationDeletionRequest` field, threaded straight to `createFedosConversationRuntime({..., deletionRequest: ...})`; omitted, byte-identical to prior behavior | See completion declaration's own "Gap-closing follow-up" section — `test/secure_runtime_alpha_6041_6120_desktop_runtime_config_threading.test.ts` proves it through the real production `startFedosDesktopRuntime()`/`FedosDesktopApplicationShell.start()` path |

## 3. Conflict classification

Every production file this Arc touches was classified before editing:

- **Additive-only** (new file, zero collision risk): all eight files under
  `src/desktop/presentation/deletion_request/`, `src/desktop/renderer/deletion_request/`, the two
  new `src/conversation/deletion_request/` inbox-summary files.
- **Additive extension of an existing shared file** (new field/method appended, zero existing
  line changed beyond an import/field insertion): `fedos_desktop_application_shell.ts`,
  `fedos_desktop_host_command.ts`, `fedos_desktop_host_bridge.ts`,
  `fedos_desktop_conversation_ui_presentation_boundary.ts`, `fedos_desktop_renderer.ts`,
  `fedos_conversation_runtime.ts` (deletion-request deps type only), `fedos_deletion_request_runtime.ts`.
- **Historical fixed-count/shape test**: none triggered — this Arc adds no Rust `pub fn`, no
  `HkdfDomain` variant, no WASM export.
- **README/docs**: newest-first stack, this Arc's own entry prepended — no reordering of any
  earlier entry.
- **Architecture conflict**: none found. No second Desktop Shell, Runtime, Host Bridge,
  Presentation boundary, or Electron Main was created.

## 4. A real, necessary functional fix found during this Arc's own development

`5881-5960`'s own `FedosDeletionRequestInboundCoordinator.executeApprovedLocalDeletion()`
re-evaluated `resolveLocalPolicy()` a SECOND time at approval — for an `"always-review"` policy
(THE central case this Arc's own consent UI exists to serve), that re-evaluation always produces
`"await-review"` again, never `"grant"`, making every `"always-review"` item permanently
un-approvable. Caught by this Arc's own real vertical slice (`deletionRequestApprove()` returning
`"policy-rejected"` instead of executing). Fixed narrowly: reaching the approval method at all
already IS the human review `"always-review"` exists to require, so that ONE policy value now
grants exactly the request's own requested scope on explicit approval — `"deny"`/`"unavailable"`
still refuse, and `"allow-local-history-only"` still caps the grant exactly as before. See the
completion declaration for the full before/after.

## 5. Stop conditions checked — none triggered

No incompatible Desktop Runtime ownership, Shell lifecycle, Host Bridge command vocabulary,
Presentation/Renderer ownership, Electron Main ownership, deletion-request Runtime facade, or
profile/unlock lifecycle model was found. No second instance of any of these was created.
