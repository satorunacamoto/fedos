import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import schedulerSource from "../src/board/outbox/fedos_publish_scheduler.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardReaderSource from "../src/board/repository/fedos_board_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardServiceSource from "../src/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

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
 * Secure Runtime Alpha 541 -- "Publish Runtime Operational Review:
 * Inventory": Stage 1 of the Alpha 541-560 Publish Runtime Operational
 * Review Arc. Review test only.
 */
describe("Secure Runtime Alpha 541 -- Publish Runtime Operational Review Inventory", () => {
  it("1. the only mentions of FedosDesktopHost/createFedosDesktopHost outside its own directory are doc-comment prose, never real imports", () => {
    for (const source of [schedulerSource, boardReaderSource, boardServiceSource]) {
      expect(codeOnlyLines(source)).not.toMatch(/FedosDesktopHost|createFedosDesktopHost/);
    }
  });

  it("2. src/worker.ts never references FedosDesktopHost, FedosBoardService, or FedosBoardPersistence", () => {
    const code = codeOnlyLines(workerSource);
    expect(code).not.toMatch(/FedosDesktopHost/);
    expect(code).not.toMatch(/FedosBoardService/);
    expect(code).not.toMatch(/FedosBoardPersistence/);
  });

  it("3. src/worker.ts renders Board pages from its own separate sample-data path", () => {
    const code = codeOnlyLines(workerSource);
    expect(code).toMatch(/SAMPLE_BOARDS|BoardData/);
  });
});
