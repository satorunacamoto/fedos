// Secure Runtime Alpha 3881-3940/4021-4100/4181-4260/4261-4340/4341-4420 -- build-support only.
//
// `tsc` compiles ONLY the `.cts`/`.ts` sources in `src/`; static HTML pages
// are not TypeScript and are never compiled -- this script copies each one
// (unmodified) into `dist/`, next to the compiled `.cjs`/`.js` output, so
// `BrowserWindow.loadFile()`/the `<script src>` tag resolve it via a plain
// relative path at runtime. Node-native `fs`/`path` only, no new
// dependency.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(packageRoot, "src");
const outDir = join(packageRoot, "dist");

mkdirSync(outDir, { recursive: true });
copyFileSync(join(srcDir, "fedos_electron_spike_page.html"), join(outDir, "fedos_electron_spike_page.html"));
// Secure Runtime Alpha 4101-4180 -- the Host Adapter's own static page, additive.
copyFileSync(join(srcDir, "fedos_electron_host_adapter_page.html"), join(outDir, "fedos_electron_host_adapter_page.html"));
// Secure Runtime Alpha 4181-4260 -- the Navigation Arc's own second, real page.
copyFileSync(join(srcDir, "fedos_electron_navigation_page.html"), join(outDir, "fedos_electron_navigation_page.html"));
// Secure Runtime Alpha 4261-4340 -- the Notifications/Tray/Background Arc's own status page.
copyFileSync(join(srcDir, "fedos_electron_notifications_tray_page.html"), join(outDir, "fedos_electron_notifications_tray_page.html"));
// Secure Runtime Alpha 4341-4420 -- the Unread Badge/Menu Bar Count Arc's own status page.
copyFileSync(join(srcDir, "fedos_electron_badge_page.html"), join(outDir, "fedos_electron_badge_page.html"));
// Secure Runtime Alpha 4821-4900 -- the Packaged Real-Unlock Arc's own onboarding page.
copyFileSync(join(srcDir, "fedos_electron_unlock_page.html"), join(outDir, "fedos_electron_unlock_page.html"));
// Secure Runtime Alpha 4901-4980 -- the Desktop Settings Arc's own settings page.
copyFileSync(join(srcDir, "fedos_electron_settings_page.html"), join(outDir, "fedos_electron_settings_page.html"));
// Secure Runtime Alpha 5061-5160 -- the Beta 0.1 Integration Arc's own composed status/onboarding page.
copyFileSync(join(srcDir, "fedos_electron_beta_page.html"), join(outDir, "fedos_electron_beta_page.html"));
