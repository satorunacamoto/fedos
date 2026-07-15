import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import source from "../src/board/publish/nostr/fedos_nostr_board_publisher.ts?raw";

describe("Secure Runtime Alpha 455 -- FedosNostrBoardPublisher Interface", () => {
  it("exports exactly FedosNostrBoardPublishEntry and FedosNostrBoardPublisher", () => {
    const exportLines = (source as string).match(/^export .*$/gm) ?? [];
    expect(exportLines).toHaveLength(2);
    expect(source).toContain("export interface FedosNostrBoardPublishEntry {");
    expect(source).toContain("export interface FedosNostrBoardPublisher {");
  });

  it("FedosNostrBoardPublisher names exactly publishOne/publishBatch, both boolean-returning", () => {
    expect(source).toMatch(
      /export interface FedosNostrBoardPublisher \{\s*\n\s*publishOne\(entry: FedosNostrBoardPublishEntry\): Promise<boolean>;\s*\n\s*publishBatch\(entries: readonly FedosNostrBoardPublishEntry\[\]\): Promise<readonly boolean\[\]>;\s*\n\s*\}/,
    );
  });

  it("FedosBoardOutboxIntent and FedosNostrWireEvent are imported as type-only", () => {
    expect(source).toMatch(/import type \{ FedosBoardOutboxIntent \} from "\.\.\/\.\.\/outbox\/fedos_board_outbox_types\.js";/);
    expect(source).toMatch(/import type \{ FedosNostrWireEvent \} from "\.\.\/\.\.\/\.\.\/desktop\/fedos_nostr_wire_event\.js";/);
  });

  it("defines no class, no function, no runtime behavior -- types only", () => {
    const codeOnly = source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\bclass\b|\bfunction\b|=>/);
  });

  it("names no Retry/Backoff/Observation/ACK/Pool vocabulary in code (comment prose describing what's absent doesn't count)", () => {
    const codeOnly = source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/[Rr]etry|[Bb]ackoff|[Oo]bservation|\bACK\b|\bPool\b/);
  });
});
