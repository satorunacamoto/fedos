/**
 * Secure Runtime Alpha 613 ("Signal Boundary") — Stage 13 of the Alpha
 * 601–620 Desktop Local Runtime Entry Point & Publish Pipeline
 * Ownership Arc.
 *
 * The ONE file in this repository that owns `process` for the Desktop
 * Local Runtime: reads CLI arguments (Option A, Alpha 604 — every
 * path is explicit, nothing env-derived), calls
 * `startFedosDesktopRuntime()` (`./fedos_desktop_runtime.js`, Alpha
 * 606, which itself knows nothing about `process`), registers
 * `SIGINT`/`SIGTERM` listeners, and awaits a graceful
 * `FedosRunningDesktopRuntime.stop()` before this process's own event
 * loop is allowed to drain naturally. `process.exit()` is called ONLY
 * at this file's own top level, on a genuine startup failure — never
 * from inside `fedos_desktop_runtime.ts` or any Host/Scheduler/
 * Controller file (all UNCHANGED, all already forbidden from doing so
 * by their own pre-existing HARD GUARDRAILS).
 *
 * Delivery activation is NOT reachable from this CLI executable —
 * `deliveryEnabled` is always `false` here. `startFedosDesktopRuntime()`
 * requires a real, already-constructed `FedosBoardOutboxPublisher`
 * object (Alpha 610) to enable delivery; a bare CLI argument vector
 * has no mechanism to carry a live object reference, and this file
 * constructs no Signing Authority/Relay of its own (this Arc's own
 * Absolute Prohibitions: no Runtime crypto). A caller that needs
 * delivery enabled imports and calls `startFedosDesktopRuntime()`
 * directly, from their own code, with their own injected Publisher —
 * exactly the boundary `docs/secure_runtime_alpha_610_publisher_registry_wiring.md`
 * documents.
 *
 * HARD GUARDRAILS:
 *   - This file is never imported by any other `src/` file — it is
 *     the leaf of the dependency graph, run only via
 *     `npm run start:runtime` (Alpha 605).
 *   - Listener cleanup is mandatory — both signal listeners are
 *     removed before this file's own shutdown sequence calls
 *     `runtime.stop()`.
 *   - No Worker (`../../worker.js`) import of any kind.
 */

// @ts-expect-error `node:process` has no type declarations without `@types/node` in this project's tsconfig.
import process from "node:process";
import { startFedosDesktopRuntime } from "./fedos_desktop_runtime.js";
import type { FedosDesktopRuntimeConfig } from "./fedos_desktop_runtime_config.js";

/** PRIVATE — `--flag=value` CLI parsing only; no env read, no default path. */
function parseArgs(argv: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) continue;
    flags.set(arg.slice(2, eq), arg.slice(eq + 1));
  }
  return flags;
}

/** PRIVATE — builds this executable's own config. `deliveryEnabled` is always `false` (see this file's own header). */
function configFromArgs(argv: readonly string[]): FedosDesktopRuntimeConfig {
  const flags = parseArgs(argv);
  const boardLogPath = flags.get("board-log");
  const outboxLogPath = flags.get("outbox-log");
  if (boardLogPath === undefined || outboxLogPath === undefined) {
    throw new Error(
      "run_fedos_desktop_runtime: both --board-log=<path> and --outbox-log=<path> are required.",
    );
  }
  return { boardLogPath, outboxLogPath, deliveryEnabled: false };
}

async function main(): Promise<void> {
  const config = configFromArgs(process.argv.slice(2));
  const runtime = await startFedosDesktopRuntime(config);
  console.log(`fedos-desktop-runtime: ready (state=${runtime.host.state()})`);

  await new Promise<void>((resolve) => {
    let settled = false;
    const shutdown = (signal: string): void => {
      if (settled) return;
      settled = true;
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
      console.log(`fedos-desktop-runtime: received ${signal}, stopping`);
      runtime
        .stop()
        .then(() => {
          console.log("fedos-desktop-runtime: stopped");
          resolve();
        })
        .catch((error: unknown) => {
          console.error("fedos-desktop-runtime: error during stop", error);
          resolve();
        });
    };
    const onSigint = (): void => shutdown("SIGINT");
    const onSigterm = (): void => shutdown("SIGTERM");
    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);
  });
}

main().catch((error: unknown) => {
  console.error("fedos-desktop-runtime: fatal startup error", error);
  process.exit(1);
});
