# Secure Runtime Alpha 6121–6200 — Reconciliation Report

**FedOS Identity Replacement User Verification and Conversation
Continuity UI Arc.** Worktree `C:\wt\identity-replacement-verification-ui`,
branch `arc/identity-replacement-user-verification-conversation-continuity-ui`.

Written before any production source edit, per this Arc's own mandatory
reconciliation requirement.

## Alpha range reservation

`git log --all` confirms the highest previously-claimed range is
**6041–6120** (`b72ca7b6`). No commit claims 6121–6200. The historical
5401–5480 collision remains a one-time event, not repeated.
**This Arc reserves 6121–6200.**

## Ancestry / merge-base analysis (mandatory steps 1–4)

`git merge-base a5f9cca5 b72ca7b6` → `d825aa0` — the two required
lineages **diverge** (`git merge-base --is-ancestor` confirms neither
contains the other). This differs from the previous Arc, where one
lineage already contained the other.

`git diff --name-only d825aa0 a5f9cca5` (83 files) vs.
`git diff --name-only d825aa0 b72ca7b6` (115 files): the ONLY
overlapping path is `README.md`. Every source/doc/test file touched by
either lineage is unique to that lineage — **mechanical additive**
across the board, zero semantic overlap in production code.

## Merge performed

A prerequisite merge commit was genuinely required (step 9): worktree
created on a new branch from `a5f9cca5`, then `git merge --no-ff
b72ca7b6`. Every file auto-merged cleanly except `README.md` (both
branches independently prepended their own newest-first status stack on
top of the same `d825aa0`-era content) — resolved by keeping this Arc's
own branch tip (`a5f9cca5`, chronologically newer, 01:11:28) as the top
entry, followed by `b72ca7b6`'s own top entry (00:53:40) as the next
"Prior status," followed by each lineage's own remaining history in
turn. No content was discarded; the resolution is a concatenation with
an explanatory note, not a rewrite.

Post-merge verification: `npm run typecheck:core` clean (2 pre-existing,
unrelated baseline errors only); both lineages' own full test suites
(`5801-5880`, `5961-6040`, `6041-6120`) re-run and pass unchanged in the
merged worktree (173 passing / 2 WASM-gated skips).

## Ownership check (no incompatible claims found)

- `FedosDesktopApplicationShell`, the Presentation Boundary
  (`FedosDesktopConversationUiPresentationBoundary`), the Renderer
  aggregate (`FedosDesktopRenderer`), and the Host Bridge
  (`FedosDesktopHostBridge`/`fedos_desktop_host_command.ts`) are each
  SINGULAR, canonical, and already extended once by `b72ca7b6` using a
  clean, repeatable "one new Controller/Renderer file + one import + one
  field + one constructor line" pattern. This Arc reuses that identical
  pattern — no second Shell/Boundary/Renderer/Bridge is created.
- `FedosConversationRuntime` already has a repeatable, precedented
  pattern for composing an optional sibling domain Runtime
  (`directRatchet()`, `peerCapability()`, `deletionRequest()`, each a
  nullable getter-style method backed by an optional dependency-bundle
  field) — this Arc adds `identityTransition()` following the exact same
  shape, composing the ALREADY-BUILT `FedosIdentityTransitionPeerRuntime`
  (`a5f9cca5`). No second Runtime.
- There is no centralized Navigation Registry to extend or duplicate —
  each feature owns a small colocated `Fedos<Feature>NavigationState`
  class (confirmed precedent: `device_management`, `deletion_request`).
  This Arc adds its own sibling, `FedosIdentityTransitionNavigationState`.
- The canonical Electron/Host process does not exist in `src/` at all
  (only a separate, explicitly-spike-labeled package,
  `packages/fedos-desktop-electron-spike/`, untouched by either prior
  lineage or this one) — `FedosDesktopHostBridge` is this repo's own
  accepted in-process `FedosDesktopHostPort` reference implementation,
  and this Arc stops at that same boundary, exactly like `b72ca7b6` did.

**No incompatible ownership found anywhere in the list Phase A named to
check.** No architecture conflict; proceeding directly to Phase A
inventory and then implementation on this single merged base.

