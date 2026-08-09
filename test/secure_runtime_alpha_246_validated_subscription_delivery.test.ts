import { describe, it, expect, vi } from "vitest";
import { createValidatedEventListener } from "../src/desktop/validated_subscription_adapter.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
import type { FedosValidatedNostrEvent } from "../src/desktop/fedos_validated_nostr_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_246_validated_subscription_delivery.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterSource from "../src/os/messenger/desktop/validated_subscription_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nullRelaySource from "../src/os/messenger/desktop/null_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";

const VALID_EVENT: FedosNostrWireEvent = {
  id: "42e04d5703c1ce6b135d167273eb4936720f008c517e2d9120445616b9e8c660",
  pubkey: "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
  created_at: 1700000300,
  kind: 1,
  tags: [],
  content:
    'quote:" backslash:\\ newline:\n cr:\r tab:\t backspace:\b formfeed:\f nonascii: héllo 世界 🎉',
  sig: "8096bd74d3289b9cc89dfb232f9be67c77cf38159752e1387793d1d527e707b6197aaadab40da763593806bebbdd75b614b165f81b5b8e1d118480d8b1ee6242",
};

/**
 * Secure Runtime Alpha 246 -- "Validated Subscription Delivery": Stage
 * 6 of the Nostr Inbound Event Validation Arc. Adds
 * src/desktop/validated_subscription_adapter.ts, exporting
 * createValidatedEventListener -- an EXTERNAL adapter (Option C) over
 * the existing onSubscriptionMessage(), zero change to
 * FedosRelay/NullRelay/WebSocketRelay.
 */
describe("Secure Runtime Alpha 246 -- Validated Subscription Delivery", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself an IMPLEMENTS Stage that modifies neither fedos_relay.ts, null_relay.ts, nor websocket_relay.ts", () => {
    expect(designDocSource).toMatch(/this Stage IMPLEMENTS/);
    expect(designDocSource).toMatch(
      /It modifies NEITHER\s*\n`fedos_relay\.ts`, `null_relay\.ts`, NOR `websocket_relay\.ts`\./,
    );
  });

  it("3. the design doc's own section 2 compares all four options and adopts exactly Option C", () => {
    expect(designDocSource).toMatch(/\*\*A\. Validate INSIDE `WebSocketRelay`/);
    expect(designDocSource).toMatch(/\*\*B\. Keep raw delivery and add `onValidatedEvent/);
    expect(designDocSource).toMatch(/\*\*C\. Add a validator adapter OUTSIDE `WebSocketRelay`\.\*\*\s*\n\*\*ADOPTED\.\*\*/);
    expect(designDocSource).toMatch(/\*\*D\. Replace `FedosNostrWireEvent` with validated events GLOBALLY\.\*\*/);
  });

  it("4. structural: fedos_relay.ts, null_relay.ts, and websocket_relay.ts carry no reference to this Stage's own symbols", () => {
    for (const source of [relaySource, nullRelaySource, websocketRelaySource]) {
      expect(source).not.toMatch(/createValidatedEventListener|FedosValidatedEventListener|validateInboundNostrEvent/);
    }
  });

  it("5. structural: FedosValidatedEventListener and createValidatedEventListener are the only exports", () => {
    const exportNames = [...adapterSource.matchAll(/^export (?:type|function) (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(new Set(exportNames)).toEqual(new Set(["FedosValidatedEventListener", "createValidatedEventListener"]));
  });

  it("6. structural: no reference to src/nostr/* or src/sign/* anywhere in this file", () => {
    expect(adapterSource).not.toMatch(/from ".*\/(nostr|sign)\//);
  });

  it("7. the design doc cross-references Alpha 245, Alpha 236, Alpha 238, and Alpha 247", () => {
    for (const ref of [
      "secure_runtime_alpha_245_combined_inbound_event_validator",
      "secure_runtime_alpha_236_subscription_event_delivery",
      "secure_runtime_alpha_238_ok_notice_handling",
      "secure_runtime_alpha_247_validation_failure_semantics",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral
  // ---------------------------------------------------------------------

  it("8. behavioral: a valid EVENT message is delivered to the wrapped listener exactly once", () => {
    const received: FedosValidatedNostrEvent[] = [];
    const wrapped = createValidatedEventListener((event) => received.push(event));
    wrapped({ kind: "event", subscriptionId: "sub-1", event: VALID_EVENT });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(VALID_EVENT);
  });

  it("9. behavioral: an invalid EVENT never reaches the wrapped listener", () => {
    const received: FedosValidatedNostrEvent[] = [];
    const wrapped = createValidatedEventListener((event) => received.push(event));
    wrapped({ kind: "event", subscriptionId: "sub-1", event: { ...VALID_EVENT, content: "tampered" } });
    expect(received).toEqual([]);
  });

  it("10. behavioral: EOSE is never forwarded to the wrapped listener", () => {
    const listener = vi.fn();
    const wrapped = createValidatedEventListener(listener);
    wrapped({ kind: "eose", subscriptionId: "sub-1" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("11. behavioral: a throwing wrapped listener does not escape the adapter", () => {
    const wrapped = createValidatedEventListener(() => {
      throw new Error("boom");
    });
    expect(() => wrapped({ kind: "event", subscriptionId: "sub-1", event: VALID_EVENT })).not.toThrow();
  });

  it("12. behavioral: a throwing wrapped listener does not prevent a later, separate call from delivering", () => {
    let calls = 0;
    const wrapped = createValidatedEventListener(() => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
    });
    wrapped({ kind: "event", subscriptionId: "sub-1", event: VALID_EVENT });
    wrapped({ kind: "event", subscriptionId: "sub-1", event: VALID_EVENT });
    expect(calls).toBe(2);
  });
});
