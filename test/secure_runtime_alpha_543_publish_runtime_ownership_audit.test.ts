import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";

/**
 * Secure Runtime Alpha 543 -- "Whole-Stack Ownership Audit": Stage 3
 * of the Alpha 541-560 Publish Runtime Operational Review Arc. Review
 * test only -- exercises real, unmodified FedosDesktopHost to confirm
 * its own ownership claims by direct construction, not source-only
 * inspection.
 */
describe("Secure Runtime Alpha 543 -- Whole-Stack Ownership Audit", () => {
  it("1. FedosDesktopHost owns Board Persistence, Outbox Persistence, Board Service, and Board Query -- confirmed once ready", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: { start: async () => {} } as unknown as ConstructorParameters<typeof FedosDesktopHost>[0]["desktopApplication"],
      boardPersistence: new InMemoryFedosBoardPersistence(),
      outboxPersistence: new InMemoryFedosBoardOutboxPersistence(),
    });
    await host.start();
    expect(host.board()).not.toBeNull();
    expect(host.query()).not.toBeNull();
    expect(host.desktop()).not.toBeNull();
  });

  it("2. FedosDesktopHost exposes no Publisher, Scheduler, or Observation accessor of any kind -- confirmed by its own public method list", () => {
    const proto = FedosDesktopHost.prototype;
    const methodNames = Object.getOwnPropertyNames(proto).filter((name) => name !== "constructor");
    for (const name of methodNames) {
      expect(name.toLowerCase()).not.toMatch(/publisher|scheduler|observation/);
    }
  });
});
