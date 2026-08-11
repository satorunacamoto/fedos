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
