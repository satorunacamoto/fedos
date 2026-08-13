import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PersonaEpochSigningKeypair } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import { createOrder, applyOrderAction } from "../src/os/commerce/order/order_state_machine.js";
import type { Order } from "../src/os/commerce/order/order_types.js";
import { issueMediaAccessGrantsForOrder } from "../src/os/commerce/media_grant/media_access_grant_issuance.js";
import { AppendOnlyMediaAccessGrantPersistence, latestGrantVersion } from "../src/os/commerce/media_grant/media_access_grant_persistence.js";
import { evaluateDigitalContentDeliveryInvariantForOrderCompletion } from "../src/os/commerce/media_grant/media_access_grant_release_channel_policy.js";
import {
  buildOutboundPrivateMediaReleaseResponse,
  applyInboundPrivateMediaReleaseResponse,
  type BuildOutboundPrivateMediaReleaseResponseInput,
} from "../src/os/commerce/events/commerce_private_media_release_apply.js";
import { DurableMediaReleaseContentCache } from "../src/os/commerce/media_grant/persistence/durable_media_release_content_cache.js";
import type { PrivateMediaReleaseRequestPayload } from "../src/os/commerce/events/commerce_private_media_release_sync.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import { IpfsMediaStore, InMemoryIpfsTransport, type IpfsTransport } from "../src/os/commerce/catalog/ipfs_media_store.js";
import type { ProductMediaEncryptionPort } from "../src/os/commerce/catalog/product_media_encryption.js";
import type { ProductMediaDecryptionPort } from "../src/os/commerce/catalog/product_media_decryption.js";

/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc — COORDINATOR
 * INTEGRATION PASS.
 *
 * Four agents (D, M, A, U) each worked from the same base commit in
 * separate worktrees and could not see each other's branches. Two claimed
 * cross-agent effects could therefore only become true AFTER the merge, and
 * neither agent was able to test its own claim. This file tests them for
 * real, rather than asserting them by code reading:
 *
 *   EFFECT 1 (M unblocks A). Agent M fixed "Blocker 4" in
 *     `ipfs_media_store.ts` (`put()`/`get()` used to pass a HARD-CODED
 *     `requiresNetwork: true` to `evaluateNetworkAccess()`, so every
 *     put/get against the only transport that exists —
 *     `InMemoryIpfsTransport`, a `Map` — failed under the default
 *     `"local-only"` profile). Agent A's seller-side release responder
 *     returns `denied("content-unavailable")` exactly when its
 *     `getProtectedContent()` callback yields `null`, and in
 *     `fedos_electron_beta_main.cts` that callback is backed by the real
 *     `IpfsMediaStore.getProtected()`. So on A's own branch the seller
 *     could never actually release anything. A's own end-to-end test
 *     stubs `getProtectedContent` with a lambda and therefore does NOT
 *     cover this seam — these tests wire the REAL store in.
 *
 *   EFFECT 2 (A vs the gap U disclosed). Agent U shipped a disclosed,
 *     unfixed P0: "'I Received This' can still be clicked with zero
 *     content delivered and no warning". Agent A independently added a
 *     hard-reject to `handleCommerceOrderComplete()`. The question the
 *     Coordinator must answer with a test, not a guess, is whether A's
 *     invariant actually closes U's gap. It does NOT close all of it, and
 *     tests 5–7 below pin exactly which half is closed and which is still
 *     open, so the residue cannot be lost.
 *
 * Everything real here is real: the real Order state machine, real grant
 * issuance/evaluation, the real `IpfsMediaStore` over the real
 * `InMemoryIpfsTransport` under the real `"local-only"` NetworkProfile, the
 * real release wrap/unwrap + digest verification, and the real durable
 * cache. Only the NIP-44 authority is a directional fake (the same
 * convention, and the same reason, as
 * `commerce_private_media_release_end_to_end.test.ts`), and the media
 * encryption/decryption ports are trivial XOR fakes so `putProtected()` can
 * succeed without a booted WASM Master Seed Authority — exactly the
 * substitution `commerce_ipfs_media_store.test.ts` already uses. Neither
 * substitution touches the network-gate logic under test.
 */

