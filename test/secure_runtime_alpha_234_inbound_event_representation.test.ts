import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_234_inbound_event_representation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wireEventSource from "../src/os/messenger/desktop/fedos_nostr_wire_event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosEventDescriptorSource from "../src/os/messenger/desktop/fedos_event_descriptor.ts?raw";

/**
 * Secure Runtime Alpha 234 -- "Inbound Event Representation": Stage 4
 * of the Nostr Relay Message Reception Arc. Adds
 * src/desktop/fedos_nostr_wire_event.ts, exporting
 * FedosNostrWireEvent -- Option B of four compared, preserving all
 * seven NIP-01 wire field names verbatim, no rename, no provider
 * field.
 */
describe("Secure Runtime Alpha 234 -- Inbound Event Representation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/fedos_nostr_wire_event\.ts`\./,
    );
  });

  it("3. structural: FedosNostrWireEvent is the only export, naming exactly the seven NIP-01 wire fields verbatim", () => {
    const exportNames = [...wireEventSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosNostrWireEvent"]);
    expect(wireEventSource).toMatch(
      /export interface FedosNostrWireEvent \{\s*\n\s*readonly id: string;\s*\n\s*readonly pubkey: string;\s*\n\s*readonly created_at: number;\s*\n\s*readonly kind: number;\s*\n\s*readonly tags: readonly \(readonly string\[\]\)\[\];\s*\n\s*readonly content: string;\s*\n\s*readonly sig: string;\s*\n\}/,
    );
  });

  it("4. structural: no provider field, and no protocol-neutral rename (author/createdAt/signature) IN CODE", () => {
    const interfaceBody = (wireEventSource.match(/export interface FedosNostrWireEvent \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
    expect(interfaceBody.length).toBeGreaterThan(0);
    expect(interfaceBody).not.toMatch(/provider/);
    expect(interfaceBody).not.toMatch(/\bauthor\b|\bcreatedAt\b|\bsignature\b/);
  });

  it("5. structural: fedos_nostr_wire_event.ts has zero import of any kind -- depends on nothing", () => {
    expect(wireEventSource).not.toMatch(/^import /m);
  });

  it("6. structural: defines a TYPE ONLY -- no function, class, or validation logic IN CODE", () => {
    const codeOnly = wireEventSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\bfunction\b|\bclass\b/);
  });

  it("7. the design doc's own section 2 compares all four options and adopts exactly Option B", () => {
    expect(designDocSource).toMatch(/\*\*A\. Reuse `FedosEventDescriptor` directly\.\*\* REJECTED/);
    expect(designDocSource).toMatch(/\*\*B\. Introduce a dedicated `FedosNostrWireEvent`\.\*\* \*\*ADOPTED\.\*\*/);
    expect(designDocSource).toMatch(/\*\*C\. Reuse the legacy `SignedNostrEvent`/);
    expect(designDocSource).toMatch(/\*\*D\. Expose the raw `unknown` object\.\*\* REJECTED/);
  });

  it("8. structural: FedosEventDescriptor (unmodified) still carries the provider field and renamed fields this Stage rejected reusing", () => {
    expect(fedosEventDescriptorSource).toMatch(/readonly provider: string;/);
    expect(fedosEventDescriptorSource).toMatch(/readonly author: string;/);
  });

  it("9. the design doc cross-references Alpha 232, Alpha 233, Alpha 231, and Alpha 202", () => {
    for (const ref of [
      "secure_runtime_alpha_232_relay_inbound_message_model",
      "secure_runtime_alpha_233_nip01_relay_wire_parser",
      "secure_runtime_alpha_231_existing_relay_inbound_inventory",
      "secure_runtime_alpha_202_desktop_facing_event_reader_abstraction",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("10. Regression: fedos_event_descriptor.ts carries no reference to this Stage's own doc or FedosNostrWireEvent", () => {
    expect(fedosEventDescriptorSource).not.toMatch(/secure_runtime_alpha_234/);
    expect(fedosEventDescriptorSource).not.toMatch(/FedosNostrWireEvent/);
  });
});
