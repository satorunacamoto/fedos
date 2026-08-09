import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_471_existing_scheduler_and_publisher_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistenceSource from "../src/os/messenger/board/outbox/fedos_board_outbox_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relayPublishSource from "../src/nostr/publish.ts?raw";

/**
 * Secure Runtime Alpha 471 -- "Existing Scheduler and Publisher
 * Inventory": Stage 1 of the Alpha 471-480 Canonical Publish Scheduler
 * Foundation Arc. Review only.
 */
describe("Secure Runtime Alpha 471 -- Existing Scheduler and Publisher Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc answers all eight numbered findings", () => {
    for (let i = 1; i <= 8; i++) {
      expect(designDocSource).toMatch(new RegExp(`^${i}\\. \\*\\*`, "m"));
    }
  });

  it("3. structural: FedosBoardOutboxPersistence exposes no pending/delivered query -- exactly the three Alpha 417 methods", () => {
    expect(persistenceSource).toMatch(/putIntent\(/);
    expect(persistenceSource).toMatch(/getIntent\(/);
    expect(persistenceSource).toMatch(/listIntents\(/);
    expect(persistenceSource).not.toMatch(/pending|delivered|Scheduler/i);
  });

  it("4. structural: RelayPublisher (src/nostr/publish.ts) is Nostr-specific -- no generic Outbox record reference", () => {
    expect(relayPublishSource).toMatch(/interface RelayPublisher/);
    expect(relayPublishSource).not.toMatch(/FedosPersistedBoardOutboxRecordV1|FedosBoardOutboxPublisher/);
  });

  it("5. the design doc concludes no protocol-agnostic Publisher port exists", () => {
    expect(designDocSource).toMatch(/protocol-agnostic Publisher port does NOT exist anywhere/);
  });

  it("6. the design doc concludes a new sibling Publisher port is required, mirroring Alpha 411", () => {
    expect(designDocSource).toMatch(/This Arc defines its own minimal, generic/);
  });

  it("7. the design doc records that in-progress Alpha 451-460 work is explicitly out of scope", () => {
    expect(designDocSource).toMatch(/is out of this Arc's scope entirely/);
  });

  it("8. the design doc reports the exact ripple scope -- three new files under src/board/outbox/", () => {
    expect(designDocSource).toMatch(/three new files under the existing/);
    expect(designDocSource).toContain("fedos_board_outbox_publisher.ts");
    expect(designDocSource).toContain("fedos_board_outbox_observation.ts");
    expect(designDocSource).toContain("fedos_publish_scheduler.ts");
  });
});
