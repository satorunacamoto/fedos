/**
 * Secure Runtime Alpha 4261-4340 — window type definitions (mirrors
 * `fedos_electron_navigation_window.d.ts`'s own "global ambient
 * declaration only" convention). Describes the ONE value
 * `fedos_electron_notifications_tray_preload.cts` exposes via
 * `contextBridge.exposeInMainWorld` — seven narrow async methods, one per
 * IPC channel that file registers. This package's tsconfig never includes
 * root `src/`, so every return is typed as `unknown` here, exactly like
 * every other untyped IPC boundary in this codebase already does.
 */

interface FedosBackgroundBridge {
  readonly status: () => Promise<unknown>;
  readonly notify: (request: unknown) => Promise<unknown>;
  readonly trayAction: (request: unknown) => Promise<unknown>;
  readonly newWindow: () => Promise<unknown>;
  readonly closeThisWindow: () => Promise<unknown>;
  readonly sessionRender: () => Promise<unknown>;
  readonly shutdown: () => Promise<unknown>;
}

interface Window {
  readonly fedosBackground: FedosBackgroundBridge;
}
