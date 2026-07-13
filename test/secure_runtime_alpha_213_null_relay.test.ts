import { describe, it, expect } from "vitest";
import { NullRelay } from "../src/desktop/null_relay.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_213_null_relay.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";

/**
 * Secure Runtime Alpha 213 -- "Null Relay": Stage 3 of the Nostr Relay
 * Foundation Arc. Adds src/desktop/null_relay.ts (NullRelay), a
 * dependency-free FedosRelay implementation holding only a url, no
 * networking, no wiring.
 */
describe("Secure Runtime Alpha 213 -- Null Relay", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/null_relay\.ts`, and nothing else/,
    );
  });

  it("3. NullRelay is the ONLY export from null_relay.ts", () => {
    const exportNames = [...nullRelaySource.matchAll(/^export (?:class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["NullRelay"]);
  });

  it("4. the design doc's own Alpha 213 code snippet shows NullRelay as it stood AT THIS STAGE -- only a constructor, no field, no method (a frozen, point-in-time record; the live class grows in later Stages of this same Arc)", () => {
    const section = (designDocSource.match(/## 2\. What was implemented([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(
      /export class NullRelay implements FedosRelay \{\s*\n\s*readonly url: string;\s*\n\s*\n\s*constructor\(url: string\) \{\s*\n\s*this\.url = url;\s*\n\s*\}\s*\n\}/,
    );
  });

  it("5. structural: NullRelay implements FedosRelay and always holds the url it was constructed with", () => {
    expect(nullRelaySource).toMatch(/export class NullRelay implements FedosRelay \{/);
    expect(nullRelaySource).toMatch(/readonly url: string;/);
  });

  it("6. structural: no WebSocket/fetch reference exists in null_relay.ts's own CODE (comments legitimately name these as forbidden guardrails)", () => {
    const codeOnly = nullRelaySource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/WebSocket|fetch/);
  });

  it("7. the design doc cross-references Alpha 212, Alpha 211, Alpha 203, and Alpha 104", () => {
    for (const ref of [
      "secure_runtime_alpha_212_relay_interface",
      "secure_runtime_alpha_211_relay_code_review",
      "secure_runtime_alpha_203_null_event_reader_and_desktop_wiring_decision",
      "secure_runtime_alpha_104_null_reader",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc or NullRelay", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_213/);
      expect(source).not.toMatch(/NullRelay/);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("9. behavioral: constructing NullRelay stores the url verbatim and throws nothing", () => {
    let relay: NullRelay | undefined;
    expect(() => {
      relay = new NullRelay("wss://relay.example.test");
    }).not.toThrow();
    expect(relay?.url).toBe("wss://relay.example.test");
  });
});
