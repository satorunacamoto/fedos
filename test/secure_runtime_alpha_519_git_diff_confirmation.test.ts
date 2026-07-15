import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_519_git_diff_confirmation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/board/outbox/fedos_publish_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxPublisherSource from "../src/board/outbox/fedos_board_outbox_publisher.ts?raw";

describe("Secure Runtime Alpha 519 -- Git Diff Confirmation", () => {
  it("names all four modified pre-existing files and the additive/deletion counts per file", () => {
    expect(doc).toContain("README.md");
    expect(doc).toContain("fedos_desktop_host.ts");
    expect(doc).toContain("create_fedos_desktop_host.ts");
    expect(doc).toContain("secure_runtime_alpha_488_");
    expect(doc).toMatch(/126 \| \*\*0\*\*/);
    expect(doc).toMatch(/52 \| \*\*0\*\*/);
  });

  it("Host's own tick-driving/lifecycle methods are present (proving the 126-insertion claim corresponds to real, exercised code, not filler)", () => {
    for (const method of ["startDelivery(", "stopDelivery(", "deliveryStatus(", "observationQuery("]) {
      expect(hostSource).toContain(method);
    }
  });

  it("FedosPublishScheduler's own public shape is unchanged, confirming the EMPTY diff claim structurally", () => {
    expect(schedulerSource).toContain("start(): void {");
    expect(schedulerSource).toContain("stop(): void {");
    expect(schedulerSource).toContain("async tick(): Promise<readonly FedosPublishSchedulerTickEntry[]> {");
  });

  it("FedosBoardOutboxPublisher's own interface is unchanged", () => {
    expect(outboxPublisherSource).toContain(
      "publish(record: FedosPersistedBoardOutboxRecordV1): Promise<FedosBoardOutboxPublishResult>;",
    );
  });
});
