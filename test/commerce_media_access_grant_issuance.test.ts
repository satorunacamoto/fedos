import { describe, it, expect } from "vitest";
import { PersonaEpochSigningKeypair } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import { verifyMediaAccessGrantEnvelope } from "../src/os/commerce/media_grant/media_access_grant_sign_verify.js";
import {
  issueMediaAccessGrantsForOrder,
  type IssueMediaAccessGrantsForOrderOrderLike,
  type IssueMediaAccessGrantsForOrderMediaLike,
} from "../src/os/commerce/media_grant/media_access_grant_issuance.js";

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) — targeted tests for `issueMediaAccessGrantsForOrder()`, the
 * merchant-side production caller for the previously-unwired
 * `MediaAccessGrant` system (arc §35-37 / friction-ledger row #15).
 *
 * Covers every gate the function's own header promises, including the
 * "seller-not-grant-capable" limitation this arc discloses rather than
 * bypasses — proven directly (a keypair minted for a claimed pubkey that
 * differs from `order.sellerPubkey` is correctly refused).
 */

const BUYER = "b".repeat(64);
const NOW = 1_000;

function order(overrides: Partial<IssueMediaAccessGrantsForOrderOrderLike> = {}): IssueMediaAccessGrantsForOrderOrderLike {
  return {
    id: "order-1",
    productId: "product-1",
    buyerPubkey: BUYER,
    sellerPubkey: "seller-not-set",
    status: "paid",
    ...overrides,
  };
}

function media(overrides: Partial<IssueMediaAccessGrantsForOrderMediaLike> = {}): IssueMediaAccessGrantsForOrderMediaLike {
  return { id: "media-1", productId: "product-1", classification: "protected", ...overrides };
}

describe("issueMediaAccessGrantsForOrder — happy path, a REAL keypair-backed seller", () => {
  it("issues one validly-signed grant per protected media item, addressed to the buyer, at grantVersion 1", () => {
    const sellerKp = PersonaEpochSigningKeypair.generate();
    const theOrder = order({ sellerPubkey: sellerKp.publicKeyHex });

    const outcome = issueMediaAccessGrantsForOrder({
      order: theOrder,
      candidateMedia: [media()],
      sellerSigningKeypair: sellerKp,
      latestKnownGrantVersionFor: () => 0,
      now: NOW,
    });

    expect(outcome.outcome).toBe("issued");
    if (outcome.outcome !== "issued") throw new Error("unreachable");
    expect(outcome.envelopes).toHaveLength(1);
    const envelope = outcome.envelopes[0]!;
    expect(envelope.payload.buyerPubkey).toBe(BUYER);
    expect(envelope.payload.orderId).toBe("order-1");
    expect(envelope.payload.mediaId).toBe("media-1");
    expect(envelope.payload.grantVersion).toBe(1);
    expect(envelope.payload.revoked).toBe(false);

    const verified = verifyMediaAccessGrantEnvelope(envelope);
    expect(verified.status).toBe("VALID");
  });

  it("increments grantVersion from the caller-supplied latestKnownGrantVersionFor", () => {
    const sellerKp = PersonaEpochSigningKeypair.generate();
    const theOrder = order({ sellerPubkey: sellerKp.publicKeyHex });

    const outcome = issueMediaAccessGrantsForOrder({
      order: theOrder,
      candidateMedia: [media()],
      sellerSigningKeypair: sellerKp,
      latestKnownGrantVersionFor: () => 3,
      now: NOW,
    });

    expect(outcome.outcome).toBe("issued");
    if (outcome.outcome !== "issued") throw new Error("unreachable");
    expect(outcome.envelopes[0]!.payload.grantVersion).toBe(4);
  });

  it("only grants PROTECTED media, silently skipping PUBLIC media for the same product", () => {
    const sellerKp = PersonaEpochSigningKeypair.generate();
    const theOrder = order({ sellerPubkey: sellerKp.publicKeyHex });

    const outcome = issueMediaAccessGrantsForOrder({
      order: theOrder,
      candidateMedia: [media({ id: "protected-1" }), media({ id: "public-1", classification: "public" })],
      sellerSigningKeypair: sellerKp,
      latestKnownGrantVersionFor: () => 0,
      now: NOW,
    });

    expect(outcome.outcome).toBe("issued");
    if (outcome.outcome !== "issued") throw new Error("unreachable");
    expect(outcome.envelopes).toHaveLength(1);
    expect(outcome.envelopes[0]!.payload.mediaId).toBe("protected-1");
  });
});

describe("issueMediaAccessGrantsForOrder — refuses to issue early / for the wrong product / with no protected media", () => {
  it("'no-protected-media' when every candidate is classified public, or belongs to a different product", () => {
    const sellerKp = PersonaEpochSigningKeypair.generate();
    const theOrder = order({ sellerPubkey: sellerKp.publicKeyHex });

    const outcome = issueMediaAccessGrantsForOrder({
      order: theOrder,
      candidateMedia: [media({ classification: "public" }), media({ productId: "other-product" })],
      sellerSigningKeypair: sellerKp,
      latestKnownGrantVersionFor: () => 0,
      now: NOW,
    });
    expect(outcome).toEqual({ outcome: "no-protected-media" });
  });

  it("'order-not-qualifying' for every non-qualifying status (created/submitted/accepted/rejected/cancelled), never issues early", () => {
    const sellerKp = PersonaEpochSigningKeypair.generate();
    for (const status of ["created", "submitted", "accepted", "rejected", "cancelled"]) {
      const outcome = issueMediaAccessGrantsForOrder({
        order: order({ sellerPubkey: sellerKp.publicKeyHex, status }),
        candidateMedia: [media()],
        sellerSigningKeypair: sellerKp,
        latestKnownGrantVersionFor: () => 0,
        now: NOW,
      });
      expect(outcome).toEqual({ outcome: "order-not-qualifying" });
    }
  });

  it("issues for every qualifying status (paid/fulfilling/delivered/completed)", () => {
    const sellerKp = PersonaEpochSigningKeypair.generate();
    for (const status of ["paid", "fulfilling", "delivered", "completed"]) {
      const outcome = issueMediaAccessGrantsForOrder({
        order: order({ sellerPubkey: sellerKp.publicKeyHex, status }),
        candidateMedia: [media()],
        sellerSigningKeypair: sellerKp,
        latestKnownGrantVersionFor: () => 0,
        now: NOW,
      });
      expect(outcome.outcome).toBe("issued");
    }
  });
});

describe("issueMediaAccessGrantsForOrder — the ONE bypass this arc's own brief names: seller-not-grant-capable", () => {
  it("refuses to issue when the resolved signing keypair's public key does NOT equal order.sellerPubkey — a claimed/self-issued identity is never sufficient", () => {
    const sellerKp = PersonaEpochSigningKeypair.generate();
    const unrelatedKp = PersonaEpochSigningKeypair.generate();
    // The Order's REAL sellerPubkey is `sellerKp`'s — but the only signing
    // keypair this caller could resolve is `unrelatedKp` (e.g. a fixed,
    // non-cryptographic demo actor pubkey with no real matching private
    // key anywhere in the system — see this arc's own final report).
    const theOrder = order({ sellerPubkey: sellerKp.publicKeyHex });

    const outcome = issueMediaAccessGrantsForOrder({
      order: theOrder,
      candidateMedia: [media()],
      sellerSigningKeypair: unrelatedKp,
      latestKnownGrantVersionFor: () => 0,
      now: NOW,
    });

    expect(outcome).toEqual({ outcome: "seller-not-grant-capable" });
  });

  it("a bare, non-cryptographic claimed pubkey (e.g. this app's fixed demo actor constants) can never satisfy the gate, by construction", () => {
    // Mirrors the shipped Commerce demo's own actor model exactly:
    // `order.sellerPubkey` is a fixed, repeated-hex-character constant with
    // no corresponding real private key anywhere in this system.
    const demoSellerPubkey = "a".repeat(64);
    const mintedForClaim = PersonaEpochSigningKeypair.generate(); // what a real, honest resolver mints
    const theOrder = order({ sellerPubkey: demoSellerPubkey });

    const outcome = issueMediaAccessGrantsForOrder({
      order: theOrder,
      candidateMedia: [media()],
      sellerSigningKeypair: mintedForClaim,
      latestKnownGrantVersionFor: () => 0,
      now: NOW,
    });

    expect(outcome).toEqual({ outcome: "seller-not-grant-capable" });
  });
});
