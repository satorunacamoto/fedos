import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_347_storage_layout_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import factorySource from "../src/os/messenger/desktop/host/create_fedos_desktop_host.ts?raw";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 347 -- "Storage Layout Review": Stage 7 of the
 * Alpha 341-350 Board Durable Backend Re-evaluation & Local Backend
 * Selection Arc. Review only. No implementation. No filesystem API of
 * any kind. Reviews a backend-agnostic directory-layout NAME
 * proposal without deciding an actual path.
 */
describe("Secure Runtime Alpha 347 -- Storage Layout Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc names all four proposed layout directories", () => {
    for (const dir of ["board/", "posts/", "metadata/", "snapshots/", "tmp/"]) {
      expect(designDocSource).toContain(dir);
    }
  });

  it("3. the design doc explicitly makes no filesystem call and decides no actual path", () => {
    expect(designDocSource).toMatch(
      /No implementation\. No filesystem API of any kind is called by\s*this Stage\./,
    );
    expect(designDocSource).toContain("<host-data-dir>");
  });

  it("4. structural: no filesystem path or directory-layout string exists anywhere in the actual Host source", () => {
    for (const source of [codeOnly(hostSource), codeOnly(factorySource)]) {
      expect(source).not.toMatch(/node:fs|node:path|["']\.\/board\/|posts\/|metadata\/|snapshots\//);
    }
  });

  it("5. the design doc names every explicit non-decision", () => {
    expect(designDocSource).toContain("## 3. What this Stage explicitly does NOT decide");
  });

  it("6. the design doc explains why the layout is backend-agnostic by design, mirroring FedosBoardPersistence itself", () => {
    expect(designDocSource).toMatch(/mirroring `FedosBoardPersistence`\s*itself \(Alpha 342 §2\)\./);
  });

  it("7. the design doc cross-references Alpha 344, Alpha 346, Alpha 338, and Alpha 328", () => {
    for (const ref of [
      "secure_runtime_alpha_344_append_only_backend_review",
      "secure_runtime_alpha_346_migration_strategy",
      "secure_runtime_alpha_338_local_process_entrypoint_review",
      "secure_runtime_alpha_328_board_schema_migration_architecture",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
