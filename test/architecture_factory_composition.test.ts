import { describe, it, expect } from "vitest";
import { createMessenger, type Messenger } from "../src/os/messenger/create_messenger.js";
import { createCommerce, type Commerce } from "../src/os/commerce/create_commerce.js";
import {
  NoopMessagingPort,
  NoopConversationPort,
  NoopNotificationPort,
  NoopTransportPort,
} from "../src/os/messenger/adapters/noop_messenger_ports.js";
import { NoopPaymentProvider } from "../src/os/commerce/payment/noop_payment.js";
import { NoopMarketplaceProvider } from "../src/os/commerce/marketplace/noop_marketplace.js";
import { InMemoryProductDirectory } from "../src/os/commerce/catalog/directory.js";

/**
 * OS Capability Modularization — Factory/Port Completion pass. Standalone
 * composition tests for `createMessenger()`/`createCommerce()`, mirroring
 * `architecture_boundary_adapter_port_shapes.test.ts`'s pattern but at the
 * FACTORY level rather than the individual-adapter level.
 *
 * Covers, per `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md`'s own
 * "Standalone composition tests needed" list:
 *   1. `createCommerce()` with all-fake/noop adapters constructs
 *      successfully and every method is callable without throwing.
 *   2. `createMessenger()`, same shape.
 *   3. Both together in one process (proves no shared/global state, no
 *      import-time side effect from either factory collides with the
 *      other).
 *   4. Commerce constructed WITHOUT ever importing/constructing a
 *      Messenger in the same test, and vice versa — an explicit
 *      composition-level regression guard for the "Commerce is standalone"
 *      / "Messenger is standalone" claim the architecture boundary tests
 *      already enforce at the IMPORT level; this proves it also holds at
 *      RUNTIME (a value can be constructed and used, not just that no
 *      import edge exists).
 *
 * Zero real external contact anywhere in this file — every default is a
 * `Noop*`/empty implementation.
 */

describe("createMessenger()", () => {
  it("constructs successfully with zero arguments (every Port defaults to a safe Noop)", () => {
    const messenger: Messenger = createMessenger();
    expect(messenger.messaging).toBeInstanceOf(NoopMessagingPort);
    expect(messenger.conversations).toBeInstanceOf(NoopConversationPort);
    expect(messenger.notifications).toBeInstanceOf(NoopNotificationPort);
    expect(messenger.transport).toBeInstanceOf(NoopTransportPort);
  });

  it("every method on the default-constructed Messenger is callable without throwing", async () => {
    const messenger = createMessenger();

    const sendResult = await messenger.messaging.send("c1", { text: "hi" });
    expect(sendResult.delivered).toBe(false);

    const readResult = await messenger.messaging.read("c1", "m1");
    expect(readResult.ok).toBe(false);

    const listResult = await messenger.messaging.list("c1");
    expect(listResult).toEqual([]);

    const unsubscribe = messenger.messaging.onMessage(() => {});
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();

    const createDirectResult = await messenger.conversations.createDirect("nostr:abc");
    expect(createDirectResult.ok).toBe(false);

    const createGroupResult = await messenger.conversations.createGroup();
    expect(createGroupResult.ok).toBe(false);

    const participants = await messenger.conversations.listParticipants("c1");
    expect(participants).toEqual([]);

    const admitResult = await messenger.conversations.admit("c1", "nostr:abc");
    expect(admitResult.outcome).toBe("unavailable");

    const revokeResult = await messenger.conversations.revoke("c1", "nostr:abc");
    expect(revokeResult.outcome).toBe("unavailable");

    const leaveResult = await messenger.conversations.leave("c1");
    expect(leaveResult.outcome).toBe("unavailable");

    const readiness = await messenger.conversations.readiness("c1");
    expect(readiness).toBeNull();

    expect(() => messenger.notifications.notify("title", "body", { kind: "conversation-message" })).not.toThrow();

    const connectStatus = await messenger.transport.connect();
    expect(connectStatus).toBe("disconnected"); // Noop never actually connects.
    const transportSendResult = await messenger.transport.send("peer-1", new Uint8Array([1, 2, 3]));
    expect(transportSendResult).toEqual({ sent: false, reason: "not-connected" });
    const transportUnsubscribe = messenger.transport.subscribe("peer-1", () => {});
    expect(typeof transportUnsubscribe).toBe("function");
    transportUnsubscribe();
    await messenger.transport.disconnect();
  });

  it("accepts explicitly-injected real Port instances instead of defaulting, including transport", () => {
    const messaging = new NoopMessagingPort();
    const conversations = new NoopConversationPort();
    const notifications = new NoopNotificationPort();
    const transport = new NoopTransportPort();

    const messenger = createMessenger({ messaging, conversations, notifications, transport });

    expect(messenger.messaging).toBe(messaging);
    expect(messenger.conversations).toBe(conversations);
    expect(messenger.notifications).toBe(notifications);
    expect(messenger.transport).toBe(transport);
  });

  it("omitting transport still constructs successfully with the Noop default -- backward compatible with every pre-existing createMessenger() call site", () => {
    const messaging = new NoopMessagingPort();
    const messenger = createMessenger({ messaging });

    expect(messenger.messaging).toBe(messaging);
    expect(messenger.transport).toBeInstanceOf(NoopTransportPort);
  });
});

