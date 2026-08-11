/**
 * Secure Runtime Alpha 4901-4980 ("Desktop Settings, Relay Configuration,
 * and User Preferences Arc") — Phase H acceptance suite.
 *
 * REAL RUNTIME, NO MOCKS (Phase H is explicit that mocked tests cannot
 * count): every test below drives the REAL file-backed settings stack —
 * `FileFedosSettingsPersistence` writing/reading a REAL JSON file in a REAL
 * temp directory, through the REAL codec/validator/authority/controller and
 * the REAL settings host bridge. "restart" is modeled the only honest way a
 * durable file can be — a brand-new persistence/controller instance opened
 * on the SAME on-disk file, proving the value survived process exit.
 *
 * The Electron adapter's own request/response translation
 * (`fedos_electron_settings_dispatch_translation.ts`) is unit-tested here
 * too (it has no Electron import, so it runs under plain Node/vitest); the
 * REAL packaged-Electron round trip is a separate, environment-gated concern
 * documented in the completion declaration.
 */

import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
// @ts-expect-error see above.
import { join, dirname } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";

import {
  defaultFedosSettingsDescriptorV1,
  withFedosSettings,
  FEDOS_SETTINGS_MAX_RELAY_COUNT,
  FEDOS_SETTINGS_MAX_AUTO_LOCK_TIMEOUT_MINUTES,
  type FedosSettingsDescriptorV1,
} from "../src/os/core/settings/fedos_settings_descriptor.js";
import {
  fedosSettingsValidationErrors,
  isWellFormedFedosSettingsDescriptorV1,
  isValidFedosRelayUrl,
} from "../src/os/core/settings/fedos_settings_validator.js";
import {
  encodeFedosSettingsDescriptorV1,
  decodeFedosSettingsDescriptorV1,
  fedosSettingsDescriptorsIdentical,
} from "../src/os/core/settings/fedos_settings_codec.js";
import {
  FileFedosSettingsPersistence,
  InMemoryFedosSettingsPersistence,
  FedosSettingsCorruptError,
} from "../src/os/core/settings/fedos_settings_persistence.js";
import { FedosSettingsAuthority } from "../src/os/core/settings/fedos_settings_authority.js";
import {
  FedosDesktopSettingsController,
  createFileBackedFedosDesktopSettingsController,
  fedosDesktopSettingsFilePath,
} from "../src/os/messenger/desktop/settings/fedos_desktop_settings_controller.js";
import { validateFedosDesktopSettingsHostCommand } from "../src/os/messenger/desktop/settings/fedos_desktop_settings_host_command.js";
import { createFedosDesktopSettingsHostBridge } from "../src/os/messenger/desktop/settings/fedos_desktop_settings_host_bridge.js";
import { FedosDesktopSettingsViewModel } from "../src/os/messenger/desktop/presentation/fedos_desktop_settings_view_model.js";
import { FedosDesktopSettingsRenderer } from "../src/os/messenger/desktop/renderer/fedos_desktop_settings_renderer.js";
import {
  fedosElectronSettingsValidateInvokeRequest,
  fedosElectronSettingsHandleInvoke,
} from "../packages/fedos-desktop-electron-spike/src/fedos_electron_settings_dispatch_translation.js";

const tempRoots: string[] = [];

function freshFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "fedos-settings-"));
  tempRoots.push(dir);
  return join(dir, "settings.json");
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();
    if (dir !== undefined && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
});

const RELAY_A = "wss://relay.example.com";
const RELAY_B = "wss://relay.two.example";

// ---------------------------------------------------------------------
// Phase B/C — descriptor, closed vocabulary, codec.
// ---------------------------------------------------------------------

