# Secure Runtime Alpha 3401–3480 — Desktop UI Renderer Boundary —
# Completion Declaration

## 1. Objective

Implement the rendering boundary only, on top of the ten ViewModels Alpha
3241-3320 already built — pure TypeScript render-model contracts, never
Electron/React/Tauri/browser code.

## 2. What was built

`src/desktop/renderer/` — eleven files:

| Renderer | File | Consumes |
|---|---|---|
| Desktop (aggregator) | `fedos_desktop_renderer.ts` | one `FedosDesktopConversationUiPresentationBoundary` |
| Conversation List | `fedos_desktop_conversation_list_renderer.ts` | `conversationList` ViewModel |
| Conversation Detail | `fedos_desktop_conversation_detail_renderer.ts` | `conversationDetail` ViewModel |
| Message | `fedos_desktop_message_renderer.ts` | `messageList` + `composeMessage` + `unreadCounter` ViewModels |
| Reply | `fedos_desktop_reply_renderer.ts` | `reply` ViewModel |
| Archive | `fedos_desktop_archive_renderer.ts` | `archive` ViewModel |
| Search | `fedos_desktop_search_renderer.ts` | `search` ViewModel |
| Membership | `fedos_desktop_membership_renderer.ts` | `membership` ViewModel |
| Status | `fedos_desktop_status_renderer.ts` | `runtimeStatus` ViewModel |
| Error | `fedos_desktop_error_renderer.ts` | any ViewModel's `.state` |
| Loading | `fedos_desktop_loading_renderer.ts` | any ViewModel's `.state` |

Plus `fedos_desktop_render_model.ts`: the ONE shared, closed render-output
shape, `FedosDesktopRenderModel<T> = {kind:"idle"} | {kind:"loading"} |
{kind:"error", outcome, message} | {kind:"content", content: T}`, and
`fedosRenderModel()`, the shared state→render-model projection every
content renderer composes (centralizing exactly what
`FedosDesktopErrorRenderer`/`FedosDesktopLoadingRenderer` also expose as
their own directly-testable, standalone units — "no duplicate business
logic" applied at the rendering layer itself).

## 3. Design decisions

**Renderer-to-ViewModel mapping is not 1:1.** Ten ViewModels, eight
content Renderers (plus the two shared Error/Loading ones and the
aggregator) — this Arc's own required renderer list names one
"MessageRenderer" and one "StatusRenderer", not ten. `MessageRenderer`
therefore consumes THREE ViewModels together (Message List, Compose
Message, Unread Counter) because a real message pane renders exactly
those three facets as one cohesive unit; `StatusRenderer` consumes Runtime
Status alone (an exact 1:1 match with its own literal name). Each
multi-ViewModel renderer's output is a plain composite of independent
`FedosDesktopRenderModel`s (e.g. `{messages, compose, unread}`) — never one
forced, artificial top-level `kind`, since the three facets genuinely have
independent lifecycles (a message list can be `"content"` while a pending
send is still `"loading"`).

**"Empty" is data, not a `kind`.** A list-shaped renderer's `content` is
`{items, count, isEmpty}` (`fedosRenderList()`) — a real, successfully
`"content"`-kind result that happens to have zero items, never confused
with `"idle"` (nothing attempted) or `"error"` (something failed). This is
the render-layer's own version of Alpha 3081-3160's own "distinguish
unavailable from empty results" rule, carried one layer further out.

**"Snapshot tests" are full `toEqual()` assertions, not an external
`__snapshots__` file convention.** This repository has no pre-existing
snapshot-testing pattern anywhere; introducing one purely to satisfy a
literal label would be a foreign, one-off convention. A full,
deterministic `toEqual()` of the ENTIRE render-model object in one
assertion achieves the same thing — capturing the complete structure at
once — using this codebase's own dominant, already-established assertion
style.

## 4. Requirements confirmed

- Every renderer's ONLY dependency is a ViewModel (or several) from
  `src/desktop/presentation/` — confirmed by inspection: no file under
  `src/desktop/renderer/` imports from `src/conversation/` except plain,
  already-public reference/view TYPES the ViewModels/Shell themselves
  already re-export (e.g. `FedosConversationMembership`,
  `FedosConversationParticipantReference`), and no file imports
  `FedosDesktopApplicationShell`, `conversationRuntime()`,
  `conversationContentAccessor()`, a persistence port, or a crypto
  authority.
- No renderer calls a ViewModel's own action method (`.load()`/`.send()`/
  `.search()`/...) — every `render()` method only READS a ViewModel's
  already-public getters (`.state`, `.query`, `.body`, `.replyToMessageId`).
- No rendering framework, HTML, CSS, or browser global anywhere in the
  directory (confirmed by grep: zero occurrences of `window`, `document`,
  `React`, `electron`, or any `.tsx`/`.jsx` file).
- Closed vocabulary: every render model is plain, frozen, JSON-serializable
  data (confirmed by a dedicated no-leakage test).

## 5. Real acceptance tests

`test/secure_runtime_alpha_3401_3480_renderer_boundary.test.ts` — 11
tests, every one against a real `FedosDesktopRenderer` over real
ViewModels over a real Shell over a real `startFedosDesktopRuntime()`
instance:

1. Snapshot: every renderer's own `"idle"` render model before any
   ViewModel action has run.
2. State transitions: Conversation List idle→content(real)→content
   (filtered-empty); Runtime Status idle→content(stopped)→content
   (running, with real device status)→content(stopped).
3. Error rendering: `FedosDesktopErrorRenderer.render()` — `null` for
   non-error states, the exact real `outcome`/`reason` otherwise; a real
   `"not-found"` and a real `"unauthorized"` (stranger sender) rendered
   through content renderers.
4. Loading rendering: `FedosDesktopLoadingRenderer.isLoading()` observed
   `true` DURING a real, still-pending async send (checked synchronously
   before awaiting the ViewModel's own promise — a real async gap, not a
   simulated one), `false` once settled.
5. Empty rendering: Conversation List, Message, and Search renderers each
   distinguish a real, successfully-loaded empty result.
6. Large conversation rendering: 30 real, distinct sent-and-listed
   messages, rendered in full with correct count/order, no truncation.
7. Search rendering: a real keyword hit rendered alongside the query text.
8. Archive rendering: real `"unavailable"` (feature disabled) and real
   `"not-found"` (feature enabled, missing file) cases.
9. No raw Error/secret leakage across every one of the eight content
   renderers' own output, JSON-round-trip checked.

## 6. Verification

`npm run typecheck` — clean except the one pre-existing, unrelated,
already-documented failure. Targeted regression (this Arc + every prior
arc in this lineage, 5 files, 66 tests) — all pass. Full `npm test`:
12798 tests, 253 failing — the identical count and, file-for-file, the
identical set already confirmed pre-existing and environment-only in
Alpha 3081-3160/3241-3320's own completion declarations (fresh-worktree
Cargo.toml/lib.rs raw-import artifact; missing compiled WASM artifact;
plus, transiently before this commit landed, the same three unrelated
historical review tests that assert a clean `git status`). Zero failures
traceable to any file this Arc changed.

## 7. Completion declaration

**COMPLETE.** All eleven required renderers exist, consume only
ViewModels, own no business logic/Runtime/crypto/persistence, and are
exercised by 11 real, passing acceptance tests covering every required
category (snapshot, state transitions, error, loading, empty, large
conversation, search, archive).

**Recommended next Arc:** Electron Host Boundary.
