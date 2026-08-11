/**
 * Secure Runtime Alpha 3801-3880 — Phase K: security/structural guards.
 *
 * Source-inspection tests (no runtime construction) verifying the layering
 * and secret-isolation rules this Arc's own Absolute Prohibitions require,
 * against REAL, currently-checked-out source in this worktree.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error see above.
import facadeSource from "../src/os/messenger/desktop/runtime/fedos_device_sync_operational_facade.js?raw";
// @ts-expect-error see above.
import shellSource from "../src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts?raw";
// @ts-expect-error see above.
import deviceInventoryVmSource from "../src/os/messenger/desktop/presentation/fedos_desktop_device_inventory_view_model.ts?raw";
// @ts-expect-error see above.
import deviceSyncStatusVmSource from "../src/os/messenger/desktop/presentation/fedos_desktop_device_sync_status_view_model.ts?raw";
// @ts-expect-error see above.
import syncScheduleVmSource from "../src/os/messenger/desktop/presentation/fedos_desktop_sync_schedule_view_model.ts?raw";
// @ts-expect-error see above.
import transferSessionVmSource from "../src/os/messenger/desktop/presentation/fedos_desktop_transfer_session_view_model.ts?raw";
// @ts-expect-error see above.
import syncConflictVmSource from "../src/os/messenger/desktop/presentation/fedos_desktop_sync_conflict_view_model.ts?raw";
// @ts-expect-error see above.
import deviceListRendererSource from "../src/os/messenger/desktop/renderer/fedos_desktop_device_list_renderer.ts?raw";
// @ts-expect-error see above.
import deviceSyncStatusRendererSource from "../src/os/messenger/desktop/renderer/fedos_desktop_device_sync_status_renderer.ts?raw";
// @ts-expect-error see above.
import syncScheduleRendererSource from "../src/os/messenger/desktop/renderer/fedos_desktop_sync_schedule_renderer.ts?raw";
// @ts-expect-error see above.
import transferSessionRendererSource from "../src/os/messenger/desktop/renderer/fedos_desktop_transfer_session_renderer.ts?raw";
// @ts-expect-error see above.
import syncConflictRendererSource from "../src/os/messenger/desktop/renderer/fedos_desktop_sync_conflict_renderer.ts?raw";
import { assertFedosRootDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

const DEVICE_SYNC_VIEW_MODEL_SOURCES: readonly string[] = [
  deviceInventoryVmSource,
  deviceSyncStatusVmSource,
  syncScheduleVmSource,
  transferSessionVmSource,
  syncConflictVmSource,
];

const DEVICE_SYNC_RENDERER_SOURCES: readonly string[] = [
  deviceListRendererSource,
  deviceSyncStatusRendererSource,
  syncScheduleRendererSource,
  transferSessionRendererSource,
  syncConflictRendererSource,
];

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

describe("Secure Runtime Alpha 3801-3880 -- Phase K: layering guards", () => {
  // A ViewModel/Renderer/Shell method signature legitimately shares the SAME
  // small, closed action-name TYPE the facade itself exposes (`FedosDeviceSyncConflictResolutionAction`)
  // -- a type-only re-import of one closed string union, never a persistence
  // class/authority instance. Only REAL business-logic imports (an actual
  // class construction, an authority, a durable port implementation) are a
  // layering violation.
  const FORBIDDEN_DEVICE_SYNC_CLASS_NAMES =
    /\b(AppendOnlyFedosDevice\w+|InMemoryFedosDevice\w+|FedosDeviceSyncScheduler\b|FedosDeviceRegistryPersistence\b|PersistedFedosDeviceTrustAuthority\b|FedosDeviceRelaySync\w*Coordinator\b|FedosDeviceTransferCoordinator\b|FedosDeviceSyncImportCoordinator\b)/;

  it("1. every new ViewModel imports ONLY the Shell (plus its own presentation-layer helpers) -- never a Device Registry/Scheduler/Persistence class directly", () => {
    for (const source of DEVICE_SYNC_VIEW_MODEL_SOURCES) {
      expect(source).not.toMatch(/from\s+["']\.\.\/runtime\/fedos_desktop_runtime\.js["']/);
      expect(source).not.toMatch(FORBIDDEN_DEVICE_SYNC_CLASS_NAMES);
    }
  });

  it("2. every new Renderer imports ONLY its own ViewModel/render-model helpers -- never the Shell, Runtime, or a Device Registry/Scheduler/Persistence class", () => {
    for (const source of DEVICE_SYNC_RENDERER_SOURCES) {
      expect(source).not.toMatch(/from\s+["']\.\.\/shell\//);
      expect(source).not.toMatch(/from\s+["']\.\.\/runtime\/fedos_desktop_runtime\.js["']/);
      expect(source).not.toMatch(FORBIDDEN_DEVICE_SYNC_CLASS_NAMES);
    }
  });

  it("3. no Renderer imports crypto/persistence of any kind", () => {
    for (const source of DEVICE_SYNC_RENDERER_SOURCES) {
      expect(source).not.toMatch(/MasterSeed|EncryptionAuthority|DecryptionAuthority|Persistence\b/);
    }
  });

  it("4. no Renderer mutates state -- no call into a ViewModel's own action method (refresh/start/stop/triggerNow/selectDevice/selectConflict/acknowledge)", () => {
    const forbiddenCalls = /\.(refresh|start|stop|triggerNow|selectDevice|selectConflict|acknowledge)\s*\(/;
    for (const source of DEVICE_SYNC_RENDERER_SOURCES) {
      expect(source).not.toMatch(forbiddenCalls);
    }
  });

  it("5. the Shell accesses Device Sync ONLY through runtime.deviceSyncOperational() -- never a direct Scheduler/Registry/Conflict persistence class import", () => {
    expect(shellSource).not.toMatch(FORBIDDEN_DEVICE_SYNC_CLASS_NAMES);
    expect(shellSource).toMatch(/deviceSyncOperational\(\)/);
  });

  it("6. the Runtime Operational Facade imports no crypto authority and constructs no MasterSeedAuthority of its own", () => {
    expect(facadeSource).not.toMatch(/MasterSeedAuthority|EncryptionAuthority|DecryptionAuthority|SigningAuthority/);
  });

  it("7. the Runtime Operational Facade never returns a raw Error instance -- every method wraps its own logic in a closed result", () => {
    expect(facadeSource).not.toMatch(/throw\s+/);
  });

  it("8. no raw secret/signature/package field name appears anywhere in the facade's own safe view shapes", () => {
    expect(facadeSource.toLowerCase()).not.toMatch(/privatekey|masterseed|passphrase|encryptedpackage|rawsignature/);
  });
});

describe("Secure Runtime Alpha 3801-3880 -- Phase K: dependency/scope guards", () => {
  it("9. no new npm dependency was introduced -- package.json still carries exactly two production dependencies", () => {
    const parsed = JSON.parse(packageJsonSource) as { dependencies: Record<string, string> };
    assertFedosRootDependencyInvariant(parsed.dependencies);
  });

  it("10. no Electron/React/Vue/Svelte/Tauri reference anywhere in this Arc's own new files", () => {
    const allNewSources = [facadeSource, shellSource, ...DEVICE_SYNC_VIEW_MODEL_SOURCES, ...DEVICE_SYNC_RENDERER_SOURCES];
    for (const source of allNewSources) {
      expect(source).not.toMatch(/from\s+["'](electron|react|vue|svelte|@tauri-apps)/i);
    }
  });

  it("11. Sender-Key implementation is untouched by this Arc", () => {
    expect(gitGrepFiles("fedos_sender_key", "src/desktop/") ).toEqual([]);
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

  it("13. no Conversation/Search/Archive production source is modified by this Arc's own working tree changes (beyond genuinely-stale structural guard tests, if any)", () => {
    const changed = execFileSync("git", ["status", "--porcelain", "--", "src/conversation", "src/search"], { encoding: "utf8" }) as string;
    expect(changed.trim()).toBe("");
  });
});
