import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_411_existing_delivery_outbox_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publishSource from "../src/os/messenger/adapters/nostr/protocol/publish.ts?raw";

/**
 * Secure Runtime Alpha 411 -- "Existing Delivery / Queue / Outbox
 * Inventory": Stage 1 of the Alpha 411-420 Canonical Board Durable
 * Outbox Foundation Arc. Review only.
 */
describe("Secure Runtime Alpha 411 -- Existing Delivery / Queue / Outbox Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. the design doc answers all ten numbered inventory findings", () => {
    for (let i = 1; i <= 10; i++) {
      expect(designDocSource).toMatch(new RegExp(`^${i}\\. \\*\\*`, "m"));
    }
  });

  it("3. structural: FedosRelay.publish() is transport-only -- no Board/Outbox reference", () => {
    expect(relaySource).not.toMatch(/Outbox|FedosBoardPost/);
  });

  it("4. structural: WebSocketRelay is transport-only -- no Board/Outbox reference", () => {
    expect(websocketRelaySource).not.toMatch(/Outbox|FedosBoardPost/);
  });

  it("5. structural: nostr/publish.ts is a pure wire-message formatter, unaware of the Board model", () => {
    expect(publishSource).not.toMatch(/Outbox|FedosBoardPost/);
  });

  it("6. the design doc confirms no pre-existing Outbox, queue, or reusable delivery-intent abstraction", () => {
    expect(designDocSource).toMatch(/No existing Outbox, queue, or reusable delivery-intent/);
  });

  it("7. the design doc concludes a new sibling persistence port is required", () => {
    expect(designDocSource).toMatch(/A separate persistence port IS required/);
  });

  it("8. the design doc reports zero-ripple to the 29 pre-existing direct-construction test files", () => {
    expect(designDocSource).toMatch(/Zero of the 29 pre-existing test files/);
  });

  it("9. the design doc cross-references Alpha 409's own outbound publish readiness review", () => {
    expect(designDocSource).toContain("secure_runtime_alpha_409_outbound_publish_readiness_review");
  });
});
