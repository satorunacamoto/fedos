/**
 * FedOS Commerce FINAL Closure (Agent X) — closes the evidence gap the
 * Commerce E2E Completion arc's own final report left open ("Real
 * Electron E2E (packaged NSIS/win-unpacked binary): NOT PROVEN —
 * test-infrastructure gap, not a product defect"): drives the SAME full
 * Commerce happy-path tabletop as
 * `commerce_e2e_full_happy_path_real_electron.test.ts`, but against the
 * REAL `electron-builder`-produced packaged binary — preferring a REAL
 * NSIS silent install into an isolated, test-only directory (never the
 * real per-user default install location), falling back to the
 * `win-unpacked` directory the same installer is built from only if the
 * install step itself fails.
 *
 * ROOT CAUSE of the original reachability gap (reproduced live, this
 * arc, via controlled A/B spawns — not guessed): the packaged binary's
 * browser process never completes Chromium's multi-process bootstrap
 * (zero GPU/utility child processes spawn, confirmed via live
 * `Win32_Process` inspection over 40s) when its stdout/stderr handles
 * are redirected to ANYTHING other than true NUL — reproduced identically
 * for an anonymous pipe (`stdio: "pipe"`, what the dev-launch test above
 * already uses successfully), a real file handle, and an inherited
 * console handle. Only `stdio: "ignore"` (matching a plain
 * `Start-Process`/double-click launch) lets it proceed. The dev-launched
 * `node_modules/electron/dist/electron.exe` is UNAFFECTED by the exact
 * same redirected-stdio spawn — this is specific to the packaged binary,
 * not this file's own AUTOTEST logic (no `app.isPackaged` branch exists
 * anywhere near the AUTOTEST/ui-script code in
 * `fedos_electron_beta_main.cts`). Because the working launch mode
 * (`stdio: "ignore"`) makes stdout unobservable by construction, this
 * suite relies on `FEDOS_BETA_UI_STEP_LOG_FILE` (a minimal, additive,
 * AUTOTEST-only disk-mirror of the exact same step-result line this
 * package's console-based harness already emits — see that env var's own
 * doc comment in `fedos_electron_beta_main.cts` for the full record) and
 * on independent OS-level process-identity evidence (PID/parent
 * PID/executable path/SHA-256/version info via `Win32_Process`) instead
 * of stdout parsing.
 *
 * Skips itself with a clear message if the real WASM artifact, its
 * manifest, the compiled root `dist/`, or the packaged installer/
 * win-unpacked binary are absent — mirrors every other real-launch test
 * in this package.
 *
 * KNOWN, DISCLOSED, UNRESOLVED LIMITATION (see
 * `docs/commerce/COMMERCE-PACKAGED-BINARY-E2E-CLOSURE.md` for the full
 * record): even with the `stdio: "ignore"` fix above, this suite was
 * observed, live, this arc, to sometimes NOT complete even its first
 * lifecycle checkpoint within several minutes on a machine under heavy
 * concurrent load from sibling Arc worktrees (measured free physical
 * memory falling as low as ~0.7 GB of 15 GB total during these runs) —
 * while the dev-launch form of the identical script consistently
 * completes in ~11 seconds on the same machine. This was NOT root-caused
 * to a single mechanism this arc (most likely explanation: a cold,
 * uniquely-hashed ~225 MB packaged binary competing for memory/disk I/O
 * against dozens of concurrent sibling builds, vs. the dev binary's OS
 * page-cache warmth from repeated cross-worktree reuse — but a genuine,
 * independent packaged-binary-specific startup issue was not ruled out
 * either). If this test is flaky or times out, re-run it in isolation
 * on an otherwise-idle machine before treating a failure as a product
 * regression.
 *
 * FedOS Commerce FINAL Closure (Agent X, harness-hardening investigation
 * phase, subsequent session): the ORIGINAL version of this suite's
 * wait-for-exit step only checked the disk-based step/checkpoint log ONCE,
 * at the very end -- it could not tell "still making progress, just slow
 * under host contention" apart from "genuinely hung" while a run was
 * actually in flight, and left nothing behind for a future reader to
 * correlate a slow/failed run against host conditions after the fact.
 * `sampleHostTelemetry()`/`readLastCheckpoint()`/`countUiStepLines()` and
 * the periodic sampler in the `it()` body below close that gap: every
 * ~15 seconds while waiting for the packaged binary to exit, this suite now
 * reads the already-written checkpoint/step-log lines (no new checkpoint
 * labels added -- the existing `host-started`/`ui-script-iife-start`/
 * `ui-script-have-window-isLoadingMainFrame=...`/`ui-script-page-loaded`
 * labels already distinguish coarse app-level startup from CDP/window
 * readiness) and fresh, read-only host CPU/memory/process-count telemetry,
 * appending both to a new, additive evidence file
 * (`packaged_binary_e2e_host_telemetry_timeline.md`, never overwriting or
 * replacing `packaged_binary_e2e_evidence.md`'s own write). This is a
 * test-harness-only, read-only diagnostic addition: no timeout was raised
 * or lowered, no assertion was weakened, and no product code path changed.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const installerPath = `${packageDir}/dist-package-beta/FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`;
const winUnpackedExePath = `${packageDir}/dist-package-beta/win-unpacked/FedOS Desktop Beta.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;
const pkgManifestPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json`;
const commerceDistPath = `${repoRoot}/dist/os/commerce/index.js`;
const trustDistPath = `${repoRoot}/dist/os/trust/index.js`;

const CAN_RUN_REAL =
  existsSync(pkgWasmPath) &&
  existsSync(pkgManifestPath) &&
  existsSync(commerceDistPath) &&
  existsSync(trustDistPath) &&
  (existsSync(installerPath) || existsSync(winUnpackedExePath));

const evidenceDir = `${repoRoot}/docs/commerce/evidence/commerce_e2e_packaged_binary`;

function sha256OfFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Runs a PowerShell command and parses its stdout as JSON. Read-only inventory calls only (process/version metadata) — never touches secrets. */
function powershellJson<T>(script: string): T {
  const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  return JSON.parse(out) as T;
}

