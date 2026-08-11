import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_336_desktop_host_access_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 336 -- "Desktop Host Access Boundary": Stage 6
 * of the Alpha 331-340 Desktop Host Runtime Foundation Arc. Adds
 * desktop()/board() to FedosDesktopHost -- both return null unless
 * state() === "ready", never throwing.
 */
describe("Secure Runtime Alpha 336 -- Desktop Host Access Boundary", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: before start(), both accessors return null without throwing", () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    expect(() => host.desktop()).not.toThrow();
    expect(() => host.board()).not.toThrow();
    expect(host.desktop()).toBeNull();
    expect(host.board()).toBeNull();
  });

  it("3. behavioral: after a successful start(), both accessors return the exact owned instances", async () => {
    const desktopApplication = new DesktopApplication();
    const host = new FedosDesktopHost({ desktopApplication, boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    expect(host.desktop()).toBe(desktopApplication);
    expect(host.board()).not.toBeNull();
  });

  it("4. behavioral: during start() (mid-flight), accessors are unreachable from outside -- state is not ready until start() resolves", async () => {
    const desktopApplication = new DesktopApplication();
    const host = new FedosDesktopHost({ desktopApplication, boardPersistence: new InMemoryFedosBoardPersistence() });
    const startPromise = host.start();
    // Synchronously, before the microtask queue drains start()'s own internal awaits, state is not ready.
    expect(host.state()).not.toBe("ready");
    expect(host.board()).toBeNull();
    await startPromise;
    expect(host.state()).toBe("ready");
  });

  it("5. structural: both accessors gate on state() === \"ready\" and never throw", () => {
    // board()'s own return type was REWIRED by Alpha 404 (Arc 401-410) from
    // FedosBoardService to FedosBoardReader -- the gating shape (return null
    // unless ready) this test's own title names is unchanged.
    expect(hostSource).toMatch(/desktop\(\): DesktopApplication \| null \{\s*return this\.#state === "ready" \? this\.#desktopApplication : null;\s*\}/);
    expect(hostSource).toMatch(/board\(\): FedosBoardReader \| null \{\s*return this\.#state === "ready" \? this\.#boardReader : null;\s*\}/);
  });

  it("6. structural: no persistence, index, registry, provider, or secret-handle type is imported into src/desktop/host/", () => {
    expect(codeOnly(hostSource)).not.toMatch(
      /InMemoryFedosBoardPersistence|FedosBoardIndex|FedosBoardSourceIndex|FedosBoardRepository|FedosIdentityRegistry|SecretHandle/,
    );
  });

  it("7. the design doc concludes Option A is not too broad, citing the owned classes' own narrow public surfaces", () => {
    expect(designDocSource).toMatch(/\*\*Decision: Option A\*\*,/);
    expect(designDocSource).toMatch(/NOT too\s+broad/);
  });

  it("8. the design doc cross-references Alpha 335, Alpha 116, and Alpha 307", () => {
    for (const ref of [
      "secure_runtime_alpha_335_board_hydration_ownership",
      "secure_runtime_alpha_116_desktop_identity_access",
      "secure_runtime_alpha_307_board_application_service",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
