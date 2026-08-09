import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/desktop/host/fedos_desktop_host.js";
import { DesktopApplication } from "../src/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/board/persistence/in_memory_fedos_board_persistence.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

function makeHost() {
  return new FedosDesktopHost({
    desktopApplication: new DesktopApplication(),
    boardPersistence: new InMemoryFedosBoardPersistence(),
  });
}

describe("Secure Runtime Alpha 508 -- Host.startDelivery()", () => {
  it("throws when the Host is not ready", () => {
    const host = makeHost();
    expect(() => host.startDelivery()).toThrow(/ready state/);
  });

  it("throws when called a second time while delivery is already running", async () => {
    const host = makeHost();
    await host.start();
    host.startDelivery();
    expect(() => host.startDelivery()).toThrow(/not already running/);
    await host.stopDelivery();
  });

  it("startDelivery() itself performs no publish/publishOne call anywhere in fedos_desktop_host.ts", () => {
    const startDeliveryBody = (hostSource.match(/startDelivery\(\): void \{([\s\S]*?)\n  \}/) ?? [])[1] ?? "";
    expect(startDeliveryBody.length).toBeGreaterThan(0);
    expect(startDeliveryBody).not.toMatch(/\.publish\(|\.publishOne\(/);
  });

  it("no call to publish/publishOne exists anywhere in fedos_desktop_host.ts", () => {
    const codeOnly = hostSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\.publish\(|\.publishOne\(/);
  });

  it("can be started again after a stop/start cycle", async () => {
    const host = makeHost();
    await host.start();
    host.startDelivery();
    await host.stopDelivery();
    expect(() => host.startDelivery()).not.toThrow();
    await host.stopDelivery();
  });
});
