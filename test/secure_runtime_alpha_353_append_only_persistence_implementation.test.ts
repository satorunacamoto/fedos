import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_353_append_only_persistence_implementation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import implementationSource from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.ts?raw";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppendOnlyFedosBoardPersistence } from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.js";
import type { FedosBoardPersistence } from "../src/os/messenger/board/persistence/fedos_board_persistence.js";

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 353 -- "Implement AppendOnlyFedosBoardPersistence":
 * Stage 3 of the Alpha 351-360 Append-only Durable Board Backend Arc.
 * Adds src/board/persistence/append_only_fedos_board_persistence.ts.
 * Zero dependency, zero constructor I/O, caller-supplied path.
 */
describe("Secure Runtime Alpha 353 -- Implement AppendOnlyFedosBoardPersistence", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. behavioral: constructing does not create the file -- no constructor I/O", () => {
    dir = mkdtempSync(join(tmpdir(), "a353-"));
    const filePath = join(dir, "board.jsonl");
    new AppendOnlyFedosBoardPersistence(filePath);
    expect(existsSync(filePath)).toBe(false);
  });

  it("3. behavioral: a fresh instance behaves like a fresh, empty persistence", () => {
    dir = mkdtempSync(join(tmpdir(), "a353-"));
    const filePath = join(dir, "board.jsonl");
    const persistence: FedosBoardPersistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(persistence.listPosts()).toEqual([]);
    expect(persistence.getPost("anything")).toBeNull();
  });

  it("4. type-level: AppendOnlyFedosBoardPersistence satisfies FedosBoardPersistence", () => {
    dir = mkdtempSync(join(tmpdir(), "a353-"));
    const filePath = join(dir, "board.jsonl");
    const persistence: FedosBoardPersistence = new AppendOnlyFedosBoardPersistence(filePath);
    expect(typeof persistence.putPost).toBe("function");
    expect(typeof persistence.getPost).toBe("function");
    expect(typeof persistence.listPosts).toBe("function");
  });

  it("5. structural: AppendOnlyFedosBoardPersistence is the only export", () => {
    const exportCount = (implementationSource.match(/^export /gm) ?? []).length;
    expect(exportCount).toBe(1);
    expect(implementationSource).toMatch(/export class AppendOnlyFedosBoardPersistence implements FedosBoardPersistence \{/);
  });

  it("6. structural: no external dependency -- only node:fs, reached via the established @ts-expect-error pattern", () => {
    expect(implementationSource).toMatch(
      /\/\/ @ts-expect-error `node:fs` has no type declarations without `@types\/node` in this project's tsconfig\.\nimport \{ readFileSync, appendFileSync \} from "node:fs";/,
    );
    expect(implementationSource).not.toMatch(/from ["'](?!\.\/|node:fs)/);
  });

  it("7. structural: the constructor performs field assignment only -- no fs call in the constructor body", () => {
    const ctorMatch = implementationSource.match(/constructor\(filePath: string\) \{[\s\S]*?\n {2}\}/);
    expect(ctorMatch).not.toBeNull();
    expect(ctorMatch![0]).not.toMatch(/readFileSync|appendFileSync|existsSync/);
  });

  it("8. the design doc explains the Fedos-prefixed naming decision", () => {
    expect(designDocSource).toContain("**`AppendOnlyFedosBoardPersistence`**");
  });

  it("9. the design doc cross-references Alpha 352, Alpha 316, and Alpha 023", () => {
    for (const ref of [
      "secure_runtime_alpha_352_append_only_record_format",
      "secure_runtime_alpha_316_in_memory_board_persistence",
      "secure_runtime_alpha_023_windows_dpapi_storage_backend",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
