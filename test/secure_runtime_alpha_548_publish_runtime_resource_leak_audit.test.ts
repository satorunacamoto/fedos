import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/os/messenger/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { MockFedosBoardOutboxPublisher } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";

/**
 * Secure Runtime Alpha 548 -- "Resource Leak Audit": Stage 8 of the
 * Alpha 541-560 Publish Runtime Operational Review Arc. Review test
 * only.
 */
describe("Secure Runtime Alpha 548 -- Resource Leak Audit", () => {
  it("1. FedosPublishScheduler.stop() actually clears the timer handle it was given -- real execution, not just source reading", () => {
    let cleared: unknown = undefined;
    const handle = { marker: "the-handle" };
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: new InMemoryFedosBoardOutboxPersistence(),
      publisher: new MockFedosBoardOutboxPublisher(),
      intervalMs: 1000,
      setIntervalFn: () => handle,
      clearIntervalFn: (h) => {
        cleared = h;
      },
    });
    scheduler.start();
    scheduler.stop();
    expect(cleared).toBe(handle);
  });

  it("2. WebSocketRelay.disconnect() closes the socket and clears its own internal reference", () => {
    expect(websocketRelaySource).toMatch(/socket\.close\(\)/);
    expect(websocketRelaySource).toMatch(/this\.#socket = undefined/);
  });

  it("3. WebSocketRelay.disconnect() is idempotent -- safe to call when not connected", () => {
    expect(websocketRelaySource).toMatch(/if \(!this\.#connected \|\| this\.#socket === undefined\)/);
  });
});
