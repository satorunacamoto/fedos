import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPostSource from "../src/board/fedos_board_post.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardIdentifiersSource from "../src/board/fedos_board_identifiers.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardAuthorSource from "../src/board/fedos_board_author.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardSourceSource from "../src/board/fedos_board_source.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardModerationSource from "../src/board/fedos_board_moderation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardReaderSource from "../src/board/repository/fedos_board_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardServiceSource from "../src/board/repository/fedos_board_service.ts?raw";

function importTargets(source: string): string[] {
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
}

/**
 * Secure Runtime Alpha 552 -- "Circular Dependency Investigation":
 * Stage 12 of the Alpha 541-560 Publish Runtime Operational Review
 * Arc. Review test only.
 */
describe("Secure Runtime Alpha 552 -- Circular Dependency Investigation", () => {
  it("1. every Board-core file imports only sibling Board-core files (or nothing)", () => {
    for (const source of [boardPostSource, boardIdentifiersSource, boardAuthorSource, boardSourceSource, boardModerationSource]) {
      for (const target of importTargets(source)) {
        expect(target).toMatch(/^\.\/fedos_board_/);
      }
    }
  });

  it("2. FedosBoardReader (fedos_board_reader.ts) imports nothing from fedos_board_service.ts -- the Service->Reader edge is one-directional", () => {
    for (const target of importTargets(boardReaderSource)) {
      expect(target).not.toMatch(/fedos_board_service/);
    }
  });

  it("3. FedosBoardService imports FedosBoardReader (the one real edge) -- confirms the direction is Service -> Reader, not mutual", () => {
    expect(importTargets(boardServiceSource).some((t) => t.includes("fedos_board_reader"))).toBe(true);
  });
});
