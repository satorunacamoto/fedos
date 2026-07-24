/**
 * Secure Runtime Alpha 3561-3640 ("Desktop Electron Host Boundary Arc") —
 * Phase B.
 *
 * `FedosDesktopHostPort` is a narrow, FRAMEWORK-NEUTRAL contract for the
 * Desktop Process Host — the boundary owning process/window lifecycle
 * ONLY (this Arc's own explicit rule: "must not own Conversation business
 * logic"). It names nothing Electron-specific (no `BrowserWindow`, no
 * `ipcMain`/`ipcRenderer`) so a FUTURE concrete adapter (Electron, or
 * anything else) can implement this exact interface — `FedosDesktopHostBridge`
 * (`./fedos_desktop_host_bridge.ts`) is this Arc's own in-process reference
 * implementation, since no Electron dependency exists in this repository
 * (see `docs/secure_runtime_alpha_3561_3640_reconciliation_report.md` §2).
 *
 * Target architecture this port sits atop (unchanged, all four layers
 * already accepted by prior Arcs):
 *
 *   Desktop Process Host (THIS Arc)
 *     -> FedosRunningDesktopRuntime (Alpha 606, via FedosDesktopApplicationShell)
 *     -> FedosDesktopApplicationShell (Alpha 2841-2920/3081-3160)
 *     -> FedosDesktopConversationUiPresentationBoundary (Alpha 3241-3320)
 *     -> FedosDesktopRenderer (Alpha 3401-3480)
 *     -> serialized, safe render model
 *     -> future concrete desktop window
 *
 * No persistence port, crypto authority, or secret handle is named or
 * reachable anywhere in this file — a `FedosDesktopHostPort` implementation
 * owns exactly one Shell (which itself owns the one Runtime), one
 * Presentation Boundary, and one Renderer; nothing lower is ever exposed.
 */

import type { FedosDesktopRuntimeConfig } from "../runtime/fedos_desktop_runtime_config.js";
import type { FedosDesktopHostResponse } from "./fedos_desktop_host_response.js";

/**
 * `"starting"`/`"failed"` are transient/terminal states this port's own
 * `start()` call passes through internally; a caller observes only
 * `"stopped"` (before start / after a successful stop),
 * `"running"` (ready to `dispatch()`), or `"failed"` (startup failed —
 * `start()` itself rejects, `status()` afterward still reads `"stopped"`,
 * mirroring `FedosDesktopApplicationShell`'s own "never returns stale
 * data, never a corrupted running state" discipline). There is no
 * `"window ready"`/`"stopping"` state a CALLER can observe distinctly from
 * `"running"`/`"stopped"` — this port owns no window of its own (Phase F's
 * own lifecycle model collapses onto the Shell's existing two-state
 * status plus this port's own construction-time guarantees).
 */
export type FedosDesktopHostStatus = "stopped" | "running";

export interface FedosDesktopHostPort {
  status(): FedosDesktopHostStatus;

  /** Constructs and starts exactly one Shell (which owns exactly one Runtime), one Presentation Boundary, and one Renderer. Fails closed (never throws) if already running. */
  start(config: FedosDesktopRuntimeConfig): Promise<FedosDesktopHostResponse<null>>;

  /** Stops in reverse ownership order. Idempotent -- a second `stop()` is a safe, closed no-op response, never a throw. */
  stop(): Promise<FedosDesktopHostResponse<null>>;

  /** Validates, then dispatches, one command against the current render/ViewModel graph. Fails closed to `"unavailable"` before `start()`/after `stop()`, and to `"invalid-input"` for any structurally malformed command -- never throws, never a raw `Error`. */
  dispatch(command: unknown): Promise<FedosDesktopHostResponse<unknown>>;

  /** The FULL current render model (every renderer's own `render()` output) -- the "request a current screen model" primitive Phase G names. */
  render(): FedosDesktopHostResponse<unknown>;
}
