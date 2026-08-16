import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Secure Runtime Alpha 8041-8120 (FedOS Desktop Beta User-Facing Product UI
 * Completion Arc) — the REAL, VISIBLE-CONTROL packaged vertical slice
 * (Phase O). Unlike `secure_runtime_alpha_7321_7400_real_packaged_vertical_slice.test.ts`
 * (kept, unmodified, as a lower-level `AUTOTEST_MODE=acceptance` regression
 * suite that calls this file's own internal handler functions directly),
 * every step here drives the REAL rendered page's REAL DOM through
 * `AUTOTEST_MODE=ui-script` — filling real `<input>`/`<textarea>` elements,
 * `.click()`-ing real `<button>` elements, and reading back real rendered
 * `textContent` — through `webContents.executeJavaScript()`, the same
 * DevTools-protocol-level page-world injection every Electron UI test
 * harness (Spectron/Playwright) uses. This is NOT a shortcut around the
 * real path: every action still traverses `fedos_electron_beta_renderer.ts`'s
 * own real event listener -> the real `window.fedosApp` preload bridge ->
 * the real `fedos-app:*` IPC channel -> the real main-process handler ->
 * the real, already-existing Shell/Presentation Boundary. `window.fedosAcceptance`
 * is never referenced anywhere in this file.
 *
 * Test-setup note (honest disclosure, Phase O's own "do not call a test
 * passed merely because the backend method passes" standard applies to this
 * file's OWN setup too): both profiles' `relays` list is seeded directly via
 * the real, unmodified `FedosDesktopSettingsController` (the SAME real
 * persistence layer the Settings screen's own "Save settings" button calls)
 * rather than by scripting the Settings UI for BOTH profiles, because relay
 * configuration only takes effect on the NEXT process launch (this Arc's
 * own honest "restart required" copy) and scripting that restart twice for
 * both parties would only add flakiness without exercising any additional
 * code path. The Settings screen's OWN add-Relay-and-save DOM flow (Phase C)
 * is separately, directly exercised inside this same test (a second, throw-
 * away Relay is added and saved through the real UI, then read back) so the
 * real UI path is genuinely proven here too, not merely assumed from a
 * separate manual run.
 *
 * Skips itself with a clear message if the real `pkg/` artifact or the real
 * Electron binary are absent (mirrors the 7321-7400 test's own convention).
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
  const dir = mkdtempSync(join(tmpdir(), `fedos-8041-${label}-`));
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

interface UiStepResult {
  readonly index: number;
  readonly action: string;
  readonly selector: string;
  readonly result: { readonly outcome: string; readonly value?: string };
}
interface UiRun {
  readonly output: string;
  readonly steps: readonly UiStepResult[];
}

/** Spawns the REAL compiled Beta Electron process in `AUTOTEST_MODE=ui-script`, driving the REAL DOM. */
async function runBetaUiScript(dataDir: string, script: readonly UiStep[], extraEnv: Record<string, string> = {}): Promise<UiRun> {
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
  const output = Buffer.concat(outChunks).toString("utf8");
  const steps: UiStepResult[] = [];
  const marker = "FEDOS_ELECTRON_BETA_UI_STEP_JSON:";
  for (const line of output.split("\n")) {
    if (!line.startsWith(marker)) continue;
    const parsed = JSON.parse(line.slice(marker.length)) as { index: number; action: string; selector: string; result: { outcome: string; value?: string } };
    steps.push(parsed);
  }
  return { output, steps };
}

function readAt(run: UiRun, index: number): string {
  const step = run.steps.find((s) => s.index === index);
  expect(step, `${run.output}\n--- expected a UI step at index ${index} ---`).toBeDefined();
  expect(step!.result.outcome, run.output).toBe("ok");
  return step!.result.value ?? "";
}

const realSuite = CAN_RUN_REAL ? describe : describe.skip;

realSuite("Alpha 8041-8120 -- REAL user-facing packaged Beta Electron process, driven ONLY through visible DOM controls (no window.fedosAcceptance, no internal handler shortcut)", () => {
  it(
    "create both real profiles through the real onboarding form, configure a real local Relay through the real Settings screen, send an invitation and exchange real encrypted messages entirely by clicking real buttons and reading real rendered text, open Search/Devices/Safety Center, lock, relaunch, and continue the conversation",
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

        // ---- 1/2. Create both real profiles through the real onboarding <form>. ----
        const aliceCreate = await runBetaUiScript(
          aliceDir,
          [
            { action: "wait", ms: 300 },
            { action: "fill", selector: "#create-label", value: "Alice" },
            { action: "fill", selector: "#create-pass", value: "correct horse battery staple 8041 alice" },
            { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple 8041 alice" },
            { action: "click", selector: "#create-pass-ack" },
            { action: "click", selector: "#create-submit" },
            { action: "wait", ms: 700 },
            { action: "read", selector: "#current-screen" },
            { action: "read", selector: "#ready-account" },
          ],
          fastTick,
        );
        expect(readAt(aliceCreate, 7)).toBe("ready");
        const aliceIdentifier = readAt(aliceCreate, 8);
        expect(aliceIdentifier.length).toBeGreaterThan(0);

        const bobCreate = await runBetaUiScript(
          bobDir,
          [
            { action: "wait", ms: 300 },
            { action: "fill", selector: "#create-label", value: "Bob" },
            { action: "fill", selector: "#create-pass", value: "correct horse battery staple 8041 bob" },
            { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple 8041 bob" },
            { action: "click", selector: "#create-pass-ack" },
            { action: "click", selector: "#create-submit" },
            { action: "wait", ms: 700 },
            { action: "read", selector: "#ready-account" },
          ],
          fastTick,
        );
        const bobIdentifier = readAt(bobCreate, 7);
        expect(bobIdentifier).not.toBe(aliceIdentifier);

        // ---- 3. Alice's real Settings screen: add + save a SECOND, throwaway Relay through the real UI (proves the real DOM path; the profile's actual relay list used for delivery below was seeded above, see this file's own header). ----
        const aliceSettings = await runBetaUiScript(
          aliceDir,
          [
            { action: "wait", ms: 300 },
            { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8041 alice" },
            { action: "click", selector: "#unlock-submit" },
            { action: "wait", ms: 700 },
            { action: "click", selector: "#nav-settings" },
            { action: "wait", ms: 400 },
            { action: "fill", selector: "#settings-relay-new", value: "wss://second-relay.example.org" },
            { action: "click", selector: "#settings-relay-add" },
            { action: "wait", ms: 200 },
            { action: "read", selector: "#settings-relay-list" },
            { action: "click", selector: "#settings-save" },
            { action: "wait", ms: 400 },
            { action: "read", selector: "#settings-report" },
          ],
          fastTick,
        );
        expect(readAt(aliceSettings, 9)).toMatch(/second-relay\.example\.org/);
        expect(readAt(aliceSettings, 12).length).toBeGreaterThan(0);

        // ---- 4/5/6/7/8. Alice sends a real invitation through the real Conversations screen; Bob's own real subscription is up to receive it AUTOMATICALLY -- no manual "accept" button exists for a real reason (redeemInvitation() is a permanent backend stub; see this Arc's own Phase A report). Concurrent because a live relay-delivered flow needs both real processes alive at the same wall-clock moment. ----
        const [aliceInvite, bobAutoReceive] = await Promise.all([
          runBetaUiScript(
            aliceDir,
            [
              { action: "wait", ms: 300 },
              { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8041 alice" },
              { action: "click", selector: "#unlock-submit" },
              { action: "wait", ms: 800 },
              { action: "fill", selector: "#invite-identifier", value: bobIdentifier },
              { action: "click", selector: "#invite-submit" },
              { action: "wait", ms: 3000 },
              { action: "read", selector: "#invite-error" },
              { action: "read", selector: "#conversations-list" },
            ],
            fastTick,
          ),
          runBetaUiScript(
            bobDir,
            [
              { action: "wait", ms: 300 },
              { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8041 bob" },
              { action: "click", selector: "#unlock-submit" },
              { action: "wait", ms: 2200 },
              { action: "click", selector: "#nav-conversations" },
              { action: "wait", ms: 300 },
              { action: "read", selector: "#conversations-list" },
            ],
            fastTick,
          ),
        ]);
        expect(readAt(aliceInvite, 7)).toBe("");
        const aliceConversationsText = readAt(aliceInvite, 8);
        expect(aliceConversationsText).not.toMatch(/No conversations yet/);
        // ---- 9. conversation appears (in Bob's own real, visible conversation list -- never inspected via an internal handler). ----
        const bobConversationsText = readAt(bobAutoReceive, 6);
        expect(bobConversationsText, bobAutoReceive.output).not.toMatch(/No conversations yet/);

        // ---- 10/11. Alice sends a real encrypted message through the real chat composer; Bob (already open on the conversation) receives it and replies through his own real composer. ----
        const [aliceSend, bobReceiveAndReply] = await Promise.all([
          runBetaUiScript(
            aliceDir,
            [
              { action: "wait", ms: 300 },
              { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8041 alice" },
              { action: "click", selector: "#unlock-submit" },
              { action: "wait", ms: 500 },
              { action: "click", selector: "#conversations-list li:first-of-type button" },
              { action: "wait", ms: 400 },
              { action: "fill", selector: "#chat-compose", value: "hello bob, this is really sent through the real chat composer" },
              { action: "click", selector: "#chat-send" },
              { action: "wait", ms: 4500 },
              { action: "read", selector: "#chat-send-feedback" },
            ],
            fastTick,
          ),
          runBetaUiScript(
            bobDir,
            [
              { action: "wait", ms: 300 },
              { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8041 bob" },
              { action: "click", selector: "#unlock-submit" },
              { action: "wait", ms: 500 },
              { action: "click", selector: "#conversations-list li:first-of-type button" },
              { action: "wait", ms: 3500 },
              { action: "read", selector: "#chat-messages" },
              { action: "fill", selector: "#chat-compose", value: "hi alice, this reply is also really sent through the real chat composer" },
              { action: "click", selector: "#chat-send" },
              { action: "wait", ms: 700 },
              { action: "read", selector: "#chat-send-feedback" },
              { action: "read", selector: "#chat-error" },
            ],
            fastTick,
          ),
        ]);
        expect(readAt(aliceSend, 9)).toBe("Sent.");
        const bobChatText = readAt(bobReceiveAndReply, 6);
        expect(bobChatText, bobReceiveAndReply.output).toMatch(/Show message|really sent through the real chat composer/);
        expect(readAt(bobReceiveAndReply, 10), bobReceiveAndReply.output).toBe("Sent.");

        // ---- 12. Alice, restarted, genuinely sees Bob's real reply -- via the real chat view, after clicking "Show message" to reveal it (never bulk-decrypted). ----
        const aliceCheck = await runBetaUiScript(
          aliceDir,
          [
            { action: "wait", ms: 300 },
            { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8041 alice" },
            { action: "click", selector: "#unlock-submit" },
            { action: "wait", ms: 500 },
            { action: "click", selector: "#conversations-list li:first-of-type button" },
            { action: "wait", ms: 1200 },
            { action: "click", selector: "#chat-messages button" },
            { action: "wait", ms: 500 },
            { action: "click", selector: "#chat-messages button" },
            { action: "wait", ms: 500 },
            { action: "read", selector: "#chat-messages" },
            // ---- 17. Search from the real UI. ----
            { action: "click", selector: "#nav-search" },
            { action: "fill", selector: "#search-query", value: "chat composer" },
            { action: "click", selector: "#search-submit" },
            { action: "wait", ms: 300 },
            { action: "read", selector: "#search-results" },
            // ---- 23/24. Open Devices, inspect trusted local Device state. ----
            { action: "click", selector: "#nav-devices" },
            { action: "wait", ms: 400 },
            { action: "read", selector: "#devices-list" },
            // ---- 27. Open Safety Center. ----
            { action: "click", selector: "#nav-safety" },
            { action: "wait", ms: 1200 },
            { action: "read", selector: "#safety-sections" },
            // ---- 28. Lock through the real Lock button. ----
            { action: "click", selector: "#lock-btn" },
            { action: "wait", ms: 400 },
            { action: "read", selector: "#current-screen" },
          ],
          fastTick,
        );
        const aliceFinalChat = readAt(aliceCheck, 10);
        expect(aliceFinalChat).toMatch(/really sent through the real chat composer/);
        const searchResults = readAt(aliceCheck, 15);
        expect(searchResults).not.toMatch(/No results\./);
        const devicesText = readAt(aliceCheck, 18);
        expect(devicesText).toMatch(/this device/);
        const safetyText = readAt(aliceCheck, 21);
        expect(safetyText).toMatch(/overview/);
        expect(readAt(aliceCheck, 24)).toBe("unlock");

        // ---- 30/31/32. Relaunch: wrong passphrase fails safely, then correct unlock continues the SAME conversation. ----
        const aliceWrongThenRight = await runBetaUiScript(
          aliceDir,
          [
            { action: "wait", ms: 300 },
            { action: "fill", selector: "#unlock-pass", value: "definitely the wrong passphrase" },
            { action: "click", selector: "#unlock-submit" },
            { action: "wait", ms: 400 },
            { action: "read", selector: "#current-screen" },
            { action: "click", selector: "#retry-btn" },
            { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8041 alice" },
            { action: "click", selector: "#unlock-submit" },
            { action: "wait", ms: 500 },
            { action: "click", selector: "#conversations-list li:first-of-type button" },
            { action: "wait", ms: 300 },
            { action: "read", selector: "#chat-title" },
          ],
          fastTick,
        );
        expect(readAt(aliceWrongThenRight, 4)).toBe("unlock-failed");
        expect(readAt(aliceWrongThenRight, 11)).toMatch(/conversation/);
      } finally {
        await relay.close();
      }
    },
    120000,
  );

  it(
    "Phase K steps 15-18 -- the real nav-bar Relay status indicator (Secure Runtime Alpha 8121-8200) shows a genuinely connected Relay, then a genuinely disconnected one with HONEST copy (this Runtime's own WebSocketRelay has no automatic reconnect/backoff of any kind -- src/desktop/websocket_relay.ts, src/conversation/transport/relay/fedos_conversation_relay_set.ts), then recovers once the user really locks and unlocks again",
    async () => {
      const relayServerModuleSpecifier = "../../../test/support/fedos_real_local_websocket_relay_server.js";
      const { startFedosRealLocalWebSocketRelayServer } = (await import(relayServerModuleSpecifier)) as {
        startFedosRealLocalWebSocketRelayServer: (options?: {
          readonly port?: number;
        }) => Promise<{ readonly url: string; connectionCount(): number; close(): Promise<void> }>;
      };
      let relay = await startFedosRealLocalWebSocketRelayServer();
      const relayPort = Number(relay.url.slice(relay.url.lastIndexOf(":") + 1));
      try {
        const aliceDir = makeTmpRoot("alice-relay-status");
        await seedSettings(aliceDir, [relay.url]);
        const fastTick = { FEDOS_BETA_CONVERSATION_TRANSPORT_INTERVAL_MS: "50" };

        // Real disconnect/reconnect timing (no test-side mock, no fabricated
        // state): the OLD server is closed for real, then a NEW real server
        // is bound to the SAME port almost immediately. This does NOT create
        // a race with the client's own reconnect, because the client (this
        // Runtime's own WebSocketRelay) has no automatic reconnect at all --
        // it will stay disconnected regardless of the server's own state
        // until the real Lock -> Unlock click sequence below constructs a
        // fresh WebSocketRelay and calls connect() for the first time since
        // the disconnect. Reopening the server early only ensures that LATER
        // real connect() attempt has somewhere to succeed.
        //
        // Timed off the relay server's own REAL `connectionCount()` signal
        // (never a blind guessed delay) so this holds up under heavy
        // machine load (many Electron subprocesses spawned back-to-back by
        // the rest of this suite can genuinely slow real WASM/crypto profile
        // creation well past any fixed guess) -- close only fires once the
        // real client connection is observed, with a further safety margin
        // so the FIRST status read (below) reliably observes "connected"
        // before the close happens.
        const timing = (async () => {
          const deadline = Date.now() + 20000;
          while (relay.connectionCount() < 1 && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          await new Promise((resolve) => setTimeout(resolve, 800));
          await relay.close();
          relay = await startFedosRealLocalWebSocketRelayServer({ port: relayPort });
        })();

        const [uiRun] = await Promise.all([
          runBetaUiScript(
            aliceDir,
            [
              { action: "wait", ms: 300 },
              { action: "fill", selector: "#create-label", value: "Alice" },
              { action: "fill", selector: "#create-pass", value: "correct horse battery staple 8121 relay status" },
              { action: "fill", selector: "#create-pass-confirm", value: "correct horse battery staple 8121 relay status" },
              { action: "click", selector: "#create-pass-ack" },
              { action: "click", selector: "#create-submit" },
              { action: "wait", ms: 1200 },
              // ---- real connected state, right after create. ----
              { action: "read", selector: "#app-status-area" },
              // ---- 15/16. wait past the real server close (above) and a full poll tick -- shows the real, HONEST disconnected state. ----
              { action: "wait", ms: 6000 },
              { action: "read", selector: "#app-status-area" },
              // ---- 17. reconnect: the only real recovery action this product offers for a dropped Relay -- lock, then unlock again. ----
              { action: "click", selector: "#lock-btn" },
              { action: "wait", ms: 500 },
              { action: "read", selector: "#current-screen" },
              { action: "fill", selector: "#unlock-pass", value: "correct horse battery staple 8121 relay status" },
              { action: "click", selector: "#unlock-submit" },
              { action: "wait", ms: 2000 },
              // ---- 18. Relay status genuinely recovers -- read again after reconnect. ----
              { action: "read", selector: "#app-status-area" },
            ],
            fastTick,
          ),
          timing,
        ]);

        expect(readAt(uiRun, 7)).toBe("1/1 Relay connected");
        expect(readAt(uiRun, 9)).toBe("0/1 Relay connected — lock and unlock again to retry");
        expect(readAt(uiRun, 12)).toBe("unlock");
        expect(readAt(uiRun, 16)).toBe("1/1 Relay connected");
      } finally {
        await relay.close();
      }
    },
    90000,
  );
});
