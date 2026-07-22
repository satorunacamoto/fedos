/**
 * Secure Runtime Alpha 4341-4420 — page script (Phase F "expose status
 * only"). Runs inside the loaded page itself (an isolated Chromium page
 * context, NOT the preload/Node context) — has NO import of any kind,
 * mirroring `fedos_electron_notifications_tray_renderer.ts`'s own
 * convention exactly: it reads ONLY `window.fedosBadge` (the frozen bridge
 * the preload already placed there) and writes DOM. No business logic.
 *
 * Plain script (not a module): compiles to un-wrapped global-scope JS, so
 * it loads via a plain `<script src="...">` tag with no bundler.
 */

// Named `fedosBadgeById` (not `byId`) -- this file is compiled as a global, non-module script
// alongside every other page script in this package, which already declares its own `byId`/
// `fedosBgById` at global scope; a same-named declaration here would be a duplicate-implementation
// error under `tsconfig.browser-scripts.json`'s shared program.
function fedosBadgeById<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`fedos-badge renderer: missing element #${id}`);
  return el as T;
}

async function fedosBadgeRefresh(): Promise<void> {
  const badge = await window.fedosBadge.badgeStatus();
  fedosBadgeById("badge-view").textContent = JSON.stringify(badge, null, 2);
  const status = await window.fedosBadge.bgStatus();
  fedosBadgeById("status-view").textContent = JSON.stringify(status, null, 2);
}

fedosBadgeById<HTMLButtonElement>("refresh-badge-btn").addEventListener("click", () => {
  void fedosBadgeRefresh();
});
fedosBadgeById<HTMLButtonElement>("new-window-btn").addEventListener("click", () => {
  void window.fedosBadge.newWindow();
});
fedosBadgeById<HTMLButtonElement>("close-window-btn").addEventListener("click", () => {
  void window.fedosBadge.closeThisWindow();
});

void fedosBadgeRefresh();