const SELLER_KP = PersonaEpochSigningKeypair.generate();
const SELLER = SELLER_KP.publicKeyHex;
const BUYER = "b".repeat(64);
const MEDIA_ID = "media-1";
const PRODUCT_ID = "product-1";
const ORDER_ID = "order-1";
const NOW = 10_000;
const REAL_CONTENT = new TextEncoder().encode("the real, protected purchased content (a PDF, say)");
const SUPPORTED_TYPES = ["application/pdf", "application/zip", "image/png"];

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), "fedos-coordinator-integration-"));
  dirs.push(d);
  return d;
}

/** Trivial XOR fake — never a real crypto primitive; mirrors `commerce_ipfs_media_store.test.ts`'s own `FakeAlwaysSucceedsEncryption`. */
class XorEncryption implements ProductMediaEncryptionPort {
  async encrypt(plaintext: Uint8Array): Promise<Uint8Array | null> {
    const out = Uint8Array.from(plaintext);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) ^ 0xaa;
    return out;
  }
}
/** The exact inverse of `XorEncryption`. */
class XorDecryption implements ProductMediaDecryptionPort {
  async decrypt(ciphertext: Uint8Array): Promise<Uint8Array | null> {
    const out = Uint8Array.from(ciphertext);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) ^ 0xaa;
    return out;
  }
}

/**
 * A transport that HONESTLY declares `requiresNetwork: true`. This is the
 * NEGATIVE CONTROL for Effect 1: it reproduces exactly the effective
 * behaviour `IpfsMediaStore` had for every transport BEFORE Agent M's fix
 * (when `true` was hard-coded), without reverting M's source change.
 */
class NetworkRequiringTransport implements IpfsTransport {
  readonly requiresNetwork = true;
  readonly #inner = new InMemoryIpfsTransport();
  add(bytes: Uint8Array): string | null {
    return this.#inner.add(bytes);
  }
  cat(cid: string): Uint8Array | null {
    return this.#inner.cat(cid);
  }
  pin(cid: string): boolean {
    return this.#inner.pin(cid);
  }
}

