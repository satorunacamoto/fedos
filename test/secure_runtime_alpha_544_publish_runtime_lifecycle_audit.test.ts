import { describe, it, expect } from "vitest";
import { FedosPublishScheduler } from "../src/os/messenger/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/os/messenger/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { MockFedosBoardOutboxPublisher } from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.js";
import { DesktopApplication } from "../src/os/messenger/desktop/desktop_application.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";

/**
 * Secure Runtime Alpha 544 -- "Lifecycle Audit": Stage 4 of the Alpha
 * 541-560 Publish Runtime Operational Review Arc. Review test only.
 */
describe("Secure Runtime Alpha 544 -- Lifecycle Audit", () => {
  it("1. DesktopApplication has no stop()/dispose method of any kind", () => {
    expect(desktopApplicationSource).not.toMatch(/\bstop\s*\(/);
    expect((DesktopApplication.prototype as unknown as Record<string, unknown>).stop).toBeUndefined();
  });

  it("2. DesktopApplication.start() throws on a second call -- permanent one-way state", async () => {
    const app = new DesktopApplication();
    await app.start();
    await expect(app.start()).rejects.toThrow();
  });

  it("3. FedosPublishScheduler.start()/stop() tolerate a real start-stop-start cycle -- reversible, unlike Host or DesktopApplication", () => {
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: new InMemoryFedosBoardOutboxPersistence(),
      publisher: new MockFedosBoardOutboxPublisher(),
      intervalMs: 1000,
      setIntervalFn: () => 1,
      clearIntervalFn: () => {},
    });
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
  });

  it("4. FedosPublishScheduler.stop() is idempotent -- calling it twice in a row does not throw", () => {
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: new InMemoryFedosBoardOutboxPersistence(),
      publisher: new MockFedosBoardOutboxPublisher(),
      intervalMs: 1000,
      setIntervalFn: () => 1,
      clearIntervalFn: () => {},
    });
    expect(() => scheduler.stop()).not.toThrow();
    expect(() => scheduler.stop()).not.toThrow();
  });
});
