import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_477_scheduler_lifecycle_model.md?raw";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";
import { MockFedosBoardOutboxPublisher } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_types.js";
import { serializeFedosBoardOutboxIntent } from "../src/board/outbox/fedos_board_outbox_codec.js";
import { toFedosBoardPostId } from "../src/board/fedos_board_identifiers.js";

function makeDeps() {
  const persistence = new InMemoryFedosBoardOutboxPersistence();
  const intent = createFedosBoardOutboxIntent(
    toFedosBoardPostId("post-1")!,
    { protocol: "nostr", destination: null },
    1_700_000_000,
  )!;
  persistence.putIntent(serializeFedosBoardOutboxIntent(intent));
  const publisher = new MockFedosBoardOutboxPublisher();

  const handlers: Array<() => void> = [];
  const cleared: unknown[] = [];
  let nextHandle = 1;
  const setIntervalFn = (handler: () => void): unknown => {
    handlers.push(handler);
    return nextHandle++;
  };
  const clearIntervalFn = (handle: unknown): void => {
    cleared.push(handle);
  };

  return { persistence, publisher, handlers, cleared, setIntervalFn, clearIntervalFn };
}

/**
 * Secure Runtime Alpha 477 -- "Scheduler Lifecycle Model": Stage 7 of
 * the Alpha 471-480 Canonical Publish Scheduler Foundation Arc.
 */
describe("Secure Runtime Alpha 477 -- Scheduler Lifecycle Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1200);
  });

  it("2. the design doc adopts throw-on-double-start, idempotent stop()", () => {
    expect(designDocSource).toMatch(/`stop\(\)` is an idempotent no-op if not running\.\*\* ADOPTED\./);
  });

  it("3. constructor throws on a zero, negative, or non-integer intervalMs", () => {
    const { persistence, publisher } = makeDeps();
    expect(() => new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 0 })).toThrow();
    expect(() => new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: -5 })).toThrow();
    expect(() => new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1.5 })).toThrow();
    expect(
      () => new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: NaN }),
    ).toThrow();
  });

  it("4. constructor performs no side effect -- no timer started, isRunning() is false", () => {
    const { persistence, publisher, handlers } = makeDeps();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });
    expect(scheduler.isRunning()).toBe(false);
    expect(handlers).toHaveLength(0);
    expect(publisher.calls).toHaveLength(0);
  });

  it("5. start() registers exactly one interval handler via the injected setIntervalFn", () => {
    const { persistence, publisher, handlers, setIntervalFn, clearIntervalFn } = makeDeps();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      setIntervalFn,
      clearIntervalFn,
    });
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    expect(handlers).toHaveLength(1);
  });

  it("6. start() throws if already running", () => {
    const { persistence, publisher, setIntervalFn, clearIntervalFn } = makeDeps();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      setIntervalFn,
      clearIntervalFn,
    });
    scheduler.start();
    expect(() => scheduler.start()).toThrow();
  });

  it("7. stop() clears the interval via the injected clearIntervalFn and is idempotent", () => {
    const { persistence, publisher, cleared, setIntervalFn, clearIntervalFn } = makeDeps();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      setIntervalFn,
      clearIntervalFn,
    });
    scheduler.start();
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
    expect(cleared).toHaveLength(1);
    expect(() => scheduler.stop()).not.toThrow();
    expect(cleared).toHaveLength(1);
  });

  it("8. after start(), invoking the captured handler runs a real tick() (fire-and-forget, never throws)", async () => {
    const { persistence, publisher, handlers, setIntervalFn, clearIntervalFn } = makeDeps();
    const scheduler = new FedosPublishScheduler({
      outboxPersistence: persistence,
      publisher,
      intervalMs: 1000,
      setIntervalFn,
      clearIntervalFn,
    });
    scheduler.start();
    expect(() => handlers[0]()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(publisher.calls).toHaveLength(1);
  });

  it("9. tick() is callable directly without ever calling start()", async () => {
    const { persistence, publisher } = makeDeps();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 1000 });
    const entries = await scheduler.tick();
    expect(entries).toHaveLength(1);
    expect(scheduler.isRunning()).toBe(false);
  });
});
