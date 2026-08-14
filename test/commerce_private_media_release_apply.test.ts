import { describe, it, expect, vi } from "vitest";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import { PersonaEpochSigningKeypair } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import { signMediaAccessGrant } from "../src/os/commerce/media_grant/media_access_grant_sign_verify.js";
import type { MediaAccessGrantPayload } from "../src/os/commerce/media_grant/media_access_grant_types.js";
import { computeCommerceMediaContentHash } from "../src/os/commerce/catalog/product_media_content_address.js";
import { createOrder, applyOrderAction } from "../src/os/commerce/order/order_state_machine.js";
import type { Order } from "../src/os/commerce/order/order_types.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import {
  buildOutboundPrivateMediaReleaseResponse,
  type BuildOutboundPrivateMediaReleaseResponseInput,
} from "../src/os/commerce/events/commerce_private_media_release_apply.js";
import type { PrivateMediaReleaseRequestPayload } from "../src/os/commerce/events/commerce_private_media_release_sync.js";

/**
 * Real Digital Delivery mega-arc (Agent G, Grant Custody pass) — end-to-end
 * plumbing coverage for `buildOutboundPrivateMediaReleaseResponse()`'s NEW
 * `sellerAuthorizedDelegateSigningKeys` parameter (closing Blocker 5), at
 * the ONE real orchestration layer that sits between the composition root
 * and `evaluateMediaAccessGrant()`/`wrapMediaAccessGrantRelease()`. No
 * dedicated test file previously existed for this orchestration function —
 * this file also covers the two other pre-existing gaps this same pass
 * found and fixed at the `fedos_electron_beta_main.cts` call site
 * (`getStoredCiphertextChecksum` was never supplied at all;
 * `media.checksum` was never populated) by proving THIS function's own
 * contract for those fields, so a regression there is caught here even
 * though the composition-root wiring itself is Electron-only and out of
 * this suite's reach.
 */

const BUYER = "b".repeat(64);
const SELLER_IDENTITY_KP = PersonaEpochSigningKeypair.generate();
const SELLER = SELLER_IDENTITY_KP.publicKeyHex; // the seller's REAL Nostr identity
const DELEGATE_KP = PersonaEpochSigningKeypair.generate(); // the durable, sealed media-grant-signing key -- structurally unrelated
const MEDIA_ID = "media-1";
const PRODUCT_ID = "product-1";
const STORAGE_REF = "storage-ref-1";
const NOW = 10_000;
const MERCHANT_ACCOUNT_INDEX = 0;

function buildPaidOrder(): Order {
  const created = createOrder(
    { id: "order-1", productId: PRODUCT_ID, sellerPubkey: SELLER, unitPriceCents: 1000, currency: "USD" },
    { kind: "customer", pubkey: BUYER },
    NOW - 300,
  );
  if (!created.ok) throw new Error("unreachable");
  const submitted = applyOrderAction(created.order, { type: "submit", actor: { kind: "customer", pubkey: BUYER } }, NOW - 200);
  if (!submitted.ok) throw new Error("unreachable");
  const accepted = applyOrderAction(submitted.order, { type: "accept", actor: { kind: "merchant", pubkey: SELLER } }, NOW - 100);
  if (!accepted.ok) throw new Error("unreachable");
  const paid = applyOrderAction(
    accepted.order,
    { type: "confirm_payment", actor: { kind: "payment_evidence" }, evidence: { orderId: "order-1", paymentId: "pay-1", status: "settled", observedAt: NOW - 50, reason: "settled" } },
    NOW - 50,
  );
  if (!paid.ok) throw new Error("unreachable");
  return paid.order;
}

function payload(overrides: Partial<MediaAccessGrantPayload> = {}): MediaAccessGrantPayload {
  return {
    formatVersion: 1,
    mediaId: MEDIA_ID,
    productId: PRODUCT_ID,
    buyerPubkey: BUYER,
    orderId: "order-1",
    issuerPubkey: DELEGATE_KP.publicKeyHex,
    grantVersion: 1,
    revoked: false,
    validFrom: NOW - 500,
    validUntil: null,
    issuedAt: NOW - 500,
    ...overrides,
  };
}