class FakeDirectionalAuthority implements Partial<FedosMasterSeedAuthority> {
  constructor(private readonly selfPubkeyHex: string) {}
  async encryptNip44Wire(_accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string | null> {
    return JSON.stringify({ from: this.selfPubkeyHex, to: counterpartyPublicKeyHex, data: Buffer.from(plaintext).toString("hex") });
  }
  async decryptNip44Wire(_accountIndex: number, counterpartyPublicKeyHex: string, payload: string): Promise<Uint8Array | null> {
    try {
      const parsed = JSON.parse(payload) as { from?: unknown; to?: unknown; data?: unknown };
      if (parsed.from !== counterpartyPublicKeyHex || parsed.to !== this.selfPubkeyHex) return null;
      if (typeof parsed.data !== "string") return null;
      return new Uint8Array(Buffer.from(parsed.data, "hex"));
    } catch {
      return null;
    }
  }
}

function buildPaidOrder(): Order {
  const created = createOrder({ id: ORDER_ID, productId: PRODUCT_ID, sellerPubkey: SELLER, unitPriceCents: 1000, currency: "USD" }, { kind: "customer", pubkey: BUYER }, NOW - 400);
  if (!created.ok) throw new Error("unreachable: create");
  const submitted = applyOrderAction(created.order, { type: "submit", actor: { kind: "customer", pubkey: BUYER } }, NOW - 300);
  if (!submitted.ok) throw new Error("unreachable: submit");
  const accepted = applyOrderAction(submitted.order, { type: "accept", actor: { kind: "merchant", pubkey: SELLER } }, NOW - 200);
  if (!accepted.ok) throw new Error("unreachable: accept");
  const paid = applyOrderAction(
    accepted.order,
    { type: "confirm_payment", actor: { kind: "payment_evidence" }, evidence: { orderId: ORDER_ID, paymentId: "pay-1", status: "settled", observedAt: NOW - 100, reason: "settled" } },
    NOW - 100,
  );
  if (!paid.ok) throw new Error("unreachable: confirm_payment");
  return paid.order;
}

function issueRealGrant(order: Order, persistence: AppendOnlyMediaAccessGrantPersistence): void {
  const existing = persistence.listGrants();
  const outcome = issueMediaAccessGrantsForOrder({
    order: { id: order.id, productId: order.productId, buyerPubkey: order.buyerPubkey, sellerPubkey: order.sellerPubkey, status: order.status },
    candidateMedia: [{ id: MEDIA_ID, productId: PRODUCT_ID, classification: "protected" }],
    sellerSigningKeypair: SELLER_KP,
    latestKnownGrantVersionFor: (mediaId) => latestGrantVersion(existing, mediaId, order.buyerPubkey, order.id),
    now: NOW,
  });
  if (outcome.outcome !== "issued") throw new Error(`unreachable: grant issuance -- ${outcome.outcome}`);
  for (const envelope of outcome.envelopes) persistence.putGrant(envelope);
}

/**
 * The REAL seller-side path, with Agent A's responder wired to Agent M's
 * REAL `IpfsMediaStore.getProtected()` — the seam neither agent could test
 * alone. `transport` selects the fixed (in-memory, `requiresNetwork:false`)
 * or the negative-control (`requiresNetwork:true`) backend.
 */
async function sellerReleaseThroughRealMediaStore(transport: IpfsTransport): Promise<{
  readonly response: Awaited<ReturnType<typeof buildOutboundPrivateMediaReleaseResponse>>;
  readonly storageRef: string;
  readonly order: Order;
}> {
  const order = buildPaidOrder();
  const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
  issueRealGrant(order, persistence);

  // The seller's own real protected-media store, at the REAL default
  // profile the app ships with (`"local-only"`) — this is precisely the
  // configuration Blocker 4 broke.
  const store = new IpfsMediaStore(transport, 1_000_000, SUPPORTED_TYPES, new XorEncryption(), "local-only", () => NOW * 1000, new XorDecryption());
  const put = await store.putProtected(REAL_CONTENT, "application/pdf");
  const storageRef = put.outcome === "stored" || put.outcome === "already-present" ? put.metadata.key : "";

  const all = persistence.listGrants();
  const latest = latestGrantVersion(all, MEDIA_ID, BUYER, ORDER_ID);
  const candidate = all.find((e) => e.payload.mediaId === MEDIA_ID && e.payload.buyerPubkey === BUYER && e.payload.orderId === ORDER_ID && e.payload.grantVersion === latest);

  const requestPayload: PrivateMediaReleaseRequestPayload = {
    category: "private-media-release-request",
    formatVersion: 1,
    orderId: ORDER_ID,
    mediaId: MEDIA_ID,
    buyerPubkey: BUYER,
    sellerPubkey: SELLER,
    at: NOW,
  };
  const input: BuildOutboundPrivateMediaReleaseResponseInput = {
    requestPayload,
    senderPubkeyHex: BUYER,
    ownPubkeyHex: SELLER,
    order: { id: order.id, productId: order.productId, buyerPubkey: order.buyerPubkey, sellerPubkey: order.sellerPubkey, status: order.status },
    // Commerce Product-Media Sync + Truthful Completion mega-arc (Agent C)
    // added a content-IDENTITY gate (`checksum`/`getStoredCiphertextChecksum`)
    // that is orthogonal to what THIS file tests (network egress gating /
    // Effects 1-2) -- neutralized here to a trivially self-consistent literal
    // so it can never interfere with test 3's negative control (which, by
    // design, sometimes has an empty/never-stored `storageRef`). Real
    // content-identity coverage lives in
    // `commerce_private_media_release_end_to_end.test.ts`.
    media: { id: MEDIA_ID, productId: PRODUCT_ID, classification: "protected", storageRef, contentType: "application/pdf", checksum: "neutral-checksum-not-under-test-here" },
    candidateGrantEnvelope: candidate,
    latestKnownGrantVersion: latest,
    now: NOW,
    merchantAccountIndex: 0,
    authority: new FakeDirectionalAuthority(SELLER) as unknown as FedosMasterSeedAuthority,
    getStoredCiphertextChecksum: () => "neutral-checksum-not-under-test-here",
    // THE SEAM: the real store, not a lambda.
    getProtectedContent: async (ref: string) => store.getProtected(ref),
  };
  return { response: await buildOutboundPrivateMediaReleaseResponse(input), storageRef, order };
}

describe("Coordinator integration effect 1 -- Agent M's Blocker 4 fix genuinely unblocks Agent A's release channel", () => {
  it("1. the seller's REAL IpfsMediaStore (in-memory transport, 'local-only' profile) actually stores protected content -- the put that Blocker 4 used to fail unconditionally", async () => {
    const store = new IpfsMediaStore(new InMemoryIpfsTransport(), 1_000_000, SUPPORTED_TYPES, new XorEncryption(), "local-only", () => NOW * 1000, new XorDecryption());
    const put = await store.putProtected(REAL_CONTENT, "application/pdf");
    expect(put.outcome).toBe("stored");
    if (put.outcome !== "stored") throw new Error("unreachable");
    const roundTripped = await store.getProtected(put.metadata.key);
    expect(roundTripped).not.toBeNull();
    expect(Buffer.from(roundTripped!)).toEqual(Buffer.from(REAL_CONTENT));
  });

  it("2. INTEGRATION EFFECT: Agent A's seller-side responder, wired to the REAL media store, now RELEASES real content instead of returning content-unavailable", async () => {
    const { response, storageRef } = await sellerReleaseThroughRealMediaStore(new InMemoryIpfsTransport());
    expect(storageRef).not.toBe("");
    expect(response.outcome).toBe("released");
    // The specific failure this merge is claimed to have fixed must be gone.
    if (response.outcome === "denied") {
      expect(response.reason).not.toBe("content-unavailable");
    }
  });

  it("3. NEGATIVE CONTROL: with a transport that honestly requires network, the SAME path still returns denied/content-unavailable under 'local-only' -- proving test 2 passes BECAUSE of M's fix, and that the real network-egress gate is not weakened", async () => {
    const { response } = await sellerReleaseThroughRealMediaStore(new NetworkRequiringTransport());
    expect(response.outcome).toBe("denied");
    if (response.outcome !== "denied") throw new Error("unreachable");
    expect(response.reason).toBe("content-unavailable");
  });

  it("4. the released content survives the real buyer-side verify + durable cache, so the invariant in effect 2 can actually be satisfied end-to-end", async () => {
    const { response, order } = await sellerReleaseThroughRealMediaStore(new InMemoryIpfsTransport());
    if (response.outcome !== "released") throw new Error("expected a release");
    const applied = await applyInboundPrivateMediaReleaseResponse({
      payload: response,
      senderPubkeyHex: SELLER,
      ownPubkeyHex: BUYER,
      order: { id: order.id, sellerPubkey: order.sellerPubkey },
      expectedMediaId: MEDIA_ID,
      buyerAccountIndex: 0,
      authority: new FakeDirectionalAuthority(BUYER) as unknown as FedosMasterSeedAuthority,
    });
    expect(applied.outcome).toBe("verified");
    if (applied.outcome !== "verified") throw new Error("unreachable");
    expect(Buffer.from(applied.record.contentBase64, "base64")).toEqual(Buffer.from(REAL_CONTENT));

    const cache = new DurableMediaReleaseContentCache(join(freshDir(), "content.ndjson"));
    expect(cache.putRelease(applied.record)).toBe("inserted");
    expect(cache.hasRelease(ORDER_ID, MEDIA_ID, BUYER)).toBe(true);
  });
});

describe("Coordinator integration effect 2 -- what Agent A's completion invariant does, and does NOT, close of the gap Agent U disclosed", () => {
  const PROTECTED_MEDIA = [{ id: MEDIA_ID, productId: PRODUCT_ID, classification: "protected" as const }];

  it("5. CLOSED BY A: an order whose product has protected media with NO release on file cannot reach 'completed' -- the invariant hard-rejects, so there is no false-green Completed", () => {
    const invariant = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: PROTECTED_MEDIA,
      hasReleasedContent: () => false,
    });
    expect(invariant.satisfied).toBe(false);
    if (invariant.satisfied || invariant.reason !== "digital-content-not-delivered") throw new Error("unreachable");
    expect(invariant.missingMediaIds).toEqual([MEDIA_ID]);
  });

