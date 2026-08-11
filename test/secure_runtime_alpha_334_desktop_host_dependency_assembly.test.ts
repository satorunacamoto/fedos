import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import factorySource from "../src/os/messenger/desktop/host/create_fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

import { createFedosDesktopHost } from "../src/os/messenger/desktop/host/create_fedos_desktop_host.js";
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
 * Secure Runtime Alpha 334 -- "Desktop Host Dependency Assembly":
 * Stage 4 of the Alpha 331-340 Desktop Host Runtime Foundation Arc.
 * Adds src/desktop/host/fedos_desktop_host.ts (FedosDesktopHostDependencies
 * + the FedosDesktopHost constructor) and
 * src/desktop/host/create_fedos_desktop_host.ts (createFedosDesktopHost).
 */
describe("Secure Runtime Alpha 334 -- Desktop Host Dependency Assembly", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: createFedosDesktopHost() with no arguments constructs a real, unstarted Host", () => {
    const host = createFedosDesktopHost();
    expect(host).toBeInstanceOf(FedosDesktopHost);
    expect(host.state()).toBe("constructed");
    expect(host.desktop()).toBeNull();
    expect(host.board()).toBeNull();
  });

  it("3. behavioral: constructing (without starting) performs no side effect on the injected persistence", () => {
    const boardPersistence = new InMemoryFedosBoardPersistence();
    const desktopApplication = new DesktopApplication();
    const host = new FedosDesktopHost({ desktopApplication, boardPersistence });
    expect(host.state()).toBe("constructed");
    expect(boardPersistence.listPosts()).toEqual([]);
  });

  it("4. behavioral: both dependencies are independently overridable", () => {
    const desktopApplication = new DesktopApplication();
    const boardPersistence = new InMemoryFedosBoardPersistence();
    const hostA = createFedosDesktopHost({ desktopApplication });
    const hostB = createFedosDesktopHost({ boardPersistence });
    expect(hostA).toBeInstanceOf(FedosDesktopHost);
    expect(hostB).toBeInstanceOf(FedosDesktopHost);
  });

  it("5. behavioral: two no-argument calls construct two independent instances -- no shared singleton", () => {
    const hostA = createFedosDesktopHost();
    const hostB = createFedosDesktopHost();
    expect(hostA).not.toBe(hostB);
  });

  it("6. structural: the factory calls no method on either dependency beyond the FedosDesktopHost constructor", () => {
    expect(factorySource).not.toMatch(/\.start\(\)|hydrateFedosBoardService/);
  });

  it("7. structural: no process.env read anywhere in the factory or host file's own code", () => {
    expect(codeOnly(factorySource)).not.toMatch(/process\.env/);
    expect(codeOnly(hostSource)).not.toMatch(/process\.env/);
  });

  it("8. structural: no filesystem or p2p import anywhere in the factory or host file", () => {
    for (const source of [factorySource, hostSource]) {
      expect(source).not.toMatch(/from ["']node:fs["']|from ["']fs["']|from ["'].*\bp2p\//);
    }
  });

  it("9. structural: FedosDesktopHostDependencies still has its two original required fields -- Arc 411-420 (Alpha 419) adds only one further OPTIONAL field, outboxPersistence, defaulted in the constructor, never a third required field", () => {
    expect(hostSource).toMatch(
      /export interface FedosDesktopHostDependencies \{\s*readonly desktopApplication: DesktopApplication;\s*readonly boardPersistence: FedosBoardPersistence;/,
    );
    expect(hostSource).toMatch(/readonly outboxPersistence\?: FedosBoardOutboxPersistence;/);
  });

  it("10. the design doc cross-references Alpha 333, Alpha 099, Alpha 109, Alpha 316, and Alpha 329", () => {
    for (const ref of [
      "secure_runtime_alpha_333_desktop_host_state_model",
      "secure_runtime_alpha_099_desktop_factory",
      "secure_runtime_alpha_109_desktop_wiring",
      "secure_runtime_alpha_316_in_memory_board_persistence",
      "secure_runtime_alpha_329_first_durable_backend_selection",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
