/**
 * Secure Runtime Alpha 4341-4420 — Phase B: Desktop Badge Boundary,
 * Coordinator.
 *
 * `FedosDesktopBadgeCoordinator` is orchestration ONLY. It reuses TWO
 * existing, frozen classes:
 *   - `FedosDesktopConversationWindowRegistry` (Alpha 4181-4260) -- for the
 *     SET of conversation ids to sum unread counts over. Specifically its
 *     own `recentConversationIds` (the SAME real, persisted list
 *     `TrayCoordinator`'s own "recent-conversations" action already reuses,
 *     `../tray/fedos_desktop_tray_coordinator.ts`) -- NOT
 *     `FedosDesktopConversationListViewModel`/`FedosDesktopApplicationShell.listConversations()`,
 *     which was investigated and rejected during this Arc's own real
 *     testing: `listConversations()` only enumerates a Shell instance's own
 *     in-memory `#knownConversationIds` bookkeeping (populated exclusively
 *     by THAT SAME Shell's own `createDirectConversation()`/`createPrivateGroup()`
 *     calls), so it never rediscovers a conversation activated through a
 *     different runtime instance (or a prior process) from the SAME
 *     persisted logs — exactly the situation a real multi-session desktop
 *     app is in on every restart. The Window Registry's own
 *     `recentConversationIds`, by contrast, is real, append-only-log
 *     persisted state (Alpha 4181-4260, Phase C) that survives a restart
 *     and is populated by `recordConversationOpened()` after ANY real,
 *     successful conversation open — regardless of which Shell/runtime
 *     instance originally created it. This mirrors `TrayCoordinator`'s own
 *     identical, already-proven choice for the exact same reason.
 *   - `FedosDesktopUnreadCounterViewModel` (Alpha 3241-3320) -- for EVERY
 *     per-conversation unread count this Coordinator ever reports.
 *     `refresh(conversationId)` is called once per conversation and its own
 *     `FedosDesktopUnreadCount.count` is summed VERBATIM -- this file never
 *     reads `listMessages()`/any Shell method directly and never re-derives
 *     what "unread" means (this Arc's own hard requirement, restated from
 *     `./fedos_desktop_badge_types.ts`'s own header: "Never compute unread
 *     independently").
 *
 * It holds no persistence, no crypto, no transport, and no Electron import
 * of any kind. Its own bookkeeping (previous per-conversation counts, for
 * "attention" detection; the last rendered view, for de-duplication) is
 * in-memory-only -- mirrors `FedosDesktopNotificationCoordinator`'s own
 * "local presentation state is never durable" guardrail.
 *
 * NO DUPLICATE BADGE UPDATES (Phase G): `refresh()` calls `port.render()`
 * ONLY when the newly computed `FedosDesktopBadgeView` is structurally
 * different from the last one this Coordinator itself rendered -- two
 * consecutive `refresh()` calls that observe the identical state never
 * touch the Port twice. `renderCount` is exposed so a test can assert this
 * without reaching into the Port.
 */

import type { FedosDesktopUnreadCounterViewModel } from "../presentation/fedos_desktop_unread_counter_view_model.js";
import type { FedosDesktopConversationWindowRegistry } from "../navigation/fedos_desktop_conversation_window_registry.js";
import type { FedosDesktopBadgePort } from "./fedos_desktop_badge_port.js";
import {
  fedosDesktopBadgeNone,
  fedosDesktopBadgeCount,
  fedosDesktopBadgeAttention,
  fedosDesktopBadgeSynchronizing,
  fedosDesktopBadgeError,
  fedosDesktopBadgeViewsEqual,
  type FedosDesktopBadgeView,
} from "./fedos_desktop_badge_types.js";

/** The Registry surface this Coordinator actually reads -- never the whole class, mirrors `FedosDesktopTrayRegistryView`'s own "narrowest dependency" discipline (`../tray/fedos_desktop_tray_coordinator.ts`). */
export type FedosDesktopBadgeRegistryView = Pick<FedosDesktopConversationWindowRegistry, "recentConversationIds">;

