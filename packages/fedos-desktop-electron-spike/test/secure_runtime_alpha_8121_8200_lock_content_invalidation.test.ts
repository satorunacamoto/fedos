import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Secure Runtime Alpha 8121-8200 — Security Finding 4 (external audit
 * delta `6873d24f`): "a Renderer-side plaintext cache whose lifecycle
 * across lock/restart was not independently proven." This test drives a
 * REAL two-party message exchange, REVEALS the received message's
 * plaintext (the exact renderer-side cache the review named,
 * `revealedMessagePlaintext` in `fedos_electron_beta_renderer.ts`), locks
 * through the real Lock button, and proves via real rendered DOM
 * `textContent` that:
 *   1. the revealed plaintext is genuinely gone from the DOM after lock
 *      (not merely hidden by CSS/screen-switching);
 *   2. it does NOT silently reappear merely from a correct re-unlock
 *      (before the conversation is re-opened through the new Runtime);
 *   3. re-opening the SAME conversation after unlock genuinely reloads
 *      the message fresh (and still requires its own explicit "Show
 *      message" reveal click -- never auto-decrypted, matching this
 *      Arc's own pre-existing "on-demand reveal, never bulk-decrypt"
 *      contract).
 * Also proves Search results are cleared on lock (a second content-cache
 * class the review named).
 */

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;
const settingsControllerDistPath = `${repoRoot}/dist/os/messenger/desktop/settings/fedos_desktop_settings_controller.js`;

const REAL_ARTIFACT_PRESENT = existsSync(pkgWasmPath);
const ELECTRON_PRESENT = existsSync(electronBinPath);
const CAN_RUN_REAL = REAL_ARTIFACT_PRESENT && ELECTRON_PRESENT && existsSync(mainCjsPath) && existsSync(settingsControllerDistPath);

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-8121-lockclear-${label}-`));
  tmpRoots.push(dir);
  return dir;
}
afterAll(() => {
  while (tmpRoots.length) {
    try {
      rmSync(tmpRoots.pop()!, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

async function seedSettings(dataDir: string, relays: readonly string[]): Promise<void> {
  const mod = (await import(`file://${settingsControllerDistPath}`)) as {
    createFileBackedFedosDesktopSettingsController: (path: string) => { save(candidate: unknown): { outcome: string } };
  };
  const controller = mod.createFileBackedFedosDesktopSettingsController(`${dataDir}/settings.json`);
  const result = controller.save({
    schemaVersion: 1,
    theme: "system",
    language: "en",
    relays,
    defaultRelay: relays[0] ?? "",
    notificationsEnabled: true,
    backgroundSyncEnabled: true,
    archiveDirectory: "",
    autoStart: false,
    autoLockTimeoutMinutes: 15,
    windowLayout: "standard",
  });
  expect(result.outcome).toBe("ok");
}

type UiStep =
  | { readonly action: "fill"; readonly selector: string; readonly value: string }
  | { readonly action: "click"; readonly selector: string }
  | { readonly action: "read"; readonly selector: string; readonly as?: "text" | "value" }
  | { readonly action: "wait"; readonly ms: number };

async function runBetaUiScript(dataDir: string, script: readonly UiStep[], extraEnv: Record<string, string> = {}): Promise<{ readonly output: string }> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "ui-script",
      FEDOS_BETA_UI_SCRIPT: JSON.stringify(script),
      ...extraEnv,
    },
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
  }, 60000);
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  clearTimeout(timer);
  return { output: Buffer.concat(outChunks).toString("utf8") };
}

function readAt(run: { readonly output: string }, index: number): string {
  const marker = "FEDOS_ELECTRON_BETA_UI_STEP_JSON:";
  for (const line of run.output.split("\n")) {
    if (!line.startsWith(marker)) continue;
    const parsed = JSON.parse(line.slice(marker.length)) as { index: number; result: { outcome: string; value?: string } };
    if (parsed.index === index) {
      expect(parsed.result.outcome, run.output).toBe("ok");
      return parsed.result.value ?? "";
    }
  }
  throw new Error(`no UI step at index ${index} in output:\n${run.output}`);
}

const realSuite = CAN_RUN_REAL ? describe : describe.skip;

