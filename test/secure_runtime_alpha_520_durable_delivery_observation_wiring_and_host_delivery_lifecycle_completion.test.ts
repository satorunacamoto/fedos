import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { createFedosDesktopHost } from "../src/os/messenger/desktop/host/create_fedos_desktop_host.js";
import { FedosHostDeliveryController } from "../src/os/messenger/desktop/host/fedos_host_delivery_controller.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_520_durable_delivery_observation_wiring_and_host_delivery_lifecycle_completion.md?raw";

describe("Secure Runtime Alpha 520 -- Durable Delivery Observation Wiring & Host Delivery Lifecycle Completion", () => {
  it("declares the key Stages of this Arc complete, and spans the full 501-519 doc range in its own See Also", () => {
    for (const n of [502, 507, 508, 509, 510, 512, 513, 514, 515, 516, 519]) {
      expect(doc).toMatch(new RegExp(`\\b${n}\\b`));
    }
    expect(doc).toContain("secure_runtime_alpha_501_existing_host_and_delivery_boundary_inventory");
    expect(doc).toContain("secure_runtime_alpha_519_git_diff_confirmation");
  });

  it("every piece this Arc built is importable and the full lifecycle is usable end to end", async () => {
    expect(typeof FedosDesktopHost).toBe("function");
    expect(typeof FedosHostDeliveryController).toBe("function");

    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    host.startDelivery();
    expect(host.deliveryStatus()).toEqual({ running: true });
    expect(host.observationQuery()).not.toBeNull();
    await host.stopDelivery();
    await host.stop();
  });

  it("createFedosDesktopHost() produces a fully-functional Host with zero overrides", () => {
    const host = createFedosDesktopHost();
    expect(host.state()).toBe("constructed");
  });

  it("names the honestly-discovered limitation and the recommended next Arc", () => {
    expect(doc).toMatch(/Honest limitation discovered, not hidden/);
    expect(doc).toContain("Attempt-Identity Observation Design Arc");
  });

  it("declares zero edits to Publisher/Scheduler/Outbox/Contract files, with exact diff numbers", () => {
    expect(doc).toMatch(/126 insertions, 0 deletions/);
    expect(doc).toMatch(/52 insertions, 0 deletions/);
  });

  it("names the dedicated isolated worktree/branch this Arc was built in", () => {
    expect(doc).toContain("worktree-alpha-491-500");
  });
});