describe("createCommerce()", () => {
  it("constructs successfully with zero arguments (every provider defaults to a safe Noop/empty default)", () => {
    const commerce: Commerce = createCommerce();
    expect(commerce.catalog).toBeInstanceOf(InMemoryProductDirectory);
    expect(commerce.payments).toBeInstanceOf(NoopPaymentProvider);
    expect(commerce.marketplace).toBeInstanceOf(NoopMarketplaceProvider);
  });

  it("every method on the default-constructed Commerce is callable without throwing", async () => {
    const commerce = createCommerce();

    expect(commerce.catalog.list()).toEqual([]);
    expect(commerce.catalog.get("nonexistent")).toBeUndefined();

    expect(commerce.payments.getStatus().available).toBe(false);
    expect(commerce.payments.getCapabilities()).toEqual([]);
    const paymentDecision = await commerce.payments.requestPayment({
      productId: "p1",
      amountCents: 100,
      currency: "USD",
      rail: "manual_placeholder",
    });
    expect(paymentDecision.allowed).toBe(false);

    expect(commerce.marketplace.status().allowed).toBe(false);
    const listDecision = await commerce.marketplace.listPlaceholder();
    expect(listDecision.items).toEqual([]);
  });

  it("accepts explicitly-injected real providers instead of defaulting", () => {
    const catalog = new InMemoryProductDirectory([]);
    const payments = new NoopPaymentProvider();
    const marketplace = new NoopMarketplaceProvider();

    const commerce = createCommerce({ catalog, payments, marketplace });

    expect(commerce.catalog).toBe(catalog);
    expect(commerce.payments).toBe(payments);
    expect(commerce.marketplace).toBe(marketplace);
  });
});

describe("Messenger and Commerce composition", () => {
  it("both factories construct successfully together in one process", async () => {
    const messenger = createMessenger();
    const commerce = createCommerce();

    expect(messenger.messaging).toBeDefined();
    expect(commerce.catalog).toBeDefined();

    // Exercise one method from each to prove neither construction disturbed the other.
    const sendResult = await messenger.messaging.send("c1", { text: "hi" });
    expect(sendResult.delivered).toBe(false);
    expect(commerce.catalog.list()).toEqual([]);
  });

  it("Commerce can be constructed and fully used without ever constructing a Messenger in this test", async () => {
    const commerce = createCommerce({ payments: new NoopPaymentProvider() });
    const decision = await commerce.payments.requestPayment({
      productId: "p1",
      amountCents: 100,
      currency: "USD",
      rail: "manual_placeholder",
    });
    expect(decision.status).toBe("unavailable");
  });

  it("Messenger can be constructed and fully used without ever constructing a Commerce in this test", async () => {
    const messenger = createMessenger({ messaging: new NoopMessagingPort() });
    const result = await messenger.messaging.send("c1", { text: "hi" });
    expect(result.delivered).toBe(false);
  });
});