  it("6. and once the content really has been delivered (effect 1's own path), the same invariant is satisfied -- the gate opens for a genuine delivery, never only ever closed", async () => {
    const { response, order } = await sellerReleaseThroughRealMediaStore(new InMemoryIpfsTransport());
    if (response.outcome !== "released") throw new Error("expected a release");
    const applied = await applyInboundPrivateMediaReleaseResponse({
      payload: response,
      senderPubkeyHex: SELLER,
      ownPubkeyHex: BUYER,
      order: { id: order.id, sellerPubkey: order.sellerPubkey },
      expectedMediaId: MEDIA_ID,
      buyerAccountIndex: 0,
      authority: new FakeDirectionalAuthority(BUYER) as unknown as FedosMasterSeedAuthority,
    });
    if (applied.outcome !== "verified") throw new Error("expected verified");
    const cache = new DurableMediaReleaseContentCache(join(freshDir(), "content.ndjson"));
    cache.putRelease(applied.record);

    const invariant = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: PROTECTED_MEDIA,
      hasReleasedContent: (mediaId) => cache.hasRelease(ORDER_ID, mediaId, BUYER),
    });
    expect(invariant).toEqual({ satisfied: true });
  });

  it("7. STILL OPEN (regression pin): 'I Received This' is a confirm_delivery transition, NOT complete -- it still succeeds with zero protected content delivered, so Agent U's disclosed gap is only PARTLY closed", () => {
    const paid = buildPaidOrder();
    // The seller marks it fulfilled first (`confirm_delivery` is only legal
    // from `"fulfilling"`) -- note the seller can do this WITHOUT having
    // released any protected content, which is itself part of the gap.
    const fulfilled = applyOrderAction(paid, { type: "fulfill", actor: { kind: "merchant", pubkey: SELLER } }, NOW);
    if (!fulfilled.ok || fulfilled.order === undefined) throw new Error("unreachable: fulfill");
    expect(fulfilled.order.status).toBe("fulfilling");

    // Exactly the action `handleCommerceDeliveryAcknowledgeReceipt()` applies
    // when the buyer clicks "I Received This".
    const acknowledged = applyOrderAction(
      fulfilled.order,
      {
        type: "confirm_delivery",
        actor: { kind: "delivery_evidence" },
        evidence: { orderId: ORDER_ID, deliveryId: "delivery-1", status: "delivered", observedAt: NOW, reason: "customer acknowledged receipt" },
      } as Parameters<typeof applyOrderAction>[1],
      NOW,
    );
    // It succeeds even though the invariant below is unsatisfied: the
    // acknowledge-receipt handler never consults it.
    expect(acknowledged.ok).toBe(true);
    if (!acknowledged.ok || acknowledged.order === undefined) throw new Error("unreachable");
    expect(acknowledged.order.status).toBe("delivered");
    expect(acknowledged.order.status).not.toBe("completed");

    const invariant = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: PROTECTED_MEDIA,
      hasReleasedContent: () => false,
    });
    expect(invariant.satisfied).toBe(false);

    // So: the buyer CAN still mark an undelivered digital order "delivered"
    // with no warning (U's gap, still open, now bounded), but CANNOT get it
    // to "completed" (A's invariant, which does close the false-green end
    // state). Both halves are pinned here so the residue is not lost.
  });
});
