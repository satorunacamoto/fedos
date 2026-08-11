import { describe, expect, it } from "vitest";
import { InMemoryFakeCommerceNostrTransport } from "../src/os/commerce/events/commerce_nostr_fake_transport.js";
import type {
  MediaManifestReferenceEventDraft,
  ProductPublicationEventDraft,
} from "../src/os/commerce/events/commerce_nostr_event_drafts.js";

const HEX_A = "a".repeat(64);

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

function validMediaManifestReference(): MediaManifestReferenceEventDraft {
  return {
    category: "media-manifest-reference",
    formatVersion: 1,
    productId: "prod-1",
    assetId: "asset-1",
    mediaKind: "pdf",
    contentHashHex: HEX_A,
  };
}

describe("InMemoryFakeCommerceNostrTransport: zero network, deterministic", () => {
  it("accepts by default and returns a non-empty eventId", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport();
    const result = await transport.send(validProductPublication());
    expect(result.accepted).toBe(true);
    expect(result.eventId.length).toBeGreaterThan(0);
    expect(transport.sent.length).toBe(1);
  });

  it("derives the SAME fake eventId for two structurally-identical drafts (content-addressed, like a real relay id)", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport();
    const a = await transport.send(validProductPublication());
    const b = await transport.send(validProductPublication());
    expect(a.eventId).toBe(b.eventId);
    expect(transport.sent.length).toBe(2); // the transport itself does NOT dedup — that's the Port's job
  });

  it("derives a DIFFERENT fake eventId for a different category of draft", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport();
    const a = await transport.send(validProductPublication());
    const b = await transport.send(validMediaManifestReference());
    expect(a.eventId).not.toBe(b.eventId);
  });

  it("derives a DIFFERENT fake eventId when a single field changes", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport();
    const a = await transport.send(validProductPublication({ priceCents: 100 }));
    const b = await transport.send(validProductPublication({ priceCents: 200 }));
    expect(a.eventId).not.toBe(b.eventId);
  });

  it("honors a constructor-configured rejection", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport({ accepted: false, message: "relay down" });
    const result = await transport.send(validProductPublication());
    expect(result.accepted).toBe(false);
    expect(result.eventId).toBe("");
    expect(result.message).toBe("relay down");
  });

  it("rejectNextSend() forces exactly one rejection, then reverts to the default", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport();
    transport.rejectNextSend("simulated timeout");

    const first = await transport.send(validProductPublication());
    expect(first.accepted).toBe(false);
    expect(first.message).toBe("simulated timeout");

    const second = await transport.send(validProductPublication());
    expect(second.accepted).toBe(true);
  });

  it("records every send() call, in order, with no network I/O", async () => {
    const transport = new InMemoryFakeCommerceNostrTransport();
    const draft1 = validProductPublication({ productId: "prod-1" });
    const draft2 = validProductPublication({ productId: "prod-2" });
    await transport.send(draft1);
    await transport.send(draft2);
    expect(transport.sent).toEqual([draft1, draft2]);
  });
});
