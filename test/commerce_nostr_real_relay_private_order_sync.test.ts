import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { startFedosRealLocalWebSocketRelayServer } from "./support/fedos_real_local_websocket_relay_server.js";
import { createNodeWebSocketRelaySocketFactory } from "../src/os/messenger/desktop/node_websocket_relay_socket_factory.js";
import { WebSocketRelayPublisher } from "../src/os/messenger/adapters/nostr/protocol/publish.js";
import { WebSocketRelayAdapter } from "../src/os/messenger/adapters/nostr/protocol/ws_relay.js";
import { createElectronMainHostAttestation } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_host_attestation.js";
import { activateFedosProductionProfileMasterSeed } from "../src/os/messenger/desktop/production_activation/fedos_production_profile_activation.js";
import { FedosProductionMasterSeedAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_master_seed_authority.js";
import { FedosProductionNostrSigningAuthority } from "../src/os/messenger/desktop/production_activation/fedos_production_nostr_signing_authority.js";
import { FEDOS_PRODUCTION_ARTIFACT_DIR } from "../src/os/messenger/desktop/production_activation/fedos_production_desktop_crypto_activation_authority.js";
import {
  COMMERCE_PRIVATE_ORDER_SYNC_TAG,
  RealCommercePrivateOrderTransport,
  verifyAndDecryptInboundPrivateOrderEnvelope,
} from "../src/os/commerce/catalog/adapters/nostr/commerce_private_order_bridge.js";
import { PRIVATE_ORDER_SYNC_STATUS_ACTION, type PrivateOrderSyncPayload } from "../src/os/commerce/events/commerce_private_order_sync.js";
import { createOrder, applyOrderAction, type Order, type OrderActor } from "../src/os/commerce/order/index.js";

/**
 * FedOS "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc (Agent N,
 * Coordinator-directed pass) — the REAL end-to-end proof for items #4/#5:
 * two independent, real production `FedosProductionMasterSeedAuthority` +
 * `FedosProductionNostrSigningAuthority` identities ("Alice"/buyer,
 * "Bob"/seller — same naming as this Agent's public-discovery test),
 * exchanging REAL NIP-44-v2-encrypted, REAL Schnorr-signed private Order
 * events through a REAL local WebSocket relay process (loopback only) —
 * no mock relay, no mock crypto, no same-process shortcut.
 *
 * Skips itself with a clear message if the real
 * `packages/fedos-core-rust/pkg/` (+ pinned manifest) is absent — same
 * gate `secure_runtime_alpha_7161_7240_production_nip44_wire_bridge.test.ts`
 * already uses.
 */
declare const process: { cwd(): string };
const PKG_DIR = join(process.cwd(), FEDOS_PRODUCTION_ARTIFACT_DIR);
const REAL_ARTIFACT_PRESENT = existsSync(join(PKG_DIR, "fedos_core_rust_bg.wasm")) && existsSync(join(PKG_DIR, "fedos_wasm_artifact_manifest.v1.json"));
const suite = REAL_ARTIFACT_PRESENT ? describe : describe.skip;

async function realIdentity(appId: string): Promise<{ readonly masterSeed: FedosProductionMasterSeedAuthority; readonly signer: FedosProductionNostrSigningAuthority; readonly pubkeyHex: string }> {
  const attestation = createElectronMainHostAttestation({ appId, appVersion: "0.0.1" })!;
  const activation = await activateFedosProductionProfileMasterSeed({ attestation });
  expect(activation.outcome).toBe("activated");
  if (activation.outcome !== "activated") throw new Error("unreachable");
  const masterSeed = activation.masterSeedAuthority as FedosProductionMasterSeedAuthority;
  const generated = await masterSeed.generate();
  expect(generated).toBe(true);
  const signer = new FedosProductionNostrSigningAuthority(masterSeed);
  const identity = await signer.publicIdentityForAccount(0);
  expect(identity).not.toBeNull();
  return { masterSeed, signer, pubkeyHex: identity!.publicKeyHex };
}

function samplePayload(buyerPubkey: string, sellerPubkey: string, overrides: Partial<PrivateOrderSyncPayload> = {}): PrivateOrderSyncPayload {
  return {
    category: "private-order-sync",
    formatVersion: 1,
    orderId: "real-order-1",
    productId: "real-prod-1",
    buyerPubkey,
    sellerPubkey,
    quantity: 1,
    unitPriceCents: 5599,
    currency: "USD",
    status: "submitted",
    at: 1_700_500_000,
    ...overrides,
  };
}

/** One side's own bounded discovery query -- mirrors `commercePrivateOrderDiscoverAndApplyNonFatal()` (`fedos_electron_beta_main.cts`) exactly. */
async function discoverPrivateOrderEvents(relayUrl: string, ownPubkeyHex: string): Promise<readonly unknown[]> {
  const subscriber = new WebSocketRelayAdapter(relayUrl, { factory: createNodeWebSocketRelaySocketFactory(), timeoutMs: 2000 });
  return subscriber.query([{ kinds: [1], "#t": [COMMERCE_PRIVATE_ORDER_SYNC_TAG], "#p": [ownPubkeyHex] }]);
}

suite("Real two-party private Order sync over a REAL local relay + REAL WASM NIP-44 crypto (arc items #4/#5)", () => {
  it("1. Alice (buyer) submits an order privately; Bob (seller) discovers, decrypts, and materializes it locally via the REAL, actor-authorized order_state_machine.ts", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    try {
      const alice = await realIdentity("com.fedos.commerce.test.private-order-1-alice");
      const bob = await realIdentity("com.fedos.commerce.test.private-order-1-bob");

      const aliceTransport = new RealCommercePrivateOrderTransport({
        signingAuthority: alice.signer,
        relayPublisher: new WebSocketRelayPublisher(relay.url, { factory: createNodeWebSocketRelaySocketFactory() }),
        nip44Wire: alice.masterSeed,
        accountIndex: 0,
      });
      const sendResult = await aliceTransport.send(samplePayload(alice.pubkeyHex, bob.pubkeyHex), bob.pubkeyHex);
      expect(sendResult.accepted).toBe(true);

      const events = await discoverPrivateOrderEvents(relay.url, bob.pubkeyHex);
      expect(events).toHaveLength(1);

      const envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(events[0], { nip44Wire: bob.masterSeed, localAccountIndex: 0 });
      expect(envelope.outcome).toBe("decrypted");
      expect(envelope.senderPubkeyHex).toBe(alice.pubkeyHex);
      expect(envelope.payload?.orderId).toBe("real-order-1");
      expect(envelope.payload?.status).toBe("submitted");

      // Bob's process has never seen this orderId before -- materialize via
      // the REAL state machine: createOrder() then submit(), using the
      // REAL VERIFIED sender pubkey as the customer actor, never a bare
      // claim (mirrors commercePrivateOrderDiscoverAndApplyNonFatal()'s own logic).
      const payload = envelope.payload!;
      const created = createOrder(
        { id: payload.orderId, productId: payload.productId, sellerPubkey: payload.sellerPubkey, unitPriceCents: payload.unitPriceCents, currency: payload.currency, quantity: payload.quantity },
        { kind: "customer", pubkey: envelope.senderPubkeyHex },
        payload.at,
      );
      expect(created.ok).toBe(true);
      const submitted = applyOrderAction(created.order!, { type: "submit", actor: { kind: "customer", pubkey: envelope.senderPubkeyHex } }, payload.at);
      expect(submitted.ok).toBe(true);
      expect(submitted.order!.status).toBe("submitted");
      expect(submitted.order!.buyerPubkey).toBe(alice.pubkeyHex);
      expect(submitted.order!.sellerPubkey).toBe(bob.pubkeyHex);
    } finally {
      await relay.close();
    }
  }, 30000);

  it("2. Bob accepts; the acceptance reaches Alice's independent process the same way, and she applies it through the REAL state machine too", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    try {
      const alice = await realIdentity("com.fedos.commerce.test.private-order-2-alice");
      const bob = await realIdentity("com.fedos.commerce.test.private-order-2-bob");

      // Alice's own local order (already submitted, exactly as test 1 proved reaches Bob).
      const created = createOrder(
        { id: "real-order-2", productId: "real-prod-2", sellerPubkey: bob.pubkeyHex, unitPriceCents: 1000, currency: "USD" },
        { kind: "customer", pubkey: alice.pubkeyHex },
        1_700_500_000,
      );
      const aliceOrder = applyOrderAction(created.order!, { type: "submit", actor: { kind: "customer", pubkey: alice.pubkeyHex } }, 1_700_500_000).order!;

      // Bob accepts LOCALLY on his own independent process, then privately notifies Alice.
      const bobOrder = applyOrderAction(aliceOrder, { type: "accept", actor: { kind: "merchant", pubkey: bob.pubkeyHex } }, 1_700_500_100).order!;
      expect(bobOrder.status).toBe("accepted");

      const bobTransport = new RealCommercePrivateOrderTransport({
        signingAuthority: bob.signer,
        relayPublisher: new WebSocketRelayPublisher(relay.url, { factory: createNodeWebSocketRelaySocketFactory() }),
        nip44Wire: bob.masterSeed,
        accountIndex: 0,
      });
      const acceptedPayload: PrivateOrderSyncPayload = {
        category: "private-order-sync",
        formatVersion: 1,
        orderId: bobOrder.id,
        productId: bobOrder.productId,
        buyerPubkey: bobOrder.buyerPubkey,
        sellerPubkey: bobOrder.sellerPubkey,
        quantity: bobOrder.quantity,
        unitPriceCents: bobOrder.unitPriceCents,
        currency: bobOrder.currency,
        status: "accepted",
        at: 1_700_500_100,
      };
      const sent = await bobTransport.send(acceptedPayload, alice.pubkeyHex);
      expect(sent.accepted).toBe(true);

      const events = await discoverPrivateOrderEvents(relay.url, alice.pubkeyHex);
      expect(events).toHaveLength(1);
      const envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(events[0], { nip44Wire: alice.masterSeed, localAccountIndex: 0 });
      expect(envelope.outcome).toBe("decrypted");
      expect(envelope.senderPubkeyHex).toBe(bob.pubkeyHex);

      const mapping = PRIVATE_ORDER_SYNC_STATUS_ACTION[envelope.payload!.status];
      expect(mapping.action).toBe("accept");
      const actor: OrderActor = { kind: "merchant", pubkey: envelope.senderPubkeyHex };
      const aliceApplied = applyOrderAction(aliceOrder, { type: "accept", actor }, envelope.payload!.at);
      expect(aliceApplied.ok).toBe(true);
      expect(aliceApplied.order!.status).toBe("accepted");
    } finally {
      await relay.close();
    }
  }, 30000);

  it("3. REPLAY: re-querying and re-applying the SAME real event is a safe no-op through the state machine's own status guard (invalid_state), never a corrupted double-transition", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    try {
      const alice = await realIdentity("com.fedos.commerce.test.private-order-3-alice");
      const bob = await realIdentity("com.fedos.commerce.test.private-order-3-bob");

      const aliceTransport = new RealCommercePrivateOrderTransport({
        signingAuthority: alice.signer,
        relayPublisher: new WebSocketRelayPublisher(relay.url, { factory: createNodeWebSocketRelaySocketFactory() }),
        nip44Wire: alice.masterSeed,
        accountIndex: 0,
      });
      await aliceTransport.send(samplePayload(alice.pubkeyHex, bob.pubkeyHex, { orderId: "real-order-3" }), bob.pubkeyHex);

      // First discovery + apply.
      let events = await discoverPrivateOrderEvents(relay.url, bob.pubkeyHex);
      expect(events).toHaveLength(1);
      let envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(events[0], { nip44Wire: bob.masterSeed, localAccountIndex: 0 });
      expect(envelope.outcome).toBe("decrypted");
      const created = createOrder(
        { id: envelope.payload!.orderId, productId: envelope.payload!.productId, sellerPubkey: envelope.payload!.sellerPubkey, unitPriceCents: envelope.payload!.unitPriceCents, currency: envelope.payload!.currency, quantity: envelope.payload!.quantity },
        { kind: "customer", pubkey: envelope.senderPubkeyHex },
        envelope.payload!.at,
      );
      let order: Order = applyOrderAction(created.order!, { type: "submit", actor: { kind: "customer", pubkey: envelope.senderPubkeyHex } }, envelope.payload!.at).order!;
      expect(order.status).toBe("submitted");

      // Bob's process restarts / re-scans the relay (historyEnabled replays
      // the SAME stored event again) -- the real fixture reconfirmed replay-safe.
      events = await discoverPrivateOrderEvents(relay.url, bob.pubkeyHex);
      expect(events).toHaveLength(1); // same single stored event, replayed again
      envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(events[0], { nip44Wire: bob.masterSeed, localAccountIndex: 0 });
      expect(envelope.outcome).toBe("decrypted"); // decryption itself is deterministic/idempotent
      // Re-applying "submit" to an order that is already "submitted" is
      // REJECTED by the real state machine's own status guard -- never a
      // second history entry, never a corrupted state.
      const replayResult = applyOrderAction(order, { type: "submit", actor: { kind: "customer", pubkey: envelope.senderPubkeyHex } }, envelope.payload!.at);
      expect(replayResult.ok).toBe(false);
      expect(replayResult.code).toBe("invalid_state");
      expect(order.history).toHaveLength(2); // create + submit only, never 3
    } finally {
      await relay.close();
    }
  }, 30000);

  it("4. TRUST BOUNDARY: a genuinely signed event from an attacker's OWN key, claiming to be the order's seller, is rejected -- real signature verification alone is not enough", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    try {
      const alice = await realIdentity("com.fedos.commerce.test.private-order-4-alice");
      const bob = await realIdentity("com.fedos.commerce.test.private-order-4-bob");
      const mallory = await realIdentity("com.fedos.commerce.test.private-order-4-mallory");

      // Alice's real local order, seller = Bob.
      const created = createOrder(
        { id: "real-order-4", productId: "real-prod-4", sellerPubkey: bob.pubkeyHex, unitPriceCents: 1000, currency: "USD" },
        { kind: "customer", pubkey: alice.pubkeyHex },
        1_700_500_000,
      );
      const order = applyOrderAction(created.order!, { type: "submit", actor: { kind: "customer", pubkey: alice.pubkeyHex } }, 1_700_500_000).order!;

      // Mallory, a genuine real identity, signs+encrypts a claimed "accept"
      // for Alice's order, addressed to Alice, and GENUINELY sends it --
      // real signature, real encryption, real relay delivery.
      const malloryTransport = new RealCommercePrivateOrderTransport({
        signingAuthority: mallory.signer,
        relayPublisher: new WebSocketRelayPublisher(relay.url, { factory: createNodeWebSocketRelaySocketFactory() }),
        nip44Wire: mallory.masterSeed,
        accountIndex: 0,
      });
      const forgedPayload: PrivateOrderSyncPayload = {
        category: "private-order-sync",
        formatVersion: 1,
        orderId: order.id,
        productId: order.productId,
        buyerPubkey: order.buyerPubkey,
        sellerPubkey: order.sellerPubkey, // claims to be reporting on Bob's own order
        quantity: order.quantity,
        unitPriceCents: order.unitPriceCents,
        currency: order.currency,
        status: "accepted",
        at: 1_700_500_200,
      };
      const sent = await malloryTransport.send(forgedPayload, alice.pubkeyHex);
      expect(sent.accepted).toBe(true);

      const events = await discoverPrivateOrderEvents(relay.url, alice.pubkeyHex);
      expect(events).toHaveLength(1);
      const envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(events[0], { nip44Wire: alice.masterSeed, localAccountIndex: 0 });
      // The signature IS genuinely valid (for Mallory's own key) and the
      // encryption genuinely decrypts (Mallory legitimately encrypted FOR
      // Alice) -- but Mallory's REAL verified pubkey does not match this
      // order's own established `sellerPubkey` (Bob).
      expect(envelope.outcome).toBe("decrypted");
      expect(envelope.senderPubkeyHex).toBe(mallory.pubkeyHex);
      expect(envelope.senderPubkeyHex).not.toBe(order.sellerPubkey);

      // The receiving side's own trust-boundary check (mirrors
      // isActorIdentityAuthorized -- and, structurally, applyOrderAction()
      // itself ALSO independently rejects it, defense in depth).
      const claimedActor: OrderActor = { kind: "merchant", pubkey: envelope.senderPubkeyHex };
      const forgedResult = applyOrderAction(order, { type: "accept", actor: claimedActor }, envelope.payload!.at);
      expect(forgedResult.ok).toBe(false);
      expect(forgedResult.code).toBe("unauthorized_actor");
      expect(order.status).toBe("submitted"); // unchanged
    } finally {
      await relay.close();
    }
  }, 30000);

  it("5. OFFLINE/RECONNECT: Alice submits; Bob's own discovery query runs strictly AFTER Alice's publish socket has already closed (no overlapping live subscription -- Alice's `RealCommercePrivateOrderTransport.send()` opens one short-lived publish socket, gets its OK, and closes, exactly like the public-catalog test's own proof) and still discovers it, because the real relay retained the event (`historyEnabled`) rather than only forwarding it to an already-open subscription", async () => {
    const relay = await startFedosRealLocalWebSocketRelayServer({ historyEnabled: true });
    try {
      const alice = await realIdentity("com.fedos.commerce.test.private-order-5-alice");
      const bob = await realIdentity("com.fedos.commerce.test.private-order-5-bob");

      const aliceTransport = new RealCommercePrivateOrderTransport({
        signingAuthority: alice.signer,
        relayPublisher: new WebSocketRelayPublisher(relay.url, { factory: createNodeWebSocketRelaySocketFactory() }),
        nip44Wire: alice.masterSeed,
        accountIndex: 0,
      });
      const sent = await aliceTransport.send(samplePayload(alice.pubkeyHex, bob.pubkeyHex, { orderId: "real-order-5" }), bob.pubkeyHex);
      expect(sent.accepted).toBe(true);
      // (Alice's own short-lived publish socket has already sent EVENT,
      // received its OK, and closed by the time `send()` resolved above --
      // `WebSocketRelayPublisher.publish()`'s own `finish()` closes the
      // socket before resolving. `connectionCount()` is not asserted here
      // because the SERVER's own observation of the TCP close can lag the
      // client-side call by a few event-loop turns -- a real, harmless
      // timing race, not a correctness property.)

      // Bob's discovery query is a wholly separate, later real socket
      // connection -- proves this is history replay, not live forwarding.
      const events = await discoverPrivateOrderEvents(relay.url, bob.pubkeyHex);
      expect(events).toHaveLength(1);
      const envelope = await verifyAndDecryptInboundPrivateOrderEnvelope(events[0], { nip44Wire: bob.masterSeed, localAccountIndex: 0 });
      expect(envelope.outcome).toBe("decrypted");
      expect(envelope.payload?.orderId).toBe("real-order-5");
    } finally {
      await relay.close();
    }
  }, 30000);
});