interface Win32ProcessInfo {
  readonly ProcessId: number;
  readonly ParentProcessId: number;
  readonly ExecutablePath: string | null;
  readonly CommandLine: string | null;
}

function queryWin32Process(pid: number): Win32ProcessInfo | null {
  const result = powershellJson<Win32ProcessInfo | null>(
    `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress`,
  );
  return result ?? null;
}

interface VersionInfo {
  readonly ProductName: string | null;
  readonly FileVersion: string | null;
  readonly ProductVersion: string | null;
}

function queryVersionInfo(exePath: string): VersionInfo {
  return powershellJson<VersionInfo>(
    `(Get-Item -LiteralPath ${JSON.stringify(exePath)}).VersionInfo | Select-Object ProductName,FileVersion,ProductVersion | ConvertTo-Json -Compress`,
  );
}

/**
 * FedOS Commerce FINAL Closure (Agent X, harness-hardening investigation
 * phase) -- Part 2 of `docs/commerce/COMMERCE-PACKAGED-BINARY-E2E-CLOSURE.md`
 * was left "disclosed, not root-caused": repeated live runs correlated the
 * packaged binary's dramatically slow/non-completing startup with severe,
 * independently-measured host memory pressure (free RAM observed falling
 * from 1.36 GB to 0.70 GB of 15.18 GB total, 280+ concurrent processes from
 * sibling worktrees), but a prior run of this exact suite only ever
 * measured elapsed TOTAL time and checked the step log ONCE, at the very
 * end (`exitCode`'s own `await`) -- it could not tell "still making
 * progress, just slow under real host contention" apart from "genuinely
 * hung" while the run was actually in flight, nor could it tell a future
 * reader which explanation applied after the fact. This function (read-only
 * inventory only, same discipline as `queryWin32Process`/`queryVersionInfo`
 * above) gives the periodic sampler below a fresh host-contention reading
 * on each poll -- never invoked outside this test file, never on a real
 * production launch.
 */
interface HostTelemetrySample {
  readonly totalProcesses: number;
  readonly nodeCount: number;
  readonly electronCount: number;
  readonly cargoCount: number;
  readonly freeMemMB: number;
  readonly totalMemMB: number;
  readonly avgCpuLoadPercent: number | null;
}

