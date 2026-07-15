import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/board/outbox/fedos_publish_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relayNostrPublisherSource from "../src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

/**
 * Secure Runtime Alpha 546 -- "Shutdown Audit": Stage 6 of the Alpha
 * 541-560 Publish Runtime Operational Review Arc. Review test only.
 */
describe("Secure Runtime Alpha 546 -- Shutdown Audit", () => {
  it("1. FedosDesktopHost.stop()'s own body contains no await", () => {
    const code = codeOnlyLines(hostSource);
    const stopStart = code.indexOf("async stop(): Promise<void> {");
    const stopEnd = code.indexOf("\n  }", stopStart);
    const stopBody = code.slice(stopStart, stopEnd);
    expect(stopBody).not.toMatch(/await/);
  });

  it("2. FedosRelayNostrBoardPublisher has no stop/close/dispose method of any kind", () => {
    const code = codeOnlyLines(relayNostrPublisherSource);
    expect(code).not.toMatch(/\bstop\s*\(|\bclose\s*\(|\bdispose\s*\(/);
  });

  it("3. FedosPublishScheduler.stop() is synchronous (not async) and never references an in-flight tick Promise", () => {
    const code = codeOnlyLines(schedulerSource);
    expect(code).toMatch(/stop\(\): void \{/);
    const stopStart = code.indexOf("stop(): void {");
    const stopEnd = code.indexOf("\n  }", stopStart);
    const stopBody = code.slice(stopStart, stopEnd);
    expect(stopBody).not.toMatch(/tick|Promise|await/);
  });
});
