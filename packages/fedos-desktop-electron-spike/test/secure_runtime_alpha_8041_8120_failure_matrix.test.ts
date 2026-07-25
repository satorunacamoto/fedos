import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Secure Runtime Alpha 8041-8120 (FedOS Desktop Beta User-Facing Product UI
 * Completion Arc) — Phase P failure matrix, covering this Arc's own new
 * `fedos-app:*` vocabulary. Reuses `AUTOTEST_MODE=acceptance` (calling this
 * file's own internal `handleApp*` functions directly) — an accepted,
 * lower-level regression-coverage technique per this codebase's own
 * established convention (see `secure_runtime_alpha_7321_7400_failure_matrix.test.ts`),
 * distinct from the Phase O headline test (which drives the real DOM).
 */

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;
const settingsControllerDistPath = `${repoRoot}/dist/desktop/settings/fedos_desktop_settings_controller.js`;

const CAN_RUN_REAL = existsSync(pkgWasmPath) && existsSync(electronBinPath) && existsSync(mainCjsPath) && existsSync(settingsControllerDistPath);
const realSuite = CAN_RUN_REAL ? describe : describe.skip;

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-8041-fm-${label}-`));
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

interface AcceptanceStep {
  readonly command: string;
  readonly result: Record<string, unknown>;
}
async function runAcceptance(dataDir: string, script: readonly { command: string; payload?: unknown }[], extraEnv: Record<string, string> = {}): Promise<{ output: string; steps: readonly AcceptanceStep[] }> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: { ...process.env, FEDOS_ELECTRON_BETA_DATA_DIR: dataDir, FEDOS_ELECTRON_BETA_AUTOTEST: "acceptance", FEDOS_BETA_ACCEPTANCE_SCRIPT: JSON.stringify(script), ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (c: Buffer) => outChunks.push(c));
  child.stderr?.on("data", (c: Buffer) => outChunks.push(c));
  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* gone */
    }
  }, 30000);
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  clearTimeout(timer);
  const output = Buffer.concat(outChunks).toString("utf8");
  const steps: AcceptanceStep[] = [];
  for (const line of output.split("\n")) {
    const marker = "FEDOS_ELECTRON_BETA_ACCEPTANCE_STEP:";
    if (!line.startsWith(marker)) continue;
    const rest = line.slice(marker.length);
    const firstColon = rest.indexOf(":");
    const secondColon = rest.indexOf(":", firstColon + 1);
    steps.push({ command: rest.slice(firstColon + 1, secondColon), result: JSON.parse(rest.slice(secondColon + 1)) as Record<string, unknown> });
  }
  return { output, steps };
}
function stepFor(run: { output: string; steps: readonly AcceptanceStep[] }, command: string): Record<string, unknown> {
  const step = run.steps.find((s) => s.command === command);
  expect(step, `${run.output}\n--- expected a "${command}" step ---`).toBeDefined();
  return step!.result;
}

realSuite("Alpha 8041-8120 -- failure matrix for the new fedos-app:* ordinary-page vocabulary", () => {
  it("1. no profile ever unlocked -- every fedos-app:* command genuinely rejects with 'unavailable', never a crash or silent success", async () => {
    const dir = makeTmpRoot("no-profile");
    const run = await runAcceptance(dir, [
      { command: "app-conversations-list" },
      { command: "app-devices-list" },
      { command: "app-safety-center-overview" },
      { command: "app-settings-load" },
    ]);
    expect(stepFor(run, "app-conversations-list").outcome, run.output).toBe("unavailable");
    expect(stepFor(run, "app-devices-list").outcome, run.output).toBe("unavailable");
    expect(stepFor(run, "app-safety-center-overview").outcome, run.output).toBe("unavailable");
    expect(stepFor(run, "app-settings-load").outcome, run.output).toBe("unavailable");
  }, 20000);

  it("2. wrong passphrase -- profile stays locked, every fedos-app:* command remains gated afterward", async () => {
    const dir = makeTmpRoot("wrong-pass");
    const create = await runAcceptance(dir, [{ command: "profile-create", payload: { label: "Alice", secret: "correct horse battery staple fm2 real" } }]);
    expect(stepFor(create, "profile-create").outcome, create.output).toBe("ok");
    const run = await runAcceptance(dir, [
      { command: "profile-unlock", payload: { secret: "definitely the wrong passphrase" } },
      { command: "app-conversations-list" },
    ]);
    expect(stepFor(run, "profile-unlock").outcome, run.output).not.toBe("ok");
    expect(stepFor(run, "app-conversations-list").outcome, run.output).toBe("unavailable");
  });

  it("3. malformed conversationId (oversized) is rejected with invalid-input before reaching the Shell", async () => {
    const dir = makeTmpRoot("oversized-id");
    const create = await runAcceptance(dir, [{ command: "profile-create", payload: { label: "Alice", secret: "correct horse battery staple fm3 real" } }]);
    expect(stepFor(create, "profile-create").outcome, create.output).toBe("ok");
    const run = await runAcceptance(dir, [
      { command: "profile-unlock", payload: { secret: "correct horse battery staple fm3 real" } },
      { command: "app-conversation-open", payload: { conversationId: "x".repeat(10000) } },
    ]);
    expect(stepFor(run, "app-conversation-open").outcome, run.output).toBe("invalid-input");
  });

  it("4. unknown conversationId -- getConversation fails closed with not-found, never a fabricated empty conversation", async () => {
    const dir = makeTmpRoot("unknown-id");
    const create = await runAcceptance(dir, [{ command: "profile-create", payload: { label: "Alice", secret: "correct horse battery staple fm4 real" } }]);
    expect(stepFor(create, "profile-create").outcome, create.output).toBe("ok");
    const run = await runAcceptance(dir, [
      { command: "profile-unlock", payload: { secret: "correct horse battery staple fm4 real" } },
      { command: "app-conversation-open", payload: { conversationId: "private-draft::direct::doesnotexist" } },
    ]);
    expect(stepFor(run, "app-conversation-open").outcome, run.output).toBe("not-found");
  });

  it("5. message send while no Relay is configured -- invitation creation fails closed (conversationInvitationEnabled requires a configured relay), never a fake 'sent'", async () => {
    const dir = makeTmpRoot("no-relay-invite");
    const create = await runAcceptance(dir, [{ command: "profile-create", payload: { label: "Alice", secret: "correct horse battery staple fm5 real" } }]);
    expect(stepFor(create, "profile-create").outcome, create.output).toBe("ok");
    const run = await runAcceptance(dir, [
      { command: "profile-unlock", payload: { secret: "correct horse battery staple fm5 real" } },
      { command: "acceptance-create-conversation-invitation", payload: { invitee: { authority: "nostr", publicIdentifier: "0".repeat(64) } } },
    ]);
    expect(stepFor(run, "acceptance-create-conversation-invitation").outcome, run.output).toBe("unavailable");
  });

  it("6. malformed Search query (empty string) is rejected locally before reaching the Shell", async () => {
    const dir = makeTmpRoot("empty-search");
    const create = await runAcceptance(dir, [{ command: "profile-create", payload: { label: "Alice", secret: "correct horse battery staple fm6 real" } }]);
    expect(stepFor(create, "profile-create").outcome, create.output).toBe("ok");
    const run = await runAcceptance(dir, [
      { command: "profile-unlock", payload: { secret: "correct horse battery staple fm6 real" } },
      { command: "acceptance-search", payload: { query: "" } },
    ]);
    expect(stepFor(run, "acceptance-search").outcome, run.output).toBe("invalid-input");
  });

  it("7. Archive restore against a missing/corrupt source file fails closed, never a fabricated restore", async () => {
    const dir = makeTmpRoot("bad-archive");
    // Archive (like invitation) is only enabled once a Relay is configured
    // (`secureRuntimeBundleConfig()`, unmodified) -- an unreachable relay is
    // fine here since this test never sends anything over it.
    await seedSettings(dir, ["ws://127.0.0.1:1"]);
    const create = await runAcceptance(dir, [{ command: "profile-create", payload: { label: "Alice", secret: "correct horse battery staple fm7 real" } }]);
    expect(stepFor(create, "profile-create").outcome, create.output).toBe("ok");
    const corruptPath = join(dir, "corrupt.fedosarchive");
    writeFileSync(corruptPath, "not a real archive container");
    const run = await runAcceptance(dir, [
      { command: "profile-unlock", payload: { secret: "correct horse battery staple fm7 real" } },
      { command: "acceptance-archive", payload: { operation: "inspect", sourcePath: corruptPath } },
    ]);
    const inspectResult = stepFor(run, "acceptance-archive");
    // Either shape is an honest "fails closed": a top-level `invalid-input`
    // (the malformed-container case, confirmed live) or an `ok`-wrapped
    // result whose OWN nested outcome is anything but `"inspected"`.
    if (inspectResult.outcome === "ok") {
      const value = inspectResult.value as { readonly result: { readonly outcome: string } };
      expect(value.result.outcome, run.output).not.toBe("inspected");
    } else {
      expect(inspectResult.outcome, run.output).not.toBe("ok");
    }
  });

  it("8. Identity Transition / Signed Deletion commands stay honestly 'unavailable' when no Relay is configured (Runtime not configured -- never fabricated as empty-but-ready)", async () => {
    const dir = makeTmpRoot("no-relay-identity-deletion");
    const create = await runAcceptance(dir, [{ command: "profile-create", payload: { label: "Alice", secret: "correct horse battery staple fm8 real" } }]);
    expect(stepFor(create, "profile-create").outcome, create.output).toBe("ok");
    const run = await runAcceptance(dir, [
      { command: "profile-unlock", payload: { secret: "correct horse battery staple fm8 real" } },
      { command: "app-identity-transition-list" },
      { command: "app-deletion-request-list-received" },
    ]);
    expect(stepFor(run, "app-identity-transition-list").outcome, run.output).toBe("unavailable");
    expect(stepFor(run, "app-deletion-request-list-received").outcome, run.output).toBe("unavailable");
  });

  it("9. device revoke with an oversized devicePublicKeyHex is rejected as invalid-input before reaching the Shell, never silently ignored", async () => {
    const dir = makeTmpRoot("bad-revoke");
    const create = await runAcceptance(dir, [{ command: "profile-create", payload: { label: "Alice", secret: "correct horse battery staple fm9 real" } }]);
    expect(stepFor(create, "profile-create").outcome, create.output).toBe("ok");
    const run = await runAcceptance(dir, [
      { command: "profile-unlock", payload: { secret: "correct horse battery staple fm9 real" } },
      { command: "app-device-revoke", payload: { deviceId: "device-1", devicePublicKeyHex: "a".repeat(10000) } },
    ]);
    expect(stepFor(run, "app-device-revoke").outcome, run.output).toBe("invalid-input");
  });

  it("10. corrupted settings.json fails closed -- even profile creation itself refuses to start rather than silently falling back to defaults (pre-existing startAssembly()/controller behavior, unmodified by this Arc)", async () => {
    const dir = makeTmpRoot("corrupt-settings");
    writeFileSync(join(dir, "settings.json"), "{ not valid json");
    const create = await runAcceptance(dir, [{ command: "profile-create", payload: { label: "Alice", secret: "correct horse battery staple fm10 real" } }]);
    expect(stepFor(create, "profile-create").outcome, create.output).not.toBe("ok");
  });

  it("11. five lock/unlock cycles -- each cycle genuinely re-locks and re-unlocks, conversations-list stays 'unavailable' while locked every time", async () => {
    const dir = makeTmpRoot("five-cycles");
    const secret = "correct horse battery staple fm11 real";
    const create = await runAcceptance(dir, [{ command: "profile-create", payload: { label: "Alice", secret } }]);
    expect(stepFor(create, "profile-create").outcome, create.output).toBe("ok");
    for (let i = 0; i < 5; i++) {
      const run = await runAcceptance(dir, [
        { command: "profile-unlock", payload: { secret } },
        { command: "app-conversations-list" },
        { command: "profile-lock" },
        { command: "app-conversations-list" },
      ]);
      const steps = run.steps.filter((s) => s.command === "app-conversations-list");
      expect(steps[0]!.result.outcome, `cycle ${i}: ${run.output}`).toBe("ok");
      expect(steps[1]!.result.outcome, `cycle ${i}: ${run.output}`).toBe("unavailable");
    }
  }, 30000);
});
