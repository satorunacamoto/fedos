# Secure Runtime Alpha 3241–3320 — Desktop Local Conversation Management
# UI Prototype Arc — Completion Declaration

## 1. Objective

Build the first real Desktop Local UI boundary on top of the newly
completed `FedosDesktopApplicationShell` and
`FedosDesktopConversationContentAccessor` (Alpha 3081-3160) — a pure
TypeScript presentation boundary, never a rendering framework, that a
future UI of any kind (CLI, Electron, native, or a test harness) can
consume.

## 2. What was built

Ten ViewModels under `src/desktop/presentation/`, one file each, plus one
shared state-shape helper (`fedos_desktop_view_model_state.ts`) and one
aggregating factory (`fedos_desktop_conversation_ui_presentation_boundary.ts`):

| ViewModel | File | Wraps |
|---|---|---|
| Conversation List | `fedos_desktop_conversation_list_view_model.ts` | `shell.listConversations()` |
| Conversation Detail | `fedos_desktop_conversation_detail_view_model.ts` | `shell.getConversation()` |
| Message List | `fedos_desktop_message_list_view_model.ts` | `shell.listMessages()` + `shell.readMessage()` (on-demand `reveal()`) |
| Compose Message | `fedos_desktop_compose_message_view_model.ts` | `shell.sendMessage()` |
| Reply | `fedos_desktop_reply_view_model.ts` | `shell.reply()` |
| Search | `fedos_desktop_search_view_model.ts` | `shell.search()` |
| Archive | `fedos_desktop_archive_view_model.ts` | `shell.archive()` (inspect/preflightRestore/export/restore) |
| Membership | `fedos_desktop_membership_view_model.ts` | `shell.getConversation()` (creator/memberships) + `shell.issuedInvitations()` |
| Unread Counter | `fedos_desktop_unread_counter_view_model.ts` | `shell.listMessages()` + a local, in-memory watermark |
| Runtime Status | `fedos_desktop_runtime_status_view_model.ts` | `shell.status()`/`start()`/`stop()`/`deviceStatus()` |

Every ViewModel:
- owns exactly one reference to the `FedosDesktopApplicationShell` it was
  constructed with, and calls it for every fact and every mutation;
- exposes a `state` getter returning the ONE shared, closed
  `FedosDesktopViewModelState<T>` shape (`"idle" | "loading" | "loaded" |
  "error"`), plus one or more `async` action methods that call the Shell
  and update that state;
- never imports `conversationRuntime()`/`conversationContentAccessor()`,
  a persistence port, or a crypto authority — the Shell is the ONLY
  dependency (confirmed by grep: no file under `src/desktop/presentation/`
  imports anything from `src/conversation/` except plain, already-public
  view/reference TYPES the Shell's own view models already re-export, and
  the Archive request/result types the Shell's own `archive()` signature
  already uses verbatim).

`FedosDesktopConversationUiPresentationBoundary` constructs exactly one
Shell and exactly one of each ViewModel over it — never a second, divergent
Shell instance; two boundaries are fully independent (confirmed by test).

## 3. Honest scope decisions (per this Arc's own "no duplicate business
## logic" / "everything must delegate to the Shell" rules)

**No Activation/Invitation-Redemption ViewModel.** Neither operation is
among this Arc's own required ten, and — a real, pre-existing
characteristic discovered while writing tests — `FedosDesktopApplicationShell`
has NO public method for either at all (`redeemInvitation()` is honestly
`"unavailable"` on this base since Alpha 2841-2920; no `activate()` method
exists on the Shell by design). A Direct conversation can therefore never
reach genuinely "active" state through the Shell/ViewModel layer alone.
This Arc does not work around that (it would mean inventing new Shell
methods outside this Arc's own stated ViewModel list, or duplicating
`conversationRuntime()` access the Shell deliberately hides) — tests that
need a real active conversation instead establish it via a real,
independent `startFedosDesktopRuntime()` setup call over the SAME durable
config paths, then fully stop it before starting the presentation
boundary's own Shell over that already-durable state, mirroring this
codebase's own established "restart recovery" testing convention exactly.