export class FedosDesktopBadgeCoordinator {
  readonly #registry: FedosDesktopBadgeRegistryView;
  readonly #unreadCounter: FedosDesktopUnreadCounterViewModel;
  readonly #port: FedosDesktopBadgePort;
  /** conversationId -> the count THIS Coordinator itself last observed for it. Never persisted; reset on every process restart along with the underlying ViewModel's own watermarks. */
  readonly #previousCounts = new Map<string, number>();
  #synchronizing = false;
  #lastView: FedosDesktopBadgeView | null = null;
  #renderCount = 0;

  constructor(registry: FedosDesktopBadgeRegistryView, unreadCounter: FedosDesktopUnreadCounterViewModel, port: FedosDesktopBadgePort) {
    this.#registry = registry;
    this.#unreadCounter = unreadCounter;
    this.#port = port;
  }

  /** The last computed view, or `null` before the first `refresh()`. */
  get lastView(): FedosDesktopBadgeView | null {
    return this.#lastView;
  }

  /** How many times this Coordinator has actually called `port.render()` -- exposed only so a caller/test can observe the "no duplicate badge updates" guarantee without reaching into the Port itself. */
  get renderCount(): number {
    return this.#renderCount;
  }

  /** Phase D "synchronizing" -- an explicit, caller-driven signal (e.g. an Electron adapter watching `FedosDesktopDeviceSyncStatusViewModel`/`BackgroundLifecycleCoordinator`'s own real state). This Coordinator never infers sync activity on its own -- no new coupling to Device Sync internals. Takes effect on the NEXT `refresh()`. */
  setSynchronizing(active: boolean): void {
    this.#synchronizing = active;
  }

  /**
   * Recomputes the aggregate badge view over `this.#registry.recentConversationIds`
   * (read fresh every call -- always current), reusing the SAME
   * `FedosDesktopUnreadCounterViewModel` for every real per-conversation
   * count, then applies the result through this Coordinator's own Port
   * (only if it actually changed). Never throws -- every branch returns a
   * closed `FedosDesktopBadgeView`.
   */
  async refresh(): Promise<FedosDesktopBadgeView> {
    const conversationIds = this.#registry.recentConversationIds;

    let total = 0;
    let anyError = false;
    let anyIncreased = false;
    const seenIds = new Set<string>();

    for (const id of conversationIds) {
      seenIds.add(id);
      const unreadState = await this.#unreadCounter.refresh(id);
      if (unreadState.status === "error") {
        anyError = true;
        continue;
      }
      if (unreadState.status !== "loaded") continue;

      const count = unreadState.data.count;
      total += count;
      // Only a count THIS Coordinator has already observed once before can "increase" -- a
      // conversation's first-ever appearance (including right after a process restart, when the
      // underlying ViewModel's own watermarks are also freshly empty) is a baseline, never a
      // false "new arrival" attention pulse.
      const hadPrevious = this.#previousCounts.has(id);
      const previous = this.#previousCounts.get(id) ?? 0;
      if (hadPrevious && count > previous) anyIncreased = true;
      this.#previousCounts.set(id, count);
    }

    // Drop bookkeeping for conversations no longer listed -- never grows unbounded, never keeps a
    // fact about a conversation this refresh did not itself see.
    for (const id of [...this.#previousCounts.keys()]) {
      if (!seenIds.has(id)) this.#previousCounts.delete(id);
    }

    if (anyError) {
      return this.#apply(fedosDesktopBadgeError("one or more conversations failed to report their own unread count"));
    }
    if (this.#synchronizing) {
      return this.#apply(fedosDesktopBadgeSynchronizing(total));
    }
    if (total === 0) {
      return this.#apply(fedosDesktopBadgeNone());
    }
    if (anyIncreased) {
      return this.#apply(fedosDesktopBadgeAttention(total));
    }
    return this.#apply(fedosDesktopBadgeCount(total));
  }

  #apply(view: FedosDesktopBadgeView): FedosDesktopBadgeView {
    const changed = this.#lastView === null || !fedosDesktopBadgeViewsEqual(this.#lastView, view);
    this.#lastView = view;
    if (changed) {
      this.#port.render(view);
      this.#renderCount += 1;
    }
    return view;
  }
}
