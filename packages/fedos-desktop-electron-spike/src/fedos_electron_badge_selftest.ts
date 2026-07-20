/**
 * Secure Runtime Alpha 4341-4420 — Phase F/G: main-process self-test
 * sequence (test-support only, mirrors
 * `fedos_electron_notifications_tray_selftest.ts`'s own "MARKER"
 * transport-proof convention, Alpha 4261-4340).
 *
 * Runs directly in the MAIN process (same reasoning as its own
 * predecessor): the eight scenarios this Arc's own brief names (unread
 * increments, unread clears, multiple windows, restart, notification
 * interaction, tray interaction, no duplicate badge updates, shutdown
 * cleanup) are process/lifecycle-level, not renderer-clickable.
 *
 * Gated behind `FEDOS_ELECTRON_BADGE_AUTOTEST=1` -- never runs during a
 * normal developer/user launch. Every step logs one `FEDOS_BADGE_TEST:{...}`
 * JSON line to this (real, unmodified) process's own stdout.
 */

const MARKER = "FEDOS_BADGE_TEST:";

function logStep(step: string, result: unknown): void {
  // eslint-disable-next-line no-console -- deliberate, minimal real-process test signal; not a debugging leftover.
  console.log(`${MARKER}${JSON.stringify({ step, result })}`);
}

export interface FedosBadgeSelftestWindowLike {
  close(): void;
}

export interface FedosBadgeSelftestDeps {
  readonly seededConversationId: string | null;
  /** Sends a fresh message into the seeded conversation (via the SAME `FedosDesktopComposeMessageViewModel` a real UI already uses) -- the real event this Arc's own "unread increments" scenario observes. */
  readonly sendSeedMessage: (body: string) => Promise<unknown>;
  /** Marks a conversation viewed through the SAME `FedosDesktopUnreadCounterViewModel.markViewed()` this Coordinator wraps, then recomputes the badge. */
  readonly markViewed: (conversationId: string) => Promise<void>;
  readonly refreshBadge: () => Promise<{ readonly state: string; readonly count: number; readonly reason: string }>;
  readonly badgeRenderCount: () => number;
  readonly notify: (candidate: unknown) => Promise<unknown>;
  readonly trayOpenWindow: (conversationId: string | null) => Promise<unknown>;
  readonly createExtraWindow: () => Promise<FedosBadgeSelftestWindowLike>;
  readonly closeWindowAndWait: (window: FedosBadgeSelftestWindowLike) => Promise<void>;
  readonly openWindowCount: () => number;
}

export async function runFedosBadgeSelftest(deps: FedosBadgeSelftestDeps): Promise<void> {
  const conversationId = deps.seededConversationId;
  if (conversationId === null) {
    logStep("seed-conversation-missing", { ok: false });
    console.log(`${MARKER}done`);
    return;
  }

  // 1 -- unread increments: a real new message lands in the seeded conversation; the badge's own
  // next refresh reflects it (reusing the SAME FedosDesktopUnreadCounterViewModel, never a
  // separately-computed count).
  await deps.sendSeedMessage("fedos-badge selftest message");
  const afterSend = await deps.refreshBadge();
  logStep("unread-increments", afterSend);

  // 2 -- unread clears: marking the SAME conversation viewed brings the aggregate back to zero.
  await deps.markViewed(conversationId);
  const afterMarkViewed = await deps.refreshBadge();
  logStep("unread-clears", afterMarkViewed);

  // 3 -- multiple windows: opening two more REAL windows never throws applying a taskbar overlay
  // icon to each; the badge's own aggregate is unaffected by window count (it is a conversation
  // fact, not a per-window one).
  const windowA = await deps.createExtraWindow();
  const windowB = await deps.createExtraWindow();
  const multiWindowCount = deps.openWindowCount();
  const afterMultiWindow = await deps.refreshBadge();
  logStep("multiple-windows", { openWindowCount: multiWindowCount, badge: afterMultiWindow });
  await deps.closeWindowAndWait(windowB);
  await deps.closeWindowAndWait(windowA);

  // 4 -- restart: after every extra window closes and a new one opens (the same "background then
  // foreground again" cycle Alpha 4261-4340's own Background Lifecycle proves), the badge is
  // still correctly, non-duplicatively recomputed -- never a stale or doubled total.
  const restarted = await deps.createExtraWindow();
  const afterRestart = await deps.refreshBadge();
  logStep("restart", afterRestart);
  await deps.closeWindowAndWait(restarted);

  // 5 -- notification interaction: delivering a real "conversation-message" notification about the
  // seeded conversation never throws; the badge remains a valid, closed-vocabulary view afterward.
  await deps.notify({ kind: "conversation-message", targetConversationId: conversationId });
  const afterNotify = await deps.refreshBadge();
  logStep("notification-interaction", afterNotify);

  // 6 -- tray interaction: a real "open-window" tray dispatch opens/focuses the seeded
  // conversation and marks it viewed (the real side-effect path, `handleTrayAction`) -- the badge
  // reflects that real interaction afterward.
  await deps.sendSeedMessage("fedos-badge selftest second message");
  await deps.trayOpenWindow(conversationId);
  const afterTray = await deps.refreshBadge();
  logStep("tray-interaction", afterTray);

  // 7 -- no duplicate badge updates: two consecutive refreshes with NOTHING changed between them
  // must never call the Port a second time -- `renderCount` stays identical.
  const renderCountBefore = deps.badgeRenderCount();
  await deps.refreshBadge();
  const renderCountAfter = deps.badgeRenderCount();
  logStep("no-duplicate-badge-updates", { renderCountBefore, renderCountAfter });

  // 8 -- shutdown cleanup: this selftest's own job ends here: the REAL shutdown path (badge
  // surfaces cleared, Tray destroyed, `app.quit()`) is `fedos_electron_badge_main.cts`'s own
  // `performCleanShutdown()`, driven by the caller's own `finally` block AFTER this function
  // returns -- proven by the acceptance suite asserting the real
  // `"fedos-badge: shutdown clean"` line appears strictly after this file's own `"done"` marker.
  logStep("shutdown-cleanup", { ok: true });

  console.log(`${MARKER}done`);
}