function grantEnvelope(overrides: Partial<MediaAccessGrantPayload> = {}, signer: PersonaEpochSigningKeypair = DELEGATE_KP) {
  const p = payload({ issuerPubkey: signer.publicKeyHex, ...overrides });
  return signMediaAccessGrant(p, signer, { issuer: signer.publicKeyHex, issuedAt: p.issuedAt });
}

function requestPayload(overrides: Partial<PrivateMediaReleaseRequestPayload> = {}): PrivateMediaReleaseRequestPayload {
  return { category: "private-media-release-request", formatVersion: 1, orderId: "order-1", mediaId: MEDIA_ID, buyerPubkey: BUYER, sellerPubkey: SELLER, at: NOW, ...overrides };
}

/** Same deterministic ECDH-pairing fake `commerce_media_access_grant_key_release.test.ts` already establishes. */
function makeFakeNip44Network() {
  const wires = new Map<string, string>();
  let nextId = 0;
  return {
    async encryptNip44Wire(_accountIndex: number, _counterpartyPublicKeyHex: string, plaintext: Uint8Array): Promise<string> {
      const id = `wire-${nextId++}`;
      wires.set(id, bytesToHex(plaintext));
      return id;
    },
  };
}

function merchantAuthority(overrides: Partial<FedosMasterSeedAuthority> = {}): FedosMasterSeedAuthority {
  return {
    isAvailable: vi.fn(async () => true),
    isCleared: vi.fn(async () => false),
    generate: vi.fn(async () => true),
    restoreSealed: vi.fn(async () => true),
    seal: vi.fn(async () => null),
    clear: vi.fn(async () => undefined),
    resolveConversationKey: vi.fn(async () => null),
    ...overrides,
  };
}

const PLAINTEXT = new TextEncoder().encode("real protected sample bytes");
const CHECKSUM = computeCommerceMediaContentHash(PLAINTEXT); // the REAL stored-ciphertext-subject checksum this test simulates

function baseInput(overrides: Partial<BuildOutboundPrivateMediaReleaseResponseInput> = {}): BuildOutboundPrivateMediaReleaseResponseInput {
  const order = buildPaidOrder();
  const network = makeFakeNip44Network();
  return {
    requestPayload: requestPayload(),
    senderPubkeyHex: BUYER,
    ownPubkeyHex: SELLER,
    order: { id: order.id, productId: order.productId, buyerPubkey: order.buyerPubkey, sellerPubkey: order.sellerPubkey, status: order.status },
    media: { id: MEDIA_ID, productId: PRODUCT_ID, classification: "protected", storageRef: STORAGE_REF, contentType: "application/pdf", checksum: CHECKSUM },
    candidateGrantEnvelope: grantEnvelope(),
    latestKnownGrantVersion: 1,
    now: NOW,
    merchantAccountIndex: MERCHANT_ACCOUNT_INDEX,
    authority: merchantAuthority({ encryptNip44Wire: network.encryptNip44Wire }),
    getStoredCiphertextChecksum: () => CHECKSUM,
    getProtectedContent: async () => PLAINTEXT,
    ...overrides,
  };
}

