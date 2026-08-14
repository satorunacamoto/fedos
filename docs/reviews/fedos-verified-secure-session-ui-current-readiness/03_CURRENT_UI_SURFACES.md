# Agent U — Current UI Surfaces (Phase A, read-only)

Mega-arc: FedOS VERIFIED SECURE SESSION UI — DEVICE TRUST VISIBILITY + SECURITY STATE TRUTHFULNESS CLOSURE.
Scope: trace the CURRENT renderer/UI only. No production files edited.

Repo: `C:\wt\fedos-installed-startup-root-cause` (git worktree), branch
`arc/fedos-installed-startup-root-cause`, commit `a9f0a7bb`.

## 0. Entry-point confirmation

Confirmed accurate. `packages/fedos-desktop-electron-spike/package.json` line 6
self-describes as "The real FedOS Desktop Beta Electron app and its
release-build pipeline (release:beta/package:beta)." The three files named in
the mandate are the real shipping surface:

- Main process: `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts` (8843 lines)
- Renderer: `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts` (5125 lines)
- HTML shell: `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html` (858 lines)

The `src/` tree also contains many *other* Electron spike/prototype pages
(`fedos_electron_badge_*`, `fedos_electron_navigation_*`,
`fedos_electron_settings_*`, `fedos_electron_host_adapter_*`,
`fedos_electron_spike_*`, `fedos_electron_notifications_tray_*`,
`fedos_electron_unlock_*`) — these are NOT the shipping product; only the
`_beta_` trio above is built/packaged by `package:beta`/`release:beta`.

The renderer runs in an isolated Chromium context via a frozen preload
bridge, reading only `window.fedosApp` (ordinary user-facing commands,
gated on a real unlocked profile) — never `window.fedosAcceptance` (a
separate, pre-existing test/acceptance-mode-only bridge; see §4 below,
this distinction matters for Ratchet visibility). File header,
`fedos_electron_beta_renderer.ts:1-19`.

---

## 1. Conversation header/details UI — what's shown when a conversation is opened

Screen container: `<div class="app-screen" id="app-screen-chat">`,
`fedos_electron_beta_page.html:284-294`.

```html
<div class="app-screen" id="app-screen-chat">
  <button id="chat-back" type="button">&larr; Back to Conversations</button>
  <h2 id="chat-title">Conversation</h2>
  <p class="muted" id="chat-meta"></p>
  <div id="chat-error" class="error" role="alert"></div>
  <ul class="plain-list" id="chat-messages"></ul>
  <label for="chat-compose">Message</label>
  <textarea id="chat-compose" maxlength="8192"></textarea>
  <button id="chat-send" type="button">Send</button>
  <p id="chat-send-feedback" role="status" aria-live="polite" class="muted"></p>
</div>
```

Populated by `openConversation()`, `fedos_electron_beta_renderer.ts:1117-1137`:

- `#chat-title` starts as `"Conversation"`, then becomes
  `` `${view.mode} conversation` `` once `window.fedosApp.conversationOpen()`
  resolves (line 1127) — e.g. literally **"direct conversation"**.
- `#chat-meta` starts as the raw `conversationId`, then becomes
  `` `${conversationId} – ${view.lifecycleState} – ${view.activationStatus}` ``
  (line 1128) — e.g. `"conv-abc123 – active – ready"`.
- No security/trust/ratchet information is rendered in this header at all
  today — only identity/lifecycle/activation strings.
- After opening: `conversationActivate()` is called (a real per-Runtime
  precondition, line 1134), then `loadChatMessages()` and
  `startChatPolling()`.

This is the ONE header structure to anchor a new security indicator to.

**Participant/membership data available but unused in the header:**
`window.fedosApp.membershipList(conversationId)` returns
`{ memberships: [{ id, participant: { publicIdentifier } }] }` — used only
to compute `localIds` for rendering "mine" vs "theirs" message bubbles
(`fedos_electron_beta_renderer.ts:1076-1090`, `:1106-1113`) and, once, to
find the counterparty for a share-code flow (`:3354-3372`,
`counterparty.participant.publicIdentifier`). **No device information is
attached to a participant anywhere in this response shape.**

