import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_211_relay_code_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/adapters/nostr/protocol/relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wsRelaySource from "../src/os/messenger/adapters/nostr/protocol/ws_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publishSource from "../src/os/messenger/adapters/nostr/protocol/publish.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import messagesSource from "../src/os/messenger/adapters/nostr/protocol/messages.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import desktopApplicationSource from "../src/desktop/desktop_application.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/os/_legacy_prototype/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 211 -- "Existing Relay Code Review": Stage 1 of
 * the Nostr Relay Foundation Arc (Alpha 211-220). Review only. Confirms
 * src/nostr/relay.ts, ws_relay.ts, publish.ts, and messages.ts are all
 * REQ/EOSE/CLOSE/Filter/ACK-oriented and unsuitable for reuse, and
 * decides a new, minimal, Desktop-owned boundary is required.
 */
describe("Secure Runtime Alpha 211 -- Existing Relay Code Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO code change of any\s*\nkind/);
  });

  it("3. structural: src/nostr/relay.ts is filter/query-oriented (confirms the review's own finding)", () => {
    expect(relaySource).toMatch(/export interface NostrFilter/);
    expect(relaySource).toMatch(/query\(filters: NostrFilter\[\]\): Promise<NostrEvent\[\]>/);
  });

  it("4. structural: src/nostr/ws_relay.ts sends REQ and CLOSE messages", () => {
    expect(wsRelaySource).toMatch(/"REQ"/);
    expect(wsRelaySource).toMatch(/"CLOSE"/);
  });

  it("5. structural: src/nostr/publish.ts waits for an OK acknowledgement (PublishResult carries accepted/message)", () => {
    expect(publishSource).toMatch(/interface PublishResult/);
    expect(publishSource).toMatch(/readonly accepted: boolean/);
    expect(publishSource).toMatch(/parseOkMessage/);
  });

  it("6. structural: src/nostr/messages.ts parses EVENT/EOSE/NOTICE, inseparable from the excluded subscription flow", () => {
    expect(messagesSource).toMatch(/case "EVENT"/);
    expect(messagesSource).toMatch(/case "EOSE"/);
  });

  it("7. the design doc's own Decision section names all three new files under src/desktop/", () => {
    const section = (designDocSource.match(/## 4\. Decision([\s\S]*?)\n## 5\./) ?? [])[1] ?? "";
    expect(section).toContain("`FedosRelay`");
    expect(section).toContain("`NullRelay`");
    expect(section).toContain("`WebSocketRelay`");
  });

  it("8. the design doc cross-references Alpha 201, Alpha 202, Alpha 210, and Alpha 101", () => {
    for (const ref of [
      "secure_runtime_alpha_201_event_runtime_exposure_review",
      "secure_runtime_alpha_202_desktop_facing_event_reader_abstraction",
      "secure_runtime_alpha_210_event_runtime_boundary_completion",
      "secure_runtime_alpha_101_public_identity_reader_interface",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("9. Regression: src/nostr/relay.ts, ws_relay.ts, publish.ts, and messages.ts carry no reference to this Stage's own doc", () => {
    for (const source of [relaySource, wsRelaySource, publishSource, messagesSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_211/);
    }
  });

  it("10. Regression: desktop_application.ts, create_runtime.ts/types.ts/worker.ts carry no reference to this Stage's own doc", () => {
    for (const source of [desktopApplicationSource, createRuntimeSource, runtimeTypesSource, workerSource]) {
      expect(source).not.toMatch(/secure_runtime_alpha_211/);
    }
  });

  it("11. Regression: package.json dependency count remains unchanged at 2 -- no new Cargo/npm dependency", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });
});
