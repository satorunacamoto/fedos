/**
 * Secure Runtime Alpha 3941-4020 — Phase N: structural guards.
 *
 * Source-inspection tests (no runtime construction) verifying the
 * layering and secret-isolation rules this Arc's own Absolute
 * Prohibitions require, against REAL, currently-checked-out source in
 * this worktree.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error see above.
import screenSource from "../src/desktop/presentation/device_management/fedos_device_management_screen.ts?raw";
// @ts-expect-error see above.
import navigationStateSource from "../src/desktop/presentation/device_management/fedos_device_management_navigation_state.ts?raw";
// @ts-expect-error see above.
import presentationLimitsSource from "../src/desktop/presentation/device_management/fedos_device_management_presentation_limits.ts?raw";
// @ts-expect-error see above.
import screenModelSource from "../src/desktop/presentation/device_management/fedos_device_management_screen_model.ts?raw";
// @ts-expect-error see above.
import controllerSource from "../src/desktop/presentation/device_management/fedos_device_management_controller.ts?raw";
// @ts-expect-error see above.
import rendererSource from "../src/desktop/renderer/device_management/fedos_device_management_renderer.ts?raw";
// @ts-expect-error see above.
import actionDescriptorSource from "../src/desktop/renderer/device_management/fedos_device_management_action_descriptor.ts?raw";

const PRESENTATION_LAYER_SOURCES: readonly string[] = [screenSource, navigationStateSource, presentationLimitsSource, screenModelSource, controllerSource];
const RENDERER_LAYER_SOURCES: readonly string[] = [rendererSource, actionDescriptorSource];
const ALL_NEW_SOURCES: readonly string[] = [...PRESENTATION_LAYER_SOURCES, ...RENDERER_LAYER_SOURCES];

function gitGrepFiles(pattern: string, pathspec: string): string[] {
  try {
    const output = execFileSync("git", ["grep", "-lE", pattern, "--", pathspec], { encoding: "utf8" }) as string;
    return output.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return [];
    throw error;
  }
}

const FORBIDDEN_DOMAIN_CLASS_NAMES =
  /\b(AppendOnlyFedosDevice\w+|InMemoryFedosDevice\w+|FedosDeviceSyncScheduler\b|FedosDeviceRegistryPersistence\b|PersistedFedosDeviceTrustAuthority\b|FedosDeviceRelaySync\w*Coordinator\b|FedosDeviceTransferCoordinator\b|FedosDeviceSyncImportCoordinator\b|FedosSyncState\b|FedosDeviceTrustRuntime\b)/;

describe("Secure Runtime Alpha 3941-4020 -- Phase N: layering guards", () => {
  it("1. the controller (presentation layer) imports the Shell/Runtime NOWHERE -- only the existing ViewModels and the presentation boundary type", () => {
    expect(controllerSource).not.toMatch(/from\s+["'].*\/shell\/fedos_desktop_application_shell\.js["']/);
    expect(controllerSource).not.toMatch(/from\s+["'].*\/runtime\/fedos_desktop_runtime\.js["']/);
    expect(controllerSource).not.toMatch(FORBIDDEN_DOMAIN_CLASS_NAMES);
  });

  it("2. no presentation-layer file under device_management/ imports a Device Registry/Scheduler/Sync Journal/Relay/persistence/crypto class", () => {
    for (const source of PRESENTATION_LAYER_SOURCES) {
      expect(source).not.toMatch(FORBIDDEN_DOMAIN_CLASS_NAMES);
      expect(source).not.toMatch(/MasterSeedAuthority|EncryptionAuthority|DecryptionAuthority|SigningAuthority/);
    }
  });

  it("3. the renderer imports ONLY the controller/screen types + the shared render-model helpers -- never the Shell, Runtime, or a Device Registry/Scheduler/Persistence/crypto class", () => {
    expect(rendererSource).not.toMatch(/from\s+["'].*\/shell\//);
    expect(rendererSource).not.toMatch(/from\s+["'].*\/runtime\/fedos_desktop_runtime\.js["']/);
    for (const source of RENDERER_LAYER_SOURCES) {
      expect(source).not.toMatch(FORBIDDEN_DOMAIN_CLASS_NAMES);
      expect(source).not.toMatch(/MasterSeedAuthority|EncryptionAuthority|DecryptionAuthority|SigningAuthority/);
    }
  });

  it("4. the renderer calls no ViewModel/controller MUTATING action method -- read-only getters only (refresh/start/stop/trigger/select/acknowledge/goto never appear as a call)", () => {
    const forbiddenCalls = /#controller\.(refresh\w*|start\w*|stop\w*|confirm\w*|select\w*|acknowledge\w*|goto|goBack|cancelConfirmation|openRegistration|openDeviceList|openSyncStatus|openSchedules|openTransfers|openConflicts|requestRevokeDeviceConfirmation|requestStopSyncConfirmation|requestTriggerSyncNowConfirmation)\s*\(/;
    expect(rendererSource).not.toMatch(forbiddenCalls);
  });

  it("5. the action descriptor type carries no function-typed field -- id/label/enabled/disabledReason only", () => {
    expect(actionDescriptorSource).toMatch(/readonly id: string/);
    expect(actionDescriptorSource).toMatch(/readonly label: string/);
    expect(actionDescriptorSource).toMatch(/readonly enabled: boolean/);
    expect(actionDescriptorSource).not.toMatch(/:\s*\(.*\)\s*=>/);
  });

  it("6. the navigation state's own goto()/requestConfirmation() are fail-closed gates -- reject before mutating any field", () => {
    expect(navigationStateSource).toMatch(/isFedosDeviceManagementScreen\(screen\)/);
    expect(navigationStateSource).toMatch(/isFedosDeviceManagementConfirmationAction\(action\)/);
  });

  it("7. no secret-shaped field name anywhere in this Arc's own new source", () => {
    for (const source of ALL_NEW_SOURCES) {
      expect(source.toLowerCase()).not.toMatch(/privatekey|masterseed\w*:|passphrase|encryptedpackage|rawsignature/);
    }
  });

  it("8. no raw Error/stack is ever constructed by this Arc's own new source", () => {
    for (const source of ALL_NEW_SOURCES) {
      expect(source).not.toMatch(/throw\s+new\s+Error/);
      expect(source).not.toMatch(/\bstack\s*:/);
    }
  });
});

describe("Secure Runtime Alpha 3941-4020 -- Phase N: dependency/scope guards", () => {
  it("9. no new npm dependency was introduced -- package.json still carries exactly two production dependencies", () => {
    const parsed = JSON.parse(packageJsonSource) as { dependencies: Record<string, string> };
    expect(Object.keys(parsed.dependencies).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("10. no Electron/React/Vue/Svelte/Tauri reference anywhere in this Arc's own new files", () => {
    for (const source of ALL_NEW_SOURCES) {
      expect(source).not.toMatch(/from\s+["'](electron|react|vue|svelte|@tauri-apps)/i);
    }
  });

  it("11. Sender-Key implementation is untouched by this Arc", () => {
    expect(gitGrepFiles("fedos_sender_key", "src/desktop/presentation/device_management/")).toEqual([]);
    expect(gitGrepFiles("fedos_sender_key", "src/desktop/renderer/device_management/")).toEqual([]);
  });

  it("12. p2p/ and .tmp_gen/ are untouched -- either absent, or (if present) show no git change", () => {
    for (const dir of ["p2p", ".tmp_gen"]) {
      if (existsSync(dir)) {
        const output = execFileSync("git", ["status", "--porcelain", "--", dir], { encoding: "utf8" }) as string;
        expect(output.trim()).toBe("");
      } else {
        expect(existsSync(dir)).toBe(false);
      }
    }
  });

  it("13. no Conversation/Search/Archive production source is modified, and Cargo.toml shows zero git changes -- this Arc's own permanent scope boundary", () => {
    // NOTE (genuinely stale, updated per Alpha 4101-4180's own "update historical
    // exact-shape tests only when genuinely stale" instruction): this test
    // originally ALSO asserted package.json/package-lock.json/tsconfig.json showed
    // zero git changes -- true for Alpha 3941-4020's own narrower scope, but not a
    // permanent repo invariant. Alpha 4101-4180 (Electron Main/Preload Adapter)
    // legitimately extends root package.json (a new build:host-bridge script) and
    // adds a new tsconfig.host-bridge.json -- exactly the kind of later, distinct
    // Arc this check must not falsely fail. The ORIGINAL protection this test
    // exists for -- Conversation/Search/Archive source and Cargo/Rust are NEVER
    // touched by ANY Desktop UI/Electron-adapter Arc -- is preserved below,
    // unweakened.
    const changed = execFileSync("git", ["status", "--porcelain", "--", "src/conversation", "src/search", "Cargo.toml"], {
      encoding: "utf8",
    }) as string;
    expect(changed.trim()).toBe("");
  });

  it("14. no existing Shell/Facade/ViewModel/Renderer file (Alpha 3801-3880 and earlier) is modified by this Arc", () => {
    const changed = execFileSync(
      "git",
      [
        "status",
        "--porcelain",
        "--",
        "src/desktop/shell/fedos_desktop_application_shell.ts",
        "src/desktop/runtime/fedos_device_sync_operational_facade.ts",
        "src/desktop/presentation/fedos_desktop_device_inventory_view_model.ts",
        "src/desktop/presentation/fedos_desktop_device_sync_status_view_model.ts",
        "src/desktop/presentation/fedos_desktop_sync_schedule_view_model.ts",
        "src/desktop/presentation/fedos_desktop_transfer_session_view_model.ts",
        "src/desktop/presentation/fedos_desktop_sync_conflict_view_model.ts",
        "src/desktop/renderer/fedos_desktop_device_list_renderer.ts",
        "src/desktop/renderer/fedos_desktop_device_sync_status_renderer.ts",
        "src/desktop/renderer/fedos_desktop_sync_schedule_renderer.ts",
        "src/desktop/renderer/fedos_desktop_transfer_session_renderer.ts",
        "src/desktop/renderer/fedos_desktop_sync_conflict_renderer.ts",
      ],
      { encoding: "utf8" },
    ) as string;
    expect(changed.trim()).toBe("");
  });
});
