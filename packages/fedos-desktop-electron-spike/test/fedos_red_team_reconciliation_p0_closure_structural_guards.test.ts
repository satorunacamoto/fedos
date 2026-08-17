/**
 * FedOS Red Team Reconciliation P0/P1 Closure — structural guards (source
 * inspection, no Electron/WASM artifact required) for the two findings
 * this Arc closed:
 *
 *   P0-B — the renderer's `onChatSend()` used to check only
 *   `result.outcome !== "ok"` and unconditionally show "Sent." on any
 *   `"ok"` outcome, ignoring the real `result.value.delivery` fact the
 *   backend already computes (`docs/reviews/fedos-red-team-reconciliation-current/02_P0_RECONCILIATION.md`).
 *
 *   P1-5 — `readyResult()` in `fedos_electron_beta_main.cts` computed the
 *   coordinator's real `recoveryNotice` (via `#readyView()` /
 *   `buildFedosProfileRecoveryNotice()`) but silently dropped it before it
 *   ever reached the renderer.
 *
 * A full live proof (real Electron + real WASM artifact, a real send over
 * a real relay, reading the real rendered DOM) already exists in
 * `secure_runtime_alpha_8041_8120_real_user_facing_vertical_slice.test.ts`
 * (updated by this same fix to expect the new, honest "Queued for
 * delivery…" text instead of the old unconditional "Sent."), but that
 * suite skips itself whenever the `pkg/` WASM artifact or the Electron
 * binary are absent (as they are in a fresh worktree — see this repo's own
 * "Worktree missing WASM artifact" convention). These guards are the
 * lightweight, artifact-free complement: they prove the SOURCE-level fix
 * is present and structurally correct even when the live suite cannot run.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8");
}

const MAIN_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts";
const RENDERER_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts";
const WINDOW_DTS_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_window.d.ts";
const HTML_PATH = "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html";

describe("FedOS Red Team Reconciliation P0/P1 Closure -- structural guards", () => {
  describe("P0-B -- onChatSend() no longer shows an unconditional 'Sent.'", () => {
    it("onChatSend() reads result.value.delivery, not just result.outcome", () => {
      const source = read(RENDERER_PATH);
      const start = source.indexOf("async function onChatSend(");
      expect(start).toBeGreaterThanOrEqual(0);
      const body = source.slice(start, start + 1400);
      expect(body).toMatch(/result\.value/);
      expect(body).toMatch(/\.delivery/);
      // The old bug: an unconditional literal assignment of "Sent." inside
      // this function regardless of the real delivery outcome.
      expect(body).not.toMatch(/textContent\s*=\s*"Sent\."/);
    });

    it("a real transport failure/unavailable delivery state is never rendered as 'Sent.' -- the closed-vocabulary state->text table has no state mapping to a bare 'Sent.'", () => {
      const source = read(RENDERER_PATH);
      const start = source.indexOf("const CHAT_SEND_DELIVERY_STATE_TEXT");
      expect(start).toBeGreaterThanOrEqual(0);
      const tableSource = source.slice(start, source.indexOf("};", start) + 2);
      expect(tableSource).not.toMatch(/:\s*"Sent\.?"/);
      // Every real failure/unavailable state this architecture can return
      // (see FedosContentAccessorDeliveryFact's own header) is present.
      expect(tableSource).toMatch(/"route-unavailable"/);
      expect(tableSource).toMatch(/\bunavailable:/);
      expect(tableSource).toMatch(/\bfailed:/);
      expect(tableSource).toMatch(/\bqueued:/);
    });

    it("a non-queued delivery outcome also surfaces via the existing chat-error element, not just the quieter chat-send-feedback line", () => {
      const source = read(RENDERER_PATH);
      const start = source.indexOf("async function onChatSend(");
      const body = source.slice(start, start + 1400);
      expect(body).toMatch(/delivery\.state\s*!==\s*"queued"/);
      expect(body).toMatch(/chat-error/);
    });
  });

  describe("P1-5 -- recoveryNotice reaches the renderer instead of being dropped at the IPC boundary", () => {
    it("readyResult() forwards recoveryNotice from the coordinator's ReadyView", () => {
      const source = read(MAIN_PATH);
      const start = source.indexOf("function readyResult(view: ReadyView)");
      expect(start).toBeGreaterThanOrEqual(0);
      const body = source.slice(start, start + 700);
      expect(body).toMatch(/recoveryNotice:\s*view\.recoveryNotice/);
    });

    it("the local ReadyView interface declares recoveryNotice as required (not optional, never silently absent)", () => {
      const source = read(MAIN_PATH);
      const start = source.indexOf("interface ReadyView {");
      expect(start).toBeGreaterThanOrEqual(0);
      const body = source.slice(start, source.indexOf("}", start) + 1);
      expect(body).toMatch(/readonly recoveryNotice: ReadyViewRecoveryNotice;/);
    });

    it("the renderer-facing FedosProfileCommandResult['ready'] type declares recoveryNotice", () => {
      const source = read(WINDOW_DTS_PATH);
      const start = source.indexOf("interface FedosProfileCommandResult {");
      expect(start).toBeGreaterThanOrEqual(0);
      expect(source.slice(start, start + 600)).toMatch(/readonly recoveryNotice: FedosProfileRecoveryNoticeView;/);
    });

    it("renderReady() actually renders the notice (not merely typed and forwarded, but consumed)", () => {
      const source = read(RENDERER_PATH);
      const start = source.indexOf("function renderReady(ready: FedosProfileCommandResult");
      expect(start).toBeGreaterThanOrEqual(0);
      const body = source.slice(start, start + 400);
      expect(body).toMatch(/renderReadyRecoveryNotice\(ready\.recoveryNotice\)/);
    });

    it("the page HTML declares the container elements renderReadyRecoveryNotice() populates", () => {
      const source = read(HTML_PATH);
      expect(source).toMatch(/id="ready-recovery-headline"/);
      expect(source).toMatch(/id="ready-recovery-backup-items"/);
      expect(source).toMatch(/id="ready-recovery-whole-dir"/);
    });
  });
});