function sampleHostTelemetry(): HostTelemetrySample | null {
  try {
    return powershellJson<HostTelemetrySample>(
      "$os = Get-CimInstance Win32_OperatingSystem; " +
        "$cpu = Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average; " +
        "$procs = Get-CimInstance Win32_Process; " +
        "[PSCustomObject]@{ " +
        "totalProcesses = $procs.Count; " +
        "nodeCount = ($procs | Where-Object { $_.Name -eq 'node.exe' }).Count; " +
        "electronCount = ($procs | Where-Object { $_.Name -like '*lectron*' -or $_.Name -like '*FedOS*' }).Count; " +
        "cargoCount = ($procs | Where-Object { $_.Name -eq 'cargo.exe' -or $_.Name -eq 'rustc.exe' }).Count; " +
        "freeMemMB = [math]::Round($os.FreePhysicalMemory/1024,2); " +
        "totalMemMB = [math]::Round($os.TotalVisibleMemorySize/1024,2); " +
        "avgCpuLoadPercent = $cpu.Average " +
        "} | ConvertTo-Json -Compress",
    );
  } catch {
    // Best-effort diagnostic only -- a failed telemetry sample must never
    // fail or mask the real test assertion.
    return null;
  }
}

/**
 * Reads the SAME disk-based step log the packaged binary itself writes
 * (`FEDOS_BETA_UI_STEP_LOG_FILE`, see `fedos_electron_beta_main.cts`'s own
 * doc comment) and returns the most recent
 * `FEDOS_ELECTRON_BETA_CHECKPOINT:<label>:<timestamp>` lifecycle line, if
 * any -- these ALREADY distinguish coarse app-level phases (`host-started`)
 * from CDP/window readiness (`ui-script-have-window-isLoadingMainFrame=...`,
 * `ui-script-page-loaded`) from the ui-script loop actually starting
 * (`ui-script-iife-start`); this function adds no new checkpoint labels, it
 * only lets a still-running harness read the ones already written so far,
 * repeatedly, instead of only after the process exits.
 */
function readLastCheckpoint(stepLogFile: string): { readonly label: string; readonly timestampMs: number } | null {
  if (!existsSync(stepLogFile)) return null;
  let raw: string;
  try {
    raw = readFileSync(stepLogFile, "utf8");
  } catch {
    return null;
  }
  const marker = "FEDOS_ELECTRON_BETA_CHECKPOINT:";
  let last: { label: string; timestampMs: number } | null = null;
  for (const line of raw.split("\n")) {
    if (!line.startsWith(marker)) continue;
    const rest = line.slice(marker.length);
    const sep = rest.lastIndexOf(":");
    if (sep === -1) continue;
    const timestampMs = Number(rest.slice(sep + 1));
    if (!Number.isFinite(timestampMs)) continue;
    last = { label: rest.slice(0, sep), timestampMs };
  }
  return last;
}

/** Counts `FEDOS_ELECTRON_BETA_UI_STEP_JSON:` lines written so far -- a coarse, always-available "how far into the 68-step script did it get" progress signal, independent of the checkpoint lines above. */
function countUiStepLines(stepLogFile: string): number {
  if (!existsSync(stepLogFile)) return 0;
  try {
    return readFileSync(stepLogFile, "utf8")
      .split("\n")
      .filter((line) => line.startsWith("FEDOS_ELECTRON_BETA_UI_STEP_JSON:")).length;
  } catch {
    return 0;
  }
}

// Same synthetic demo pubkeys `fedos_electron_beta_renderer.ts`'s own
// `COMMERCE_DEMO_ACTORS` uses -- restated here for the same reason
// `commerce_e2e_full_happy_path_real_electron.test.ts` restates them
// (this test cannot `import` the renderer).
const ALICE_CUSTOMER = "c".repeat(64);
const NORTHLIGHT_MERCHANT = "a".repeat(64);

type UiStep =
  | { readonly action: "fill"; readonly selector: string; readonly value: string }
  | { readonly action: "click"; readonly selector: string }
  | { readonly action: "read"; readonly selector: string; readonly as?: "text" | "value" }
  | { readonly action: "wait"; readonly ms: number };

interface UiStepResult {
  readonly index: number;
  readonly action: string;
  readonly selector: string;
  readonly result: { readonly outcome: string; readonly value?: string };
}

