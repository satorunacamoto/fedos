/**
 * Secure Runtime Alpha 4181-4260 ("Desktop Conversation Window and
 * Navigation Arc") — Phase B/C: Multi-Window State Model, Window
 * Lifecycle, Conversation Pin State, Recent Conversation List,
 * Navigation State Persistence.
 *
 * `FedosDesktopConversationWindowRegistry` is the ONE process-wide owner
 * of every open window's `FedosDesktopConversationWindowController`
 * (Phase B) plus the small amount of navigation state that is
 * legitimately CROSS-window rather than per-window: which conversations
 * are pinned, the recent-conversation list, and which conversation id to
 * restore on next launch. All three are persisted through
 * `AppendOnlyFedosDesktopNavigationPersistence` (Phase C) — the SAME
 * append-only-NDJSON approach every other domain in this repository
 * already uses, never a new persistence engine.
 *
 * Constructed from exactly ONE `FedosDesktopConversationUiPresentationBoundary`
 * (never constructs its own — the caller, e.g. the Electron main-process
 * adapter in Phase E, owns exactly one Boundary per running Host, and
 * passes it here) — every window this Registry creates shares that SAME
 * Boundary/Shell/Runtime, each with its own independent per-window
 * ViewModel/Renderer instances (see
 * `fedos_desktop_conversation_window_controller.ts`'s own "MULTI-WINDOW
 * SAFETY" header).
 *
 * HARD GUARDRAILS:
 *   - No Electron import, no `BrowserWindow`, no IPC of any kind — window
 *     ids here are opaque strings/numbers the CALLER assigns (an Electron
 *     adapter naturally uses its own `BrowserWindow.id`); this file knows
 *     nothing about what a "window" actually renders into.
 *   - No business logic beyond pin/recent/last-opened bookkeeping — every
 *     conversation FACT still flows through the Boundary's Shell.
 */

import type { FedosDesktopConversationUiPresentationBoundary } from "../presentation/fedos_desktop_conversation_ui_presentation_boundary.js";
import type { FedosConversationParticipantReference } from "../../conversation/membership/fedos_conversation_participant_reference.js";
import { FedosDesktopConversationWindowController } from "./fedos_desktop_conversation_window_controller.js";
import {
  AppendOnlyFedosDesktopNavigationPersistence,
  type FedosDesktopNavigationSnapshot,
} from "./append_only_fedos_desktop_navigation_persistence.js";

export type FedosDesktopWindowId = string;

export interface FedosDesktopConversationWindowRegistrySessionState {
  readonly lastOpenedConversationId: string | null;
  readonly pinnedConversationIds: readonly string[];
  readonly recentConversationIds: readonly string[];
  readonly openWindowIds: readonly FedosDesktopWindowId[];
}

export class FedosDesktopConversationWindowRegistry {
  readonly #boundary: FedosDesktopConversationUiPresentationBoundary;
  readonly #viewerParticipant: FedosConversationParticipantReference;
  readonly #persistence: AppendOnlyFedosDesktopNavigationPersistence;
  readonly #clock: () => number;
  readonly #windows = new Map<FedosDesktopWindowId, FedosDesktopConversationWindowController>();

  #snapshot: FedosDesktopNavigationSnapshot;

  constructor(
    boundary: FedosDesktopConversationUiPresentationBoundary,
    viewerParticipant: FedosConversationParticipantReference,
    navigationLogPath: string,
    clock: () => number = () => Math.floor(Date.now() / 1000),
  ) {
    this.#boundary = boundary;
    this.#viewerParticipant = viewerParticipant;
    this.#persistence = new AppendOnlyFedosDesktopNavigationPersistence(navigationLogPath);
    this.#clock = clock;
    this.#snapshot = this.#persistence.snapshot();
  }

  // ---------------------------------------------------------------------
  // Window lifecycle / multi-window state model.
  // ---------------------------------------------------------------------

  /** Creates and registers a new window controller under `windowId` (caller-assigned — e.g. a real `BrowserWindow.id`). Throws on a duplicate id: this Registry never silently replaces a live window. */
  createWindow(windowId: FedosDesktopWindowId): FedosDesktopConversationWindowController {
    if (this.#windows.has(windowId)) {
      throw new Error(`FedosDesktopConversationWindowRegistry.createWindow: window id "${windowId}" already exists.`);
    }
    const controller = new FedosDesktopConversationWindowController(this.#boundary, this.#viewerParticipant);
    this.#windows.set(windowId, controller);
    return controller;
  }

  /** Removes `windowId` from this Registry (e.g. on the real OS window's own "closed" event). A no-op-returns-`false` for an unknown id, never a throw — window teardown races are expected and must fail closed, not crash the app. */
  disposeWindow(windowId: FedosDesktopWindowId): boolean {
    return this.#windows.delete(windowId);
  }

  getWindow(windowId: FedosDesktopWindowId): FedosDesktopConversationWindowController | null {
    return this.#windows.get(windowId) ?? null;
  }

  get openWindowIds(): readonly FedosDesktopWindowId[] {
    return Object.freeze([...this.#windows.keys()]);
  }

  // ---------------------------------------------------------------------
  // Recent / last-opened — call after a window's own openConversation()/
  // switchConversation() SUCCEEDS (never on a failed open — an
  // unavailable/not-found id is not a real "recent" or "last opened"
  // conversation). This Registry never inspects a Controller's own
  // navigation state itself; the caller (Phase E's Electron adapter)
  // reports success explicitly, since only the caller knows whether ITS
  // OWN `openConversation()`/`switchConversation()` call actually
  // resolved to `"open"`.
  // ---------------------------------------------------------------------

  recordConversationOpened(conversationId: string): void {
    this.#persistence.recordEvent({ type: "last-opened", conversationId, at: this.#clock() });
    this.#refreshSnapshot();
  }

  // ---------------------------------------------------------------------
  // Conversation pin state.
  // ---------------------------------------------------------------------

  pinConversation(conversationId: string): void {
    this.#persistence.recordEvent({ type: "pin", conversationId, at: this.#clock() });
    this.#refreshSnapshot();
  }

  unpinConversation(conversationId: string): void {
    this.#persistence.recordEvent({ type: "unpin", conversationId, at: this.#clock() });
    this.#refreshSnapshot();
  }

  isPinned(conversationId: string): boolean {
    return this.#snapshot.pinnedConversationIds.includes(conversationId);
  }

  get pinnedConversationIds(): readonly string[] {
    return this.#snapshot.pinnedConversationIds;
  }

  get recentConversationIds(): readonly string[] {
    return this.#snapshot.recentConversationIds;
  }

  get lastOpenedConversationId(): string | null {
    return this.#snapshot.lastOpenedConversationId;
  }

  // ---------------------------------------------------------------------
  // Whole-session snapshot — a future UI's "restore/show everything" read.
  // ---------------------------------------------------------------------

  sessionState(): FedosDesktopConversationWindowRegistrySessionState {
    return Object.freeze({
      lastOpenedConversationId: this.#snapshot.lastOpenedConversationId,
      pinnedConversationIds: this.#snapshot.pinnedConversationIds,
      recentConversationIds: this.#snapshot.recentConversationIds,
      openWindowIds: this.openWindowIds,
    });
  }

  #refreshSnapshot(): void {
    this.#snapshot = this.#persistence.snapshot();
  }
}
