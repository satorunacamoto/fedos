import { describe, it, expect, vi } from "vitest";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import { PersonaEpochSigningKeypair } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import { signMediaAccessGrant } from "../src/os/commerce/media_grant/media_access_grant_sign_verify.js";
import type { MediaAccessGrantPayload } from "../src/os/commerce/media_grant/media_access_grant_types.js";
import { createOrder, applyOrderAction } from "../src/os/commerce/order/order_state_machine.js";
import type { Order } from "../src/os/commerce/order/order_types.js";
import type { FedosMasterSeedAuthority } from "../src/os/core/vault/wasm/fedos_master_seed_authority.js";
import {
  wrapMediaAccessGrantRelease,
  unwrapMediaAccessGrantRelease,
  MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES,
} from "../src/os/commerce/media_grant/media_access_grant_key_release.js";

const BUYER = "b".repeat(64);
const SELLER_KP = PersonaEpochSigningKeypair.generate();
const SELLER = SELLER_KP.publicKeyHex;
const MEDIA = { id: "media-1", productId: "product-1" };
const NOW = 10_000;
const MERCHANT_ACCOUNT_INDEX = 0;
const BUYER_ACCOUNT_INDEX = 0;

function buildPaidOrder(): Order {
  const created = createOrder(
    { id: "order-1", productId: MEDIA.productId, sellerPubkey: SELLER, unitPriceCents: 1000, currency: "USD" },
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
    mediaId: MEDIA.id,
    productId: MEDIA.productId,
    buyerPubkey: BUYER,
    orderId: "order-1",
    issuerPubkey: SELLER,
    grantVersion: 1,
    revoked: false,
    validFrom: NOW - 500,
    validUntil: null,
    issuedAt: NOW - 500,
    ...overrides,
  };
}

function grantEnvelope(overrides: Partial<MediaAccessGrantPayload> = {}) {
  const p = payload(overrides);
  return signMediaAccessGrant(p, SELLER_KP, { issuer: SELLER_KP.publicKeyHex, issuedAt: p.issuedAt });
}

/**
 * A small, deterministic fake standing in for the real ECDH+NIP-44 wire
 * bridge — mirrors `commerce_wasm_product_media_decryption.test.ts`'s own
 * "inject fakes to exercise THIS FILE's wiring, not real cryptography"
 * convention. Simulates ECDH's own key property (only the exact intended
 * counterparty pairing can decrypt) via a plain lookup table keyed by the
 * UNORDERED `(accountA, accountB)` pair, without claiming to BE NIP-44.
 */