describe("buildOutboundPrivateMediaReleaseResponse — Real Digital Delivery mega-arc (Agent G, Grant Custody pass)", () => {
  it("REAL SELLER SHAPE: releases once the grant, signed by the durable delegate key, is accompanied by an already-verified delegate authorization", async () => {
    const result = await buildOutboundPrivateMediaReleaseResponse(baseInput({ sellerAuthorizedDelegateSigningKeys: [DELEGATE_KP.publicKeyHex] }));
    expect(result.outcome).toBe("released");
  });

  it("without the delegate authorization, the SAME real request is correctly denied wrong-signer (proves the field is load-bearing)", async () => {
    const result = await buildOutboundPrivateMediaReleaseResponse(baseInput());
    expect(result).toMatchObject({ outcome: "denied", reason: "wrong-signer" });
  });

  it("WRONG BUYER: sender identity mismatch is still rejected even with a valid delegate authorization", async () => {
    const result = await buildOutboundPrivateMediaReleaseResponse(
      baseInput({ senderPubkeyHex: "c".repeat(64), sellerAuthorizedDelegateSigningKeys: [DELEGATE_KP.publicKeyHex] }),
    );
    expect(result).toMatchObject({ outcome: "denied", reason: "sender-mismatch" });
  });

  it("WRONG PRODUCT: a grant for a different product is still rejected even with a valid delegate authorization", async () => {
    const order = buildPaidOrder();
    const result = await buildOutboundPrivateMediaReleaseResponse(
      baseInput({
        order: { id: order.id, productId: "other-product", buyerPubkey: order.buyerPubkey, sellerPubkey: order.sellerPubkey, status: order.status },
        media: { id: MEDIA_ID, productId: "other-product", classification: "protected", storageRef: STORAGE_REF, contentType: "application/pdf", checksum: CHECKSUM },
        sellerAuthorizedDelegateSigningKeys: [DELEGATE_KP.publicKeyHex],
      }),
    );
    expect(result.outcome).toBe("denied");
  });

  it("a delegate list naming an UNRELATED key never authorizes a grant signed by a DIFFERENT key", async () => {
    const mallory = PersonaEpochSigningKeypair.generate();
    const result = await buildOutboundPrivateMediaReleaseResponse(
      baseInput({
        candidateGrantEnvelope: grantEnvelope({}, DELEGATE_KP),
        sellerAuthorizedDelegateSigningKeys: [mallory.publicKeyHex],
      }),
    );
    expect(result).toMatchObject({ outcome: "denied", reason: "wrong-signer" });
  });

  it("CONTENT-IDENTITY GATE: a stored-ciphertext checksum drift denies before ever touching decryption, independent of the delegate authorization", async () => {
    const result = await buildOutboundPrivateMediaReleaseResponse(
      baseInput({ sellerAuthorizedDelegateSigningKeys: [DELEGATE_KP.publicKeyHex], getStoredCiphertextChecksum: () => "f".repeat(64) }),
    );
    expect(result).toMatchObject({ outcome: "denied", reason: "content-checksum-mismatch" });
  });

  it("omitting sellerAuthorizedDelegateSigningKeys entirely is byte-identical to passing [] (backward compatibility)", async () => {
    const omitted = await buildOutboundPrivateMediaReleaseResponse(baseInput());
    const empty = await buildOutboundPrivateMediaReleaseResponse(baseInput({ sellerAuthorizedDelegateSigningKeys: [] }));
    expect(omitted).toEqual(empty);
  });

  it("RESTART DURABILITY: a grant issued under the delegate key before a restart is still released after, given the SAME continuing delegate key re-certified post-restart", async () => {
    const secretBytes = PersonaEpochSigningKeypair.generateSecretKeyBytesForSealedCustody();
    const delegateBeforeRestart = PersonaEpochSigningKeypair.fromSecretKeyBytes(secretBytes.slice());
    const historicalEnvelope = grantEnvelope({}, delegateBeforeRestart);

    const delegateAfterRestart = PersonaEpochSigningKeypair.fromSecretKeyBytes(secretBytes.slice());
    expect(delegateAfterRestart.publicKeyHex).toBe(delegateBeforeRestart.publicKeyHex);

    const result = await buildOutboundPrivateMediaReleaseResponse(
      baseInput({ candidateGrantEnvelope: historicalEnvelope, sellerAuthorizedDelegateSigningKeys: [delegateAfterRestart.publicKeyHex] }),
    );
    expect(result.outcome).toBe("released");
  });
});
