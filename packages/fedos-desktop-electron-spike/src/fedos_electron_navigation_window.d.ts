/**
 * Secure Runtime Alpha 4181-4260 — spike type definitions (mirrors
 * `fedos_electron_spike_window.d.ts`'s own "global ambient declaration
 * only" convention). Describes the ONE value
 * `fedos_electron_navigation_preload.cts` exposes via
 * `contextBridge.exposeInMainWorld` — ten narrow async methods, one per
 * IPC channel that file registers. Every method returns whatever
 * `FedosDesktopConversationWindowController.render()`
 * (`../../../src/desktop/navigation/fedos_desktop_conversation_window_controller.ts`)
 * or `FedosDesktopConversationWindowRegistry.sessionState()`
 * (`../../../src/desktop/navigation/fedos_desktop_conversation_window_registry.ts`)
 * already produces — this file intentionally types those returns as
 * `unknown` rather than importing the root project's own types (this
 * package's tsconfig never includes root `src/`, Alpha 4021-4100's own
 * isolation architecture); the renderer-side script narrows what it
 * actually reads at the point of use, exactly like every other untyped
 * IPC boundary in this codebase already does.
 */

interface FedosNavigationBridge {
  readonly listConversations: () => Promise<unknown>;
  readonly openConversation: (conversationId: string) => Promise<unknown>;
  readonly switchConversation: (conversationId: string) => Promise<unknown>;
  readonly closeConversation: () => Promise<unknown>;
  readonly back: () => Promise<unknown>;
  readonly forward: () => Promise<unknown>;
  readonly pinConversation: (conversationId: string) => Promise<unknown>;
  readonly unpinConversation: (conversationId: string) => Promise<unknown>;
  readonly sessionState: () => Promise<unknown>;
  readonly newWindow: () => Promise<unknown>;
}

interface Window {
  readonly fedosNavigation: FedosNavigationBridge;
}
