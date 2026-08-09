import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_205_event_immutability_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/os/messenger/desktop/fedos_event_descriptor.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerSource from "../src/os/messenger/desktop/fedos_event_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullEventReaderSource from "../src/os/messenger/desktop/null_event_reader.ts?raw";

/**
 * Secure Runtime Alpha 205 -- "Event Immutability Review": Stage 5 of
 * the Nostr Event Runtime Exposure Arc. Review only. Confirms every
 * field on FedosEventDescriptor is readonly, FedosEventReader exposes
 * no write/update/delete method, and NullEventReader holds no mutable
 * internal state.
 */
describe("Secure Runtime Alpha 205 -- Event Immutability Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. structural: every field on FedosEventDescriptor is readonly -- zero mutable field", () => {
    const body = (descriptorSource.match(/export interface FedosEventDescriptor \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    const fieldLines = body
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
    expect(fieldLines.length).toBe(8);
    for (const line of fieldLines) {
      expect(line).toMatch(/^readonly \w+:/);
    }
  });

  it("4. structural: the tags field is doubly readonly -- outer array AND inner arrays", () => {
    expect(descriptorSource).toMatch(/readonly tags: readonly \(readonly string\[\]\)\[\];/);
  });

  it("5. structural: FedosEventReader declares exactly one method, returning a readonly array of FedosEventDescriptor", () => {
    const methodNames = [...readerSource.matchAll(/^\s{2}(\w+)\(/gm)].map((m: RegExpMatchArray) => m[1]);
    expect(methodNames).toEqual(["readEvents"]);
    expect(readerSource).toMatch(/Promise<readonly FedosEventDescriptor\[\]>/);
  });

  it("6. structural: no write/update/delete/clear method name appears anywhere in the reader interface's own CODE (comments legitimately discuss mutation as a forbidden guardrail)", () => {
    const codeOnly = readerSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/write|update|delete|clear|mutate|set[A-Z]/i);
  });

  it("7. structural: NullEventReader holds no field of any kind", () => {
    const classBody = (nullEventReaderSource.match(/export class NullEventReader[^{]*\{([\s\S]*)\n\}/) ?? [])[1] ?? "";
    expect(classBody).not.toMatch(/#\w+/);
  });

  it("8. behavioral: the array returned by NullEventReader.readEvents() is a fresh instance on every call, never a shared reference", async () => {
    const { NullEventReader } = await import("../src/os/messenger/desktop/null_event_reader.js");
    const reader = new NullEventReader();
    const first = await reader.readEvents();
    const second = await reader.readEvents();
    expect(first).not.toBe(second);
    expect(first).toEqual([]);
    expect(second).toEqual([]);
  });

  it("9. the design doc cross-references Alpha 204, Alpha 202, and Alpha 197", () => {
    for (const ref of [
      "secure_runtime_alpha_204_event_ownership_review",
      "secure_runtime_alpha_202_desktop_facing_event_reader_abstraction",
      "secure_runtime_alpha_197_event_boundary_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