describe("Phase B/C — descriptor + closed vocabulary", () => {
  it("the canonical default is well-formed and deep-frozen", () => {
    const def = defaultFedosSettingsDescriptorV1();
    expect(isWellFormedFedosSettingsDescriptorV1(def)).toBe(true);
    expect(Object.isFrozen(def)).toBe(true);
    expect(def.schemaVersion).toBe(1);
    expect(() => {
      // @ts-expect-error runtime immutability probe
      def.theme = "dark";
    }).toThrow();
  });

  it("rejects a free-form/unknown key (Phase C: no free-form key/value)", () => {
    const withExtra = { ...defaultFedosSettingsDescriptorV1(), customFlag: true } as unknown;
    expect(isWellFormedFedosSettingsDescriptorV1(withExtra)).toBe(false);
    expect(fedosSettingsValidationErrors(withExtra)).toContain("unknown-key");
  });

  it("rejects a value outside each closed vocabulary", () => {
    const base = defaultFedosSettingsDescriptorV1();
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, theme: "neon" })).toBe(false);
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, language: "fr" })).toBe(false);
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, windowLayout: "tiny" })).toBe(false);
  });

  it("relay URL validation accepts only bounded ws(s):// URLs", () => {
    expect(isValidFedosRelayUrl(RELAY_A)).toBe(true);
    expect(isValidFedosRelayUrl("ws://localhost:7777")).toBe(true);
    expect(isValidFedosRelayUrl("https://relay.example.com")).toBe(false);
    expect(isValidFedosRelayUrl("relay.example.com")).toBe(false);
    expect(isValidFedosRelayUrl("wss://has space.example")).toBe(false);
  });

  it("rejects a duplicate relay and an over-count relay list", () => {
    const base = defaultFedosSettingsDescriptorV1();
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, relays: [RELAY_A, RELAY_A] })).toBe(false);
    const tooMany = Array.from({ length: FEDOS_SETTINGS_MAX_RELAY_COUNT + 1 }, (_v, i) => `wss://relay-${i}.example`);
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, relays: tooMany })).toBe(false);
  });

  it("rejects a defaultRelay not present in the relay list, accepts one that is", () => {
    const base = defaultFedosSettingsDescriptorV1();
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, relays: [RELAY_A], defaultRelay: RELAY_B })).toBe(false);
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, relays: [RELAY_A], defaultRelay: RELAY_A })).toBe(true);
  });

  it("rejects an auto-lock timeout that is negative, non-integer, or above the ceiling", () => {
    const base = defaultFedosSettingsDescriptorV1();
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, autoLockTimeoutMinutes: -1 })).toBe(false);
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, autoLockTimeoutMinutes: 1.5 })).toBe(false);
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, autoLockTimeoutMinutes: FEDOS_SETTINGS_MAX_AUTO_LOCK_TIMEOUT_MINUTES + 1 })).toBe(false);
    expect(isWellFormedFedosSettingsDescriptorV1({ ...base, autoLockTimeoutMinutes: 0 })).toBe(true);
  });

  it("codec round-trips deterministically and fails closed on garbage", () => {
    const d = withFedosSettings(defaultFedosSettingsDescriptorV1(), { relays: [RELAY_A], defaultRelay: RELAY_A, theme: "dark" });
    const encoded = encodeFedosSettingsDescriptorV1(d);
    expect(encodeFedosSettingsDescriptorV1(decodeFedosSettingsDescriptorV1(encoded) as FedosSettingsDescriptorV1)).toBe(encoded);
    expect(decodeFedosSettingsDescriptorV1("not json")).toBeNull();
    expect(decodeFedosSettingsDescriptorV1('{"schemaVersion":1}')).toBeNull();
    expect(fedosSettingsDescriptorsIdentical(d, decodeFedosSettingsDescriptorV1(encoded) as FedosSettingsDescriptorV1)).toBe(true);
  });
});

// ---------------------------------------------------------------------
// Phase H — acceptance, real file-backed authority/controller.
// ---------------------------------------------------------------------

