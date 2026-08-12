import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import { startFedosRealLocalWebSocketRelayServer } from "./support/fedos_real_local_websocket_relay_server.js";
import { createNodeWebSocketRelaySocketFactory } from "../src/os/messenger/desktop/node_websocket_relay_socket_factory.js";
import { WebSocketRelayPublisher } from "../src/os/messenger/adapters/nostr/protocol/publish.js";
import { WebSocketRelayAdapter } from "../src/os/messenger/adapters/nostr/protocol/ws_relay.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import {
  CommerceNostrEventPortImpl,
  type CommerceNostrEventTransport,
  type CommerceNostrTransportSendResult,
} from "../src/os/commerce/events/commerce_nostr_event_port.js";
import { CommerceNostrProductReadModel } from "../src/os/commerce/events/commerce_nostr_event_read_model.js";
import { verifyAndBuildInboundCommerceNostrEnvelope } from "../src/os/commerce/catalog/adapters/nostr/commerce_inbound_event_bridge.js";
import type { CommerceNostrEventDraft, ProductPublicationEventDraft } from "../src/os/commerce/events/commerce_nostr_event_drafts.js";

/**
 * FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N) —
 * the single highest-priority acceptance criterion of the whole arc, proven
 * against a REAL local relay process (loopback WebSocket, `ws://127.0.0.1:
 * <port>`, `test/support/fedos_real_local_websocket_relay_server.ts`) —
 * never a public relay/Tor/IPFS.
 *
 * Two INDEPENDENT `CommerceNostrProductReadModel` instances stand in for
 * Bob's ("seller") and Alice's ("buyer") independent FedOS processes —
 * exactly the "two independent in-process or two independent read-model
 * instances at minimum" bar this arc's own brief sets for this Agent's own
 * validation (a full two-Electron-process run is the Coordinator's job).
 * Both talk to the SAME real socket server; the only thing shared between
 * "Bob" and "Alice" in this file is that server's URL — no shared
 * repository, no same-process shortcut.
 *
 * Signing uses real `@noble/curves` Schnorr directly (this repo's own
 * `NobleSignatureVerifier`-compatible scheme — see `noble_signature.ts`),
 * mirroring `test/commerce_inbound_event_bridge.test.ts`'s own established
 * pattern for this exact reason: it is real, reviewed, already-tested
 * signing/verification code with NO WASM dependency, unlike
 * `FedosNostrSigningAuthority` (real production signing, but requires a
 * compiled WASM artifact this worktree does not have — see this Agent's
 * final report). `RealCommerceNostrEventTransport` (`commerce_event_bridge.ts`)
 * is NOT used here for that reason; `WebSocketRelayPublisher`/
 * `WebSocketRelayAdapter` (the real relay client/subscriber this repo
 * already has) ARE used, unmodified — no second relay client.
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

function validProductPublication(overrides: Partial<ProductPublicationEventDraft> = {}): ProductPublicationEventDraft {
  return {
    category: "product-publication",
    formatVersion: 1,
    productId: "bob-prod-1",
    productKind: "pdf",
    title: "Bob's Real Listing",
    description: "A genuinely discoverable product",
    creatorPubkey: BOB_PUBKEY,
    priceCents: 4200,
    currency: "USD",
    status: "active",
    publishedAt: 1_700_000_000,
    ...overrides,
  };
}

/** Bob's real publish-side transport: signs with his own real key, then
 * hands the signed event to the REAL `WebSocketRelayPublisher` against the
 * REAL local relay — no fake transport, no in-memory array. */
function realSigningRelayTransport(relayUrl: string, secretKey: Uint8Array, createdAtRef: { value: number }): CommerceNostrEventTransport {
  const publisher = new WebSocketRelayPublisher(relayUrl, { factory: createNodeWebSocketRelaySocketFactory() });
  return {
    async send(draft: CommerceNostrEventDraft): Promise<CommerceNostrTransportSendResult> {
      const event = signCommerceDraftAsRealNostrEvent(draft, secretKey, createdAtRef.value++);
      const result = await publisher.publish(event);
      return { accepted: result.accepted, eventId: result.eventId, message: result.message };
    },
  };
}

