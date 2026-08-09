import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_352_append_only_record_format.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import implementationSource from "../src/os/messenger/board/persistence/append_only_fedos_board_persistence.ts?raw";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 352 -- "Append-only Record Format": Stage 2 of
 * the Alpha 351-360 Append-only Durable Board Backend Arc. Design
 * only -- fixes JSON Lines, one record per line, no binary format, no
 * compression, no batching, and discloses the no-fsync crash
 * assumption ahead of implementation.
 */
describe("Secure Runtime Alpha 352 -- Append-only Record Format", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc fixes JSON Lines with no binary format, no compression, no batching", () => {
    for (const requirement of [
      "**No binary format**",
      "**No compression**",
      "**No batching**",
    ]) {
      expect(designDocSource).toContain(requirement);
    }
  });

  it("3. the design doc explicitly discloses the no-fsync limitation as deliberate, not an oversight", () => {
    expect(normalize(designDocSource)).toContain(
      "This is a genuine, disclosed limitation, not an",
    );
    expect(designDocSource).toContain("## 3. Named limitation: no `fsync`");
  });

  it("4. structural: the actual implementation matches the frozen format -- exactly one JSON.stringify call, newline-terminated, no compression library", () => {
    const stringifyCalls = (codeOnly(implementationSource).match(/JSON\.stringify\(/g) ?? []).length;
    expect(stringifyCalls).toBe(1);
    expect(implementationSource).toMatch(/JSON\.stringify\(record\) \+ "\\n"/);
    expect(codeOnly(implementationSource)).not.toMatch(/zlib|gzip|deflate|compress/i);
  });

  it("5. structural: the actual implementation still calls no fsync -- matching this Stage's own disclosed limitation", () => {
    expect(codeOnly(implementationSource)).not.toMatch(/fsync|fdatasync/);
  });

  it("6. structural: exactly one appendFileSync call exists -- no write batching of any kind", () => {
    const appendCalls = (codeOnly(implementationSource).match(/appendFileSync\(/g) ?? []).length;
    expect(appendCalls).toBe(1);
  });

  it("7. the design doc states this Stage adds no code, no file, no test", () => {
    expect(designDocSource).toContain("No code, no file, no test");
  });

  it("8. the design doc cross-references Alpha 351, Alpha 345, Alpha 344, and Alpha 314", () => {
    for (const ref of [
      "secure_runtime_alpha_351_existing_persistence_layer_inventory",
      "secure_runtime_alpha_345_crash_recovery_review",
      "secure_runtime_alpha_344_append_only_backend_review",
      "secure_runtime_alpha_314_board_serialization_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