describe("Phase H — first load / save / restart / restore (REAL file)", () => {
  it("first load returns the default and persists it to a real file", () => {
    const file = freshFile();
    expect(existsSync(file)).toBe(false);
    const controller = createFileBackedFedosDesktopSettingsController(file);
    const loaded = controller.load();
    expect(loaded.outcome).toBe("ok");
    if (loaded.outcome !== "ok") throw new Error("unreachable");
    expect(loaded.value).toEqual(defaultFedosSettingsDescriptorV1());
    expect(existsSync(file)).toBe(true);
  });

  it("save then restart (fresh controller, same file) restores the exact value", () => {
    const file = freshFile();
    const first = createFileBackedFedosDesktopSettingsController(file);
    first.load();
    const desired = withFedosSettings(defaultFedosSettingsDescriptorV1(), {
      theme: "dark",
      language: "ja",
      relays: [RELAY_A, RELAY_B],
      defaultRelay: RELAY_B,
      notificationsEnabled: false,
      autoLockTimeoutMinutes: 45,
      windowLayout: "wide",
    });
    const saved = first.save(desired);
    expect(saved.outcome).toBe("ok");

    // "restart": a brand-new controller opened on the SAME on-disk file.
    const restarted = createFileBackedFedosDesktopSettingsController(file);
    const reloaded = restarted.load();
    expect(reloaded.outcome).toBe("ok");
    if (reloaded.outcome !== "ok") throw new Error("unreachable");
    expect(reloaded.value).toEqual(desired);
  });

  it("relay change / theme change / notification change each persist independently", () => {
    const file = freshFile();
    const c = createFileBackedFedosDesktopSettingsController(file);
    let current = (c.load() as { value: FedosSettingsDescriptorV1 }).value;

    current = (c.save(withFedosSettings(current, { relays: [RELAY_A], defaultRelay: RELAY_A })) as { value: FedosSettingsDescriptorV1 }).value;
    current = (c.save(withFedosSettings(current, { theme: "light" })) as { value: FedosSettingsDescriptorV1 }).value;
    current = (c.save(withFedosSettings(current, { notificationsEnabled: false })) as { value: FedosSettingsDescriptorV1 }).value;

    const reloaded = (createFileBackedFedosDesktopSettingsController(file).load() as { value: FedosSettingsDescriptorV1 }).value;
    expect(reloaded.relays).toEqual([RELAY_A]);
    expect(reloaded.defaultRelay).toBe(RELAY_A);
    expect(reloaded.theme).toBe("light");
    expect(reloaded.notificationsEnabled).toBe(false);
  });

  it("reset restores the default and persists it", () => {
    const file = freshFile();
    const c = createFileBackedFedosDesktopSettingsController(file);
    c.load();
    c.save(withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark", relays: [RELAY_A], defaultRelay: RELAY_A }));
    const reset = c.reset();
    expect(reset.outcome).toBe("ok");
    const reloaded = (createFileBackedFedosDesktopSettingsController(file).load() as { value: FedosSettingsDescriptorV1 }).value;
    expect(reloaded).toEqual(defaultFedosSettingsDescriptorV1());
  });
});

describe("Phase H — export / import round trip (REAL file)", () => {
  it("export reflects the durable value; import applies and persists a valid string", () => {
    const src = freshFile();
    const dst = freshFile();
    const source = createFileBackedFedosDesktopSettingsController(src);
    source.load();
    source.save(withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark", language: "ja", relays: [RELAY_A], defaultRelay: RELAY_A }));
    const exported = source.export();
    expect(exported.outcome).toBe("ok");
    if (exported.outcome !== "ok") throw new Error("unreachable");

    const target = createFileBackedFedosDesktopSettingsController(dst);
    target.load();
    const imported = target.import(exported.value);
    expect(imported.outcome).toBe("ok");
    const reloaded = (createFileBackedFedosDesktopSettingsController(dst).load() as { value: FedosSettingsDescriptorV1 }).value;
    expect(reloaded.theme).toBe("dark");
    expect(reloaded.language).toBe("ja");
    expect(reloaded.relays).toEqual([RELAY_A]);
  });

  it("import of a validation-failing string writes NOTHING (fail closed)", () => {
    const file = freshFile();
    const c = createFileBackedFedosDesktopSettingsController(file);
    c.load();
    const before = readFileSync(file, "utf8");
    const badDescriptor = JSON.stringify({ ...defaultFedosSettingsDescriptorV1(), theme: "neon" });
    const imported = c.import(badDescriptor);
    expect(imported.outcome).toBe("invalid");
    if (imported.outcome === "invalid") expect(imported.errors).toContain("theme");
    expect(readFileSync(file, "utf8")).toBe(before); // durable value untouched
  });

  it("import of an unknown-key string is rejected (Phase H: unknown key)", () => {
    const c = createFileBackedFedosDesktopSettingsController(freshFile());
    c.load();
    const withExtra = JSON.stringify({ ...defaultFedosSettingsDescriptorV1(), rogue: 1 });
    const imported = c.import(withExtra);
    expect(imported.outcome).toBe("invalid");
    if (imported.outcome === "invalid") expect(imported.errors).toContain("unknown-key");
  });

  it("import of a wrong schema version is rejected (Phase H: version mismatch)", () => {
    const c = createFileBackedFedosDesktopSettingsController(freshFile());
    c.load();
    const v2 = JSON.stringify({ ...defaultFedosSettingsDescriptorV1(), schemaVersion: 2 });
    const imported = c.import(v2);
    expect(imported.outcome).toBe("invalid");
    if (imported.outcome === "invalid") expect(imported.errors).toContain("schema-version");
  });

  it("import of non-JSON / tampered JSON fails closed", () => {
    const c = createFileBackedFedosDesktopSettingsController(freshFile());
    c.load();
    expect(c.import("}{not json").outcome).toBe("invalid");
    expect(c.import(42 as unknown).outcome).toBe("invalid");
  });
});

describe("Phase H — corrupted / tampered on-disk file fails closed", () => {
  it("a corrupt settings file makes load() return outcome 'corrupt', never a silent default", () => {
    const file = freshFile();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "this is not settings json", "utf8");
    const loaded = createFileBackedFedosDesktopSettingsController(file).load();
    expect(loaded.outcome).toBe("corrupt");
  });

  it("a tampered (out-of-vocabulary) field on disk makes load() return 'corrupt'", () => {
    const file = freshFile();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ ...defaultFedosSettingsDescriptorV1(), theme: "rainbow" }), "utf8");
    expect(createFileBackedFedosDesktopSettingsController(file).load().outcome).toBe("corrupt");
  });

  it("the raw persistence read() THROWS FedosSettingsCorruptError on a corrupt file", () => {
    const file = freshFile();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "{}", "utf8");
    expect(() => new FileFedosSettingsPersistence(file).read()).toThrow(FedosSettingsCorruptError);
  });

  it("export of a corrupt store fails closed (never exports a fabricated value)", () => {
    const file = freshFile();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "garbage", "utf8");
    expect(createFileBackedFedosDesktopSettingsController(file).export().outcome).toBe("corrupt");
  });
});

