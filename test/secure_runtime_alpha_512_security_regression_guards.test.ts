import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import controllerSource from "../src/os/messenger/desktop/host/fedos_host_delivery_controller.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createHostSource from "../src/os/messenger/desktop/host/create_fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/os/messenger/board/outbox/fedos_publish_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxPublisherSource from "../src/os/messenger/board/outbox/fedos_board_outbox_publisher.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_512_security_regression_guards.md?raw";

const NEW_SOURCES = [controllerSource, hostSource, createHostSource] as string[];

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

describe("Secure Runtime Alpha 512 -- Security Regression Guards", () => {
  it("no forbidden protocol/subsystem reference in code across this Arc's own new/touched files", () => {
    for (const source of NEW_SOURCES) {
      expect(codeOnly(source)).not.toMatch(
        /ActivityPub|ATProto|AtProto|\bSession\b|Ontology|p2p|\bWorker\b|Cloudflare/i,
      );
    }
  });

  it("no numeric backoff/delay field is introduced anywhere in this Arc's own new files", () => {
    for (const source of NEW_SOURCES) {
      expect(codeOnly(source)).not.toMatch(/backoff|retryAfterMs|delayMs|exponential/i);
    }
  });

  it("FedosBoardOutboxRetryPolicy's own three-value vocabulary is unchanged", () => {
    expect(outboxPublisherSource).toMatch(
      /export type FedosBoardOutboxRetryPolicy = "immediate" \| "later" \| "never";/,
    );
  });

  it("FedosDesktopHost still calls publish()/publishOne() nowhere", () => {
    expect(codeOnly(hostSource)).not.toMatch(/\.publish\(|\.publishOne\(/);
  });

  it("fedos_host_delivery_controller.ts never calls #scheduler.start()/stop()", () => {
    expect(codeOnly(controllerSource)).not.toMatch(/#scheduler\.start\(\)|#scheduler\.stop\(\)/);
  });

  it("FedosPublishScheduler.ts was untouched by THIS Arc (Alpha 501-520) -- structural spot-check of its own public shape as of that Stage", () => {
    // Secure Runtime Alpha 563 (Alpha 561-580 Arc) later, legitimately,
    // changed tick()'s own signature (single-flight guard) -- this
    // Stage's "untouched by this Arc" claim is scoped to Alpha 501-520.
    expect(schedulerSource).toContain("readonly publisher: FedosBoardOutboxPublisher;");
    expect(schedulerSource).toContain("tick(): Promise<readonly FedosPublishSchedulerTickEntry[]> {");
  });

  it("the doc declares PASS", () => {
    expect(doc).toMatch(/PASS —/);
  });
});
