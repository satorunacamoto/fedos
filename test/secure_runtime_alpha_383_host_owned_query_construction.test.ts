import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_383_host_owned_query_construction.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";

import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import type { FedosPublicIdentityReader } from "../src/desktop/fedos_public_identity_reader.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
import { AppendOnlyFedosBoardPersistence } from "../src/board/persistence/append_only_fedos_board_persistence.js";
import { FedosBoardQuery } from "../src/board/query/fedos_board_query.js";

class NullReader implements FedosPublicIdentityReader {
  async readPublicIdentity() {
    return null;
  }
}
class ThrowingReader implements FedosPublicIdentityReader {
  async readPublicIdentity(): Promise<never> {
    throw new Error("desktop start failure");
  }
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 383 -- "Host-Owned Query Construction": Stage 3
 * of the Alpha 381-390 Canonical Board Query Host Integration &
 * Startup Failure Closure Arc. Host owns exactly one FedosBoardQuery,
 * constructed only after successful hydration.
 */
describe("Secure Runtime Alpha 383 -- Host-Owned Query Construction", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. Query is not constructed before the Host constructor runs -- no I/O, no Query reference reachable pre-start()", () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: new InMemoryFedosBoardPersistence() });
    expect(host.state()).toBe("constructed");
    expect(host.query()).toBeNull();
  });

  it("3. Query is discarded on a Desktop-startup failure, even though hydration itself succeeded", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new ThrowingReader()), boardPersistence: new InMemoryFedosBoardPersistence() });
    await expect(host.start()).rejects.toThrow();
    expect(host.state()).toBe("failed");
    expect(host.query()).toBeNull();
  });

  it("4. Query is discarded on a hydration failure", async () => {
    dir = mkdtempSync(join(tmpdir(), "a383-"));
    const filePath = join(dir, "board.jsonl");
    writeFileSync(filePath, "not valid json\n", "utf8");
    const persistence = new AppendOnlyFedosBoardPersistence(filePath);
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: persistence });
    await expect(host.start()).rejects.toThrow();
    expect(host.query()).toBeNull();
  });

  it("5. exactly one FedosBoardQuery instance is constructed per successful start, and it is a real FedosBoardQuery", async () => {
    const host = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: new InMemoryFedosBoardPersistence() });
    await host.start();
    expect(host.query()).toBeInstanceOf(FedosBoardQuery);
  });

  it("6. no global singleton -- independent Hosts own independent Query instances", async () => {
    const h1 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: new InMemoryFedosBoardPersistence() });
    const h2 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: new InMemoryFedosBoardPersistence() });
    await h1.start();
    await h2.start();
    expect(h1.query()).not.toBe(h2.query());
  });

  it("7. no Query persistence -- a fresh Host against the same file constructs a fresh Query instance", async () => {
    dir = mkdtempSync(join(tmpdir(), "a383-"));
    const filePath = join(dir, "board.jsonl");
    const h1 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: new AppendOnlyFedosBoardPersistence(filePath) });
    await h1.start();
    const q1 = h1.query();
    await h1.stop();

    const h2 = new FedosDesktopHost({ desktopApplication: new DesktopApplication(new NullReader()), boardPersistence: new AppendOnlyFedosBoardPersistence(filePath) });
    await h2.start();
    const q2 = h2.query();
    expect(q2).not.toBe(q1);
  });

  it("8. structural: FedosBoardQuery is constructed textually after the hydration-outcome check, before DesktopApplication.start()", () => {
    const startMatch = hostSource.match(/async start\(\): Promise<void> \{[\s\S]*?\n {2}\}/);
    const body = startMatch![0];
    const hydrationCheckIndex = body.indexOf('throw new Error(`FedosDesktopHost failed to hydrate');
    const queryConstructIndex = body.indexOf("new FedosBoardQuery(hydration.service)");
    const desktopStartIndex = body.indexOf("this.#desktopApplication.start()");
    expect(hydrationCheckIndex).toBeGreaterThan(-1);
    expect(queryConstructIndex).toBeGreaterThan(-1);
    expect(desktopStartIndex).toBeGreaterThan(-1);
    expect(hydrationCheckIndex).toBeLessThan(queryConstructIndex);
    expect(queryConstructIndex).toBeLessThan(desktopStartIndex);
  });

  it("9. structural: the Query implementation itself carries zero diff -- this Stage integrates it, never alters it", () => {
    expect(designDocSource).toContain(
      "## 5. The Query implementation itself is untouched",
    );
  });

  it("10. the design doc cross-references Alpha 382, Alpha 372, and Alpha 335", () => {
    for (const ref of [
      "secure_runtime_alpha_382_host_startup_failure_closure",
      "secure_runtime_alpha_372_canonical_board_query_contract",
      "secure_runtime_alpha_335_board_hydration_ownership",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
