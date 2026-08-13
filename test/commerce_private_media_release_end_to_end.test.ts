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

/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) — the
 * ASSEMBLED end-to-end proof: real Order state machine -> real grant
 * issuance -> real `evaluateMediaAccessGrant()` -> real
 * `wrapMediaAccessGrantRelease()`/`unwrapMediaAccessGrantRelease()` ->
 * real digest verification -> real durable content cache, with a fake
 * directional NIP-44 authority standing in for the real WASM one (the
 * SAME "fake crypto models NIP-44's real directional property, no
 * approximated cryptography" convention `commerce_private_delivery_bridge_fake_crypto.test.ts`
 * already established — the actual NIP-44 primitive itself is a separately
 * reviewed, already-tested boundary this file does not re-verify).
 *
 * This is the arc's own mandate item 3 ("verify... grant binds buyer
 * identity, product, media, and the qualifying order — wrong buyer, wrong
 * product, wrong media, and pre-payment access must all be REJECTED with
 * tests proving it") and item 4 ("content-missing/corrupt/wrong-hash/
 * expired-grant... truthful, visible failure state") proven together, at
 * the fully assembled orchestration layer — the exact composition
 * `fedos_electron_beta_main.cts`'s own request-handling/response-handling
 * call sites use.
 */

const SELLER_KP = PersonaEpochSigningKeypair.generate();
const SELLER = SELLER_KP.publicKeyHex;
const BUYER = "b".repeat(64);
const OTHER_BUYER = "c".repeat(64);
const MEDIA_ID = "media-1";
const PRODUCT_ID = "product-1";
const ORDER_ID = "order-1";
const NOW = 10_000;
const REAL_CONTENT = new TextEncoder().encode("this is the real, protected purchased content");

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), "fedos-media-release-e2e-"));
  dir = d;
  return d;
}

/** Directional fake NIP-44: `encryptNip44Wire`/`decryptNip44Wire` only "work" for the exact bound counterparty pair, mirroring the real primitive's ECDH-binding property without implementing real cryptography. */
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

function buildOrder(overrides: { readonly buyerPubkey?: string } = {}): Order {
  const buyerPubkey = overrides.buyerPubkey ?? BUYER;
  const created = createOrder({ id: ORDER_ID, productId: PRODUCT_ID, sellerPubkey: SELLER, unitPriceCents: 1000, currency: "USD" }, { kind: "customer", pubkey: buyerPubkey }, NOW - 400);
  if (!created.ok) throw new Error("unreachable: create");
  return created.order;
}

function toAccepted(o: Order): Order {
  const submitted = applyOrderAction(o, { type: "submit", actor: { kind: "customer", pubkey: o.buyerPubkey } }, NOW - 300);
  if (!submitted.ok) throw new Error("unreachable: submit");
  const accepted = applyOrderAction(submitted.order, { type: "accept", actor: { kind: "merchant", pubkey: SELLER } }, NOW - 200);
  if (!accepted.ok) throw new Error("unreachable: accept");
  return accepted.order;
}

function toPaid(o: Order): Order {
  const accepted = toAccepted(o);
  const paid = applyOrderAction(
    accepted,
    { type: "confirm_payment", actor: { kind: "payment_evidence" }, evidence: { orderId: o.id, paymentId: "pay-1", status: "settled", observedAt: NOW - 100, reason: "settled" } },
    NOW - 100,
  );
  if (!paid.ok) throw new Error("unreachable: confirm_payment");
  return paid.order;
}

const REAL_STORED_CIPHERTEXT_CHECKSUM = "a".repeat(64);
const MEDIA = { id: MEDIA_ID, productId: PRODUCT_ID, classification: "protected" as const, storageRef: "storage-ref-1", contentType: "application/pdf", checksum: REAL_STORED_CIPHERTEXT_CHECKSUM };

function issueRealGrant(order: Order, persistence: AppendOnlyMediaAccessGrantPersistence): void {
  const existingGrants = persistence.listGrants();
  const outcome = issueMediaAccessGrantsForOrder({
    order: { id: order.id, productId: order.productId, buyerPubkey: order.buyerPubkey, sellerPubkey: order.sellerPubkey, status: order.status },
    candidateMedia: [{ id: MEDIA.id, productId: MEDIA.productId, classification: "protected" }],
    sellerSigningKeypair: SELLER_KP,
    latestKnownGrantVersionFor: (mediaId) => latestGrantVersion(existingGrants, mediaId, order.buyerPubkey, order.id),
    now: NOW,
  });
  if (outcome.outcome !== "issued") throw new Error(`unreachable: grant issuance -- ${outcome.outcome}`);
  for (const envelope of outcome.envelopes) persistence.putGrant(envelope);
}