describe("Phase H — validation error surface + in-memory parity", () => {
  it("save of an invalid candidate returns coded errors and writes nothing", () => {
    const persistence = new InMemoryFedosSettingsPersistence();
    const authority = new FedosSettingsAuthority(persistence);
    authority.load();
    const result = authority.save({ ...defaultFedosSettingsDescriptorV1(), autoLockTimeoutMinutes: -5 });
    expect(result.outcome).toBe("invalid");
    if (result.outcome === "invalid") expect(result.errors).toContain("auto-lock-timeout");
    // In-memory value unchanged (still the default persisted at load()).
    expect((authority.load() as { value: FedosSettingsDescriptorV1 }).value).toEqual(defaultFedosSettingsDescriptorV1());
  });

  it("plantCorruptForTest makes in-memory read fail closed like the file backend", () => {
    const persistence = new InMemoryFedosSettingsPersistence();
    persistence.plantCorruptForTest("not a descriptor");
    expect(() => persistence.read()).toThrow(FedosSettingsCorruptError);
    expect(new FedosSettingsAuthority(persistence).load().outcome).toBe("corrupt");
  });
});

// ---------------------------------------------------------------------
// Phase F — closed host command vocabulary + bridge.
// ---------------------------------------------------------------------

describe("Phase F — closed settings host command vocabulary", () => {
  it("accepts exactly the five settings commands, rejects everything else", () => {
    expect(validateFedosDesktopSettingsHostCommand({ type: "settings-load" })?.type).toBe("settings-load");
    expect(validateFedosDesktopSettingsHostCommand({ type: "settings-reset" })?.type).toBe("settings-reset");
    expect(validateFedosDesktopSettingsHostCommand({ type: "settings-export" })?.type).toBe("settings-export");
    expect(validateFedosDesktopSettingsHostCommand({ type: "settings-save", descriptor: {} })?.type).toBe("settings-save");
    expect(validateFedosDesktopSettingsHostCommand({ type: "settings-import", serialized: "{}" })?.type).toBe("settings-import");

    expect(validateFedosDesktopSettingsHostCommand({ type: "settings-delete" })).toBeNull();
    expect(validateFedosDesktopSettingsHostCommand({ type: "runtime-status" })).toBeNull();
    expect(validateFedosDesktopSettingsHostCommand({ type: "settings-save" })).toBeNull(); // missing descriptor
    expect(validateFedosDesktopSettingsHostCommand({ type: "settings-import" })).toBeNull(); // missing serialized
    expect(validateFedosDesktopSettingsHostCommand(null)).toBeNull();
    expect(validateFedosDesktopSettingsHostCommand("settings-load")).toBeNull();
  });

  it("rejects an oversized import string before it can reach the parser", () => {
    const huge = "x".repeat(64 * 1024 + 1);
    expect(validateFedosDesktopSettingsHostCommand({ type: "settings-import", serialized: huge })).toBeNull();
  });

  it("the bridge dispatches the closed set against a real file controller and fails closed otherwise", async () => {
    const file = freshFile();
    const bridge = createFedosDesktopSettingsHostBridge(createFileBackedFedosDesktopSettingsController(file));

    const load = await bridge.dispatch({ type: "settings-load", requestId: "r1" });
    expect(load).toMatchObject({ outcome: "ok", requestId: "r1" });

    const save = await bridge.dispatch({
      type: "settings-save",
      descriptor: withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark" }),
    });
    expect(save).toMatchObject({ outcome: "ok" });

    const invalidSave = await bridge.dispatch({ type: "settings-save", descriptor: { ...defaultFedosSettingsDescriptorV1(), theme: "neon" } });
    expect(invalidSave).toMatchObject({ outcome: "error", code: "invalid-input" });

    const unknown = await bridge.dispatch({ type: "settings-nope" });
    expect(unknown).toMatchObject({ outcome: "error", code: "unknown-command" });

    // Round-trips durably through the bridge alone.
    const exported = (await bridge.dispatch({ type: "settings-export" })) as { outcome: string; value: string };
    expect(exported.outcome).toBe("ok");
    expect(JSON.parse(exported.value).theme).toBe("dark");
  });
});

