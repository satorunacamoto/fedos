import { describe, expect, it } from "vitest";
import {
  CommerceNostrEventPortImpl,
  canonicalizeCommerceNostrEventDraft,
  type CommerceNostrEventTransport,
  type CommerceNostrTransportSendResult,
} from "../src/os/commerce/events/commerce_nostr_event_port.js";
import { InMemoryFakeCommerceNostrTransport } from "../src/os/commerce/events/commerce_nostr_fake_transport.js";
import type {
  CommerceNostrEventDraft,
  OrderCommitmentEventDraft,
  ProductPublicationEventDraft,
} from "../src/os/commerce/events/commerce_nostr_event_drafts.js";
import { createCommerce } from "../src/os/commerce/create_commerce.js";

const HEX_A = "a".repeat(64);
const HEX_B = "b".repeat(64);
const HEX_C = "c".repeat(64);

function validProductPublication(
  overrides: Partial<ProductPublicationEventDraft> = {},
): ProductPublicationEventDraft {
  return {
    category: "product-publication",
    formatVersion: 1,
    productId: "prod-1",
    productKind: "pdf",
    title: "A Fine PDF",
    creatorPubkey: HEX_A,
    priceCents: 1999,
    currency: "USD",
    status: "active",
    publishedAt: 1_700_000_000,
    ...overrides,
  };
}

function validOrderCommitment(overrides: Partial<OrderCommitmentEventDraft> = {}): OrderCommitmentEventDraft {
  return {
    category: "order-commitment",
    formatVersion: 1,
    orderRefDigestHex: HEX_A,
    buyerPartyDigestHex: HEX_B,
    sellerPubkey: HEX_C,
    status: "committed",
    committedAt: 1_700_000_200,
    ...overrides,
  };
}

/** A spy transport that records every call, wrapping a fake transport. */
class RecordingTransport implements CommerceNostrEventTransport {
  readonly calls: CommerceNostrEventDraft[] = [];
  readonly #inner: InMemoryFakeCommerceNostrTransport;

  constructor(inner: InMemoryFakeCommerceNostrTransport = new InMemoryFakeCommerceNostrTransport()) {
    this.#inner = inner;
  }

  send(draft: CommerceNostrEventDraft): Promise<CommerceNostrTransportSendResult> {
    this.calls.push(draft);
    return this.#inner.send(draft);
  }
}

describe("CommerceNostrEventPort: safety gate — invalid drafts never reach the transport", () => {
  it("rejects a malformed draft without ever calling transport.send()", async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport);

    const malformed = { ...validOrderCommitment(), priceCents: 4999 };
    const result = await port.publish(malformed as unknown as CommerceNostrEventDraft);

    expect(result.outcome).toBe("rejected");
    expect(result.eventId).toBeUndefined();
    expect(transport.calls.length).toBe(0);
  });

  it("rejects a completely bogus object without throwing and without calling transport.send()", async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport);

    const result = await port.publish({ nonsense: true } as unknown as CommerceNostrEventDraft);

    expect(result.outcome).toBe("rejected");
    expect(transport.calls.length).toBe(0);
  });

  it("publishes a well-formed draft and forwards it to the transport exactly once", async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport);

    const draft = validProductPublication();
    const result = await port.publish(draft);

    expect(result.outcome).toBe("published");
    expect(result.eventId).toBeDefined();
    expect(transport.calls.length).toBe(1);
  });
});

describe("CommerceNostrEventPort: duplicate / replay guard", () => {
  it("no-ops a second publish of an identical draft — transport is called only once, same eventId returned", async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport);

    const draft = validProductPublication();
    const first = await port.publish(draft);
    const second = await port.publish({ ...draft }); // structurally identical, different object identity

    expect(first.outcome).toBe("published");
    expect(second.outcome).toBe("duplicate");
    expect(second.eventId).toBe(first.eventId);
    expect(transport.calls.length).toBe(1);
    expect(port.publishedCount).toBe(1);
  });

  it("treats a draft that differs in even one field as a genuinely new event, not a duplicate", async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport);

    const first = await port.publish(validProductPublication({ priceCents: 1999 }));
    const second = await port.publish(validProductPublication({ priceCents: 2499 }));

    expect(first.outcome).toBe("published");
    expect(second.outcome).toBe("published");
    expect(second.eventId).not.toBe(first.eventId);
    expect(transport.calls.length).toBe(2);
    expect(port.publishedCount).toBe(2);
  });

  it("does not record a dedup entry for a rejected (invalid) draft", async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport);

    const malformed = { ...validOrderCommitment(), buyerPubkey: HEX_B };
    await port.publish(malformed as unknown as CommerceNostrEventDraft);
    await port.publish(malformed as unknown as CommerceNostrEventDraft);

    expect(transport.calls.length).toBe(0);
    expect(port.publishedCount).toBe(0);
  });

  it("does not record a dedup entry when the transport itself rejects the send (allows retry)", async () => {
    const inner = new InMemoryFakeCommerceNostrTransport({ accepted: false, message: "relay unreachable" });
    const transport = new RecordingTransport(inner);
    const port = new CommerceNostrEventPortImpl(transport);

    const draft = validProductPublication();
    const first = await port.publish(draft);
    expect(first.outcome).toBe("transport-error");
    expect(port.publishedCount).toBe(0);

    // A retry with the exact same content is NOT short-circuited as a
    // duplicate, because nothing was ever successfully published.
    const second = await port.publish(draft);
    expect(second.outcome).toBe("transport-error");
    expect(transport.calls.length).toBe(2);
  });

  it("canonicalizeCommerceNostrEventDraft is stable under key reordering", () => {
    const draft = validProductPublication();
    const reordered = {
      publishedAt: draft.publishedAt,
      status: draft.status,
      currency: draft.currency,
      priceCents: draft.priceCents,
      creatorPubkey: draft.creatorPubkey,
      title: draft.title,
      productKind: draft.productKind,
      productId: draft.productId,
      formatVersion: draft.formatVersion,
      category: draft.category,
    } as ProductPublicationEventDraft;

    expect(canonicalizeCommerceNostrEventDraft(draft)).toBe(canonicalizeCommerceNostrEventDraft(reordered));
  });
});