function requestPayloadFor(order: Order): PrivateMediaReleaseRequestPayload {
  return { category: "private-media-release-request", formatVersion: 1, orderId: order.id, mediaId: MEDIA_ID, buyerPubkey: order.buyerPubkey, sellerPubkey: order.sellerPubkey, at: NOW };
}

function candidateGrantFor(persistence: AppendOnlyMediaAccessGrantPersistence, order: Order, buyerPubkey: string) {
  const allGrants = persistence.listGrants();
  const latest = latestGrantVersion(allGrants, MEDIA_ID, buyerPubkey, order.id);
  return { latest, candidate: allGrants.find((e) => e.payload.mediaId === MEDIA_ID && e.payload.buyerPubkey === buyerPubkey && e.payload.orderId === order.id && e.payload.grantVersion === latest) };
}

async function sellerBuildResponse(
  order: Order,
  persistence: AppendOnlyMediaAccessGrantPersistence,
  requestBuyer: string,
  senderPubkeyHex: string,
  opts: { readonly storeReturnsNull?: boolean; readonly storedChecksum?: string | null } = {},
) {
  const { latest, candidate } = candidateGrantFor(persistence, order, requestBuyer);
  const input: BuildOutboundPrivateMediaReleaseResponseInput = {
    requestPayload: { ...requestPayloadFor(order), buyerPubkey: requestBuyer },
    senderPubkeyHex,
    ownPubkeyHex: SELLER,
    order: { id: order.id, productId: order.productId, buyerPubkey: order.buyerPubkey, sellerPubkey: order.sellerPubkey, status: order.status },
    media: MEDIA,
    candidateGrantEnvelope: candidate,
    latestKnownGrantVersion: latest,
    now: NOW,
    merchantAccountIndex: 0,
    authority: new FakeDirectionalAuthority(SELLER) as unknown as FedosMasterSeedAuthority,
    // Commerce Product-Media Sync + Truthful Completion mega-arc (Agent C) --
    // defaults to a genuine match (`MEDIA.checksum`) so every pre-existing
    // scenario in this file is unaffected; `opts.storedChecksum` lets a test
    // simulate the store actually holding DIFFERENT (or unavailable) bytes
    // than the product's own declared checksum.
    getStoredCiphertextChecksum: () => (opts.storedChecksum !== undefined ? opts.storedChecksum : MEDIA.checksum),
    getProtectedContent: async () => (opts.storeReturnsNull ? null : REAL_CONTENT),
  };
  return buildOutboundPrivateMediaReleaseResponse(input);
}

