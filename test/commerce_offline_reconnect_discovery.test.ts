import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import { verifyAndBuildInboundCommerceNostrEnvelope } from "../src/os/commerce/catalog/adapters/nostr/commerce_inbound_event_bridge.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import { CommerceNostrProductReadModel } from "../src/os/commerce/events/commerce_nostr_event_read_model.js";
import type { CommerceNostrEventDraft, ProductPublicationEventDraft } from "../src/os/commerce/events/commerce_nostr_event_drafts.js";
import { deriveCommerceDiscoveryView } from "../src/os/commerce/index.js";

/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) —
 * targeted end-to-end offline->reconnect test (arc mandate item 7: "Bob
 * publishes while Alice is offline; Alice connects later; the listing
 * appears exactly once (no duplicate)"). Uses the SAME real
 * `@noble/curves`-signed-event + real verifying-bridge + real read-model
 * pipeline `test/commerce_inbound_event_bridge.test.ts` already proves
 * sound at the unit level — this file's own job is to compose those pieces
 * into the EXACT scenario the arc mandate names, plus tie the result into
 * this arc's own new `deriveCommerceDiscoveryView` (never a separate,
 * hand-wavy narrative claim of "it appears once").
 */

const BOB_SECRET = new Uint8Array(32).fill(7);
const BOB_PUBKEY = bytesToHex(schnorr.getPublicKey(BOB_SECRET));

function signCommerceDraftAsRealNostrEvent(draft: CommerceNostrEventDraft, secretKey: Uint8Array, createdAt: number): NostrEvent {
  const pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
  const tags: string[][] = [["t", `fedos-commerce:${draft.category}:v1`]];
  const content = JSON.stringify(draft);
  const preimage = JSON.stringify([0, pubkey, createdAt, 1, tags, content]);
  const id = bytesToHex(sha256(new TextEncoder().encode(preimage)));
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), secretKey));
  return Object.freeze({ id, pubkey, created_at: createdAt, kind: 1, tags, content, sig });
}

function bobsPublication(overrides: Partial<ProductPublicationEventDraft> = {}): ProductPublicationEventDraft {
  return {
    category: "product-publication",
    formatVersion: 1,
    productId: "prod-bob-wallpaper-pack",
    productKind: "other",
    title: "FedOS Starter Wallpaper Pack",
    creatorPubkey: BOB_PUBKEY,
    priceCents: 499,
    currency: "USD",
    status: "active",
    publishedAt: 1_700_000_000,
    ...overrides,
  };
}

/** Plain in-memory array standing in for "the relay" this test's real
 * events flow through — a real relay's own REQ/EOSE re-delivers whatever
 * currently matches the filter on every fresh query (it is not a queue
 * that drains), so a query "replays" every already-seen event again on
 * every poll -- this fake mirrors that, deliberately, to prove the read
 * model (not the transport) is what makes reconnect idempotent. */
class InMemoryLoopbackRelay {
  readonly #events: NostrEvent[] = [];
  publish(event: NostrEvent): void {
    this.#events.push(event);
  }
  /** Mirrors a real relay's own REQ query semantics: returns every
   * currently-stored matching event, every time -- never "only new since
   * last query" (this test's read model is what must dedupe, not the relay). */
  query(): readonly NostrEvent[] {
    return [...this.#events];
  }
}

describe("Offline -> reconnect: Bob publishes while Alice is offline, listing appears exactly once", () => {
  it("1. Alice never queries while offline; on reconnect she discovers Bob's product exactly once", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();

    // Bob publishes a real, signed product-publication event while Alice
    // is offline -- her read model is never touched by this step.
    const event = signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000);
    relay.publish(event);
    expect(alicesReadModel.listProducts()).toHaveLength(0);

    // Alice "connects later": one bounded discovery query, verify + ingest
    // every candidate event, exactly like
    // `commerceNostrDiscoverAndIngestProductsNonFatal()` does in the real
    // Electron main process.
    for (const candidate of relay.query()) {
      const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(candidate);
      alicesReadModel.ingest(envelope);
    }

    expect(alicesReadModel.listProducts()).toHaveLength(1);
    expect(alicesReadModel.getProduct("prod-bob-wallpaper-pack")?.title).toBe("FedOS Starter Wallpaper Pack");
    expect(alicesReadModel.appliedEventCount).toBe(1);

    const view = deriveCommerceDiscoveryView({
      networkProfile: "direct",
      hasConfiguredRelay: true,
      inFlight: false,
      hasEverAttempted: true,
      lastAttemptSucceeded: true,
      realListingCount: alicesReadModel.listProducts().length,
    });
    expect(view.status).toBe("connected");
    expect(view.noListings).toBe(false);
  });

  it("2. a SECOND reconnect (e.g. Alice re-opens Shop later) re-queries the SAME relay and re-delivers the SAME event -- the listing still appears exactly once, never duplicated", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();
    const event = signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000);
    relay.publish(event);

    // First reconnect.
    for (const candidate of relay.query()) {
      const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(candidate);
      alicesReadModel.ingest(envelope);
    }
    expect(alicesReadModel.appliedEventCount).toBe(1);

    // Second reconnect -- same relay, same event still present (a real
    // relay does not "consume" a REQ match), same read model instance
    // (this process never rebuilds it between catalog loads).
    let duplicateOutcomeSeen = false;
    for (const candidate of relay.query()) {
      const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(candidate);
      const result = alicesReadModel.ingest(envelope);
      if (result.outcome === "duplicate") duplicateOutcomeSeen = true;
    }
    expect(duplicateOutcomeSeen).toBe(true);
    expect(alicesReadModel.listProducts()).toHaveLength(1);
    expect(alicesReadModel.appliedEventCount).toBe(1);
  });

  it("3. Bob publishes an update WHILE Alice is still offline (two events queued); one reconnect converges to the latest state, still exactly one listing", async () => {
    const relay = new InMemoryLoopbackRelay();
    const alicesReadModel = new CommerceNostrProductReadModel();

    relay.publish(signCommerceDraftAsRealNostrEvent(bobsPublication(), BOB_SECRET, 1_700_000_000));
    relay.publish(
      signCommerceDraftAsRealNostrEvent(
        {
          category: "product-update",
          formatVersion: 1,
          productId: "prod-bob-wallpaper-pack",
          priceCents: 399,
          updatedAt: 1_700_000_500,
        },
        BOB_SECRET,
        1_700_000_500,
      ),
    );

    for (const candidate of relay.query()) {
      const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(candidate);
      alicesReadModel.ingest(envelope);
    }

    expect(alicesReadModel.listProducts()).toHaveLength(1);
    expect(alicesReadModel.getProduct("prod-bob-wallpaper-pack")?.priceCents).toBe(399);
  });
});
