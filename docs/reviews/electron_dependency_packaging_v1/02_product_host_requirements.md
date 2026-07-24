# 02. Product Host Requirements

Separates requirements the existing Shell/ViewModel/Renderer/Host stack
actually EVIDENCES (a real capability something already calls for) from
assumptions a "desktop app" might casually be expected to want. Per this
review's own instruction: do not recommend a feature merely because
Electron happens to support it.

| Requirement | Real, evidenced? | Evidence |
|---|---|---|
| Local desktop window | **Assumed, not yet evidenced** | `FedosDesktopHostPort`'s own predecessor design (Alpha 3561-3640's own Phase B conceptual list) names `openMainWindow()`/`closeMainWindow()`, but the ACTUAL shipped `FedosDesktopHostPort` (this review's own `01`) has no such method — only `status`/`start`/`stop`/`dispatch`/`render`. No window concept exists in real, checked-out code today. |
| Filesystem access | **Real** | `archive-inspect` command + `FedosDesktopRuntimeConfig`'s own explicit log paths — both require real filesystem reads/writes. |
| Native dialogs | **Not yet required** | No file-picker abstraction exists; Alpha 3561-3640's own Phase H explicitly deferred this ("expose a validated path-input host port and document the future adapter" — not yet built). |
| System tray | **Not evidenced** | No ViewModel/Renderer/Host concept of presence, background operation, or a persistent icon exists anywhere. |
| Notifications | **Not evidenced** | No ViewModel/Renderer output resembles a notification payload; Unread Counter is a pull-based count, never a push/notify primitive. |
| Deep links | **Not evidenced** | No URL-scheme/protocol-handler concept exists anywhere in this stack. |
| Auto-start | **Not evidenced** | No login-item/service-registration code exists anywhere. |
| Application updates | **Not yet a product requirement** | No packaging exists at all yet (`01`) — there is nothing to update. |
| Code signing | **N/A until packaging exists** | See `14`. |
| Crash recovery | **Real — ALREADY satisfied, not an Electron concern** | The Runtime's own durable, append-only, restart-recoverable design (proven repeatedly: every Arc in this lineage includes a real stop/restart test) already delivers this at the Runtime layer. Electron adds nothing here; it must not regress it (e.g. `app.quit()` must wait for `host.stop()` — see `06`/`17`). |
| Multiple windows | **Not evidenced** | `FedosDesktopHostBridge` is single-instance-per-process by construction (`start()` throws `"conflict"` on a second call) — nothing in the current design anticipates more than one window per Host. Multiple INDEPENDENT Host instances (confirmed possible and tested, Alpha 3561-3640's own isolation test) is a different thing from multiple windows sharing one Host. |
| Offline operation | **Real — ALREADY a core, tested property** | Alpha 3561-3640's own dedicated test asserts zero `fetch`/network activity across a full session. Any Electron adapter MUST preserve this — it is this project's own stated architecture (`p2p +` own-DB hybrid, explicitly NOT "remote web hosting"/"cloud sync" per every Arc's own Absolute Prohibitions). |

## Conclusion

The only two REAL, evidenced requirements a host technology must satisfy
today are **filesystem access** (already working, narrowly, via
`archive-inspect`) and **eventually, a local desktop window** (assumed by
the very name "Desktop Host Boundary," but not yet backed by any window
API call anywhere in checked-out source). Every other commonly-assumed
desktop-app feature (tray, notifications, deep links, auto-start, updates,
multi-window) has zero evidence in this codebase and should NOT drive the
technology choice in `03`.