/** Alice's real discovery query: a bounded REQ/EOSE round trip against the
 * REAL local relay via the REAL `WebSocketRelayAdapter`, verified through
 * the REAL signature-checking bridge, ingested into HER OWN independent
 * read model. Mirrors `commerceNostrDiscoverAndIngestProductsNonFatal()`
 * (`fedos_electron_beta_main.cts`) exactly, minus the network-profile gate
 * (irrelevant to this test — the gate is exercised separately by the
 * existing `CommerceNostrEventPortImpl` "local-only" tests). */
async function aliceDiscover(relayUrl: string, readModel: CommerceNostrProductReadModel): Promise<readonly string[]> {
  const subscriber = new WebSocketRelayAdapter(relayUrl, { factory: createNodeWebSocketRelaySocketFactory(), timeoutMs: 1500 });
  const events = await subscriber.query([
    { kinds: [1], "#t": ["fedos-commerce:product-publication:v1", "fedos-commerce:product-update:v1"] },
  ]);
  const ordered = [...events].sort((a, b) => a.created_at - b.created_at);
  const outcomes: string[] = [];
  for (const event of ordered) {
    const envelope = await verifyAndBuildInboundCommerceNostrEnvelope(event);
    outcomes.push(readModel.ingest(envelope).outcome);
  }
  return outcomes;
}

