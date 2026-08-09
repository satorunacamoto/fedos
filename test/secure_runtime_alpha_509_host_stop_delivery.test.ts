import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";

function makeHost() {
  return new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence: new InMemoryFedosBoardPersistence(),
  });
}

describe("Secure Runtime Alpha 509 -- Host.stopDelivery()", () => {
  it("throws when delivery is not running", async () => {
    const host = makeHost();
    await host.start();
    await expect(host.stopDelivery()).rejects.toThrow(/delivery is running/);
  });

  it("deliveryStatus() flips to not-running synchronously, before stopDelivery()'s own await settles", async () => {
    const host = makeHost();
    await host.start();
    host.startDelivery();
    expect(host.deliveryStatus().running).toBe(true);
    const stopPromise = host.stopDelivery();
    // Synchronous check immediately after invoking stopDelivery(), before its own await resolves.
    expect(host.deliveryStatus().running).toBe(false);
    await stopPromise;
    expect(host.deliveryStatus().running).toBe(false);
  });

  it("Host.stop()'s own body is untouched -- it does not reference delivery at all", async () => {
    // @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
    const hostSource = (await import("../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw")).default as string;
    const stopBody = (hostSource.match(/async stop\(\): Promise<void> \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(stopBody.length).toBeGreaterThan(0);
    expect(stopBody).not.toMatch(/[Dd]elivery/);
  });

  it("Host.stop() still works normally while delivery has never been started", async () => {
    const host = makeHost();
    await host.start();
    await expect(host.stop()).resolves.toBeUndefined();
    expect(host.state()).toBe("stopped");
  });
});
