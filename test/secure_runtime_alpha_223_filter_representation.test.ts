import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_223_filter_representation.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import filterSource from "../src/os/messenger/desktop/fedos_subscription_filter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import legacyRelaySource from "../src/os/messenger/adapters/nostr/protocol/relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/os/messenger/desktop/desktop_application.ts?raw";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 223 -- "Filter Representation": Stage 3 of the
 * Nostr Subscription Foundation Arc. Adds
 * src/desktop/fedos_subscription_filter.ts, exporting
 * FedosSubscriptionFilter -- exactly six optional, readonly, minimum
 * NIP-01 fields (ids/authors/kinds/since/until/limit), no #e/#p tag
 * filter of any kind.
 */
describe("Secure Runtime Alpha 223 -- Filter Representation", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(1500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage adding exactly one new file", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It adds exactly one new file,\s*\n`src\/desktop\/fedos_subscription_filter\.ts`\./,
    );
  });

  it("3. FedosSubscriptionFilter is the ONLY export, and names exactly six optional readonly fields", () => {
    const exportNames = [...filterSource.matchAll(/^export (?:interface|class|function|const) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(exportNames).toEqual(["FedosSubscriptionFilter"]);
    expect(filterSource).toMatch(
      /export interface FedosSubscriptionFilter \{\s*\n\s*readonly ids\?: readonly string\[\];\s*\n\s*readonly authors\?: readonly string\[\];\s*\n\s*readonly kinds\?: readonly number\[\];\s*\n\s*readonly since\?: number;\s*\n\s*readonly until\?: number;\s*\n\s*readonly limit\?: number;\s*\n\}/,
    );
  });

  it("4. structural: no #e/#p/generic tag filter field exists IN CODE", () => {
    expect(codeOnly(filterSource)).not.toMatch(/#e|#p|"#/);
  });

  it("5. structural: fedos_subscription_filter.ts has zero import of any kind -- depends on nothing", () => {
    expect(filterSource).not.toMatch(/^import /m);
  });

  it("6. structural: defines a TYPE ONLY -- no function, class, or filter-matching logic IN CODE", () => {
    expect(codeOnly(filterSource)).not.toMatch(/\bfunction\b|\bclass\b/);
  });

  it("7. structural: shares no code with the legacy, wider src/nostr/relay.ts NostrFilter", () => {
    expect(codeOnly(filterSource)).not.toMatch(/NostrFilter|RelayAdapter/);
    expect(legacyRelaySource).not.toMatch(/FedosSubscriptionFilter/);
  });

  it("8. the design doc cross-references Alpha 222, Alpha 221, and Alpha 211", () => {
    for (const ref of [
      "secure_runtime_alpha_222_subscription_interface",
      "secure_runtime_alpha_221_subscription_code_review",
      "secure_runtime_alpha_211_relay_code_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("9. Regression: desktop_application.ts carries no reference to this Stage's own doc or FedosSubscriptionFilter", () => {
    expect(desktopApplicationSource).not.toMatch(/secure_runtime_alpha_223/);
    expect(desktopApplicationSource).not.toMatch(/FedosSubscriptionFilter/);
  });
});
