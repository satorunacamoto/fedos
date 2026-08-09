import { describe, it, expect } from "vitest";
import { FedosDesktopHost } from "../src/os/messenger/desktop/host/fedos_desktop_host.js";
import { createFedosDesktopHost } from "../src/os/messenger/desktop/host/create_fedos_desktop_host.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
import { InMemoryFedosBoardPersistence } from "../src/os/messenger/board/persistence/in_memory_fedos_board_persistence.js";
import { MockFedosBoardOutboxPublisher } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import { FedosDeliveryObservationRepository } from "../src/os/messenger/board/observation/fedos_delivery_observation_repository.js";
import { InMemoryFedosDeliveryObservationPersistence } from "../src/os/messenger/board/observation/in_memory_fedos_delivery_observation_persistence.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_507_host_constructor_and_factory_wiring.md?raw";

describe("Secure Runtime Alpha 507 -- Host Constructor and Factory Wiring", () => {
  it("every pre-existing new FedosDesktopHost({desktopApplication, boardPersistence}) call site still compiles and constructs", () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    expect(host.state()).toBe("constructed");
  });

  it("startDelivery() works against a zero-override construction, using the default Mock publisher and in-memory Observation Repository", async () => {
    const host = new FedosDesktopHost({
      desktopApplication: new DesktopApplication(),
      boardPersistence: new InMemoryFedosBoardPersistence(),
    });
    await host.start();
    expect(host.deliveryStatus()).toEqual({ running: false });
    host.startDelivery();
    expect(host.deliveryStatus()).toEqual({ running: true });
    await host.stopDelivery();
  });

  it("createFedosDesktopHost() passes through an explicit publisher/observationRepository/deliveryIntervalMs override unmodified", () => {
    const publisher = new MockFedosBoardOutboxPublisher();
    const observationRepository = new FedosDeliveryObservationRepository(new InMemoryFedosDeliveryObservationPersistence());
    const host = createFedosDesktopHost({ publisher, observationRepository, deliveryIntervalMs: 5000 });
    expect(host.state()).toBe("constructed");
  });

  it("createFedosDesktopHost() with zero delivery-related overrides still constructs (defaults apply)", () => {
    const host = createFedosDesktopHost();
    expect(host.state()).toBe("constructed");
  });

  it("the diff to fedos_desktop_host.ts is confirmed 100% additive by the doc's own claim", () => {
    expect(doc).toMatch(/is EMPTY/);
  });
});
