// Secure Runtime Alpha 3881-3940 -- build-support only (Phase C/G).
//
// `tsc` compiles ONLY the `.cts`/`.ts` sources in this directory; the
// static HTML page is not TypeScript and is never compiled -- this script
// copies it (unmodified) next to the compiled `.cjs`/`.js` output so
// `BrowserWindow.loadFile()`/the `<script src>` tag resolve it via a plain
// relative path at runtime. Node-native `fs`/`path` only, no new
// dependency.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const spikeSourceDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(spikeSourceDir, "..", "..", "..", "dist-electron-spike");

mkdirSync(outDir, { recursive: true });
copyFileSync(join(spikeSourceDir, "fedos_electron_spike_page.html"), join(outDir, "fedos_electron_spike_page.html"));
