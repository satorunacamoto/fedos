# Secure Runtime Alpha 8041-8120 — Accessibility Report

Addresses the UX audit's (`9c238a11`) own accessibility findings for the
newly-added screens.

## Implemented

- **Enter submits the focused form**: wired for create/unlock passphrase
  fields, invite identifier, search query, and the Settings add-Relay
  field (`fedos_electron_beta_renderer.ts`, the `for (const [inputId,
  buttonId] of [...])` loop). The chat composer submits on Enter
  (Shift+Enter for a newline).
- **Visible focus indicator**: `button:focus-visible, input:focus-visible,
  textarea:focus-visible, select:focus-visible, a:focus-visible { outline:
  2px solid #6cf; }` (page CSS) — never relies on the browser default
  alone, never removed.
- **Labels associated with inputs**: every text/password/checkbox input has
  a matching `<label for="...">` (or, for the two checkboxes, an implicit
  wrapping `<label>`).
- **Passphrase autocomplete**: `autocomplete="new-password"` on create,
  `autocomplete="current-password"` on unlock — changed from the prior
  `autocomplete="off"` the UX review flagged, since disabling password-
  manager support has no documented security benefit for a local
  passphrase field and actively harms usability.
- **Errors use `role="alert"`**: every `.error` div in the new/updated
  markup carries `role="alert"`; loading/status text uses
  `role="status" aria-live="polite"` (`#chat-send-feedback`,
  `#recovery-copy-feedback`, `#settings-report`, `#app-status-area`,
  `#screen-initializing`'s own paragraph).
- **No color-only status**: every status badge/list item this Arc renders
  is prefixed with a glyph (✓ ready/trusted, ⚠ attention/pending, ✗
  blocked/revoked/rejected, – unavailable/deferred) in addition to color
  and text, for Conversations activation, Devices trust state, Identity
  Replacement acceptance state, and Safety Center section state.
- **Descriptive button names**: dynamically-created buttons carry
  `aria-label` where the visible text alone is ambiguous (e.g. "Open
  conversation <id>", "Remove Relay <url>").
- **Destructive-action confirmation**: Device revoke and Identity
  Replacement "Accept" both go through a native `window.confirm()` dialog
  stating the real, non-reversible consequence before proceeding — a
  native browser dialog is itself fully keyboard/screen-reader accessible
  and Escape-closable, satisfying "Escape closes safe dialogs" without a
  custom modal implementation.
- **Copy-action feedback**: the Recovery screen's diagnostic-code copy
  button reports "Copied." (or an honest failure message) via
  `role="status" aria-live="polite"`.
- **Japanese/long-text handling**: `.field`/`.muted` classes already used
  `word-break: break-all`; inputs/textareas are `width: 100%; box-sizing:
  border-box`, so long conversation ids, public identifiers, and Japanese
  text wrap without overflow.
- **Loading states announced**: `#screen-initializing`'s own paragraph
  already carries `role="status" aria-live="polite"` (updated from a bare
  `<p>`).

## Known gaps (honestly disclosed, not fixed in this Arc)

- No dedicated keyboard-only navigation regression test suite was written
  beyond the manual keyboard-reachability confirmed during the real
  visible-control vertical slice (every control used by that test is a
  real `<button>`/`<input>`/`<textarea>`, which are natively
  Tab-reachable and Enter/Space-activatable by the browser itself — no
  custom non-native widget was introduced anywhere in this Arc).
- No automated screen-reader (NVDA/JAWS/VoiceOver) run was performed;
  `role="alert"`/`aria-live="polite"` usage is correct per the ARIA
  specification but not independently verified against a real assistive
  technology in this pass.
