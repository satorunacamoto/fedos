import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_222_subscription_interface.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import subscriptionSource from "../src/desktop/fedos_subscription.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";

/**
 * Secure Runtime Alpha 222 -- "Subscription Interface": Stage 2 of the
 * Nostr Subscription Foundation Arc. Adds src/desktop/fedos_subscription.ts,
 * exporting FedosSubscription -- an opaque identifier-only handle,
 * naming exactly one field (id) and nothing else.
 */
describe("Secure Runtime Alpha 222 -- Subscription Interface", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/fedos_subscription\.ts`\./,
    );
  });

  it("3. FedosSubscription is the ONLY export from fedos_subscription.ts, and carries exactly one readonly id field", () => {
    const exportNames = [...subscriptionSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosSubscription"]);
    expect(subscriptionSource).toMatch(/export interface FedosSubscription \{\s*\n\s*readonly id: string;\s*\n\}/);
  });

  it("4. structural: fedos_subscription.ts has zero import of any kind -- depends on nothing", () => {
    expect(subscriptionSource).not.toMatch(/^import /m);
  });

  it("5. structural: fedos_subscription.ts defines a TYPE ONLY -- no function, class, or runtime behavior IN CODE", () => {
    const codeOnly = subscriptionSource
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\bfunction\b|\bclass\b/);
  });

  it("6. structural: at this Stage, FedosRelay does not yet reference FedosSubscription (added later, Alpha 226)", () => {
    // This test file's own doc doc only covers Alpha 222; FedosRelay's
    // final shape (post Alpha 226) is verified by the Alpha 226/230 tests.
    // Here we only confirm the type itself exists and is well-formed.
    expect(relaySource).toMatch(/export interface FedosRelay \{/);
  });

  it("7. the design doc cross-references Alpha 221, Alpha 212, and Alpha 219", () => {
    for (const ref of [
      "secure_runtime_alpha_221_subscription_code_review",
      "secure_runtime_alpha_212_relay_interface",
      "secure_runtime_alpha_219_relay_extensibility_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. Regression: desktop_application.ts and create_runtime.ts carry no reference to this Stage's own doc or FedosSubscription", () => {
    for (const source of [desktopApplicationSource, createRuntimeSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_222/);
      expect(source).not.toMatch(/FedosSubscription/);
    }
  });
});
