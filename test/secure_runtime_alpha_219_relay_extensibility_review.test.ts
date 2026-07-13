import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_219_relay_extensibility_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 219 -- "Relay Future Extensibility Review":
 * Stage 9 of the Nostr Relay Foundation Arc. Review only. Confirms
 * FedosRelay's current shape is compatible with a future Relay Pool,
 * Subscription, REQ, and CLOSE -- as additive, composable future work,
 * never requiring FedosRelay itself to be reshaped -- and that none of
 * the four exists in any of the three Relay files' own code today.
 */
describe("Secure Runtime Alpha 219 -- Relay Future Extensibility Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. the design doc reviews all four named topics: Relay Pool, Subscription, REQ, and CLOSE", () => {
    expect(designDocSource).toMatch(/## 2\. Relay Pool/);
    expect(designDocSource).toMatch(/## 3\. Subscription/);
    expect(designDocSource).toMatch(/## 4\. REQ/);
    expect(designDocSource).toMatch(/## 5\. CLOSE/);
  });

  it("4. structural: zero reference to REQ/CLOSE/Subscription/Filter/Pool in any of the three Relay files' own CODE", () => {
    for (const source of [relaySource, nullRelaySource, websocketRelaySource]) {
      expect(codeOnly(source)).not.toMatch(/\bREQ\b|\bCLOSE\b|Subscription|Filter|Pool/);
    }
  });

  it("5. structural: FedosRelay's own final method set is unchanged from Alpha 216's own closing state -- connect/disconnect/isConnected/publish, plus url", () => {
    expect(relaySource).toMatch(
      /export interface FedosRelay \{\s*\n\s*readonly url: string;\s*\n\s*connect\(\): Promise<void>;\s*\n\s*disconnect\(\): Promise<void>;\s*\n\s*isConnected\(\): boolean;\s*\n\s*publish\(event: FedosEventDescriptor\): Promise<void>;\s*\n\}/,
    );
  });

  it("6. the design doc's own §6 confirms 'no ACK handling' is publish-specific, not assumed to generalize to a future Subscription", () => {
    const section = (designDocSource.match(/## 6\. What does NOT generalize([\s\S]*?)\n## 7\./) ?? [])[1] ?? "";
    expect(section).toMatch(/is NOT a\s*\nprinciple a future Subscription Stage should try to inherit unchanged/);
  });

  it("7. the design doc cross-references Alpha 218, Alpha 216, Alpha 211, Alpha 199, and Alpha 179", () => {
    for (const ref of [
      "secure_runtime_alpha_218_relay_boundary_review",
      "secure_runtime_alpha_216_publish_api",
      "secure_runtime_alpha_211_relay_code_review",
      "secure_runtime_alpha_199_event_protocol_extensibility_review",
      "secure_runtime_alpha_179_nostr_identifier_protocol_extensibility_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("8. Regression: none of the three Relay files carries a reference to this Stage's own doc", () => {
    for (const source of [relaySource, nullRelaySource, websocketRelaySource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_219/);
    }
  });
});
