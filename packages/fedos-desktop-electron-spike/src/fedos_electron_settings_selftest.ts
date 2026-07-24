/**
 * Secure Runtime Alpha 4901-4980 — settings self-test page script (Phase G).
 *
 * Runs inside the loaded page's isolated Chromium context (NOT the preload/
 * Node context) — has NO import of any kind. Calls the ONE exposed
 * `window.fedosSettings.invoke()` API with a small, fixed sequence of real
 * settings commands and logs each JSON result via `console.log`, prefixed
 * with a marker Main forwards to stdout (test-support only). A TRANSPORT
 * proof harness for a real acceptance run — every response is already
 * secret-free, closed `FedosDesktopHostResponse` JSON.
 *
 * Plain script (not a module): TypeScript emits un-wrapped global-scope JS,
 * loaded via a plain `<script src>` tag, no bundler.
 */

const SETTINGS_MARKER = "FEDOS_ELECTRON_SETTINGS_TEST:";

function logSettingsStep(step: string, result: unknown): void {
  console.log(`${SETTINGS_MARKER}${JSON.stringify({ step, result })}`);
}

async function runSettingsSelfTest(): Promise<void> {
  const loaded = await window.fedosSettings.invoke({ op: "dispatch", command: { type: "settings-load", requestId: "selftest-load" } });
  logSettingsStep("load", loaded);

  const themeSave = await window.fedosSettings.invoke({
    op: "dispatch",
    command: {
      type: "settings-save",
      requestId: "selftest-save",
      descriptor: {
        schemaVersion: 1,
        theme: "dark",
        language: "ja",
        relays: ["wss://relay.example.com"],
        defaultRelay: "wss://relay.example.com",
        notificationsEnabled: false,
        backgroundSyncEnabled: true,
        archiveDirectory: "",
        autoStart: false,
        autoLockTimeoutMinutes: 30,
        windowLayout: "compact",
      },
    },
  });
  logSettingsStep("save", themeSave);

  const exported = await window.fedosSettings.invoke({ op: "dispatch", command: { type: "settings-export", requestId: "selftest-export" } });
  logSettingsStep("export", exported);

  const unknownCommand = await window.fedosSettings.invoke({ op: "dispatch", command: { type: "not-a-real-command" } });
  logSettingsStep("unknown-command", unknownCommand);

  const reset = await window.fedosSettings.invoke({ op: "dispatch", command: { type: "settings-reset", requestId: "selftest-reset" } });
  logSettingsStep("reset", reset);

  console.log(`${SETTINGS_MARKER}done`);
}

void runSettingsSelfTest();
