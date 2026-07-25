# External Security Audit Preparation — UI Attack-Surface Delta v1

**This is audit PREPARATION material, not an external audit.** No
independent third party has reviewed this codebase. This document is a
DELTA against `8e730f25` ("Desktop Beta external security audit
preparation package") — it does not rewrite that document; read both
together. `8e730f25` remains the base inventory (architecture, trust
boundaries, secret flows, crypto primitives, protocol extensions,
persistent data, Relay/network surface, threat scenarios); this delta
covers ONLY the new attack surface Secure Runtime Alpha 8041-8120 added.

## New IPC surface: `window.fedosApp`

34 new `fedos-app:*` channels (full list:
`conversations-list`, `conversation-open`, `conversation-activate`,
`messages-list`, `message-reveal`, `message-send`, `membership-list`,
`invitations-list`, `create-invitation`, `search`, `archive`,
`archive-workflow-warnings`, `archive-choose-export-destination`,
`archive-choose-source`, `devices-list`, `device-detail`,
`device-revoke`, `device-sync-status`, `device-pairing-create/inspect/approve/complete`,
`identity-transition-list/open/accept/reject/defer/record-manual-verification`,
`deletion-request-list-received/open/approve/reject`,
`safety-center-overview`, `settings-load`). Unlike `fedosAcceptance`'s own
12 channels (still zero UI consumer, by design — confirmed unchanged),
**every one of these 34 IS now reachable from real, untrusted-input-capable
UI controls** — this is the single largest NEW attack surface this Arc
introduces, and the highest-priority area for external review.

### Preload input validation (`fedos_electron_beta_preload.cts`)

Every string argument is passed through the SAME `boundedString(value,
MAX_*)` helper the pre-existing `fedosAcceptance` bridge already used —
length-bounded, but NOT content/shape-validated at the preload layer
(e.g. `expectedAccountRef`/`sender`-shaped object arguments are passed
through un-narrowed, exactly like the pre-existing `fedosAcceptance`
bridge's own documented limitation in `8e730f25` §8). Real, deeper
validation happens main-process-side in each `handleApp*` function
(bounded-length + type checks) before ever reaching the Shell.

### Relay Settings URL handling

`isValidRelayUrl()` (renderer-side) requires a real, parseable URL with
`ws:`/`wss:` scheme; a malformed value never reaches IPC. **Audit focus**:
this is a client-side-only check — a modified/compromised renderer could
bypass it and submit an arbitrary string to `fedos-app:settings-load`'s
sibling write path (`fedos-beta:settings-apply`, pre-existing, unmodified)
directly. The main-process `FedosDesktopSettingsController`'s own
validator (pre-existing, unmodified) is the real trust boundary, not the
renderer's own check — confirm during audit that it independently
re-validates scheme/shape server-side.

### Invitation clipboard handling

No explicit clipboard write exists in the new invitation flow (the UI
displays the local account's own already-public identifier for the user
to copy manually via native OS text selection, not a scripted
`navigator.clipboard.writeText()` call for invitation content itself).
The Recovery screen's diagnostic-code copy button DOES call
`navigator.clipboard.writeText()` — audit should confirm the copied
string never contains anything beyond the closed outcome-code vocabulary
(verified this session: `RECOVERY_EXPLANATIONS`'s own key set only).

### Conversation rendering / message composer

Message plaintext is rendered via `textContent` assignment (`li.textContent
= m.plaintext.text`), never `innerHTML` — no HTML/script injection surface
from message content. **Audit focus**: confirm this holds for every
render path added (chat, search results, identity/deletion detail views)
— grep target: any `innerHTML =` assignment in `fedos_electron_beta_renderer.ts`
that assigns anything other than an empty string. (This session found and
removed one harmless-but-pointless `title.innerHTML = ""` on a
freshly-created, already-empty element — no content was ever assigned
through it — as a small cleanup; zero non-empty `innerHTML` assignments
exist anywhere in this file.)

### Search input/results

Query is bounded (`MAX_SEARCH_QUERY_CHARS=256`) client- and server-side;
results render `conversationId`/`messageId` via `textContent`. No
additional surface beyond the pre-existing Search Runtime `8e730f25`
already inventoried.

### Archive file-selection boundary

The two new channels (`archive-choose-export-destination`/
`archive-choose-source`) open a NATIVE `dialog.showSaveDialog`/
`showOpenDialog` and return ONLY the user-chosen path string back to the
renderer — the renderer never supplies an arbitrary path for main-process
file I/O; the ONLY path that ever reaches `shell.archive()` is one the
native OS dialog itself produced from an explicit user click. **Audit
focus**: confirm `handleAppArchiveChooseExportDestination`'s own
`conversationId`-derived default filename sanitization
(`replace(/[^a-zA-Z0-9_-]/g, "_")`) cannot be bypassed to produce a path
traversal — the default filename is advisory only (the user can rename in
the native dialog), so this is a UX nicety, not a security boundary; the
real boundary is that `dialog.showSaveDialog` itself is the only path
source.

### Device revocation / Identity decision / Signed Deletion consent actions

Each destructive action requires (a) a real, unlocked profile
(`requireShell()`/`requireBoundary()`), (b) for Device revoke and
Identity-accept specifically, an explicit `window.confirm()` before the
IPC call fires. **Audit focus**: `window.confirm()` is a renderer-side-
only gate — a compromised/scripted renderer could skip it and call
`window.fedosApp.deviceRevoke(...)` directly. The REAL security boundary
is that revocation/decision actions are NOT reversible-by-omission (i.e.
skipping the confirm dialog doesn't grant any capability beyond what a
real user click already grants) — there is no SEPARATE, more-privileged
IPC path; the confirm dialog is a UX safety net, not an authorization
boundary. Confirm this design assumption holds under audit.

### Safety Center projections / Recovery diagnostics

Both are read-only projections of already-existing, already-audited
domain state (`8e730f25` §5/§11) — no new secret-bearing field is
introduced. Recovery's own diagnostic code is drawn from a small, closed,
non-secret outcome-code set (verified: `recovery-required`, `corrupt`,
`seed-unavailable`, `unsupported-version`).

### Live-update mechanism (chat poll)

A 2-second `setInterval` while a conversation screen is open, calling the
same `messages-list` channel a manual reload would call. **Audit focus**:
this is a real, if modest, DoS-adjacent consideration — a malicious/buggy
extension of this pattern to many simultaneously-open screens could
increase IPC/Shell call volume; today only ONE interval exists at a time
(enforced by `stopChatPolling()` being called before `startChatPolling()`),
confirmed via structural-guard-adjacent code reading this session.

### Relay status poll (new this Arc, `fedos-app:relay-status`)

Secure Runtime Alpha 8121-8200 added a second, similarly-shaped 3-second
`setInterval`, started once at Ready (`startRelayStatusPolling()`,
`fedos_electron_beta_renderer.ts`) and stopped on lock
(`stopRelayStatusPolling()`), separate from and unaffected by the chat
poll's own lifecycle. It reads a NEW module-level `activeRelays` reference
in the main process (`fedos_electron_beta_main.cts`) — the SAME
`WebSocketRelay` instances `secureRuntimeBundleConfig()` already
constructs, never a second connection or a new secret-bearing value; the
handler returns only `{url, connected}` pairs, both already non-secret
(the URL is user-configured Settings data; `connected` is derived from the
pre-existing public `WebSocketRelay.isConnected()` accessor, Alpha 215).
**Audit focus, and a real product-claim correction made during this Arc's
own verification**: this Runtime's `WebSocketRelay` has "NO automatic
reconnect, retry, storage, or global event bus of its own" — a deliberate,
repeatedly-documented contract (`src/desktop/websocket_relay.ts`,
`src/conversation/transport/relay/fedos_conversation_relay_set.ts`: "no
reconnect/backoff policy of any kind"). An earlier draft of this Arc's own
nav-bar status text said "retrying the rest" for a disconnected Relay,
which was FALSE — no background retry exists. The text was corrected to
"lock and unlock again to retry" (the only real recovery action: each
unlock constructs a fresh `WebSocketRelay` and calls `connect()` for the
first time since the disconnect) and re-verified against a real
disconnect/reconnect scenario (a genuine local relay server closed, then
rebound to the identical port, with the client's own real, unmodified
`connect()` path exercised via a real Lock → Unlock click sequence — see
`secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`'s
"Phase K steps 15-18" test). Auditors should independently confirm no
later change reintroduces a "retry"/"reconnecting" claim without a real
backing mechanism.

### DOM secret exposure / accessible-name and error-text leak surfaces

No `SecretHandle`, Master Seed, private key, or raw Ratchet key/counter
appears in any DOM text, `aria-label`, or error string added by this Arc
(re-confirmed via `grep` for `SecretHandle|masterSeed|privateKey|rootKey|chainKey`
across `fedos_electron_beta_renderer.ts`/`_main.cts`: zero matches outside
comments explaining what must NOT be exposed). Accessible names
(`aria-label`s) constructed from user/peer-supplied data (conversation id,
Relay URL) are the SAME strings already rendered as visible text —- no
additional-length or format leak beyond what is already on-screen.

## Suggested external audit order (delta additions to `8e730f25` §12)

1. `fedos-app:*` channel input validation (main-process side), especially
   the un-narrowed object-shaped arguments (`sender`, `expectedAccountRef`).
2. Renderer-side confirm() gates for destructive actions — confirm no
   privileged path bypasses the equivalent real-user-click authorization.
3. The chat-poll interval lifecycle (single-instance guarantee).
4. Archive file-picker path handling.
5. The relay-status poll interval lifecycle (single-instance guarantee,
   correct stop-on-lock) and the nav-bar copy's own no-auto-reconnect claim
   accuracy (see "Relay status poll" above).

## Suggested fuzz targets (delta additions to `8e730f25` §13)

- `fedos-app:conversation-open`/`fedos-app:messages-list` with malformed/
  oversized `conversationId` strings.
- `fedos-app:identity-transition-open` with a malformed `peerAccountRef`
  object shape.
- `fedos-app:archive` with every combination of `operation` value against
  a malformed `request` object.