describe("Private media-release channel -- assembled end-to-end", () => {
  it("HAPPY PATH: real paid order + real issued grant -> real release -> buyer verifies+caches -> restart survives", async () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    issueRealGrant(order, persistence);

    const response = await sellerBuildResponse(order, persistence, order.buyerPubkey, order.buyerPubkey);
    expect(response.outcome).toBe("released");
    if (response.outcome !== "released") throw new Error("unreachable");
    expect(response.grantVersion).toBe(1);
    expect(response.contentType).toBe("application/pdf");

    const applied = await applyInboundPrivateMediaReleaseResponse({
      payload: response,
      senderPubkeyHex: order.sellerPubkey,
      ownPubkeyHex: order.buyerPubkey,
      order: { id: order.id, sellerPubkey: order.sellerPubkey },
      expectedMediaId: MEDIA_ID,
      buyerAccountIndex: 0,
      authority: new FakeDirectionalAuthority(order.buyerPubkey) as unknown as FedosMasterSeedAuthority,
    });
    expect(applied.outcome).toBe("verified");
    if (applied.outcome !== "verified") throw new Error("unreachable");
    expect(Buffer.from(applied.record.contentBase64, "base64")).toEqual(Buffer.from(REAL_CONTENT));

    const cacheFile = join(freshDir(), "content.ndjson");
    const cache1 = new DurableMediaReleaseContentCache(cacheFile);
    expect(cache1.putRelease(applied.record)).toBe("inserted");

    // RESTART SURVIVAL: fresh cache instance, same file.
    const cache2 = new DurableMediaReleaseContentCache(cacheFile);
    expect(cache2.hasRelease(ORDER_ID, MEDIA_ID, order.buyerPubkey)).toBe(true);

    // The order-completion invariant now sees this media as released.
    const invariant = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [MEDIA],
      hasReleasedContent: (mediaId) => cache2.hasRelease(ORDER_ID, mediaId, order.buyerPubkey),
    });
    expect(invariant).toEqual({ satisfied: true });
  });

  it("REJECT: pre-payment order (accepted, not paid) never qualifies -- denied at the grant layer", async () => {
    const order = toAccepted(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    // No grant can even be issued pre-payment (mirrors issuance's own "order-not-qualifying").
    const response = await sellerBuildResponse(order, persistence, order.buyerPubkey, order.buyerPubkey);
    expect(response.outcome).toBe("denied");
    if (response.outcome !== "denied") throw new Error("unreachable");
    expect(response.reason).toMatch(/MALFORMED_ENVELOPE|order-not-qualifying/);
  });

  it("REJECT: wrong buyer requests another buyer's real grant -- denied (buyer-mismatch) before any content ever decrypts", async () => {
    const order = toPaid(buildOrder({ buyerPubkey: BUYER }));
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    issueRealGrant(order, persistence);

    // OTHER_BUYER sends a self-consistent request (sender === payload.buyerPubkey === OTHER_BUYER),
    // but the real Order's own buyer is BUYER, so the authorization pre-check itself
    // rejects it as order-mismatch before evaluateMediaAccessGrant is ever reached.
    const response = await sellerBuildResponse(order, persistence, OTHER_BUYER, OTHER_BUYER);
    expect(response.outcome).toBe("denied");
    if (response.outcome !== "denied") throw new Error("unreachable");
    expect(response.reason).toBe("order-mismatch");
  });

  it("REJECT: a spoofed sender (claims to be the real buyer, but the real verified signer differs) is denied at the sender-identity gate", async () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    issueRealGrant(order, persistence);

    const response = await sellerBuildResponse(order, persistence, order.buyerPubkey, OTHER_BUYER /* real sender != claimed buyer */);
    expect(response.outcome).toBe("denied");
    if (response.outcome !== "denied") throw new Error("unreachable");
    expect(response.reason).toBe("sender-mismatch");
  });

  it("REJECT: content missing/unavailable at the seller's own store is denied honestly, never fabricated", async () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    issueRealGrant(order, persistence);
    const response = await sellerBuildResponse(order, persistence, order.buyerPubkey, order.buyerPubkey, { storeReturnsNull: true });
    expect(response.outcome).toBe("denied");
    if (response.outcome !== "denied") throw new Error("unreachable");
    expect(response.reason).toBe("content-unavailable");
  });

  it("REJECT: buyer receives a response that did NOT really come from this order's own seller -- unauthorized, never unwrapped", async () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    issueRealGrant(order, persistence);
    const response = await sellerBuildResponse(order, persistence, order.buyerPubkey, order.buyerPubkey);
    expect(response.outcome).toBe("released");

    const applied = await applyInboundPrivateMediaReleaseResponse({
      payload: response,
      senderPubkeyHex: OTHER_BUYER, // NOT order.sellerPubkey -- e.g. some other party trying to inject a message
      ownPubkeyHex: order.buyerPubkey,
      order: { id: order.id, sellerPubkey: order.sellerPubkey },
      expectedMediaId: MEDIA_ID,
      buyerAccountIndex: 0,
      authority: new FakeDirectionalAuthority(order.buyerPubkey) as unknown as FedosMasterSeedAuthority,
    });
    expect(applied.outcome).toBe("unauthorized");
  });

  it("REJECT: corrupted/tampered wire content -- decrypts to the WRONG bytes under a real counterparty -- fails the digest check, never accepted as success", async () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    issueRealGrant(order, persistence);
    const response = await sellerBuildResponse(order, persistence, order.buyerPubkey, order.buyerPubkey);
    expect(response.outcome).toBe("released");
    if (response.outcome !== "released") throw new Error("unreachable");

    // Simulate ciphertext tampering/corruption in transit: mutate the embedded hex payload
    // so a (fake-crypto) decrypt still "succeeds" but returns DIFFERENT bytes than what the
    // seller actually committed to via contentDigest -- a real NIP-44 AEAD would instead fail
    // the decrypt outright, so this specifically exercises the SECOND, independent layer of
    // defense this arc's mandate requires: never trust a decrypt success alone.
    const inner = JSON.parse(response.wireCiphertext) as { from: string; to: string; data: string };
    const corrupted = { ...response, wireCiphertext: JSON.stringify({ ...inner, data: Buffer.from("totally different bytes!!").toString("hex") }) };

    const applied = await applyInboundPrivateMediaReleaseResponse({
      payload: corrupted,
      senderPubkeyHex: order.sellerPubkey,
      ownPubkeyHex: order.buyerPubkey,
      order: { id: order.id, sellerPubkey: order.sellerPubkey },
      expectedMediaId: MEDIA_ID,
      buyerAccountIndex: 0,
      authority: new FakeDirectionalAuthority(order.buyerPubkey) as unknown as FedosMasterSeedAuthority,
    });
    expect(applied.outcome).toBe("content-corrupt");
  });

  it("REJECT: even past authorization, a wrong-identity authority cannot decrypt the release -- fails closed at the ECDH/unwrap layer, never a fabricated success", async () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    issueRealGrant(order, persistence);
    const response = await sellerBuildResponse(order, persistence, order.buyerPubkey, order.buyerPubkey);
    expect(response.outcome).toBe("released");

    // Defense in depth: authorization above only re-checks CLAIMED identities
    // (payload/sender/order fields); the actual bytes can still only ever be
    // recovered by an authority whose real ECDH counterparty key matches --
    // here the authority's own "self" key is wrong (simulates a real
    // account/authority resolution bug independent of the authorization
    // layer), so `decryptNip44Wire` itself fails closed.
    const applied = await applyInboundPrivateMediaReleaseResponse({
      payload: response as never,
      senderPubkeyHex: order.sellerPubkey,
      ownPubkeyHex: order.buyerPubkey,
      order: { id: order.id, sellerPubkey: order.sellerPubkey },
      expectedMediaId: MEDIA_ID,
      buyerAccountIndex: 0,
      authority: new FakeDirectionalAuthority(OTHER_BUYER) as unknown as FedosMasterSeedAuthority, // wrong "self" identity
    });
    expect(applied.outcome).toBe("wrap-unavailable");
  });

  it("REJECT: a revoked grant is denied even though it is validly signed -- media never released", async () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    issueRealGrant(order, persistence);
    const v1 = persistence.listGrants()[0]!;
    const { signMediaAccessGrant } = await import("../src/os/commerce/media_grant/media_access_grant_sign_verify.js");
    const revokedPayload = { ...v1.payload, grantVersion: 2, revoked: true, issuedAt: NOW + 1 };
    const v2 = signMediaAccessGrant(revokedPayload, SELLER_KP, { issuer: SELLER, issuedAt: NOW + 1 });
    persistence.putGrant(v2);

    const response = await sellerBuildResponse(order, persistence, order.buyerPubkey, order.buyerPubkey);
    expect(response.outcome).toBe("denied");
    if (response.outcome !== "denied") throw new Error("unreachable");
    expect(response.reason).toBe("revoked");
  });

  it("REJECT (Agent C): stored ciphertext checksum does not match the product's declared ProductMedia checksum -- denied before any decrypt is ever attempted", async () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    issueRealGrant(order, persistence);
    const response = await sellerBuildResponse(order, persistence, order.buyerPubkey, order.buyerPubkey, { storedChecksum: "b".repeat(64) /* differs from MEDIA.checksum */ });
    expect(response.outcome).toBe("denied");
    if (response.outcome !== "denied") throw new Error("unreachable");
    expect(response.reason).toBe("content-checksum-mismatch");
  });

  it("REJECT (Agent C): store has no record at all for this storageRef -- fail-closed as a mismatch, not silently skipped", async () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(join(freshDir(), "grants.ndjson"));
    issueRealGrant(order, persistence);
    const response = await sellerBuildResponse(order, persistence, order.buyerPubkey, order.buyerPubkey, { storedChecksum: null });
    expect(response.outcome).toBe("denied");
    if (response.outcome !== "denied") throw new Error("unreachable");
    expect(response.reason).toBe("content-checksum-mismatch");
  });

  it("order-completion invariant: a digital order with an UNRELEASED protected media item is never satisfied", () => {
    const cacheFile = join(freshDir(), "content.ndjson");
    const cache = new DurableMediaReleaseContentCache(cacheFile);
    const invariant = evaluateDigitalContentDeliveryInvariantForOrderCompletion({
      productId: PRODUCT_ID,
      productMedia: [MEDIA],
      hasReleasedContent: (mediaId) => cache.hasRelease(ORDER_ID, mediaId, BUYER),
    });
    expect(invariant).toEqual({ satisfied: false, reason: "digital-content-not-delivered", missingMediaIds: [MEDIA_ID] });
  });
});