---

## 2. Existing security-related surfaces already proven in the renderer

Both live inside the **Safety Center** screen
(`<div class="app-screen" id="app-screen-safety">`,
`fedos_electron_beta_page.html:759-774`), NOT as separate modals — they are
**inline list+detail panels within one screen**, both sharing one layout
convention: `<ul class="plain-list">` of summary rows, each with a "Review"
button, opening a detail `<div>` immediately below the same list.

```html
<div class="app-screen" id="app-screen-safety">
  <h2>Safety Center</h2>
  <p class="muted">Every section below is reported independently. There is no
  overall security score — a partial or unavailable section does not mean the
  rest of the application is unsafe, and a fully "supported" section is not an
  external audit result.</p>
  <div id="safety-error" class="error" role="alert"></div>
  <ul class="plain-list" id="safety-sections"></ul>

  <h3>Identity Replacement</h3>
  <p class="muted">A pending item means a contact's account signed a NEW
  identity claiming continuity with an existing conversation. Never
  auto-accepted — review it yourself before trusting it.</p>
  <ul class="plain-list" id="identity-transition-list"></ul>
  <div id="identity-transition-detail"></div>

  <h3>Signed Deletion requests</h3>
  <p class="muted">A signed request to delete something locally. Approving it
  never guarantees removal from a Relay, another Device, or a foreign Archive
  copy — this policy always requires your own review.</p>
  <ul class="plain-list" id="deletion-request-list"></ul>
  <div id="deletion-request-detail"></div>
</div>
```
(`fedos_electron_beta_page.html:759-774`)

### 2a. Identity Replacement ("Ratchet Reset / Identity Transition review UI")

- List renderer: `refreshIdentityTransitionList()`,
  `fedos_electron_beta_renderer.ts:3895-3943`. Empty state literal text:
  **"No pending Identity Replacement items."** Each row:
  `` `${glyph} Transition ${item.transitionId} – ${item.acceptanceState}` ``,
  glyph table `IDENTITY_ACCEPTANCE_GLYPH` (`:3883-3893`): `observed`/
  `structurally-valid`/`proof-verified`/`corroborated`/
  `manual-review-required` → `⚠`; `accepted` → `✓`; `rejected`/`conflicting`
  → `✗`; `superseded` → `–`. A row that was silently auto-accepted gets
  glyph `⚠✓` plus an appended `<span class="warn">` reading verbatim
  **" — accepted automatically, you were not asked"** (`:3921-3928`). A row
  with no known device evidence gets a `<span class="muted">` reading
  **" (no known Device evidence to open yet)"** (`:3936-3939`) instead of a
  Review button.
