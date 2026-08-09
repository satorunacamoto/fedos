import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_212_relay_interface.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createDesktopApplicationSource from "../src/desktop/create_desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

/**
 * Secure Runtime Alpha 212 -- "Relay Interface": Stage 2 of the Nostr
 * Relay Foundation Arc. Adds src/desktop/fedos_relay.ts, exporting
 * FedosRelay -- a bare, protocol-independent interface naming exactly
 * one connection target (url) and no method of any kind yet.
 */
describe("Secure Runtime Alpha 212 -- Relay Interface", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/fedos_relay\.ts`, and nothing else/,
    );
  });

  it("3. FedosRelay is the ONLY export from fedos_relay.ts, and always carries a readonly url member", () => {
    const exportNames = [...relaySource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosRelay"]);
    expect(relaySource).toMatch(/export interface FedosRelay \{\s*\n\s*readonly url: string;/);
  });

  it("3b. the design doc's own Alpha 212 code snippet shows the interface as it stood AT THIS STAGE -- exactly one member, no method (a frozen, point-in-time record; the live source grows in later Stages of this same Arc)", () => {
    const section = (designDocSource.match(/## 2\. What was implemented([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    expect(section).toMatch(/export interface FedosRelay \{\s*\n\s*readonly url: string;\s*\n\}/);
  });

  it("4. structural: fedos_relay.ts has zero dependency on src/nostr/* or src/sign/* -- no import from either directory", () => {
    expect(relaySource).not.toMatch(/from ".*\/(nostr|sign)\//);
  });

  it("5. no ACK vocabulary exists IN CODE (comments legitimately name these as forbidden guardrails); REQ/CLOSE/Subscription/Filter were, as this Stage's own scope anticipated, legitimately added by Alpha 226, a later Arc", () => {
    const codeOnly = relaySource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/accepted|acknowledgement/i);
  });

  it("6. the design doc cross-references Alpha 211, Alpha 101, and Alpha 202", () => {
    for (const ref of [
      "secure_runtime_alpha_211_relay_code_review",
      "secure_runtime_alpha_101_public_identity_reader_interface",
      "secure_runtime_alpha_202_desktop_facing_event_reader_abstraction",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("7. the design doc's own 'does NOT do' list confirms no implementation and no method exists yet", () => {
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* implement `FedosRelay` — no class conforming to it\s*\n\s*exists anywhere in this repository yet/,
    );
    expect(designDocSource).toMatch(
      /Does \*\*not\*\* add `connect\(\)`, `disconnect\(\)`, `isConnected\(\)`, or\s*\n\s*`publish\(\)` to the interface/,
    );
  });

  it("8. Regression: desktop_application.ts and create_desktop_application.ts carry no reference to this Stage's own doc or FedosRelay", () => {
    for (const source of [desktopApplicationSource, createDesktopApplicationSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_212/);
      expect(source).not.toMatch(/FedosRelay/);
    }
  });

  it("9. Regression: create_runtime.ts/types.ts/worker.ts are unmodified -- no reference to this Stage's own doc or FedosRelay", () => {
    for (const source of [createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_212/);
      expect(source).not.toMatch(/FedosRelay/);
    }
  });
});
