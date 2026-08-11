import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_337_desktop_host_shutdown_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";

async function readyHost(): Promise<FedosDesktopHost> {
  const host = new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence: new InMemoryFedosBoardPersistence(),
  });
  await host.start();
  return host;
}

/**
 * Secure Runtime Alpha 337 -- "Desktop Host Shutdown Contract": Stage
 * 7 of the Alpha 331-340 Desktop Host Runtime Foundation Arc. Adds
 * stop() to FedosDesktopHost -- ready-only, lifecycle-closure-only
 * (no resource to release yet), NOT idempotent.
 */
describe("Secure Runtime Alpha 337 -- Desktop Host Shutdown Contract", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. behavioral: stop() from ready succeeds and transitions to stopped", async () => {
    const host = await readyHost();
    await host.stop();
    expect(host.state()).toBe("stopped");
  });

  it("3. behavioral: a stopped Host denies application/Board access", async () => {
    const host = await readyHost();
    await host.stop();
    expect(host.desktop()).toBeNull();
    expect(host.board()).toBeNull();
  });

  it("4. behavioral: stop() before start() rejects", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await expect(host.stop()).rejects.toThrow(/ready state/);
  });

  it("5. behavioral: a second stop() call rejects -- NOT idempotent", async () => {
    const host = await readyHost();
    await host.stop();
    await expect(host.stop()).rejects.toThrow(/ready state/);
  });

  it("6. behavioral: stop() calls no method on the owned DesktopApplication or persistence", async () => {
    const desktopApplication = new DesktopApplication();
    const boardPersistence = new InMemoryFedosBoardPersistence();
    const host = new FedosDesktopHost({ desktopApplication, boardPersistence });
    await host.start();
    const identityBefore = desktopApplication.currentIdentity();
    const postsBefore = boardPersistence.listPosts();
    await host.stop();
    expect(desktopApplication.currentIdentity()).toEqual(identityBefore);
    expect(boardPersistence.listPosts()).toEqual(postsBefore);
  });

  it("7. structural: stop() calls no method on #desktopApplication/#boardPersistence -- lifecycle state closure only", () => {
    const stopMatch = hostSource.match(/async stop\(\): Promise<void> \{[\s\S]*?\n {2}\}/);
    expect(stopMatch).not.toBeNull();
    const stopBody = stopMatch![0];
    expect(stopBody).not.toMatch(/#desktopApplication\.|#boardPersistence\./);
    expect(stopBody).not.toMatch(/process\.exit|process\.on\(/);
  });

  it("8. the design doc explicitly decides non-idempotency, citing the Alpha 098 DesktopApplication precedent", () => {
    expect(designDocSource).toMatch(/\*\*Not idempotent\.\*\*/);
    expect(designDocSource).toContain("secure_runtime_alpha_098_ready_state");
  });

  it("9. the design doc documents future additive resource cleanup without implementing it", () => {
    expect(designDocSource).toMatch(/A SQLite connection/);
    expect(designDocSource).toMatch(/Relay connections/);
    expect(designDocSource).toMatch(/Filesystem handles/);
    expect(designDocSource).toMatch(/Background sync/);
  });

  it("10. the design doc cross-references Alpha 336, Alpha 061, and Alpha 316", () => {
    for (const ref of [
      "secure_runtime_alpha_336_desktop_host_access_boundary",
      "secure_runtime_alpha_061_identity_bootstrap_idempotency",
      "secure_runtime_alpha_316_in_memory_board_persistence",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