const HAPPY_PATH_SCRIPT: readonly UiStep[] = [
  { action: "wait", ms: 300 }, // 0
  { action: "fill", selector: "#create-label", value: "Commerce E2E Packaged Test Profile" }, // 1
  { action: "fill", selector: "#create-pass", value: "commerce e2e packaged happy path pass" }, // 2
  { action: "fill", selector: "#create-pass-confirm", value: "commerce e2e packaged happy path pass" }, // 3
  { action: "click", selector: "#create-submit" }, // 4
  { action: "wait", ms: 2000 }, // 5 -- real Argon2 unlock + real WASM master seed generation
  { action: "read", selector: "#current-screen" }, // 6 -- expect "ready"

  // Bob (Merchant/Northlight): create + publish a product.
  { action: "click", selector: "#nav-commerce-merchant" }, // 7
  { action: "wait", ms: 300 }, // 8
  { action: "fill", selector: "#commerce-merchant-acting-as", value: NORTHLIGHT_MERCHANT }, // 9
  { action: "wait", ms: 200 }, // 10
  { action: "fill", selector: "#commerce-merchant-create-title", value: "Handmade Ceramic Mug" }, // 11
  { action: "fill", selector: "#commerce-merchant-create-description", value: "A small fictional demo product for the packaged-binary E2E tabletop." }, // 12
  { action: "fill", selector: "#commerce-merchant-create-price", value: "2500" }, // 13
  { action: "fill", selector: "#commerce-merchant-create-currency", value: "USD" }, // 14
  { action: "click", selector: "#commerce-merchant-create-submit" }, // 15
  { action: "wait", ms: 300 }, // 16
  { action: "read", selector: "#commerce-merchant-products-list" }, // 17 -- proves the new draft product is real and listed
  { action: "click", selector: "#commerce-merchant-products-list li:last-child button" }, // 18 -- Publish
  { action: "wait", ms: 300 }, // 19

  // Alice (Customer): discover, order, submit.
  { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 20
  { action: "wait", ms: 200 }, // 21
  { action: "click", selector: "#nav-commerce" }, // 22
  { action: "wait", ms: 300 }, // 23
  { action: "read", selector: "#commerce-catalog-list" }, // 24
  { action: "click", selector: "#commerce-catalog-list li:nth-child(4) button" }, // 25
  { action: "wait", ms: 300 }, // 26
  { action: "read", selector: "#commerce-detail-title" }, // 27 -- expect "Handmade Ceramic Mug"
  { action: "click", selector: "#commerce-order-create-submit" }, // 28
  { action: "wait", ms: 400 }, // 29
  { action: "read", selector: "#commerce-order-status-text" }, // 30 -- expect "created"
  { action: "click", selector: "#commerce-order-submit-btn" }, // 31
  { action: "wait", ms: 300 }, // 32
  { action: "read", selector: "#commerce-order-status-text" }, // 33 -- expect "submitted"

  // Bob (Merchant): accept.
  { action: "fill", selector: "#commerce-acting-as", value: NORTHLIGHT_MERCHANT }, // 34
  { action: "wait", ms: 200 }, // 35
  { action: "click", selector: "#commerce-order-accept-btn" }, // 36
  { action: "wait", ms: 300 }, // 37
  { action: "read", selector: "#commerce-order-status-text" }, // 38 -- expect "accepted"

  // Alice (Customer): request + simulate (TEST/LOCAL) payment.
  { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 39
  { action: "wait", ms: 200 }, // 40
  { action: "click", selector: "#commerce-order-payment-request-btn" }, // 41
  { action: "wait", ms: 400 }, // 42
  { action: "read", selector: "#commerce-order-payment-id" }, // 43
  { action: "click", selector: "#commerce-order-payment-simulate-btn" }, // 44
  { action: "wait", ms: 500 }, // 45
  { action: "read", selector: "#commerce-order-status-text" }, // 46 -- expect "paid"

  // Bob (Merchant): fulfill.
  { action: "fill", selector: "#commerce-acting-as", value: NORTHLIGHT_MERCHANT }, // 47
  { action: "wait", ms: 200 }, // 48
  { action: "click", selector: "#commerce-order-fulfill-btn" }, // 49
  { action: "wait", ms: 400 }, // 50
  { action: "read", selector: "#commerce-order-status-text" }, // 51 -- expect "fulfilling"
  { action: "read", selector: "#commerce-order-delivery-status" }, // 52

  // Alice (Customer): acknowledge real receipt.
  { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 53
  { action: "wait", ms: 200 }, // 54
  { action: "click", selector: "#commerce-order-acknowledge-receipt-btn" }, // 55
  { action: "wait", ms: 400 }, // 56
  { action: "read", selector: "#commerce-order-status-text" }, // 57 -- expect "delivered"

  // Complete.
  { action: "click", selector: "#commerce-order-complete-btn" }, // 58
  { action: "wait", ms: 400 }, // 59
  { action: "read", selector: "#commerce-order-status-text" }, // 60 -- expect "completed"

  // Issue + verify a REAL signed, QR-encoded Trust receipt.
  { action: "click", selector: "#commerce-order-receipt-issue-btn" }, // 61
  { action: "wait", ms: 500 }, // 62
  { action: "read", selector: "#commerce-order-receipt-verify-status" }, // 63 -- expect "VALID"
  { action: "read", selector: "#commerce-order-receipt-qr-text", as: "value" }, // 64

  // Messenger regression.
  { action: "click", selector: "#nav-conversations" }, // 65
  { action: "wait", ms: 300 }, // 66
  { action: "read", selector: ".app-screen.active#app-screen-conversations" }, // 67
];

function readAt(steps: readonly UiStepResult[], rawOutput: string, index: number): string {
  const step = steps.find((s) => s.index === index);
  expect(step, `${rawOutput}\n--- expected a UI step at index ${index} ---`).toBeDefined();
  expect(step!.result.outcome, rawOutput).toBe("ok");
  return step!.result.value ?? "";
}

// ---------------------------------------------------------------------
// Evidence state, gathered across beforeAll/it/afterAll and written to
// disk at the end regardless of pass/fail (fail-open on evidence writing
// only -- never suppresses a real test assertion failure).
// ---------------------------------------------------------------------
let installDir = "";
let launchExePath = "";
let installOutcome: "nsis-silent-install" | "win-unpacked-fallback" | "skipped" = "skipped";
let installerSha256 = "";
let launchExeSha256Before = "";
let uninstallOutcome = "not-attempted";
let spawnedPid: number | undefined;
let liveProcessInfo: Win32ProcessInfo | null = null;
let versionInfo: VersionInfo | null = null;
const evidenceLines: string[] = [];
function record(line: string): void {
  evidenceLines.push(line);
  // eslint-disable-next-line no-console
  console.log(`[packaged-e2e-evidence] ${line}`);
}

const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log(
    "commerce_e2e_packaged_binary_real_electron: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce, dist/os/trust, or the packaged installer/win-unpacked binary is absent. Run `npm run build:wasm && npm run build:wasm:manifest && npm run build:beta-runtime && npm run package:electron-beta` first.",
  );
}

realSuite("FedOS Commerce End-to-End -- REAL electron-builder-packaged Beta binary (NSIS silent install preferred), full happy-path tabletop, driven only through visible DOM controls", () => {
  beforeAll(() => {
    if (existsSync(installerPath)) {
      installerSha256 = sha256OfFile(installerPath);
      record(`installer path: ${installerPath}`);
      record(`installer sha256: ${installerSha256}`);
      installDir = mkdtempSync(join(tmpdir(), "fedos-packaged-install-"));
      // NSIS silent, custom install dir. `/D=` must be the LAST argument,
      // unquoted, no trailing backslash -- a real, documented NSIS
      // requirement (electron-builder's own generated installer honors
      // it, confirmed live this arc: `allowToChangeInstallationDirectory`
      // is `true` and `oneClick` is `false` in
      // `electron_builder.beta.config.json`, the configuration this
      // exact NSIS support requires).
      const result = spawnSync(installerPath, ["/S", `/D=${installDir}`], { stdio: "pipe", timeout: 120000, windowsVerbatimArguments: true });
      const candidateExe = join(installDir, "FedOS Desktop Beta.exe");
      if (result.status === 0 && existsSync(candidateExe)) {
        launchExePath = candidateExe;
        installOutcome = "nsis-silent-install";
        record(`NSIS silent install PASSED into isolated dir: ${installDir}`);
      } else {
        record(`NSIS silent install did not produce the expected exe (status=${String(result.status)}, error=${String(result.error)}) -- falling back to win-unpacked`);
        launchExePath = winUnpackedExePath;
        installOutcome = "win-unpacked-fallback";
      }
    } else {
      record(`installer not found at ${installerPath} -- using win-unpacked directly`);
      launchExePath = winUnpackedExePath;
      installOutcome = "win-unpacked-fallback";
    }
    expect(existsSync(launchExePath), `launch exe must exist at ${launchExePath}`).toBe(true);
    launchExeSha256Before = sha256OfFile(launchExePath);
    record(`launch exe path: ${launchExePath}`);
    record(`launch exe sha256 (pre-launch, on-disk): ${launchExeSha256Before}`);
    try {
      versionInfo = queryVersionInfo(launchExePath);
      record(`launch exe version info: ${JSON.stringify(versionInfo)}`);
    } catch (err) {
      record(`version info query failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, 150000);

  afterAll(() => {
    // Process cleanup: kill ONLY the PID this suite itself spawned, by
    // PID, never by process name/image -- see the class-level "process
    // safety" discipline every real-launch test/harness in this arc
    // follows.
    if (spawnedPid !== undefined) {
      try {
        execFileSync("taskkill", ["/PID", String(spawnedPid), "/F", "/T"], { stdio: "ignore" });
        record(`afterAll: taskkill issued for owned PID ${spawnedPid}`);
      } catch {
        /* already exited on its own -- expected, not an error */
      }
      try {
        const stillThere = queryWin32Process(spawnedPid);
        record(`afterAll: post-cleanup liveness check for PID ${spawnedPid}: ${stillThere === null ? "gone (clean)" : "STILL PRESENT"}`);
      } catch {
        /* best-effort verification only */
      }
    }

    if (installOutcome === "nsis-silent-install" && installDir.length > 0) {
      // Real, disclosed side effects of a real NSIS install even with
      // `/S /D=`: a per-user (HKCU, `perMachine:false`) Desktop shortcut,
      // Start Menu entry, and Add/Remove Programs registry key are
      // created unconditionally by this installer's own template (no
      // CLI flag suppresses them -- confirmed by reading
      // `node_modules/app-builder-lib/templates/nsis/installSection.nsh`
      // this arc). Run the real, installer-provided uninstaller (also
      // silent) to remove all three before deleting the install
      // directory, rather than leaving them behind.
      try {
        const uninstallerCandidates = ["Uninstall FedOS Desktop Beta.exe", "Uninstall.exe"].map((name) => join(installDir, name));
        const uninstallerPath = uninstallerCandidates.find((p) => existsSync(p));
        if (uninstallerPath !== undefined) {
          const uninstallResult = spawnSync(uninstallerPath, ["/S"], { stdio: "pipe", timeout: 60000 });
          uninstallOutcome = `ran (status=${String(uninstallResult.status)})`;
        } else {
          uninstallOutcome = "no uninstaller found at expected path";
        }
      } catch (err) {
        uninstallOutcome = `uninstall attempt threw: ${err instanceof Error ? err.message : String(err)}`;
      }
      record(`afterAll: uninstall outcome: ${uninstallOutcome}`);
      try {
        rmSync(installDir, { recursive: true, force: true });
        record(`afterAll: removed install dir ${installDir}`);
      } catch (err) {
        record(`afterAll: install dir removal failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    try {
      mkdirSync(evidenceDir, { recursive: true });
      const evidencePath = join(evidenceDir, "packaged_binary_e2e_evidence.md");
      writeFileSync(
        evidencePath,
        [
          "# Commerce E2E — packaged binary launch evidence (generated by commerce_e2e_packaged_binary_real_electron.test.ts)",
          "",
          `Generated: ${new Date().toISOString()}`,
          "",
          "```",
          ...evidenceLines,
          "```",
          "",
        ].join("\n"),
      );
      // eslint-disable-next-line no-console
      console.log(`[packaged-e2e-evidence] wrote ${evidencePath}`);
    } catch {
      /* evidence writing is best-effort, never masks a real test failure */
    }
  }, 90000);

  it(
    "Bob (Northlight) creates+publishes a product; Alice discovers, orders, submits; Bob accepts; Alice pays (TEST/LOCAL simulator); Bob fulfills; Alice acknowledges receipt; order completes; a real signed+QR-encoded Trust receipt is issued and independently verified VALID -- all against the REAL packaged/installed binary, proven by independent OS process-identity evidence",
    async () => {
      const dataDir = mkdtempSync(join(tmpdir(), "fedos-packaged-e2e-data-"));
      const screenshotDir = mkdtempSync(join(tmpdir(), "fedos-packaged-e2e-shots-"));
      const stepLogFile = join(mkdtempSync(join(tmpdir(), "fedos-packaged-e2e-steps-")), "steps.log");

      const child = spawn(launchExePath, [], {
        cwd: packageDir,
        env: {
          ...process.env,
          FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
          FEDOS_ELECTRON_BETA_AUTOTEST: "ui-script",
          FEDOS_BETA_UI_SCRIPT: JSON.stringify(HAPPY_PATH_SCRIPT),
          FEDOS_ELECTRON_BETA_SCREENSHOT_DIR: screenshotDir,
          FEDOS_BETA_UI_STEP_LOG_FILE: stepLogFile,
        },
        // See this file's own top-of-file root-cause note: this is the
        // ONLY stdio mode under which the packaged binary reliably
        // proceeds past Chromium's multi-process bootstrap. Evidence is
        // gathered via `stepLogFile` (disk) and independent OS process
        // inspection instead of captured stdout.
        stdio: "ignore",
      });
      spawnedPid = child.pid;
      record(`spawned packaged binary, pid=${String(child.pid)}, exe=${launchExePath}`);
      expect(child.pid, "child process must have a real PID").toBeDefined();

      // Independent OS-level proof this is the REAL launched packaged
      // binary, not dev Electron / `npm start` / an unpacked sibling /
      // an old previously-installed binary: query the live process
      // table for the PID we just received, confirm its own
      // `ExecutablePath` matches the exact file we launched, and confirm
      // our own PID is its `ParentProcessId` (we are the direct parent,
      // not some unrelated launcher).
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        liveProcessInfo = queryWin32Process(child.pid!);
        record(`live Win32_Process info: ${JSON.stringify(liveProcessInfo)}`);
      } catch (err) {
        record(`live process query failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (liveProcessInfo !== null) {
        expect(liveProcessInfo.ParentProcessId, "the spawned packaged binary's OS-reported parent PID must be THIS test process").toBe(process.pid);
        if (liveProcessInfo.ExecutablePath !== null) {
          expect(liveProcessInfo.ExecutablePath.toLowerCase()).toBe(launchExePath.toLowerCase());
          const liveHash = sha256OfFile(liveProcessInfo.ExecutablePath);
          record(`sha256 of the ACTUALLY-RUNNING executable (re-read from the live ExecutablePath while running): ${liveHash}`);
          expect(liveHash, "the actually-running executable's own bytes must match the pre-launch on-disk hash").toBe(launchExeSha256Before);
        }
      }

      // FedOS Commerce FINAL Closure (Agent X, harness-hardening
      // investigation phase) -- periodic host-telemetry + checkpoint-
      // freshness sampler, ADDITIVE to the pre-existing single-shot
      // wait-for-exit below (never replaces it, never affects the
      // timeout/kill/assertion behavior). Every `POLL_INTERVAL_MS` while
      // waiting for the packaged binary to exit, this samples (1) the most
      // recent lifecycle checkpoint the binary itself has written to disk
      // and how long ago that was (distinguishes "still progressing, just
      // slow" from "genuinely stalled" -- the exact diagnostic gap Part 2
      // of `docs/commerce/COMMERCE-PACKAGED-BINARY-E2E-CLOSURE.md` left
      // open: that arc's own runs only ever checked the step log ONCE, at
      // the very end), (2) how many `ui-script` step lines have landed so
      // far, and (3) fresh host CPU/memory/process-count telemetry (same
      // read-only `Win32_Process`/`Win32_OperatingSystem` inventory
      // technique as `queryWin32Process` above). Written to its own,
      // additive evidence file (never touches
      // `packaged_binary_e2e_evidence.md`'s own write) so a future run's
      // slowness/hang can be correlated against host contention after the
      // fact instead of guessed at. Purely a test-harness diagnostic --
      // reads already-written disk files and read-only OS process
      // inventory; issues no commands to the packaged binary and changes
      // no product code path.
      const telemetryTimelinePath = join(evidenceDir, "packaged_binary_e2e_host_telemetry_timeline.md");
      const runStartMs = Date.now();
      function telemetryLine(): string {
        const elapsedS = Math.round((Date.now() - runStartMs) / 1000);
        const lastCheckpoint = readLastCheckpoint(stepLogFile);
        const sinceLastCheckpointS = lastCheckpoint === null ? null : Math.round((Date.now() - lastCheckpoint.timestampMs) / 1000);
        const stepLinesSoFar = countUiStepLines(stepLogFile);
        const telemetry = sampleHostTelemetry();
        return (
          `t+${elapsedS}s | lastCheckpoint=${lastCheckpoint === null ? "NONE" : lastCheckpoint.label}` +
          ` | secondsSinceLastCheckpoint=${sinceLastCheckpointS === null ? "n/a" : String(sinceLastCheckpointS)}` +
          ` | uiStepLinesSoFar=${stepLinesSoFar}` +
          ` | totalProcesses=${telemetry?.totalProcesses ?? "?"} | node=${telemetry?.nodeCount ?? "?"} | electron=${telemetry?.electronCount ?? "?"} | cargo=${telemetry?.cargoCount ?? "?"}` +
          ` | freeMemMB=${telemetry?.freeMemMB ?? "?"} | totalMemMB=${telemetry?.totalMemMB ?? "?"} | avgCpuLoad%=${telemetry?.avgCpuLoadPercent ?? "?"}`
        );
      }
      try {
        mkdirSync(evidenceDir, { recursive: true });
        writeFileSync(
          telemetryTimelinePath,
          [
            "# Commerce E2E packaged binary -- host telemetry timeline (this run, generated by commerce_e2e_packaged_binary_real_electron.test.ts)",
            "",
            `Generated: ${new Date().toISOString()}`,
            "",
            "Sampled every ~15s while waiting for the packaged binary to exit, correlating the disk-based lifecycle checkpoint/step-log progress against fresh host CPU/memory/process-count telemetry -- lets a future reader distinguish host contention from a genuine product hang without guessing.",
            "",
            "```",
            telemetryLine(),
          ].join("\n") + "\n",
        );
      } catch {
        /* evidence writing is best-effort, never masks a real test failure */
      }
      const POLL_INTERVAL_MS = 15000;
      const pollTimer = setInterval(() => {
        const line = telemetryLine();
        record(`telemetry-sample: ${line}`);
        try {
          appendFileSync(telemetryTimelinePath, line + "\n");
        } catch {
          /* best-effort only */
        }
      }, POLL_INTERVAL_MS);

      const exitCode = await new Promise<number | null>((resolve) => {
        const timer = setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {
            /* already gone */
          }
        }, 240000);
        child.once("exit", (code) => {
          clearTimeout(timer);
          clearInterval(pollTimer);
          resolve(code);
        });
      });
      try {
        appendFileSync(telemetryTimelinePath, telemetryLine() + "\n```\n");
      } catch {
        /* best-effort only */
      }
      record(`packaged binary process exit code: ${String(exitCode)}`);

      expect(existsSync(stepLogFile), "the packaged binary must have written the disk-based step log (proves AUTOTEST ui-script actually ran to completion, not just that the process launched)").toBe(true);
      const rawOutput = readFileSync(stepLogFile, "utf8");
      const steps: UiStepResult[] = [];
      const marker = "FEDOS_ELECTRON_BETA_UI_STEP_JSON:";
      for (const line of rawOutput.split("\n")) {
        if (!line.startsWith(marker)) continue;
        steps.push(JSON.parse(line.slice(marker.length)) as UiStepResult);
      }

      expect(readAt(steps, rawOutput, 6)).toBe("ready");

      readAt(steps, rawOutput, 17);
      const publishStep = steps.find((s) => s.index === 18);
      expect(publishStep, rawOutput).toBeDefined();
      expect(publishStep!.result.outcome, rawOutput).toBe("ok");

      const catalogText = readAt(steps, rawOutput, 24);
      expect(catalogText).toMatch(/Handmade Ceramic Mug/);

      expect(readAt(steps, rawOutput, 27)).toBe("Handmade Ceramic Mug");
      expect(readAt(steps, rawOutput, 30)).toBe("created");
      expect(readAt(steps, rawOutput, 33)).toBe("submitted");
      expect(readAt(steps, rawOutput, 38)).toBe("accepted");

      const paymentIdText = readAt(steps, rawOutput, 43);
      expect(paymentIdText.length).toBeGreaterThan(0);
      expect(readAt(steps, rawOutput, 46)).toBe("paid");

      expect(readAt(steps, rawOutput, 51)).toBe("fulfilling");
      expect(readAt(steps, rawOutput, 52)).toMatch(/Delivery status: fulfilling/);

      expect(readAt(steps, rawOutput, 57)).toBe("delivered");
      expect(readAt(steps, rawOutput, 60)).toBe("completed");

      expect(readAt(steps, rawOutput, 63)).toBe("VALID");
      const qrText = readAt(steps, rawOutput, 64);
      expect(qrText.length).toBeGreaterThan(0);
      expect(qrText).not.toMatch(/"markAsPaid"/i);

      readAt(steps, rawOutput, 67);

      record(`step count observed: ${steps.length}`);
      record(`screenshot dir (best-effort, not asserted on): ${screenshotDir}`);
    },
    270000,
  );
});
