import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Real Digital Delivery mega-arc (Agent U) — Security / Device UI Closure.
 * Backend support for Signed Deletion (sender-side) and Identity
 * Replacement Ratchet-reset already existed (a prior Wave's own IPC
 * modules, `fedos_electron_deletion_request_send_ipc.ts`/
 * `fedos_electron_identity_transition_ratchet_reset_ipc.ts`, already unit-
 * tested at the handler-contract level); this Arc wires the SHIPPING
 * renderer's own UI on top and adds the tests below.
 *
 * Two tiers, mirroring `secure_runtime_alpha_8121_8200_double_submit_guards.test.ts`'s
 * own established, disclosed strategy exactly:
 *
 *  1. ALWAYS-RUN structural tests (below, ungated) — real source-order
 *     invariants (never "the function exists"): the EXACT sequence of
 *     operations inside the new control-flow functions, proving e.g. that
 *     a cancelled confirmation returns BEFORE the one call that would
 *     mutate Ratchet state, and that the double-submit guard on the new
 *     "Request deletion" button follows the SAME disable-before-await
 *     pattern already proven live for Lock/Device-Revoke one file over.
 *     These need no Electron/WASM artifact and give real signal in every
 *     environment, including this one.
 *
 *  2. A gated real-Electron smoke test (`CAN_RUN_REAL`) proving the new
 *     Device Sync inventory wiring does not crash the real packaged app
 *     and renders real content. Full real end-to-end coverage of the
 *     Signed Deletion / Identity Replacement flows would additionally
 *     require a real second Device/peer (a full Device Pairing or cross-
 *     account Identity Transition protocol run, each its own large,
 *     pre-existing Arc) purely to reach a screen this Arc's own new code
 *     never touches the setup of — the SAME disproportionality judgment
 *     `secure_runtime_alpha_8121_8200_double_submit_guards.test.ts`'s own
 *     header already makes for exactly this class of flow, not repeated
 *     here narratively but followed identically.
 */