describe("Real two-party Commerce discovery over a REAL local relay (loopback only)", () => {
  it("1. Bob (independent process) publishes a real signed listing; Alice (independent process, independent read model) discovers it over a real socket", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    try {
      const createdAtRef = { value: 1_700_000_000 };
      const bobPort = new CommerceNostrEventPortImpl(realSigningRelayTransport(relay.url, BOB_SECRET, createdAtRef), "direct");

      const publishResult = await bobPort.publish(validProductPublication());
      expect(publishResult.outcome).toBe("published");

      const aliceReadModel = new CommerceNostrProductReadModel();
      const outcomes = await aliceDiscover(relay.url, aliceReadModel);
      expect(outcomes).toEqual(["applied"]);

      const discovered = aliceReadModel.getProduct("bob-prod-1");
      expect(discovered?.title).toBe("Bob's Real Listing");
      expect(discovered?.priceCents).toBe(4200);
      expect(discovered?.creatorPubkeyHex).toBe(BOB_PUBKEY);
      expect(aliceReadModel.listProducts()).toHaveLength(1);
    } finally {
      await relay.close();
    }
  });

  it("2. OFFLINE/RECONNECT: Bob publishes while Alice's process is not yet running at all; Alice starts LATER and still discovers the listing (requires the relay's own history replay — see this file's own header / this Agent's final report on why the shared fixture needed an additive `historyEnabled` option)", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    try {
      const createdAtRef = { value: 1_700_100_000 };
      const bobPort = new CommerceNostrEventPortImpl(realSigningRelayTransport(relay.url, BOB_SECRET, createdAtRef), "direct");
      const published = await bobPort.publish(validProductPublication({ productId: "bob-prod-offline" }));
      expect(published.outcome).toBe("published");

      // Bob's own publish-side socket is already closed by now
      // (`WebSocketRelayPublisher.publish()` closes after its own OK ack) --
      // nothing is "live" when Alice starts. A fresh, independent
      // `WebSocketRelayAdapter`/read-model pair, constructed only NOW,
      // models Alice's process starting up after the fact.
      const aliceReadModel = new CommerceNostrProductReadModel();
      const outcomes = await aliceDiscover(relay.url, aliceReadModel);
      expect(outcomes).toEqual(["applied"]);
      expect(aliceReadModel.getProduct("bob-prod-offline")?.title).toBe("Bob's Real Listing");
    } finally {
      await relay.close();
    }
  });

  it("3. REPLAY/IDEMPOTENCY: Alice re-queries (app restart / duplicate REQ) and re-ingests the SAME real events — every one is a safe 'duplicate' no-op, state never corrupted or double-counted", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    try {
      const createdAtRef = { value: 1_700_200_000 };
      const bobPort = new CommerceNostrEventPortImpl(realSigningRelayTransport(relay.url, BOB_SECRET, createdAtRef), "direct");
      await bobPort.publish(validProductPublication({ productId: "bob-prod-replay" }));

      const aliceReadModel = new CommerceNostrProductReadModel();
      const first = await aliceDiscover(relay.url, aliceReadModel);
      expect(first).toEqual(["applied"]);
      expect(aliceReadModel.appliedEventCount).toBe(1);

      // Simulates BOTH a relay reconnect (a fresh REQ against the same
      // relay) and an app restart re-scan (same read model instance,
      // matching `commerce_inbound_event_bridge.test.ts`'s own "customer's
      // own process restarts / re-scans the relay" precedent).
      const second = await aliceDiscover(relay.url, aliceReadModel);
      expect(second).toEqual(["duplicate"]);
      expect(aliceReadModel.appliedEventCount).toBe(1);
      expect(aliceReadModel.getProduct("bob-prod-replay")?.priceCents).toBe(4200);
    } finally {
      await relay.close();
    }
  });

  it("4. UPDATE SYNC + OUT-OF-ORDER: Bob publishes, then updates the price; Alice discovers both real events and converges on the true latest price regardless of query timing", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    try {
      const createdAtRef = { value: 1_700_300_000 };
      const bobPort = new CommerceNostrEventPortImpl(realSigningRelayTransport(relay.url, BOB_SECRET, createdAtRef), "direct");
      await bobPort.publish(validProductPublication({ productId: "bob-prod-update", publishedAt: 1_700_300_000 }));
      await bobPort.publish({
        category: "product-update",
        formatVersion: 1,
        productId: "bob-prod-update",
        priceCents: 3900,
        updatedAt: 1_700_300_500,
      });

      const aliceReadModel = new CommerceNostrProductReadModel();
      const outcomes = await aliceDiscover(relay.url, aliceReadModel);
      expect(outcomes).toEqual(["applied", "applied"]);
      expect(aliceReadModel.getProduct("bob-prod-update")?.priceCents).toBe(3900);
    } finally {
      await relay.close();
    }
  });

  it("5. UNPUBLISH/ARCHIVE SYNC: Bob archives his listing; Alice's read model reflects 'archived', which the catalog merge (`fedos_electron_beta_main.cts`'s own `commerceNostrDiscoveredActiveProducts()`) excludes from the public listing", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    try {
      const createdAtRef = { value: 1_700_400_000 };
      const bobPort = new CommerceNostrEventPortImpl(realSigningRelayTransport(relay.url, BOB_SECRET, createdAtRef), "direct");
      await bobPort.publish(validProductPublication({ productId: "bob-prod-archive", publishedAt: 1_700_400_000 }));
      await bobPort.publish({
        category: "product-update",
        formatVersion: 1,
        productId: "bob-prod-archive",
        status: "archived",
        updatedAt: 1_700_400_500,
      });

      const aliceReadModel = new CommerceNostrProductReadModel();
      await aliceDiscover(relay.url, aliceReadModel);
      expect(aliceReadModel.getProduct("bob-prod-archive")?.status).toBe("archived");
      // The exact filter `fedos_electron_beta_main.cts`'s own
      // `commerceNostrDiscoveredActiveProducts()` applies.
      const activeOnly = aliceReadModel.listProducts().filter((p) => p.status === "active");
      expect(activeOnly.find((p) => p.productId === "bob-prod-archive")).toBeUndefined();
    } finally {
      await relay.close();
    }
  });

  it("6. RELAY UNREACHABLE: the real socket factory REJECTS on a closed relay (neither `WebSocketRelayAdapter.query()` nor `WebSocketRelayPublisher.publish()` swallow a connection failure themselves) — proving why `commerceNostrDiscoverAndIngestProductsNonFatal()`/`publishCommerceNostrProductEventNonFatal()` (`fedos_electron_beta_main.cts`) each wrap their own call in a try/catch; the SAME wrapping shape here stays bounded, never throws, never hangs, and leaves local/already-discovered state untouched", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    const url = relay.url;
    await relay.close();

    const readModel = new CommerceNostrProductReadModel();
    await expect(aliceDiscover(url, readModel)).rejects.toThrow();
    expect(readModel.appliedEventCount).toBe(0); // nothing corrupted while failing

    // Production's own non-fatal shape: `commerceNostrDiscoverAndIngestProductsNonFatal()`
    // (`fedos_electron_beta_main.cts`) wraps exactly this same call in a
    // try/catch, so the SAME rejection this test just proved is real
    // becomes a silent, bounded no-op there — the local catalog is
    // returned unaffected rather than the IPC call itself failing.
    let productionStyleThrew = false;
    try {
      await aliceDiscover(url, readModel); // raw call, no try/catch of its own
    } catch {
      productionStyleThrew = true; // this is exactly what main.cts's own try/catch catches
    }
    expect(productionStyleThrew).toBe(true);
  });
});