// ---------------------------------------------------------------------
// Phase E — ViewModel + Renderer projection.
// ---------------------------------------------------------------------

describe("Phase E — ViewModel + Renderer (eight closed screens)", () => {
  it("the ViewModel loads through the controller and the renderer projects every screen group", () => {
    const controller = createFileBackedFedosDesktopSettingsController(freshFile());
    const vm = new FedosDesktopSettingsViewModel(controller);
    const renderer = new FedosDesktopSettingsRenderer(vm);

    expect(renderer.render().kind).toBe("idle");
    vm.load();
    vm.save(withFedosSettings(defaultFedosSettingsDescriptorV1(), { theme: "dark", relays: [RELAY_A], defaultRelay: RELAY_A }));
    vm.setActiveScreen("relay");

    const model = renderer.render();
    expect(model.kind).toBe("content");
    if (model.kind !== "content") throw new Error("unreachable");
    expect(model.content.activeScreen).toBe("relay");
    expect(model.content.screens).toHaveLength(8);
    expect(model.content.appearance.theme).toBe("dark");
    expect(model.content.relay.relays).toEqual([RELAY_A]);
    expect(model.content.relay.count).toBe(1);
    expect(model.content.about.settingsSchemaVersion).toBe(1);
  });

  it("an invalid save surfaces as an error state carrying the field codes", () => {
    const vm = new FedosDesktopSettingsViewModel(new FedosDesktopSettingsController(new InMemoryFedosSettingsPersistence()));
    vm.load();
    const state = vm.save({ ...defaultFedosSettingsDescriptorV1(), windowLayout: "huge" });
    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.outcome).toBe("invalid");
      expect(state.reason).toContain("window-layout");
    }
  });
});

// ---------------------------------------------------------------------
// Phase G — Electron dispatch translation (no Electron import; runs here).
// ---------------------------------------------------------------------

describe("Phase G — Electron settings dispatch translation", () => {
  it("validates the closed {op:'dispatch'} request and forwards to the bridge", async () => {
    const bridge = createFedosDesktopSettingsHostBridge(createFileBackedFedosDesktopSettingsController(freshFile()));
    const ok = (await fedosElectronSettingsHandleInvoke(bridge, { op: "dispatch", command: { type: "settings-load" } })) as { outcome: string };
    expect(ok.outcome).toBe("ok");
  });

  it("fails closed (unavailable) with no bridge, (invalid-input) on a malformed request", async () => {
    expect(fedosElectronSettingsValidateInvokeRequest({ op: "render" })).toBeNull();
    expect(fedosElectronSettingsValidateInvokeRequest(null)).toBeNull();
    const noBridge = (await fedosElectronSettingsHandleInvoke(undefined, { op: "dispatch", command: {} })) as { code: string };
    expect(noBridge.code).toBe("unavailable");
    const bridge = createFedosDesktopSettingsHostBridge(createFileBackedFedosDesktopSettingsController(freshFile()));
    const malformed = (await fedosElectronSettingsHandleInvoke(bridge, { op: "not-dispatch" })) as { code: string };
    expect(malformed.code).toBe("invalid-input");
  });
});

// ---------------------------------------------------------------------
// Phase D — controller path helper.
// ---------------------------------------------------------------------

describe("Phase D — settings file path derivation", () => {
  it("derives a deterministic settings.json leaf under an absolute root, rejects a relative root", () => {
    // A leading-slash root is absolute under both the win32 and posix path
    // implementations, so this is platform-neutral; the assertion uses the
    // same `join` the helper uses, so the separator matches on any OS.
    const root = "/fedos/profile";
    expect(fedosDesktopSettingsFilePath(root)).toBe(join(root, "settings.json"));
    expect(fedosDesktopSettingsFilePath("relative/dir")).toBeNull();
    expect(fedosDesktopSettingsFilePath("")).toBeNull();
  });
});
