/**
 * Secure Runtime Alpha 3881-3940 -- static page script (Phase D).
 *
 * Runs inside the loaded page itself (a normal, isolated Chromium page
 * context, NOT the preload/Node context) -- deliberately has NO import of
 * any kind (Electron, Node, or otherwise): it only reads the ONE frozen
 * value the preload already placed on `window`, and writes safe,
 * hard-coded build-spike status text into the DOM. No business feature, no
 * Conversation/Search/Archive/Device/Sync/key/Runtime data of any kind.
 *
 * Plain script (not a module): TypeScript emits this file as un-wrapped
 * global-scope JS (no `import`/`export` exists in this file), so it can be
 * loaded directly via a plain `<script src="...">` tag with no bundler.
 */

const versionsElement = document.getElementById("fedos-electron-spike-versions");
const metadata = window.fedosElectronSpikeBuildMetadata;

if (versionsElement !== null) {
  versionsElement.textContent =
    metadata !== undefined
      ? `Electron ${metadata.electronVersion} / Chrome ${metadata.chromeVersion} / Node ${metadata.nodeVersion}`
      : "Build metadata unavailable.";
}
