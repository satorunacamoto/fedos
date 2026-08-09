import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_384_host_query_access_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { FedosBoardQuery } from "../src/board/query/fedos_board_query.js";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 384 -- "Host Query Access Boundary": Stage 4 of
 * the Alpha 381-390 Canonical Board Query Host Integration & Startup
 * Failure Closure Arc. Adds query() -- Option A, matching desktop()/
 * board()'s exact ownership access pattern.
 */
describe("Secure Runtime Alpha 384 -- Host Query Access Boundary", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: null before ready", () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    expect(() => host.query()).not.toThrow();
    expect(host.query()).toBeNull();
  });

  it("3. behavioral: the Query instance while ready", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    expect(host.query()).toBeInstanceOf(FedosBoardQuery);
  });

  it("4. behavioral: null after stopped", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    await host.stop();
    expect(host.query()).toBeNull();
  });

  it("5. behavioral: null after failed, and never throws", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication({
        readPublicIdentity: async () => {
          throw new Error("fail");
        },
      }),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await expect(host.start()).rejects.toThrow();
    expect(() => host.query()).not.toThrow();
    expect(host.query()).toBeNull();
  });

  it("6. structural: query() gates on state() === 'ready', matching desktop()/board()'s exact shape", () => {
    expect(hostSource).toMatch(/query\(\): FedosBoardQuery \| null \{\s*return this\.#state === "ready" \? this\.#boardQuery : null;\s*\}/);
  });

  it("7. the design doc confirms the rejection condition does not trigger -- Option A adopted", () => {
    expect(normalize(designDocSource)).toContain(
      "The rejection condition does not trigger; Option A is adopted.",
    );
  });

  it("8. the design doc names every permanent exposure prohibition", () => {
    for (const prohibition of [
      "**Never exposes Persistence**",
      "**Never exposes indexes directly**",
      "**Never exposes protocol adapters**",
      "**Never exposes the Ontology engine**",
    ]) {
      expect(designDocSource).toContain(prohibition);
    }
  });

  it("9. the design doc cross-references Alpha 383, Alpha 336, and Alpha 381", () => {
    for (const ref of [
      "secure_runtime_alpha_383_host_owned_query_construction",
      "secure_runtime_alpha_336_desktop_host_access_boundary",
      "secure_runtime_alpha_381_host_query_integration_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
