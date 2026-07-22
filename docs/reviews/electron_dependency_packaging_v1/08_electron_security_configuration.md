# 08. Electron Security Configuration

Minimum mandatory settings, IF Electron is adopted (`20`). Specification
only — nothing installed or configured by this review.

| Setting | Required value | Why |
|---|---|---|
| `contextIsolation` | `true` (mandatory) | Preload's own JS context must stay isolated from the renderer page's own (potentially attacker-influenced, if any remote/loaded content were ever involved) context — this repository's own Absolute Prohibitions already name this explicitly. |
| `nodeIntegration` | `false` (mandatory, renderer) | Renderer page code must never see `require`/Node globals — already named as an Absolute Prohibition. |
| `sandbox` | `true` (recommended) | Further restricts the renderer OS-process itself; no known requirement in this stack needs it disabled. |
| Preload allowlist | Exactly `FedosDesktopHostPort`'s own public methods, nothing else | `05`/`06` — no `require`, no raw `ipcRenderer`, no generic invoke. |
| Navigation restrictions | Deny all (`will-navigate` handler + `setWindowOpenHandler` returning `{action:"deny"}`) | This is a fully local, offline app (`02`) — no legitimate reason for the window to ever navigate away from its own bundled page. |
| External URL handling | None loaded by default; if ever needed, only via `shell.openExternal` in the OS default browser, never in-app, and only for an explicitly allowlisted scheme | Matches "no remote web hosting." |
| Permission requests | Deny all by default (`session.setPermissionRequestHandler` returning `false`) | No evidenced requirement (`02`) for camera/mic/geolocation/notifications/etc. |
| CSP | Strict `default-src 'self'` (no remote script/style/image/font sources) | Everything is bundled locally; nothing legitimately needs a remote origin. |
| Remote module (`@electron/remote`) | Never included | Deprecated/removed pattern; no requirement in this stack needs cross-process object access from the renderer. |
| `eval`/`new Function()` | Disallowed | Confirmed already absent from the entire existing Shell/ViewModel/Renderer/Host stack (grep, zero matches for dynamic code construction of any kind). |
| Shell/process execution (`child_process`, `shell.openItem` on an untrusted path) | Disallowed from renderer-reachable code | No requirement in this stack calls for arbitrary program execution; `archive-inspect`'s own path validation is the only filesystem-adjacent surface, and it never executes anything (`09`). |
| `webSecurity` | `true` (never disabled) | No requirement in this stack needs cross-origin fetches or mixed content — disabling this is never justified here. |

## Conclusion

None of this stack's own real requirements (`02`) need ANY of Electron's
"loosen for compatibility" escape hatches. Every mandatory hardening
setting above is compatible with the actual feature set this review
found evidenced — this is a genuine point in Electron's favor relative to
the cost in `04`, not a reason to relax any setting.