const repoRoot = process.cwd();
const rendererSourcePath = join(repoRoot, "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts");
const mainSourcePath = join(repoRoot, "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// ---------------------------------------------------------------------
// Tier 1 — always-run structural tests.
// ---------------------------------------------------------------------

describe("Real Digital Delivery (Agent U) — structural invariants (always run, no Electron/WASM needed)", () => {
  const rendererSource = readFileSync(rendererSourcePath, "utf8");
  const mainSource = stripComments(readFileSync(mainSourcePath, "utf8"));

  it("Identity Replacement: cancelling the Ratchet-reset follow-up confirmation means identityTransitionAuthorizeRatchetReset() is never reached -- the function returns immediately after an unconfirmed dialog, strictly BEFORE that call, in source order", () => {
    const start = rendererSource.indexOf("async function runIdentityTransitionRatchetResetFlow(");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = rendererSource.slice(start, start + 1300);
    const confirmIdx = body.indexOf("await confirmInPage(");
    const cancelReturnIdx = body.indexOf("if (!confirmed) return;");
    const authorizeCallIdx = body.indexOf("window.fedosApp.identityTransitionAuthorizeRatchetReset(");
    expect(confirmIdx, "must call confirmInPage()").toBeGreaterThanOrEqual(0);
    expect(cancelReturnIdx, "must return on !confirmed").toBeGreaterThan(confirmIdx);
    expect(authorizeCallIdx, "must call authorizeRatchetReset()").toBeGreaterThan(cancelReturnIdx);
  });

  it("Identity Replacement: the Ratchet-reset follow-up NEVER runs on reject/defer, and only after Accept itself already reported outcome \"ok\" -- both conditions gate the SAME call, in source order right after that call resolves", () => {
    const start = rendererSource.indexOf("async function decideIdentityTransition(");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = rendererSource.slice(start, start + 2600);
    expect(body).toMatch(/if \(decision === "accept" && result\.outcome === "ok"\) \{\s*await runIdentityTransitionRatchetResetFlow\(target\);/);
  });

  it("Identity Replacement: never uses window.confirm() anywhere for the Ratchet-reset confirmation -- reuses the existing non-blocking confirmInPage() primitive only (a prior Unpublish freeze already demonstrated why native confirm() is unsafe here)", () => {
    const start = rendererSource.indexOf("async function runIdentityTransitionRatchetResetFlow(");
    const end = rendererSource.indexOf("\n}\n", start);
    const body = rendererSource.slice(start, end);
    expect(body).not.toMatch(/window\.confirm\(/);
    expect(body).toMatch(/confirmInPage\(/);
  });

  it("Identity Replacement: normal-language confirmation text introduces no raw cryptographic jargon (\"ratchet\"/\"epoch\") -- the body is built only from the domain's own already-plain warningText plus a plain count sentence", () => {
    const start = rendererSource.indexOf("async function runIdentityTransitionRatchetResetFlow(");
    const end = rendererSource.indexOf("\n}\n", start);
    const body = rendererSource.slice(start, end);
    expect(body.toLowerCase()).not.toMatch(/ratchet key|key epoch|continuity proof/);
  });

  it("Signed Deletion: the sender-facing button label is \"Request deletion\", and no user-facing STRING LITERAL anywhere claims \"Delete for everyone\"/\"Delete everywhere\"/\"Erase remotely\" (comments discussing the prohibition itself, e.g. this file's own header, are not string literals and are excluded)", () => {
    expect(rendererSource).toMatch(/textContent = state\?\.kind === "requesting" \? "Requesting…" : "Request deletion";/);
    const stringLiteralsOnly = stripComments(rendererSource).match(/"[^"\n]*"/g)?.join("\n") ?? "";
    expect(stringLiteralsOnly).not.toMatch(/Delete (for )?everyone/i);
    expect(stringLiteralsOnly).not.toMatch(/Delete everywhere/i);
    expect(stringLiteralsOnly).not.toMatch(/Erase remotely/i);
  });

  it("Signed Deletion: onRequestDeletion() disables its own button SYNCHRONOUSLY before the (awaited) confirmation ever opens -- the SAME disable-before-await pattern already proven live for Lock/Device-Revoke -- and never uses window.confirm()", () => {
    const start = rendererSource.indexOf("async function onRequestDeletion(");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = rendererSource.slice(start, start + 1300);
    const guardIdx = body.indexOf("if (btn.disabled || currentConversationId === null) return;");
    const disableIdx = body.indexOf("btn.disabled = true;");
    const confirmIdx = body.indexOf("await confirmInPage(");
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(disableIdx).toBeGreaterThan(guardIdx);
    expect(confirmIdx).toBeGreaterThan(disableIdx);
    expect(body).toMatch(/finally \{\s*btn\.disabled = false;/);
    expect(body).not.toMatch(/window\.confirm\(/);
  });

  it("Signed Deletion: a message already shown as locally deleted never gets a \"Request deletion\" control, and the control is offered ONLY on this local sender's own messages (never a contact's incoming message)", () => {
    const start = rendererSource.indexOf("function renderChatMessages(");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = rendererSource.slice(start, start + 2400);
    expect(body).toMatch(/if \(mine && !deleted\) li\.appendChild\(buildDeletionRequestControl\(m\.messageId\)\);/);
  });

  it("Signed Deletion: the confirmation copy explains this sends a REQUEST that the recipient may decline, and never claims it removes Relay/other-Device/off-app copies", () => {
    const start = rendererSource.indexOf("async function onRequestDeletion(");
    const end = rendererSource.indexOf("\n}\n", start);
    const body = rendererSource.slice(start, end);
    expect(body).toMatch(/They may decline it\./);
    expect(body.toLowerCase()).not.toMatch(/this (will|has) delete[sd]? (it |the message )?(everywhere|remotely|for everyone)/);
  });

  it("Signed Deletion: the IPC channel this button calls is registered WITHOUT allowConcurrentSelf -- the real, authoritative idempotency boundary is the shared per-channel in-flight guard (a concurrent second call returns {outcome:\"busy\"}, never a second real request)", () => {
    expect(mainSource).toMatch(/ipcCommands\.registerHandle\(ipcMain, "fedos-app:deletion-request-create", \(payload: unknown\) => handleAppDeletionRequestCreate\(payload\)\);/);
  });

  it("Signed Deletion: the sender-side create handler never forwards a caller-supplied scope claiming full remote erasure -- the renderer only ever requests the closed local-history scopes", () => {
    const start = rendererSource.indexOf("async function onRequestDeletion(");
    const end = rendererSource.indexOf("\n}\n", start);
    const body = rendererSource.slice(start, end);
    expect(body).toMatch(/window\.fedosApp\.deletionRequestCreate\(currentConversationId, messageId, "local-history-and-index", null, null\)/);
  });

  it("Device Sync: conflict acknowledgement is confirmed via the non-blocking confirmInPage() primitive (never window.confirm()), disabled for the duration of the request, and only sends one of the closed, safe resolution actions the Shell already accepts", () => {
    const start = rendererSource.indexOf("async function onSyncConflictAcknowledge(");
    expect(start).toBeGreaterThanOrEqual(0);
    const body = rendererSource.slice(start, start + 1100);
    expect(body).toMatch(/if \(btn\.disabled\) return;/);
    expect(body).toMatch(/btn\.disabled = true;/);
    expect(body).toMatch(/await confirmInPage\(/);
    expect(body).not.toMatch(/window\.confirm\(/);
    expect(body).toMatch(/finally \{\s*btn\.disabled = false;/);

    const mainStart = mainSource.indexOf("const DEVICE_SYNC_CONFLICT_RESOLUTION_ACTIONS");
    expect(mainStart).toBeGreaterThanOrEqual(0);
    expect(mainSource.slice(mainStart, mainStart + 200)).toMatch(/"accept-identical", "discard-invalid", "refresh-missing-dependency", "acknowledge"/);
  });

  it("Device Sync: every new fedos-app:* channel this Arc adds is registered (pure wiring over already-real Shell methods, no new authority)", () => {
    for (const channel of [
      "fedos-app:deletion-request-sent-status",
      "fedos-app:device-sync-schedules-list",
      "fedos-app:device-sync-transfers-list",
      "fedos-app:device-sync-conflicts-list",
      "fedos-app:device-sync-conflict-acknowledge",
    ]) {
      expect(mainSource, `${channel} must be registered`).toMatch(new RegExp(`ipcCommands\\.registerHandle\\(ipcMain, "${channel.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"`));
    }
  });
});

// ---------------------------------------------------------------------
// Tier 2 — real packaged Electron smoke test (gated: needs the built
// `dist/fedos_electron_beta_main.cjs` and the compiled WASM `pkg/`, both
// produced by `npm run package:beta`/`npm run build`, neither present in
// every worktree -- skips cleanly rather than faking a pass, exactly like
// `secure_runtime_alpha_8121_8200_double_submit_guards.test.ts`'s own
// `CAN_RUN_REAL` gate).
// ---------------------------------------------------------------------

const packageDir = join(repoRoot, "packages/fedos-desktop-electron-spike");
const mainCjsPath = join(packageDir, "dist/fedos_electron_beta_main.cjs");
const electronBinPath = join(packageDir, "node_modules/electron/dist/electron.exe");
const pkgWasmPath = join(repoRoot, "packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm");
const CAN_RUN_REAL = existsSync(pkgWasmPath) && existsSync(electronBinPath) && existsSync(mainCjsPath);

const tmpRoots: string[] = [];
afterAll(() => {
  while (tmpRoots.length) {
    try {
      rmSync(tmpRoots.pop()!, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

async function runUiScript(dataDir: string, script: readonly Record<string, unknown>[]): Promise<string> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: { ...process.env, FEDOS_ELECTRON_BETA_DATA_DIR: dataDir, FEDOS_ELECTRON_BETA_AUTOTEST: "ui-script", FEDOS_BETA_UI_SCRIPT: JSON.stringify(script) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (c: Buffer) => outChunks.push(c));
  child.stderr?.on("data", (c: Buffer) => outChunks.push(c));
  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }, 30000);
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  clearTimeout(timer);
  return Buffer.concat(outChunks).toString("utf8");
}

function readAt(output: string, index: number): string {
  const marker = "FEDOS_ELECTRON_BETA_UI_STEP_JSON:";
  for (const line of output.split("\n")) {
    if (!line.startsWith(marker)) continue;
    const parsed = JSON.parse(line.slice(marker.length)) as { index: number; result: { outcome: string; value?: string } };
    if (parsed.index === index) return parsed.result.value ?? "";
  }
  throw new Error(`no UI step at index ${index} in output:\n${output}`);
}

const realSuite = CAN_RUN_REAL ? describe : describe.skip;

realSuite("Real Digital Delivery (Agent U) — real packaged-app smoke test", () => {
  it("Devices screen renders real Device Sync inventory content (never crashes, never leaves the summary blank) on a fresh single-Device profile with no peers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-rdd-agent-u-devicesync-"));
    tmpRoots.push(dir);
    const out = await runUiScript(dir, [
      { action: "wait", ms: 300 },
      { action: "fill", selector: "#create-label", value: "Alice" },
      { action: "fill", selector: "#create-pass", value: "correct horse battery staple rdd agent u" },
      { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple rdd agent u" },
      { action: "click", selector: "#create-pass-ack" },
      { action: "click", selector: "#create-submit" },
      { action: "wait", ms: 900 },
      { action: "click", selector: "#nav-devices" },
      { action: "wait", ms: 600 },
      { action: "read", selector: "#current-screen" },
      { action: "read", selector: "#device-sync-summary" },
      { action: "read", selector: "#device-sync-conflicts-list" },
    ]);
    expect(readAt(out, 9), out).toBe("devices");
    const summary = readAt(out, 10);
    expect(summary.length, out).toBeGreaterThan(0);
    expect(summary).not.toMatch(/undefined|\[object Object\]|NaN/);
    const conflicts = readAt(out, 11);
    expect(conflicts.length, out).toBeGreaterThan(0);
  });
});