function makeFakeNip44Network() {
  const wires = new Map<string, { readonly senderPair: string; readonly plaintextHex: string }>();
  let nextId = 0;

  function pairKey(a: number, bHex: string): string {
    return `${a}:${bHex}`;
  }

  function encryptNip44Wire(accountIndex: number, counterpartyPublicKeyHex: string, plaintext: Uint8Array): string {
    const id = `wire-${nextId++}`;
    wires.set(id, { senderPair: pairKey(accountIndex, counterpartyPublicKeyHex), plaintextHex: bytesToHex(plaintext) });
    return id;
  }

  function decryptNip44Wire(_accountIndex: number, _counterpartyPublicKeyHex: string, payloadWire: string): Uint8Array | null {
    // Deliberately simple: this fake only stands in for THIS file's own
    // wrap/unwrap wiring (does it pass the right arguments, does it fail
    // closed on an unknown wire), never for real ECDH pairing semantics --
    // an unknown/tampered `payloadWire` is the one thing it actually gates.
    const entry = wires.get(payloadWire);
    if (entry === undefined) return null; // tampered/unknown wire
    return hexToBytes(entry.plaintextHex);
  }

  return { encryptNip44Wire, decryptNip44Wire, wires };
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

describe("wrapMediaAccessGrantRelease", () => {
  it("DENIED GRANT: never calls encryptNip44Wire when the grant is not allowed (e.g. no Order)", async () => {
    const encryptNip44Wire = vi.fn(async () => "should-not-be-called");
    const authority = merchantAuthority({ encryptNip44Wire });
    const result = await wrapMediaAccessGrantRelease({
      envelope: grantEnvelope(),
      media: MEDIA,
      actorPubkey: BUYER,
      order: null,
      now: NOW,
      merchantAccountIndex: MERCHANT_ACCOUNT_INDEX,
      releasePayload: new TextEncoder().encode("hello"),
      authority,
    });
    expect(result).toEqual({ outcome: "denied", reason: "order-not-found" });
    expect(encryptNip44Wire).not.toHaveBeenCalled();
  });

  it("REVOKED GRANT: denied, encryptNip44Wire never called", async () => {
    const encryptNip44Wire = vi.fn(async () => "should-not-be-called");
    const authority = merchantAuthority({ encryptNip44Wire });
    const order = buildPaidOrder();
    const result = await wrapMediaAccessGrantRelease({
      envelope: grantEnvelope({ revoked: true, grantVersion: 2 }),
      media: MEDIA,
      actorPubkey: BUYER,
      order,
      now: NOW,
      merchantAccountIndex: MERCHANT_ACCOUNT_INDEX,
      releasePayload: new TextEncoder().encode("hello"),
      authority,
    });
    expect(result).toEqual({ outcome: "denied", reason: "revoked" });
    expect(encryptNip44Wire).not.toHaveBeenCalled();
  });

  it("EMPTY / OVERSIZED PAYLOAD: rejected before any crypto call", async () => {
    const encryptNip44Wire = vi.fn(async () => "should-not-be-called");
    const authority = merchantAuthority({ encryptNip44Wire });
    const order = buildPaidOrder();
    const base = { envelope: grantEnvelope(), media: MEDIA, actorPubkey: BUYER, order, now: NOW, merchantAccountIndex: MERCHANT_ACCOUNT_INDEX, authority };

    const empty = await wrapMediaAccessGrantRelease({ ...base, releasePayload: new Uint8Array(0) });
    expect(empty).toEqual({ outcome: "payload-too-large" });

    const oversized = await wrapMediaAccessGrantRelease({
      ...base,
      releasePayload: new Uint8Array(MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES + 1),
    });
    expect(oversized).toEqual({ outcome: "payload-too-large" });
    expect(encryptNip44Wire).not.toHaveBeenCalled();
  });

  it("WRAP UNAVAILABLE: encryptNip44Wire absent -- resolves wrap-unavailable, mirrors UnavailableProductMediaEncryption's honest-default posture", async () => {
    const authority = merchantAuthority(); // no encryptNip44Wire at all
    const order = buildPaidOrder();
    const result = await wrapMediaAccessGrantRelease({
      envelope: grantEnvelope(),
      media: MEDIA,
      actorPubkey: BUYER,
      order,
      now: NOW,
      merchantAccountIndex: MERCHANT_ACCOUNT_INDEX,
      releasePayload: new TextEncoder().encode("hello"),
      authority,
    });
    expect(result).toEqual({ outcome: "wrap-unavailable" });
  });

  it("WRAP UNAVAILABLE: encryptNip44Wire resolves null -- resolves wrap-unavailable", async () => {
    const authority = merchantAuthority({ encryptNip44Wire: vi.fn(async () => null) });
    const order = buildPaidOrder();
    const result = await wrapMediaAccessGrantRelease({
      envelope: grantEnvelope(),
      media: MEDIA,
      actorPubkey: BUYER,
      order,
      now: NOW,
      merchantAccountIndex: MERCHANT_ACCOUNT_INDEX,
      releasePayload: new TextEncoder().encode("hello"),
      authority,
    });
    expect(result).toEqual({ outcome: "wrap-unavailable" });
  });

  it("WRAP UNAVAILABLE: encryptNip44Wire throws -- fails closed, never rejects", async () => {
    const authority = merchantAuthority({
      encryptNip44Wire: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const order = buildPaidOrder();
    await expect(
      wrapMediaAccessGrantRelease({
        envelope: grantEnvelope(),
        media: MEDIA,
        actorPubkey: BUYER,
        order,
        now: NOW,
        merchantAccountIndex: MERCHANT_ACCOUNT_INDEX,
        releasePayload: new TextEncoder().encode("hello"),
        authority,
      }),
    ).resolves.toEqual({ outcome: "wrap-unavailable" });
  });

  it("SUCCESS: calls encryptNip44Wire with (merchantAccountIndex, grant.buyerPubkey, releasePayload) exactly", async () => {
    const encryptNip44Wire = vi.fn(async () => "wire-abc");
    const authority = merchantAuthority({ encryptNip44Wire });
    const order = buildPaidOrder();
    const releasePayload = new TextEncoder().encode("purchased content bytes");
    const result = await wrapMediaAccessGrantRelease({
      envelope: grantEnvelope(),
      media: MEDIA,
      actorPubkey: BUYER,
      order,
      now: NOW,
      merchantAccountIndex: MERCHANT_ACCOUNT_INDEX,
      releasePayload,
      authority,
    });
    expect(result.outcome).toBe("released");
    if (result.outcome === "released") expect(result.wireCiphertext).toBe("wire-abc");
    expect(encryptNip44Wire).toHaveBeenCalledWith(MERCHANT_ACCOUNT_INDEX, BUYER, releasePayload);
  });
});

describe("wrapMediaAccessGrantRelease + unwrapMediaAccessGrantRelease: end-to-end over the fake NIP-44 network", () => {
  it("the grant-authorized buyer recovers the exact original release payload", async () => {
    const net = makeFakeNip44Network();
    const merchant = merchantAuthority({ encryptNip44Wire: vi.fn(async (a, b, p) => net.encryptNip44Wire(a, b, p)) });
    const buyer: FedosMasterSeedAuthority = {
      ...merchantAuthority(),
      decryptNip44Wire: vi.fn(async (a, b, w) => net.decryptNip44Wire(a, b, w)),
    };
    const order = buildPaidOrder();
    const releasePayload = new TextEncoder().encode("the purchased document's plaintext bytes");

    const wrapped = await wrapMediaAccessGrantRelease({
      envelope: grantEnvelope(),
      media: MEDIA,
      actorPubkey: BUYER,
      order,
      now: NOW,
      merchantAccountIndex: MERCHANT_ACCOUNT_INDEX,
      releasePayload,
      authority: merchant,
    });
    expect(wrapped.outcome).toBe("released");
    if (wrapped.outcome !== "released") throw new Error("unreachable");

    const recovered = await unwrapMediaAccessGrantRelease({
      buyerAccountIndex: BUYER_ACCOUNT_INDEX,
      merchantPubkeyHex: SELLER,
      wireCiphertext: wrapped.wireCiphertext,
      authority: buyer,
    });
    expect(recovered).not.toBeNull();
    expect(bytesToHex(recovered as Uint8Array)).toBe(bytesToHex(releasePayload));
  });

  it("TAMPERED CIPHERTEXT: an unknown/mutated wire string never decrypts", async () => {
    const buyer: FedosMasterSeedAuthority = {
      ...merchantAuthority(),
      decryptNip44Wire: vi.fn(async () => null), // a real decrypt_nip44_wire() would fail authentication this way
    };
    const recovered = await unwrapMediaAccessGrantRelease({
      buyerAccountIndex: BUYER_ACCOUNT_INDEX,
      merchantPubkeyHex: SELLER,
      wireCiphertext: "not-a-real-wire-string",
      authority: buyer,
    });
    expect(recovered).toBeNull();
  });

  it("UNWRAP UNAVAILABLE: decryptNip44Wire absent -- resolves null, never throws", async () => {
    const buyer = merchantAuthority(); // no decryptNip44Wire
    const recovered = await unwrapMediaAccessGrantRelease({
      buyerAccountIndex: BUYER_ACCOUNT_INDEX,
      merchantPubkeyHex: SELLER,
      wireCiphertext: "wire-abc",
      authority: buyer,
    });
    expect(recovered).toBeNull();
  });

  it("UNWRAP fails closed when decryptNip44Wire throws", async () => {
    const buyer: FedosMasterSeedAuthority = {
      ...merchantAuthority(),
      decryptNip44Wire: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    await expect(
      unwrapMediaAccessGrantRelease({
        buyerAccountIndex: BUYER_ACCOUNT_INDEX,
        merchantPubkeyHex: SELLER,
        wireCiphertext: "wire-abc",
        authority: buyer,
      }),
    ).resolves.toBeNull();
  });
});