realSuite("Alpha 8121-8200 -- Security Finding 4 (6873d24f): Renderer plaintext cache is genuinely cleared on lock, does not reappear on bare unlock", () => {
  it(
    "revealed message plaintext and Search results disappear from the real DOM on Lock, stay absent immediately after a correct re-unlock, and only reload (with a fresh explicit reveal) once the conversation is re-opened",
    async () => {
      const relayServerModuleSpecifier = "../../../test/support/fedos_real_local_websocket_relay_server.js";
      const { startFedosRealLocalWebSocketRelayServer } = (await import(relayServerModuleSpecifier)) as {
        startFedosRealLocalWebSocketRelayServer: () => Promise<{ readonly url: string; close(): Promise<void> }>;
      };
      const relay = await startFedosRealLocalWebSocketRelayServer();
      try {
        const aliceDir = makeTmpRoot("alice");
        const bobDir = makeTmpRoot("bob");
        await seedSettings(aliceDir, [relay.url]);
        await seedSettings(bobDir, [relay.url]);
        const fastTick = { FEDOS_BETA_CONVERSATION_TRANSPORT_INTERVAL_MS: "50" };

        const aliceCreate = await runBetaUiScript(
          aliceDir,
          [
            { action: "wait", ms: 300 },
            { action: "fill", selector: "#create-label", value: "Alice" },
            { action: "fill", selector: "#create-pass", value: "correct horse battery staple 8121 lockclear alice" },
            { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple 8121 lockclear alice" },
            { action: "click", selector: "#create-submit" },
            { action: "wait", ms: 700 },
            { action: "read", selector: "#ready-account" },
          ],
          fastTick,
        );
        const aliceIdentifier = readAt(aliceCreate, 6);
        expect(aliceIdentifier.length).toBeGreaterThan(0);

        const bobCreate = await runBetaUiScript(
          bobDir,
          [
            { action: "wait", ms: 300 },
            { action: "fill", selector: "#create-label", value: "Bob" },
            { action: "fill", selector: "#create-pass", value: "correct horse battery staple 8121 lockclear bob" },
            { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple 8121 lockclear bob" },
            { action: "click", selector: "#create-submit" },
            { action: "wait", ms: 700 },
            { action: "read", selector: "#ready-account" },
          ],
          fastTick,
        );
        const bobIdentifier = readAt(bobCreate, 6);
        expect(bobIdentifier).not.toBe(aliceIdentifier);

        const [aliceInvite, bobAutoReceive] = await Promise.all([
          runBetaUiScript(
            aliceDir,
            [
              { action: "wait", ms: 300 },
              { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8121 lockclear alice" },
              { action: "click", selector: "#unlock-submit" },
              { action: "wait", ms: 800 },
              { action: "fill", selector: "#invite-identifier", value: bobIdentifier },
              { action: "click", selector: "#invite-submit" },
              { action: "wait", ms: 3000 },
            ],
            fastTick,
          ),
          runBetaUiScript(
            bobDir,
            [
              { action: "wait", ms: 300 },
              { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8121 lockclear bob" },
              { action: "click", selector: "#unlock-submit" },
              { action: "wait", ms: 2200 },
              { action: "click", selector: "#nav-conversations" },
              { action: "wait", ms: 300 },
            ],
            fastTick,
          ),
        ]);
        void aliceInvite;
        void bobAutoReceive;

        const [, bobSend] = await Promise.all([
          runBetaUiScript(
            aliceDir,
            [
              { action: "wait", ms: 300 },
              { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8121 lockclear alice" },
              { action: "click", selector: "#unlock-submit" },
              { action: "wait", ms: 800 },
              // Alice's own conversation must be genuinely OPEN (not merely
              // unlocked) while Bob sends, mirroring the established real
              // vertical slice's own successful receive pattern -- a live,
              // real-time delivery needs the receiving side's own
              // subscription genuinely active on this specific conversation.
              { action: "click", selector: "#conversations-list li:first-of-type button" },
              { action: "wait", ms: 3500 },
            ],
            fastTick,
          ),
          runBetaUiScript(
            bobDir,
            [
              { action: "wait", ms: 300 },
              { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8121 lockclear bob" },
              { action: "click", selector: "#unlock-submit" },
              { action: "wait", ms: 500 },
              { action: "click", selector: "#conversations-list li:first-of-type button" },
              { action: "wait", ms: 400 },
              { action: "fill", selector: "#chat-compose", value: "secret plaintext content only Alice should ever see revealed" },
              { action: "click", selector: "#chat-send" },
              { action: "wait", ms: 700 },
            ],
            fastTick,
          ),
        ]);
        void bobSend;

        // ---- Alice: open the conversation, reveal Bob's message, prove it's on screen, search for it, then Lock. ----
        const aliceRevealThenLock = await runBetaUiScript(
          aliceDir,
          [
            { action: "wait", ms: 300 },
            { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8121 lockclear alice" },
            { action: "click", selector: "#unlock-submit" },
            { action: "wait", ms: 500 },
            { action: "click", selector: "#conversations-list li:first-of-type button" },
            { action: "wait", ms: 1000 },
            { action: "click", selector: "#chat-messages button" },
            { action: "wait", ms: 400 },
            // ---- 1. revealed plaintext genuinely on screen. ----
            { action: "read", selector: "#chat-messages" },
            { action: "click", selector: "#nav-search" },
            { action: "fill", selector: "#search-query", value: "secret plaintext content" },
            { action: "click", selector: "#search-submit" },
            { action: "wait", ms: 300 },
            // ---- 2. search results genuinely on screen. ----
            { action: "read", selector: "#search-results" },
            // ---- 3. Lock. ----
            { action: "click", selector: "#lock-btn" },
            { action: "wait", ms: 400 },
            // ---- 4. immediately after Lock: the revealed plaintext and search results must be genuinely gone from the DOM. ----
            { action: "read", selector: "#chat-messages" },
            { action: "read", selector: "#search-results" },
            { action: "read", selector: "#current-screen" },
          ],
          fastTick,
        );
        const revealedBeforeLock = readAt(aliceRevealThenLock, 8);
        expect(revealedBeforeLock).toMatch(/secret plaintext content only Alice should ever see revealed/);
        const searchResultsBeforeLock = readAt(aliceRevealThenLock, 13);
        expect(searchResultsBeforeLock).not.toMatch(/No results\./);
        const chatMessagesAfterLock = readAt(aliceRevealThenLock, 16);
        expect(chatMessagesAfterLock, "chat-messages must be genuinely empty right after Lock").not.toMatch(/secret plaintext content only Alice should ever see revealed/);
        const searchResultsAfterLock = readAt(aliceRevealThenLock, 17);
        expect(searchResultsAfterLock, "search-results must be genuinely cleared right after Lock").toBe("");
        expect(readAt(aliceRevealThenLock, 18)).toBe("unlock");

        // ---- Alice: re-unlock. Immediately (before re-opening the conversation), the old plaintext must NOT reappear. Then re-open the conversation: it reloads fresh and still requires its own explicit reveal click. ----
        const aliceReunlock = await runBetaUiScript(
          aliceDir,
          [
            { action: "wait", ms: 300 },
            { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8121 lockclear alice" },
            { action: "click", selector: "#unlock-submit" },
            { action: "wait", ms: 500 },
            // ---- 5. immediately after a correct re-unlock, BEFORE re-opening the conversation: no old content re-appeared on its own. ----
            { action: "read", selector: "#chat-messages" },
            { action: "click", selector: "#conversations-list li:first-of-type button" },
            { action: "wait", ms: 1000 },
            // ---- 6. re-opened fresh through the new Runtime: the message is listed again but its plaintext is NOT auto-revealed. ----
            { action: "read", selector: "#chat-messages" },
            { action: "click", selector: "#chat-messages button" },
            { action: "wait", ms: 700 },
            { action: "click", selector: "#chat-messages button" },
            { action: "wait", ms: 700 },
            // ---- 7. explicitly revealing it again genuinely works -- this is a fresh reload, not leftover stale cache surviving the lock. ----
            { action: "read", selector: "#chat-messages" },
          ],
          fastTick,
        );
        const chatMessagesRightAfterUnlock = readAt(aliceReunlock, 4);
        expect(chatMessagesRightAfterUnlock, "no old-generation plaintext may reappear merely from unlocking, before the conversation is reloaded").not.toMatch(
          /secret plaintext content only Alice should ever see revealed/,
        );
        const chatMessagesAfterReopenBeforeReveal = readAt(aliceReunlock, 7);
        expect(chatMessagesAfterReopenBeforeReveal, "re-opened fresh -- message is listed but NOT auto-revealed").toMatch(/Show message/);
        expect(chatMessagesAfterReopenBeforeReveal).not.toMatch(/secret plaintext content only Alice should ever see revealed/);
        const chatMessagesAfterFreshReveal = readAt(aliceReunlock, 12);
        expect(chatMessagesAfterFreshReveal, "explicit re-reveal after a fresh unlock genuinely still works").toMatch(/secret plaintext content only Alice should ever see revealed/);
      } finally {
        await relay.close();
      }
    },
    120000,
  );
});
