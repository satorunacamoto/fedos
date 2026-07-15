import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_478_publish_scheduler_implementation.md?raw";
import { FedosPublishScheduler } from "../src/board/outbox/fedos_publish_scheduler.js";
import { MockFedosBoardOutboxPublisher } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import type { FedosBoardOutboxPublisher } from "../src/board/outbox/fedos_board_outbox_publisher.js";
import { createFedosBoardOutboxObservation } from "../src/board/outbox/fedos_board_outbox_observation.js";
import { InMemoryFedosBoardOutboxPersistence } from "../src/board/outbox/in_memory_fedos_board_outbox_persistence.js";

/**
 * Secure Runtime Alpha 478 -- "Publish Scheduler Implementation and
 * Unit Verification": Stage 8 of the Alpha 471-480 Canonical Publish
 * Scheduler Foundation Arc.
 */
describe("Secure Runtime Alpha 478 -- Publish Scheduler Implementation and Unit Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc names all three new files and confirms no existing-file modification", () => {
    expect(designDocSource).toContain("fedos_board_outbox_publisher.ts");
    expect(designDocSource).toContain("fedos_board_outbox_observation.ts");
    expect(designDocSource).toContain("fedos_publish_scheduler.ts");
    expect(designDocSource).toMatch(
      /No existing file under `src\/board\/outbox\/` \(or anywhere else\) is\s*\nmodified/,
    );
  });

  it("3. the design doc reports this Arc's own seven-file isolated test run as 100% green", () => {
    expect(designDocSource).toMatch(/files passed, 59\/59 tests passed, zero failures/);
  });

  it("4. the design doc attributes the wider suite's failures to pre-existing and concurrent-external causes only", () => {
    expect(designDocSource).toMatch(/The 71 failing files are NOT this\n\s*Arc's own regression/);
  });

  it("5. all three exported modules are real, importable, and usable together end-to-end", async () => {
    const persistence = new InMemoryFedosBoardOutboxPersistence();
    const publisher: FedosBoardOutboxPublisher = new MockFedosBoardOutboxPublisher();
    const scheduler = new FedosPublishScheduler({ outboxPersistence: persistence, publisher, intervalMs: 500 });
    expect(scheduler.isRunning()).toBe(false);
    expect(await scheduler.tick()).toEqual([]);
    expect(createFedosBoardOutboxObservation("x" as never, "delivered", 1)).not.toBeNull();
  });
});
