import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_372_canonical_board_query_contract.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import typesSource from "../src/board/query/fedos_board_query_types.ts?raw";

import type { FedosBoardQuerySource } from "../src/board/query/fedos_board_query_types.js";
import { FedosBoardService } from "../src/board/repository/fedos_board_service.js";

/**
 * Secure Runtime Alpha 372 -- "Canonical Board Query Contract": Stage
 * 2 of the Alpha 371-380 Canonical Board Query Foundation Arc. Adds
 * src/board/query/fedos_board_query_types.ts -- type-only, four
 * exports, no implementation.
 */
describe("Secure Runtime Alpha 372 -- Canonical Board Query Contract", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: exactly four exports, all type-only, no function or class", () => {
    const exportCount = (typesSource.match(/^export /gm) ?? []).length;
    expect(exportCount).toBe(4);
    expect(typesSource).not.toMatch(/export function|export class/);
    expect(typesSource).toMatch(/export interface FedosBoardQueryFilter \{/);
    expect(typesSource).toMatch(/export interface FedosBoardQueryPageOptions \{/);
    expect(typesSource).toMatch(/export interface FedosBoardQueryResult \{/);
    expect(typesSource).toMatch(/export interface FedosBoardQuerySource \{/);
  });

  it("3. structural: every field on FedosBoardQueryFilter/PageOptions/Result is readonly", () => {
    for (const interfaceName of ["FedosBoardQueryFilter", "FedosBoardQueryPageOptions", "FedosBoardQueryResult"]) {
      const match = typesSource.match(new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`));
      expect(match).not.toBeNull();
      const body: string = match![1]!;
      const fieldLines = body
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0 && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"));
      expect(fieldLines.length).toBeGreaterThan(0);
      for (const line of fieldLines) {
        expect(line.startsWith("readonly ")).toBe(true);
      }
    }
  });

  it("4. type-level: FedosBoardService already structurally satisfies FedosBoardQuerySource, with no explicit implements", () => {
    const service = new FedosBoardService();
    const source: FedosBoardQuerySource = service; // compiles iff structural typing holds
    expect(typeof source.listBoardPosts).toBe("function");
    expect(typeof source.listThreadPosts).toBe("function");
  });

  it("5. structural: no cursor-shaped field exists on the page options type", () => {
    const pageOptionsMatch = typesSource.match(/export interface FedosBoardQueryPageOptions \{[\s\S]*?\n\}/);
    expect(pageOptionsMatch).not.toBeNull();
    expect(pageOptionsMatch![0]).not.toMatch(/readonly (cursor|after|before)\??:/i);
  });

  it("6. structural: the filter type has exactly the four reviewed dimensions, no more", () => {
    const filterMatch = typesSource.match(/export interface FedosBoardQueryFilter \{[\s\S]*?\n\}/);
    expect(filterMatch).not.toBeNull();
    const fieldCount = (filterMatch![0].match(/^\s*readonly \w+\?:/gm) ?? []).length;
    expect(fieldCount).toBe(4);
  });

  it("7. the design doc explains why FedosBoardQuerySource is structural, mirroring FedosBoardFeedSource", () => {
    expect(designDocSource).toContain(
      "## 3. Why `FedosBoardQuerySource` is structural, not a direct `FedosBoardService` dependency",
    );
  });

  it("8. the design doc cross-references Alpha 371, Alpha 313, Alpha 315, and Alpha 308", () => {
    for (const ref of [
      "secure_runtime_alpha_371_existing_read_path_inventory",
      "secure_runtime_alpha_313_persisted_board_record_v1",
      "secure_runtime_alpha_315_board_persistence_port",
      "secure_runtime_alpha_308_chronological_board_feed",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