## Phase A inventory (files touched vs. must-remain-untouched)

| File | Responsibility | Change |
|---|---|---|
| `src/conversation/runtime/fedos_conversation_runtime.ts` | composes every optional sibling domain Runtime | ADD one optional `identityTransition` dependency bundle + nullable `identityTransition()` accessor, mirroring `deletionRequest()` byte-for-byte |
| `src/desktop/shell/fedos_desktop_application_shell.ts` | narrow, validated command surface over the Runtime | ADD ~10 new methods, mirroring the 9 `deletionRequest*` methods' null-gate + outcome-mapping discipline |
| `src/desktop/host_boundary/fedos_desktop_host_command.ts` | closed, structurally-validated command union | ADD ~10 new command kinds + validators |
| `src/desktop/host_boundary/fedos_desktop_host_bridge.ts` | dispatches validated commands to Shell/Controller | ADD ~10 dispatch cases |
| `src/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.ts` | composes every feature Controller | ADD one import + one field + one constructor line |
| `src/desktop/renderer/fedos_desktop_renderer.ts` | composes every feature Renderer | ADD one import + one field + one constructor line |
| `src/conversation/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.ts` | the already-built Peer Runtime facade | ADD `recordManualVerification()`/`recordConversationContinuity()`-style methods (new, additive) |
| `src/conversation/ratchet/fedos_direct_ratchet_conversation_runtime.ts` | live Ratchet session lifecycle | **UNTOUCHED** — this Arc calls its existing PUBLIC `initializeDirectRatchetSession()` (already a thin wrapper over `establishSession()`) and `getDirectRatchetStatus()` only |
| `src/desktop/renderer/fedos_desktop_membership_renderer.ts`, `fedos_desktop_conversation_detail_renderer.ts` | existing Conversation/Membership display | **UNTOUCHED** |
| `src/desktop/notification/fedos_desktop_notification_coordinator.ts` | safe notification delivery | **UNTOUCHED** — `b72ca7b6`'s own README explicitly disclosed "Notification Coordinator wiring were not reached (narrow, non-redesign follow-on)"; this Arc makes the identical, precedented scope choice rather than exceeding the pattern it was asked to mirror |
| `packages/fedos-desktop-electron-spike/` | Electron spike, no accepted Main/preload in `src/` | **UNTOUCHED** — same disclosed-gap precedent |

## Design decision: Ratchet reset dispatch adapter

`authorizeFedosIdentityTransitionRatchetReset()` (`a5f9cca5`) accepts
`Pick<FedosDirectRatchetOutboundIntegration, "establishSession">`. Rather
than reaching into the Ratchet domain's internals, the Shell constructs
a THIN inline adapter at call time:
`{ establishSession: (conversationId, remoteDeviceRef, options) =>
runtime.directRatchet()!.initializeDirectRatchetSession(conversationId,
remoteDeviceRef, options) }` — reusing the ALREADY-PUBLIC, already-thin
`initializeDirectRatchetSession()` wrapper `b8e9e06`/`f80889d` already
expose, never a new Ratchet-facing method.

## Design decision: Ratchet impact identification without a new session-listing query

`planFedosIdentityTransitionAffectedSessions()` (`a5f9cca5`) takes raw
`FedosDirectRatchetSessionRecordV1[]`, which nothing public exposes (no
"list all live sessions for a remote account" query exists on
`FedosDirectRatchetConversationRuntime`, and adding one would be a
Ratchet-domain change this Arc's own prohibitions forbid). Given "the
smallest model consistent with `45e0fce`," this Arc instead has the
caller (Shell command input) name the specific `(conversationId,
remoteDeviceRef)` pairs to assess — exactly the same two-parameter shape
`getDirectRatchetStatus()`/`initializeDirectRatchetSession()` already
require — and reports each pair's already-public safe status
(`FedosDirectRatchetSafeStatus`, 8 closed values) rather than a
raw session record. See the execution spec for the exact mapping.

## Conclusion

Proceeding to Phase B (safe view model) implementation on this single,
fully-verified merged base.