describe("CommerceNostrEventPort: no Commerce domain state mutation (scope note)", () => {
  it("starts with an empty dedup ledger and only grows it on a successful publish, never on rejection", async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport);
    expect(port.publishedCount).toBe(0);

    await port.publish({ nonsense: true } as unknown as CommerceNostrEventDraft);
    expect(port.publishedCount).toBe(0);

    await port.publish(validProductPublication());
    expect(port.publishedCount).toBe(1);
  });
});

describe("CommerceNostrEventPort: NetworkProfile gating (Nostr must remain strictly optional)", () => {
  it('defaults to "direct" (NOSTR_OPTIONAL) when no profile is given — unchanged behavior for existing callers', async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport);
    expect(port.networkProfile).toBe("direct");

    const result = await port.publish(validProductPublication());
    expect(result.outcome).toBe("published");
    expect(transport.calls.length).toBe(1);
  });

  it('"local-only" (LOCAL_ONLY) refuses to publish — transport.send() is NEVER called', async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport, "local-only");
    expect(port.networkProfile).toBe("local-only");

    const result = await port.publish(validProductPublication());
    expect(result.outcome).toBe("network-disabled");
    expect(result.reason).toMatch(/local-only/);
    expect(result.eventId).toBeUndefined();
    expect(transport.calls.length).toBe(0);
    expect(port.publishedCount).toBe(0);
  });

  it('"local-only" still validates the draft FIRST — a malformed draft is "rejected", not "network-disabled"', async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport, "local-only");

    const result = await port.publish({ nonsense: true } as unknown as CommerceNostrEventDraft);
    expect(result.outcome).toBe("rejected");
    expect(transport.calls.length).toBe(0);
  });

  it('"tor-optional" (SERVERLESS_PRIVACY) permits publishing, exactly like "direct"', async () => {
    const transport = new RecordingTransport();
    const port = new CommerceNostrEventPortImpl(transport, "tor-optional");

    const result = await port.publish(validProductPublication());
    expect(result.outcome).toBe("published");
    expect(transport.calls.length).toBe(1);
  });

  it('a "local-only" Port never touches the dedup ledger — flipping to a permissive profile still allows a first real publish', async () => {
    const inner = new InMemoryFakeCommerceNostrTransport();
    const draft = validProductPublication();

    const blockedPort = new CommerceNostrEventPortImpl(new RecordingTransport(inner), "local-only");
    const blocked = await blockedPort.publish(draft);
    expect(blocked.outcome).toBe("network-disabled");

    // A second, independent Port instance (simulating the user later
    // opting in to Nostr publication) can still publish the exact same
    // content — the local-only Port never consumed/poisoned any shared
    // dedup state, because there is none shared across Port instances.
    const openPort = new CommerceNostrEventPortImpl(new RecordingTransport(inner), "direct");
    const opened = await openPort.publish(draft);
    expect(opened.outcome).toBe("published");
  });
});

describe("Commerce works fully with zero Nostr relay configured or available (mandatory-optionality check)", () => {
  it("createCommerce() with no arguments never references a CommerceNostrEventPort and remains fully usable", () => {
    const commerce = createCommerce();
    // No `events`/Nostr-shaped field exists anywhere on the aggregate —
    // Commerce's real domain surface is entirely independent of this
    // Port's existence.
    expect(Object.keys(commerce).sort()).toEqual(["catalog", "marketplace", "payments"]);
    expect(() => commerce.catalog.list()).not.toThrow();
    expect(commerce.catalog.list()).toEqual([]);
  });

  it('a CommerceNostrEventPort built with networkProfile "local-only" never reaches a transport, and nothing else in Commerce degrades because of it', async () => {
    let sendCalls = 0;
    class NeverCalledTransport implements CommerceNostrEventTransport {
      send(): Promise<CommerceNostrTransportSendResult> {
        sendCalls += 1;
        return Promise.resolve({ accepted: true, eventId: "should-not-happen", message: "" });
      }
    }
    const port = new CommerceNostrEventPortImpl(new NeverCalledTransport(), "local-only");
    const commerce = createCommerce();

    const publishResult = await port.publish(validProductPublication());
    expect(publishResult.outcome).toBe("network-disabled");
    expect(sendCalls).toBe(0);

    // Commerce's own real domain code is completely unaffected.
    expect(commerce.catalog.list()).toEqual([]);
  });
});
