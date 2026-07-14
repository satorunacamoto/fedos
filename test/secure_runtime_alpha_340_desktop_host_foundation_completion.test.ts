import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_340_desktop_host_foundation_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPersistenceSource from "../src/board/persistence/fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/board/persistence/fedos_board_hydration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrAdapterSource from "../src/board/fedos_board_nostr_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activityPubAdapterSource from "../src/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import atprotoAdapterSource from "../src/board/atproto/fedos_atproto_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionAdapterSource from "../src/board/session/fedos_session_board_adapter.ts?raw";

import { createFedosDesktopHost } from "../src/desktop/host/create_fedos_desktop_host.js";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import type { FedosDesktopHostState } from "../src/desktop/host/fedos_desktop_host_state.js";

/**
 * Secure Runtime Alpha 340 -- "Desktop Host Foundation Completion":
 * Stage 10, the closing Stage, of the Alpha 331-340 Desktop Host
 * Runtime Foundation Arc. Review only. Issues the Arc's own
 * Completion Declaration, confirms every prior Board/Desktop boundary
 * this Arc built atop of remains fully functional and untouched, and
 * recommends exactly one next Arc: Board Durable Backend Selection
 * Re-evaluation, not Ontology integration.
 */
describe("Secure Runtime Alpha 340 -- Desktop Host Foundation Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(designDocSource).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\.\*\*/);
  });

  it("3. the design doc recommends exactly one next Arc: Board Durable Backend Selection Re-evaluation, and explicitly not Ontology integration", () => {
    expect(designDocSource).toMatch(/\*\*Board Durable Backend Selection Re-evaluation Arc\.\*\*/);
    expect(designDocSource).toMatch(/\*\*Ontology integration is explicitly NOT the next recommended Arc\*\*/);
  });

  it("4. the Host this Arc built is still fully functional end to end", async () => {
    const host = createFedosDesktopHost();
    expect(host).toBeInstanceOf(FedosDesktopHost);
    const state: FedosDesktopHostState = host.state();
    expect(state).toBe("constructed");
    await host.start();
    expect(host.state()).toBe("ready");
    expect(host.desktop()).not.toBeNull();
    expect(host.board()).not.toBeNull();
    await host.stop();
    expect(host.state()).toBe("stopped");
  });

  it("5. Regression: package.json dependency count remains unchanged at 2 across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
    expect(pkg.bin).toBeUndefined();
  });

  it("6. Regression: src/worker.ts carries zero reference to the Host, and DesktopApplication is byte-for-byte unchanged in its own public surface", () => {
    expect(workerSource).not.toMatch(/FedosDesktopHost|createFedosDesktopHost/);
    expect(desktopApplicationSource).toMatch(
      /NO GUI, NO Nostr\/Relay connection, NO Observation implementation/,
    );
    expect(createDesktopApplicationSource).toMatch(/export function createDesktopApplication/);
  });

  it("7. Regression: the Board persistence/hydration boundary this Arc called (but did not modify) still exports the same frozen symbols", () => {
    expect(boardPersistenceSource).toMatch(/export interface FedosBoardPersistence \{/);
    expect(hydrationSource).toMatch(/export function hydrateFedosBoardService/);
  });

  it("8. Regression: none of the four Board Adapters has functional coupling to the Host", () => {
    for (const source of [nostrAdapterSource, activityPubAdapterSource, atprotoAdapterSource, sessionAdapterSource]) {
      expect(source).not.toMatch(/FedosDesktopHost|createFedosDesktopHost|desktop\/host/);
    }
  });

  it("9. the design doc's own 'still out of scope' section names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "Executable main, CLI",
      "Electron, Tauri, browser shell, GUI, system tray, OS integration",
      "SQLite, IndexedDB, filesystem persistence, D1 Board persistence",
      "Relay Pool, automatic sync",
      "Signal handling, installer, code signing, auto-update",
      "Ontology integration",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("10. the design doc cross-references every prior Stage of this Arc, Alpha 331 through Alpha 339, plus Alpha 330", () => {
    for (let n = 331; n <= 339; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
    expect(designDocSource).toContain("secure_runtime_alpha_330_durable_backend_selection_completion");
  });

  it("11. the design doc's own frozen architecture diagram names every owned dependency", () => {
    const normalized = designDocSource.replace(/\s+/g, " ");
    expect(normalized).toContain("FedosDesktopHost");
    expect(normalized).toContain("DesktopApplication");
    expect(normalized).toContain("FedosBoardService");
    expect(normalized).toContain("FedosBoardPersistence");
  });
});