**Unread Counter is an honest, local, in-memory watermark — not a new
"read receipt" backend capability.** No such concept exists anywhere in
this codebase (`fedos_desktop_shell_view_models.ts`'s own header). Rather
than fabricate one as a new business capability, `FedosDesktopUnreadCounterViewModel`
keeps exactly one non-persisted `Map<conversationId, newestSeenCreatedAt>`
and counts real `listMessages()` results newer than that watermark —
pure presentation bookkeeping over already-real data, lost on process
exit, never durable, never claiming to be a cross-device fact.

**Runtime Status ViewModel also proxies `start()`/`stop()`.** "Runtime
Status" implies observing AND controlling the one thing that has a
status — this is a thin pass-through (call Shell, then re-read status),
not new lifecycle logic.

**No Archive `list`/`summary`/`verify`.** Unchanged from Alpha 3081-3160 —
the Shell's own `archive()` has no such operation to wrap.

## 4. Acceptance

`test/secure_runtime_alpha_3241_3320_presentation_boundary.test.ts` — 13
tests, every one against a real `FedosDesktopConversationUiPresentationBoundary`
→ real `FedosDesktopApplicationShell` → real `startFedosDesktopRuntime()`,
real append-only log files:

1. Runtime Status lifecycle (stopped → running with real device status →
   stopped); every ViewModel honestly `"error"` before `start()`.
2. Real Direct conversation creation visible through
   List/Detail/Membership; unknown id honestly `"not-found"`; the
   permanently-`"draft"` `lifecycleState` is surfaced verbatim, never
   papered over.
3. Real send → list (plaintext hidden, Alpha 1139 unchanged) → reveal
   (exact plaintext) → reply (reply reference preserved) → Unread Counter
   tracking a real message count across `markViewed()` transitions;
   stranger-sender `"unauthorized"`; empty-body/no-reply-target
   `"invalid-input"`, never reaching the Shell.
4. Real keyword Search over a real sent message; empty query
   `"invalid-input"`.
5. Archive `"unavailable"` when `archiveEnabled` was never set; real
   `"not-found"` for a nonexistent file once it IS enabled.
6. No raw `Error`/stack in any ViewModel state (JSON-round-trip checked);
   two independent boundaries never share a Shell or see each other's
   conversations.

`FakeEncryptionAuthority`/`FakeDecryptionAuthority` are the SAME test
doubles every other vertical-slice test in this repository already uses
(no compiled WASM artifact in this checked-out tree) — not a mock of
anything this Arc adds; no other test double is used anywhere in this
suite.

## 5. Verification

`npm run typecheck` — clean except the one pre-existing, unrelated,
already-documented failure in
`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`. Targeted
regression (Desktop Runtime/Shell/Content Accessor/Direct/Group/
Reactivation/Search/Archive, 12 files, 135 tests) — all pass. Full `npm
test`: 12787 tests, 253 failing — every failing FILE matches, name-for-name,
the SAME pre-existing, environment-only categories already confirmed and
documented in Alpha 3081-3160's own completion declaration §14 (a
fresh-linked-worktree Cargo.toml/lib.rs raw-import artifact; the missing
compiled WASM artifact), PLUS three transient failures
(`secure_runtime_alpha_167`/`172`/`178_*`) that assert `git status
--porcelain` is empty/scoped to their own unrelated historical review
directories — these fail only because this Arc's own new files were still
untracked at verification time, and resolve once this Arc's commit lands
(confirmed after committing, see below). Zero failures traceable to any
file this Arc actually changed.

## 6. Security guarantees (restated, none of them touched by this Arc)

No persistence port, crypto authority, key handle, or secret is reachable
from any file under `src/desktop/presentation/` — every one of the ten
ViewModels' only dependency is `FedosDesktopApplicationShell`, whose own
guarantees (Alpha 2841-2920/3081-3160) are unchanged and unbypassed.

## 7. Completion declaration

**COMPLETE.** All ten required ViewModels exist, delegate entirely to the
real Shell, add no duplicate business logic, and are exercised by 13 real,
passing acceptance tests against a real Desktop Runtime/Shell/Content
Accessor (Search and Archive included). No UI framework, no HTML/CSS, no
browser API, no persistence, no crypto, no transport was added.

**Recommended next Arc:** Desktop UI Renderer Boundary.
