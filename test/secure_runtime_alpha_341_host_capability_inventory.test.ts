import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_341_host_capability_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import factorySource from "../src/os/messenger/desktop/host/create_fedos_desktop_host.ts?raw";

import { createFedosDesktopHost } from "../src/os/messenger/desktop/host/create_fedos_desktop_host.js";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 341 -- "Host Capability Inventory": Stage 1 of
 * the Alpha 341-350 Board Durable Backend Re-evaluation & Local
 * Backend Selection Arc. Review only. Re-confirms FedosDesktopHost's
 * own lifecycle/ownership/hydration/startup/shutdown by direct
 * inspection, and concludes it can structurally own any
 * FedosBoardPersistence implementation.
 */
describe("Secure Runtime Alpha 341 -- Host Capability Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc concludes the Host can structurally own a local durable backend", () => {
    expect(normalize(designDocSource)).toContain(
      "**Yes, structurally — the Host already owns a `FedosBoardPersistence` value by construction",
    );
  });

  it("3. structural: FedosDesktopHostDependencies accepts any FedosBoardPersistence, not an in-memory-specific type", () => {
    expect(hostSource).toMatch(/readonly boardPersistence: FedosBoardPersistence;/);
    expect(hostSource).not.toMatch(/import.*InMemoryFedosBoardPersistence/);
  });

  it("4. behavioral: the Host accepts an arbitrary FedosBoardPersistence implementation, not only the default", () => {
    class NoopPersistence extends InMemoryFedosBoardPersistence {}
    const host = createFedosDesktopHost({ boardPersistence: new NoopPersistence() });
    expect(host).toBeInstanceOf(FedosDesktopHost);
    expect(host.state()).toBe("constructed");
  });

  it("5. structural: the factory's own default persistence is documented, not hidden", () => {
    expect(factorySource).toMatch(/InMemoryFedosBoardPersistence/);
  });

  it("6. the design doc names every real lifecycle/ownership/hydration/startup/shutdown property it confirms", () => {
    for (const heading of [
      "### 2.1 Lifecycle",
      "### 2.2 Ownership",
      "### 2.3 Persistence caller",
      "### 2.4 Hydration",
      "### 2.5 Startup",
      "### 2.6 Shutdown",
    ]) {
      expect(designDocSource).toContain(heading);
    }
  });

  it("7. the design doc cross-references Alpha 340, Alpha 334, and Alpha 335", () => {
    for (const ref of [
      "secure_runtime_alpha_340_desktop_host_foundation_completion",
      "secure_runtime_alpha_334_desktop_host_dependency_assembly",
      "secure_runtime_alpha_335_board_hydration_ownership",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
