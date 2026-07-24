/**
 * Secure Runtime Alpha 4261-4340 — Phase F/G: main-process self-test
 * sequence (test-support only, mirrors `fedos_electron_host_adapter_selftest.ts`'s
 * own "MARKER" transport-proof convention, Alpha 4101-4180).
 *
 * UNLIKE that file (which ran inside a renderer page, since the Host
 * Adapter's `dispatch`/`render` had no natural interactive UI), this
 * sequence runs directly in the MAIN process, because the scenarios this
 * Arc's own Phase G names are process/lifecycle-level (window close,
 * background/foreground, shutdown) rather than renderer-clickable —
 * exercising them one process layer down would only re-test what
 * `test/secure_runtime_alpha_4261_4340_*.test.ts` (root) already covers
 * for real; this file's own job is proving the SAME real objects wired
 * together inside a genuine Electron main process behave identically.
 *
 * Gated behind `FEDOS_ELECTRON_BG_AUTOTEST=1` (mirrors
 * `FEDOS_ELECTRON_NAV_DEVTOOLS`'s own env-gate convention) -- never runs
 * during a normal developer/user launch. Every step logs one
 * `FEDOS_BG_TEST:{...}` JSON line to this (real, unmodified) process's own
 * stdout; `fedos_electron_notifications_tray_main.cts` adds no forwarding
 * of its own (console output already reaches stdout directly, since this
 * runs in Main, not a renderer).
 */

const MARKER = "FEDOS_BG_TEST:";

function logStep(step: string, result: unknown): void {
  // eslint-disable-next-line no-console -- deliberate, minimal real-process test signal; not a debugging leftover.
  console.log(`${MARKER}${JSON.stringify({ step, result })}`);
}

export interface FedosBackgroundSelftestWindowLike {
  close(): void;
}

export interface FedosBackgroundSelftestBackgroundLifecycleLike {
  readonly state: string;
  canRunBackgroundSync(): boolean;
  canDeliverBackgroundNotifications(): boolean;
}

export interface FedosBackgroundSelftestDeps {
  readonly notify: (candidate: unknown) => Promise<unknown>;
  readonly trayDispatch: (candidate: unknown) => Promise<unknown>;
  readonly backgroundLifecycle: FedosBackgroundSelftestBackgroundLifecycleLike;
  readonly createBackgroundWindow: () => Promise<FedosBackgroundSelftestWindowLike>;
  readonly closeWindowAndWait: (window: FedosBackgroundSelftestWindowLike) => Promise<void>;
  readonly destroyTray: () => void;
}

export async function runFedosBackgroundSelftest(deps: FedosBackgroundSelftestDeps): Promise<void> {
  // 1/2/3/4 -- notification / message notification / archive notification / sync notification.
  logStep("notification", await deps.notify({ kind: "warning" }));
  logStep("message-notification", await deps.notify({ kind: "conversation-message", targetConversationId: "selftest-conversation" }));
  logStep("archive-notification-complete", await deps.notify({ kind: "archive-complete" }));
  logStep("archive-notification-failed", await deps.notify({ kind: "archive-failed" }));
  logStep("sync-notification-complete", await deps.notify({ kind: "sync-complete" }));
  logStep("sync-notification-failed", await deps.notify({ kind: "sync-failed" }));

  // 5/6/7/8 -- tray open / tray pause / tray resume / tray exit (outcome only -- the real quit happens once, at the very end, driven by Main).
  logStep("tray-open", await deps.trayDispatch({ action: "open-window" }));
  logStep("tray-pause", await deps.trayDispatch({ action: "pause-sync" }));
  logStep("tray-resume", await deps.trayDispatch({ action: "resume-sync" }));
  logStep("tray-exit", await deps.trayDispatch({ action: "exit" }));

  // 9 -- window close keeps runtime alive: open a real second BrowserWindow, close it for real, confirm the
  // process is still alive (backgroundLifecycle never reaches "stopped"/"shutting-down" on this path).
  const window = await deps.createBackgroundWindow();
  await deps.closeWindowAndWait(window);
  logStep("window-close-keeps-runtime-alive", { backgroundState: deps.backgroundLifecycle.state });

  // 10 -- background sync: the capability flag stays true while backgrounded (0 windows open, keep-alive policy).
  logStep("background-sync", {
    canRunBackgroundSync: deps.backgroundLifecycle.canRunBackgroundSync(),
    canDeliverBackgroundNotifications: deps.backgroundLifecycle.canDeliverBackgroundNotifications(),
  });

  // 11 -- restart: opening a new window after backgrounding returns to "foreground".
  const restarted = await deps.createBackgroundWindow();
  logStep("restart", { backgroundState: deps.backgroundLifecycle.state });
  await deps.closeWindowAndWait(restarted);

  // 12 -- multiple notifications in quick succession.
  const multi = await Promise.all([deps.notify({ kind: "device-sync" }), deps.notify({ kind: "device-transfer" }), deps.notify({ kind: "error" })]);
  logStep("multiple-notifications", multi);

  // 13 -- unexpected command: both boundaries fail closed, never throw.
  logStep("unexpected-notification-kind", await deps.notify({ kind: "not-a-real-kind" }));
  logStep("unexpected-tray-action", await deps.trayDispatch({ action: "not-a-real-action" }));

  // 14 -- resource cleanup: tearing down the tray icon never throws, safe even called more than once.
  deps.destroyTray();
  deps.destroyTray();
  logStep("resource-cleanup", { ok: true });

  console.log(`${MARKER}done`);
}