- Detail renderer: `renderIdentityTransitionDetail()`,
  `:3961-4036`, filling `#identity-transition-detail` with plain `<p>`
  elements: `` `Old identity: ${...}` ``, `` `New identity: ${...}` ``,
  `` `Evidence: ${evidenceOutcome}. Current state: ${acceptanceState}.` ``
  (`.muted`). Conditional warning (`.warn`), verbatim:
  **"The old identity's signature alone is not treated as sufficient here —
  manual verification is recommended before accepting."** (`:3994-3998`).
  Conditional auto-accept warning, `id="identity-transition-auto-accepted-warning"`,
  verbatim: **"FedOS accepted this identity replacement automatically
  because it was signed with your contact's previous key — nobody was asked
  to confirm it first. Consider confirming with this contact through
  another channel that they really did replace their identity."**
  (`:4000-4006`). Then arbitrary backend `warningText` strings as `.muted`
  `<p>`s, then three plain `<button>`s: **Accept** / **Reject** / **Defer**
  (`:4014-4035`), all three disabled together while any one decision is in
  flight (`decisionButtons` array pattern, `:4029`, credited to "Secure
  Runtime Alpha 8121-8200 — Security Finding 2").
- Accept goes through the shared confirm dialog (§2c) with title
  **"Accept this new identity?"**, body **"This is a trust decision you make
  yourself — it cannot be undone automatically."**, confirm label
  **"Yes, accept this identity"** (`:4050-4054`).
- On successful Accept, a follow-up **Ratchet Reset** flow can run
  (`runIdentityTransitionRatchetResetFlow()`, `:4109-4122`): calls
  `identityTransitionAssessContinuity()`, and if any live sessions need a
  reset, shows the SAME shared confirm dialog with title **"Start new
  secure sessions?"**, body = a pluralized count sentence (e.g. `"1
  existing conversation with this contact will start a new secure session
  automatically."` / `"N existing conversations with this contact will
  start a new secure session automatically."`) joined with backend
  `warningText`, confirm label **"Yes, start new secure sessions"**
  (`:4118-4119`). This is entirely text-based — no session/device list UI.

### 2b. Signed Deletion requests

- List renderer: `refreshDeletionRequestList()`, `:4133-4156`. Empty state
  literal: **"No Signed Deletion requests."** Row text:
  `` `Request from ${item.requesterAccountRef} – ${item.displayStatus}` ``
  plus a **Review** button.
- Detail renderer: `renderDeletionRequestDetail()`, `:4165-4209`. Plain
  `<p>`s: `` `Requested by: ${requesterAccountRef}` ``,
  `` `Conversation ${conversationId} – scope: ${requestedScope} – status:
  ${decisionState}` `` (`.muted`), then per-warning-code text from a fixed
  lookup table `DELETION_WARNING_TEXT` (`:4124-4131`) — e.g.
  **"This asks the recipient to remove a local copy. The recipient may
  reject the request."**, **"Other Devices belonging to the recipient may
  retain a copy."**, **"Archives and backups may still contain this message
  even if the request is applied."**, **"Encrypted copies on Relays are not
  deleted by this request."**, **"Screenshots, exports, notifications, or
  copies made outside FedOS cannot be verified or affected."**,
  **"An acknowledgement is a Device's own signed claim, not proof of
  physical erasure."** — then, if not terminal, **Approve** / **Reject**
  buttons (mutually-disabled while in flight, same pattern as §2a).
- Approve goes through the shared confirm dialog with title **"Approve this
  deletion request?"**, body **"This never guarantees removal everywhere —
  see the warnings above."**, confirm label **"Yes, approve this deletion
  request"** (`:4219-4223`).

### 2c. The ONE shared confirmation primitive (`confirmInPage`)

Not a modal per feature — a single shared overlay reused by every
destructive action app-wide (Identity Replacement Accept, Signed Deletion
Approve, Device Revoke, Unpublish, etc.). Markup,
`fedos_electron_beta_page.html:847-854`:

```html
<div id="app-confirm-overlay" class="app-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="app-confirm-title" aria-describedby="app-confirm-body" hidden>
  <div class="app-confirm-box">
    <h2 id="app-confirm-title">Please confirm</h2>
    <p id="app-confirm-body"></p>
    <button id="app-confirm-accept" type="button" class="commerce-btn-primary">Yes, continue</button>
    <button id="app-confirm-cancel" type="button" class="commerce-btn-secondary">Cancel</button>
  </div>
</div>
```

Driven by `confirmInPage(title, body, confirmLabel)`,
`fedos_electron_beta_renderer.ts:183-193`, and `settleAppConfirm()`,
`:195-200`. It is a real ordinary-DOM overlay (never `window.confirm()` —
that primitive is banned repo-wide by a structural guard test after it was
found to freeze the whole renderer JS thread; see the large comment block
at `:147-170`). Re-entrancy: if a confirmation is already open, a second
call resolves `false` immediately rather than stacking. Focus is moved to
the accept button on open (`:189`). `role="dialog" aria-modal="true"
aria-labelledby aria-describedby` is the ONE accessible-modal pattern this
app uses — any new Security Details "panel" should decide up front whether
it wants this same modal treatment or the §2a/§2b inline-panel-within-a-
screen treatment; both are established, proven conventions.

**If the mandate calls for a genuinely new "Security Details" modal**, the
correct pattern to clone is `#app-confirm-overlay` (only existing real
dialog with `role="dialog"`/`aria-modal`) — NOT `<details>` (used only for
plain disclosure, e.g. `#screen-ready`'s capabilities/limitations block and
`#commerce-order-technical-details`, no ARIA dialog semantics at all).

---

## 3. Settings screen — per-conversation or per-account security settings

`<div class="app-screen" id="app-screen-settings">`,
`fedos_electron_beta_page.html:776-832`. Contains exactly three
`<fieldset>` groups: **Relays**, **Preferences** (theme/language/
notifications/background-sync checkboxes), and **Commerce Nostr
Publication (experimental)**. There is **no per-conversation security
setting anywhere**, and **no per-account security setting** beyond the
Relay list itself (with its own honest metadata-exposure warning, verbatim:
**"A Relay operator (or a network observer) can see who you are messaging
and when, even though it cannot read message contents. Adding a Relay you
do not trust exposes this metadata to it."**, `:785`). Confirmed via grep
for "per-conversation"/"per conversation" across both files — zero matches.

---

## 4. Device inventory UI/backend

Two genuinely different concepts exist; only one has any UI at all, and it
is **account-scoped ("my devices"), never peer-scoped**.

### 4a. "My Devices" — real UI, real backend (`app-screen-devices`)

`fedos_electron_beta_page.html:695-757`. Full screen with: a devices list
(`#devices-list`), a "Device Sync" sub-section (conflicts/schedule/transfer
lists), and a three-step "Pair a New Device" flow. List renderer:
`refreshDevicesList()`, `fedos_electron_beta_renderer.ts:3451-3482`, backed
by `window.fedosApp.devicesList()`
(type at `fedos_electron_beta_window.d.ts:522`:
`readonly devicesList: () => Promise<FedosAppCommandResult>`). Row shape:
`{deviceId, label, trustState, isLocal, devicePublicKeyRef}` — **this is
one account's own set of Devices, never a contact/peer's Devices.** Empty
state literal: **"No Devices registered yet."** Row text pattern:
`` `${glyph} ${label ?? deviceId} ${isLocal ? "(this device)" : ""} –
${trustState}` `` with glyph `✓` trusted / `✗` revoked / `⚠` other
(`:3470`). Non-local, non-revoked rows get a **Revoke** button
(`onDeviceRevoke()`, `:3493-3520`) going through the shared confirm dialog:
title `` `Revoke "${label}"?` ``, body **"This removes its trust for future
messages. It does not delete copies that Device already has."**, confirm
label **"Yes, revoke this Device"**.

Static explanatory copy below the list, verbatim: **"Revoking a Device
removes its trust for future messages — it does not delete copies that
Device already has, and does not affect Relay-side or foreign Archive
copies."** (`fedos_electron_beta_page.html:699`).

### 4b. "Peer's devices" — NOT present, in either UI or backend surface reachable from the renderer

Grepped thoroughly (`device`, case-insensitive, across every file in
`packages/fedos-desktop-electron-spike/src/`; `PeerDevice`/`peerDevice`/
`counterpartyDevice`/`remoteDevice`). Findings:

- `peerDeviceRef` / `remoteDeviceRef` DO exist as fields, but only ever as
  an **opaque single-device selector string** tied to one specific Identity
  Replacement transition or one specific Ratchet session
  (`fedos_electron_identity_transition_ratchet_reset_ipc.ts`,
  `fedos_electron_beta_preload.cts:204-225`,
  `fedos_electron_beta_main.cts:662-877`) — never a queryable *list* of a
  contact's devices, and never rendered as such anywhere.
- `establishDirectRatchetSession(conversationId, remoteDeviceRef)` and
  `directRatchetStatus(conversationId, remoteDeviceRef)` exist as real IPC
  methods (`fedos_electron_beta_window.d.ts:93,97`) — but they belong to
  `FedosAcceptanceBridge` / `window.fedosAcceptance`, the **separate
  pre-existing acceptance/test-mode-only bridge** the shipping renderer
  explicitly never reads (file header comment,
  `fedos_electron_beta_renderer.ts:16-18`: "This file never reads
  `window.fedosAcceptance` — that bridge remains reachable only by the
  pre-existing acceptance-mode test harness"). Grepping the renderer body
  for `directRatchetStatus`/`establishDirectRatchetSession`/`Ratchet`
  confirms zero call sites outside of the Identity-Replacement-triggered
  ratchet-reset flow (§2a) — there is **no ordinary-user-reachable way to
  see a conversation's Ratchet/session status at all** today. This is
  consistent with the pre-existing memory finding that "an 'active' ratchet
  session does NOT mean messages are ratchet-routed" and that no safety
  number is computed anywhere in FedOS.
- No IPC handler anywhere returns "this contact's device list." Membership
  data (`membershipList()`) returns only `participant.publicIdentifier` per
  member — no device dimension at all (§1).

**Conclusion for the Coordinator:** a "peer device trust visibility" panel
has genuinely nothing to build on except the single opaque
`peerDeviceRef`/`remoteDeviceRef` string already flowing through the
Identity-Replacement plumbing — there is no existing multi-device-per-peer
model surfaced to the renderer at all. This is a real backend/product gap,
not a UI-only gap.

---

## 5. Accessibility patterns already established

- **Live regions**: `role="status" aria-live="polite"` is the standing
  pattern for any transient, non-error feedback text — used at minimum 15+
  times across the HTML (nav badges, chat-send feedback, recovery-copy
  feedback, device-pairing copy feedback, commerce sync/discovery notes,
  settings report, safety live regions). e.g.
  `<p id="chat-send-feedback" role="status" aria-live="polite" class="muted"></p>`.
- **Errors**: `role="alert"` on every `.error` div, paired with CSS
  `.error:empty { display: none; }` so an empty error region is invisible
  and takes no space (`fedos_electron_beta_page.html:28-29`, and 20+ error
  div instances, e.g. `#chat-error`, `#devices-error`, `#safety-error`).
- **Focus-visible**: one global rule,
  `button:focus-visible, input:focus-visible, textarea:focus-visible,
  select:focus-visible, a:focus-visible { outline: 2px solid #6cf;
  outline-offset: 2px; }` (`:25-27`) — applies uniformly, nothing bespoke
  per-screen.
- **Modal dialog semantics**: exactly one real ARIA dialog exists,
  `#app-confirm-overlay` with `role="dialog" aria-modal="true"
  aria-labelledby="app-confirm-title" aria-describedby="app-confirm-body"`
  (§2c) plus an explicit focus-to-accept-button call on open. This is the
  only precedent for a genuinely modal security surface.
- **aria-label**: used sparingly, only where the visible button text alone
  would be ambiguous out of context — e.g. per-row Open buttons in the
  conversation list: `openBtn.setAttribute("aria-label", \`Open
  conversation ${c.conversationId}\`)` (`fedos_electron_beta_renderer.ts:845`).
- **Never color alone**: every state/status badge pairs a CSS color class
  with a literal text glyph prefix written by the renderer, explicitly
  documented in CSS: `/* Phase M -- never color alone: every state badge
  also carries a text glyph prefix set by the renderer. */`
  (`fedos_electron_beta_page.html:42`). Two established glyph vocabularies
  to reuse rather than invent a third:
  - `SAFETY_SECTION_GLYPH` (`fedos_electron_beta_renderer.ts:3849-3857`):
    `ready→✓, loading→…, unavailable→–, attention/warning→⚠, blocked/error→✗`.
  - `IDENTITY_ACCEPTANCE_GLYPH` (`:3883-3893`, listed in §2a).
  - Devices list uses the same shape inline: `✓` trusted / `✗` revoked /
    `⚠` other (`:3470`).
- **No `innerHTML` anywhere in the security-adjacent code paths** — every
  dynamic node above is built via `document.createElement` +
  `.textContent`, never raw HTML injection (also explicitly called out for
  Commerce media rendering, `:1170-1180`).
- **Keyboard nav**: no custom keyboard handling (roving tabindex, arrow-key
  list nav, escape-to-close) exists anywhere in this file — reliance is
  entirely on native tab order + the one `focus-visible` rule + native
  `<button>`/`<a>`/`<input>` semantics. A new panel should follow the same
  minimalism (native focusable elements, native tab order) rather than
  introduce the first custom keyboard-nav pattern in this codebase.

---

## 6. Security-adjacent copy conventions (verbatim, for tone-matching)

Already quoted in full above; consolidated here for quick reference:

- Old-key / auto-accept notice (Identity Replacement detail):
  > "FedOS accepted this identity replacement automatically because it was
  > signed with your contact's previous key — nobody was asked to confirm
  > it first. Consider confirming with this contact through another
  > channel that they really did replace their identity."
- Old-key insufficiency warning:
  > "The old identity's signature alone is not treated as sufficient here —
  > manual verification is recommended before accepting."
- Identity Replacement section intro (Safety Center):
  > "A pending item means a contact's account signed a NEW identity
  > claiming continuity with an existing conversation. Never auto-accepted
  > — review it yourself before trusting it."
- Ratchet-reset confirmation body (count-sentence + backend warningText,
  joined with a single space) — e.g.:
  > "1 existing conversation with this contact will start a new secure
  > session automatically. [...additional backend warning sentences...]"
- Signed Deletion section intro (Safety Center):
  > "A signed request to delete something locally. Approving it never
  > guarantees removal from a Relay, another Device, or a foreign Archive
  > copy — this policy always requires your own review."
- Safety Center screen-level honesty disclaimer (top of screen, sets the
  tone for the whole surface):
  > "Every section below is reported independently. There is no overall
  > security score — a partial or unavailable section does not mean the
  > rest of the application is unsafe, and a fully "supported" section is
  > not an external audit result."
- Device revoke confirmation body:
  > "This removes its trust for future messages. It does not delete copies
  > that Device already has."
- Devices screen static explainer:
  > "Revoking a Device removes its trust for future messages — it does not
  > delete copies that Device already has, and does not affect Relay-side
  > or foreign Archive copies."

**House style observed across all of the above**: short declarative
sentences; an em-dash to append the "but here's the honest caveat" clause;
never claims a guarantee it can't back ("never guarantees", "does not
delete", "cannot be verified"); always says explicitly what a security
action does NOT do, not just what it does; "you"/"your" second person;
never uses jargon like "ratchet"/"safety number"/"forward secrecy" in
user-facing copy even when the underlying mechanism is exactly that (see
`fedosIdentityTransitionWarningText()` reference at
`fedos_electron_beta_renderer.ts:4100-4102`, explicitly avoiding the word
"ratchet"). Any new Security Details copy should follow this same register.

---

## 7. Mobile/narrow layout

Confirmed **not relevant / does not exist**, as expected for a desktop
Electron app. The entire `<style>` block in
`fedos_electron_beta_page.html:10-142` contains **zero `@media` queries**.
Layout is fixed-width (`max-width: 46rem` for `section`/`.app-screen`,
`max-width: 60rem` for `#app-content`/`#app-nav`), with only one deliberate
flex-wrap concession for a narrow *window* (not a media query) documented
at `:70-81` (`.commerce-actor-bar`, using `flex-wrap: wrap` +
`min-width: 0` to survive a ~380px-wide window). A new Security Details
surface can safely assume the same fixed desktop-width design system —
no responsive/breakpoint work is needed or expected.

---

## 8. Candidate DOM insertion points (NOT implemented — for Coordinator's choice)

### Candidate A — inline indicator inside the existing chat header (RECOMMENDED anchor)

Insert directly after `#chat-meta`, inside `#app-screen-chat`, anchored on
this exact current markup (`fedos_electron_beta_page.html:284-294`):

```html
<div class="app-screen" id="app-screen-chat">
  <button id="chat-back" type="button">&larr; Back to Conversations</button>
  <h2 id="chat-title">Conversation</h2>
  <p class="muted" id="chat-meta"></p>
  <!-- INSERTION POINT A: e.g. <p id="chat-security-indicator" class="muted" role="status" aria-live="polite"></p> -->
  <div id="chat-error" class="error" role="alert"></div>
  ...
```

Rationale: same element tier as `#chat-meta` (already the "conversation
facts" line), populated from the same `openConversation()` function
(`:1117-1137`) right after the existing `conversationOpen()` call — no new
screen-transition wiring needed. Would use the established `status-badge`
CSS class + glyph-prefix convention (§5) rather than a new visual language.
A "Security Details" trigger could be a small button placed right after it,
following the `openBtn.setAttribute("aria-label", ...)` pattern (§5) for a
descriptive accessible name (e.g. "View security details for this
conversation") since the visible label alone ("Details") would be
ambiguous.

### Candidate B — new `<h3>` sub-section inside Safety Center, mirroring §2a/§2b exactly

Insert a third list+detail block into `#app-screen-safety`
(`fedos_electron_beta_page.html:759-774`), directly following the existing
"Signed Deletion requests" block, using the IDENTICAL structural pattern
already proven twice in this file:

```html
  <h3>Signed Deletion requests</h3>
  ...
  <div id="deletion-request-detail"></div>
  <!-- INSERTION POINT B: e.g.
  <h3>Conversation Security</h3>
  <p class="muted">...</p>
  <ul class="plain-list" id="conversation-security-list"></ul>
  <div id="conversation-security-detail"></div>
  -->
</div>
```

Rationale: zero new UI pattern risk — reuses the exact list-row +
Review-button + detail-div + glyph-table convention already shipped twice
(§2a, §2b) and already covered by existing structural-guard tests for that
family. Weaker as a *discovery* path (buried in a separate screen, not
visible from the conversation itself) — better suited as the destination
a Candidate-A trigger button navigates to, rather than a replacement for
Candidate A.

### Candidate C — modal reachable from Candidate A, cloning `#app-confirm-overlay`

If the mandate wants a genuine modal "Security Details" panel (distinct
from Safety Center's inline convention), clone the ONE existing dialog
pattern rather than invent a new one — anchor on
`fedos_electron_beta_page.html:847-854` (§2c):

```html
<!-- sibling to #app-confirm-overlay, e.g.: -->
<div id="chat-security-overlay" class="app-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="chat-security-title" aria-describedby="chat-security-body" hidden>
  <div class="app-confirm-box">
    <h2 id="chat-security-title">Security details</h2>
    <div id="chat-security-body"></div>
    <button id="chat-security-close" type="button" class="commerce-btn-secondary">Close</button>
  </div>
</div>
```

Rationale: reuses `.app-confirm-overlay`/`.app-confirm-box` CSS verbatim
(already themed, already keyboard/focus-tested via `confirmInPage()`'s
precedent) and the one proven ARIA-dialog pattern in the codebase, at the
cost of needing a second, independent open/close state machine (since
`#app-confirm-overlay`'s own `appConfirmPendingResolve` singleton, §2c, is
purpose-built for yes/no confirmations, not an inspectable detail panel,
and should not be reused/overloaded for this).

**Recommendation for the Coordinator (informational only):** A + B
together give a truthful, low-risk pair — a compact glyph/status-badge
indicator at Candidate A doubling as the disclosure trigger, opening into
Candidate B's Safety-Center-style inline panel (reuses two already-proven
conventions, adds zero new interaction patterns). Candidate C is the
right choice only if in-context modal review (without navigating away
from the conversation) is a hard requirement.
