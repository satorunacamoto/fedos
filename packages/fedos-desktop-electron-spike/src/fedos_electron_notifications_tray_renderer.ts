/**
 * Secure Runtime Alpha 4261-4340 — page script (Phase F "expose status
 * only"). Runs inside the loaded page itself (an isolated Chromium page
 * context, NOT the preload/Node context) — has NO import of any kind,
 * mirroring `fedos_electron_navigation_renderer.ts`'s own convention
 * exactly: it reads ONLY `window.fedosBackground` (the frozen bridge the
 * preload already placed there) and writes DOM. No business logic.
 *
 * Plain script (not a module): compiles to un-wrapped global-scope JS, so
 * it loads via a plain `<script src="...">` tag with no bundler.
 */

// Named `fedosBgById` (not `byId`) -- this file is compiled as a global, non-module script
// alongside every other page script in this package (`fedos_electron_navigation_renderer.ts`
// etc.), which already declares its own `byId` at global scope; a same-named declaration here
// would be a duplicate-implementation error under `tsconfig.browser-scripts.json`'s shared program.
function fedosBgById<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`fedos-bg renderer: missing element #${id}`);
  return el as T;
}

async function fedosBgRefreshStatus(): Promise<void> {
  const status = await window.fedosBackground.status();
  fedosBgById("status-view").textContent = JSON.stringify(status, null, 2);
}

fedosBgById<HTMLButtonElement>("refresh-status-btn").addEventListener("click", () => {
  void fedosBgRefreshStatus();
});
fedosBgById<HTMLButtonElement>("pause-sync-btn").addEventListener("click", () => {
  void window.fedosBackground.trayAction({ action: "pause-sync" }).then(() => fedosBgRefreshStatus());
});
fedosBgById<HTMLButtonElement>("resume-sync-btn").addEventListener("click", () => {
  void window.fedosBackground.trayAction({ action: "resume-sync" }).then(() => fedosBgRefreshStatus());
});
fedosBgById<HTMLButtonElement>("new-window-btn").addEventListener("click", () => {
  void window.fedosBackground.newWindow();
});
fedosBgById<HTMLButtonElement>("close-window-btn").addEventListener("click", () => {
  void window.fedosBackground.closeThisWindow();
});

void fedosBgRefreshStatus();
