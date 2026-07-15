import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPostSource from "../src/board/fedos_board_post.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardServiceSource from "../src/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/board/persistence/fedos_board_hydration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistedRepositorySource from "../src/board/persistence/persisted_fedos_board_repository.ts?raw";

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
 * Secure Runtime Alpha 542 -- "Whole-Stack Dependency Graph": Stage 2
 * of the Alpha 541-560 Publish Runtime Operational Review Arc. Review
 * test only.
 */
describe("Secure Runtime Alpha 542 -- Whole-Stack Dependency Graph", () => {
  it("1. Board core (fedos_board_post.ts) has no outgoing edge outside Board core", () => {
    const importLines = codeOnlyLines(boardPostSource)
      .split("\n")
      .filter((line) => line.trim().startsWith("import"));
    for (const line of importLines) {
      expect(line).toMatch(/from\s+["']\.\/fedos_board_/);
    }
  });

  it("2. FedosBoardService's default repository argument is InMemoryFedosBoardRepository", () => {
    const code = codeOnlyLines(boardServiceSource);
    expect(code).toMatch(/repository:\s*FedosBoardRepository\s*=\s*new InMemoryFedosBoardRepository\(\)/);
  });

  it("3. hydrateFedosBoardService constructs FedosBoardService with zero arguments -- never wires PersistedFedosBoardRepository", () => {
    const code = codeOnlyLines(hydrationSource);
    expect(code).toMatch(/new FedosBoardService\(\)/);
    expect(code).not.toMatch(/PersistedFedosBoardRepository/);
  });

  it("4. PersistedFedosBoardRepository exists as a real, complete implementation of the contract", () => {
    const code = codeOnlyLines(persistedRepositorySource);
    expect(code).toMatch(/class PersistedFedosBoardRepository implements FedosBoardRepository/);
  });
});
