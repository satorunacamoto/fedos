import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceBindingSource from "../src/sync/fedos_sync_device_binding.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import deviceRegistrySource from "../src/sync/fedos_sync_device_registry.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import journalSource from "../src/sync/fedos_sync_journal.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import cursorSource from "../src/sync/fedos_sync_cursor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import conflictSource from "../src/sync/fedos_sync_conflict.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import pendingChangesSource from "../src/sync/fedos_sync_pending_changes.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import queueSource from "../src/sync/fedos_sync_queue.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import recoverySource from "../src/sync/fedos_sync_recovery.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import stateSource from "../src/sync/fedos_sync_state.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

const ALL_SYNC_SOURCES: readonly string[] = [
  deviceBindingSource,
  deviceRegistrySource,
  journalSource,
  cursorSource,
  conflictSource,
  pendingChangesSource,
  queueSource,
  recoverySource,
  stateSource,
];

/**
 * Secure Runtime Alpha 2421-2500 ("Multi Device Synchronization
 * Foundation") — its own structural guards, mirroring this
 * repository's established per-Arc pattern (see e.g. Alpha 1471-1540's
 * own `test/secure_runtime_alpha_1471_1540_structural_guards.test.ts`).
 */
describe("Secure Runtime Alpha 2421-2500 -- Multi Device Sync Structural Guards", () => {
  it("1. no network/transport primitive of any kind anywhere in the new sync module -- this Arc is additive primitives only, no transport redesign", () => {
    const forbidden = [/\bfetch\(/, /new WebSocket\(/, /new XMLHttpRequest\(/, /\bnet\.connect\(/, /https?:\/\//i];
    for (const source of ALL_SYNC_SOURCES) {
      for (const pattern of forbidden) {
        expect(source).not.toMatch(pattern);
      }
    }
  });

  it("2. no import from the existing transport, Sender-Key, or GUI layers -- this Arc redesigns neither", () => {
    for (const source of ALL_SYNC_SOURCES) {
      expect(source).not.toMatch(/from ["'].*\/transport\//);
      expect(source).not.toMatch(/from ["'].*sender.?key/i);
      expect(source).not.toMatch(/from ["'].*\/render\//);
      expect(source).not.toMatch(/from ["'].*\/worker\.js["']/);
      expect(source).not.toMatch(/from ["'].*\/p2p\//);
    }
  });

  it("3. Sync State never imports the Archive module directly -- archive-awareness is a narrow injected port, not a hard dependency", () => {
    expect(stateSource).not.toMatch(/from ["'].*\/conversation\/archive\//);
    expect(stateSource).toMatch(/FedosSyncArchiveAwareness/);
  });

  it("4. every append-only primitive (Journal, Device Registry, Sync Queue, Pending Changes) exposes no delete method", () => {
    for (const source of [journalSource, deviceRegistrySource, queueSource, pendingChangesSource]) {
      expect(source).not.toMatch(/\bdelete\w*\(/i);
    }
  });

  it("5. the Conflict Vocabulary is exactly the four named outcomes -- none invented beyond it, none silently dropped", () => {
    expect(conflictSource).toMatch(/"none" \| "duplicate" \| "tombstone-vs-upsert" \| "concurrent-update"/);
  });

  it("6. no new production dependency was introduced by this arc -- still exactly @noble/curves and @noble/hashes", () => {
    const parsed = JSON.parse(packageJsonSource as string) as { dependencies: Record<string, string> };
    expect(Object.keys(parsed.dependencies).sort()).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("7. package.json's own scripts carry no entry point added by THIS arc -- genuinely stale otherwise (updated per later Arcs' own 'update historical exact-shape tests only when genuinely stale' instruction, e.g. Alpha 4101-4180): the Electron Build Spike/Node Type Isolation/Electron Host Adapter Arcs (Alpha 3881-3940/4021-4100/4101-4180) legitimately added their own build/start/typecheck entry points well after this Arc's own scope closed. This Arc's own original protection -- no entry point THIS Arc itself would have added is present -- is preserved by asserting the CURRENT real, closed list rather than a frozen pre-Electron snapshot.", () => {
    const parsed = JSON.parse(packageJsonSource as string) as { scripts: Record<string, string> };
    expect(Object.keys(parsed.scripts).sort()).toEqual(
      [
        "build:electron-spike",
        "build:host-bridge",
        "build:runtime",
        "build:wasm",
        "package:electron-spike",
        "start:electron-host-adapter",
        "start:electron-spike",
        "start:runtime",
        "test",
        "test:electron-spike",
        "test:watch",
        "typecheck",
        "typecheck:core",
        "typecheck:electron",
      ].sort(),
    );
  });

  it("8. FedosSyncDeviceBinding's own field list carries exactly deviceRef/accountRef/state/boundAt/updatedAt -- no key material or credential field of any kind", () => {
    const interfaceMatch = deviceBindingSource.match(/export interface FedosSyncDeviceBinding \{([\s\S]*?)\}/);
    expect(interfaceMatch).not.toBeNull();
    const fieldNames = [...(interfaceMatch![1] as string).matchAll(/readonly (\w+):/g)].map((m) => m[1]);
    expect(fieldNames.sort()).toEqual(["accountRef", "boundAt", "deviceRef", "state", "updatedAt"].sort());
  });
});
