import { describe, it, expect } from "vitest";
import { PersonaEpochSigningKeypair } from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import { createOrder, applyOrderAction } from "../src/os/commerce/order/order_state_machine.js";
import type { Order } from "../src/os/commerce/order/order_types.js";
import { issueMediaAccessGrantsForOrder } from "../src/os/commerce/media_grant/media_access_grant_issuance.js";
import { evaluateMediaAccessGrant, isQualifyingOrderStatusForMediaAccess } from "../src/os/commerce/media_grant/media_access_grant_policy.js";
import { AppendOnlyMediaAccessGrantPersistence, latestGrantVersion } from "../src/os/commerce/media_grant/media_access_grant_persistence.js";
import { wrapMediaAccessGrantRelease, type WrapMediaAccessGrantReleaseInput } from "../src/os/commerce/media_grant/media_access_grant_key_release.js";
import { signMediaAccessGrant } from "../src/os/commerce/media_grant/media_access_grant_sign_verify.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) — a real, end-to-end BYPASS-REJECTION matrix at the exact
 * composition `fedos_electron_beta_main.cts`'s own
 * `issueCommerceMediaAccessGrantsNonFatal()`/`handleCommerceMediaGrantRedeem()`
 * perform: real Order state machine → real grant issuance orchestration →
 * real durable persistence → real grant evaluation. Every scenario below
 * mirrors one of the bypasses arc §37 explicitly names.
 */

const SELLER_KP = PersonaEpochSigningKeypair.generate();
const SELLER = SELLER_KP.publicKeyHex;
const BUYER = "b".repeat(64);
const OTHER_BUYER = "c".repeat(64);
const MEDIA = { id: "media-1", productId: "product-1" };
const NOW = 10_000;

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});
function freshPersistenceFile(): string {
  const d = mkdtempSync(join(tmpdir(), "fedos-media-grant-redeem-"));
  dir = d;
  return join(d, "media_access_grants.ndjson");
}

function buildOrder(overrides: { readonly orderId?: string; readonly buyerPubkey?: string } = {}): Order {
  const orderId = overrides.orderId ?? "order-1";
  const buyerPubkey = overrides.buyerPubkey ?? BUYER;
  const created = createOrder(
    { id: orderId, productId: MEDIA.productId, sellerPubkey: SELLER, unitPriceCents: 1000, currency: "USD" },
    { kind: "customer", pubkey: buyerPubkey },
    NOW - 400,
  );
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

describe("Media grant redeem bypass matrix — real Order + real persistence + real evaluateMediaAccessGrant", () => {
  it("PASS: a legitimate buyer, on a real paid Order, with a real issued+persisted grant, is ALLOWED", () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(freshPersistenceFile());

    const issued = issueMediaAccessGrantsForOrder({
      order,
      candidateMedia: [{ id: MEDIA.id, productId: MEDIA.productId, classification: "protected" }],
      sellerSigningKeypair: SELLER_KP,
      latestKnownGrantVersionFor: (mediaId) => latestGrantVersion(persistence.listGrants(), mediaId, order.buyerPubkey, order.id),
      now: NOW,
    });
    expect(issued.outcome).toBe("issued");
    if (issued.outcome !== "issued") throw new Error("unreachable");
    for (const envelope of issued.envelopes) persistence.putGrant(envelope);

    const allGrants = persistence.listGrants();
    const latest = latestGrantVersion(allGrants, MEDIA.id, order.buyerPubkey, order.id);
    const candidate = allGrants.find((e) => e.payload.grantVersion === latest)!;

    const decision = evaluateMediaAccessGrant({
      envelope: candidate,
      media: MEDIA,
      actorPubkey: order.buyerPubkey,
      order,
      now: NOW,
      latestKnownGrantVersion: latest,
    });
    expect(decision.allowed).toBe(true);
  });

  it("BYPASS 1 (Order creation alone, unpaid): an 'accepted'-but-not-paid Order never qualifies for grant issuance", () => {
    const order = toAccepted(buildOrder());
    expect(isQualifyingOrderStatusForMediaAccess(order.status)).toBe(false);

    const issued = issueMediaAccessGrantsForOrder({
      order,
      candidateMedia: [{ id: MEDIA.id, productId: MEDIA.productId, classification: "protected" }],
      sellerSigningKeypair: SELLER_KP,
      latestKnownGrantVersionFor: () => 0,
      now: NOW,
    });
    expect(issued).toEqual({ outcome: "order-not-qualifying" });
  });

  it("BYPASS 2 (wrong buyer): a real grant for buyer A is DENIED when actor B tries to redeem it", () => {
    const order = toPaid(buildOrder({ buyerPubkey: BUYER }));
    const persistence = new AppendOnlyMediaAccessGrantPersistence(freshPersistenceFile());
    const issued = issueMediaAccessGrantsForOrder({
      order,
      candidateMedia: [{ id: MEDIA.id, productId: MEDIA.productId, classification: "protected" }],
      sellerSigningKeypair: SELLER_KP,
      latestKnownGrantVersionFor: () => 0,
      now: NOW,
    });
    if (issued.outcome !== "issued") throw new Error("unreachable");
    for (const envelope of issued.envelopes) persistence.putGrant(envelope);
    const candidate = persistence.listGrants()[0]!;

    const decision = evaluateMediaAccessGrant({
      envelope: candidate,
      media: MEDIA,
      actorPubkey: OTHER_BUYER, // NOT the real buyer
      order,
      now: NOW,
      latestKnownGrantVersion: 1,
    });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("unreachable");
    expect(decision.reason).toBe("buyer-mismatch");
  });

  it("BYPASS 3 (no grant on file / bare Product-Detail-access alone): redeeming with NO persisted grant at all is DENIED — MALFORMED_ENVELOPE, never a fabricated allow", () => {
    const order = toPaid(buildOrder());
    const decision = evaluateMediaAccessGrant({
      envelope: undefined, // exactly "no grant on file" -- no candidate envelope exists
      media: MEDIA,
      actorPubkey: order.buyerPubkey,
      order,
      now: NOW,
      latestKnownGrantVersion: 0,
    });
    expect(decision.allowed).toBe(false);
  });

  it("BYPASS 4 (revoked grant): a merchant-revoked grant version is DENIED even though it is validly signed", () => {
    const order = toPaid(buildOrder());
    const persistence = new AppendOnlyMediaAccessGrantPersistence(freshPersistenceFile());
    const issued = issueMediaAccessGrantsForOrder({
      order,
      candidateMedia: [{ id: MEDIA.id, productId: MEDIA.productId, classification: "protected" }],
      sellerSigningKeypair: SELLER_KP,
      latestKnownGrantVersionFor: () => 0,
      now: NOW,
    });
    if (issued.outcome !== "issued") throw new Error("unreachable");
    for (const envelope of issued.envelopes) persistence.putGrant(envelope);

    // Merchant issues a REVOKING v2 for the same triple.
    const v1 = persistence.listGrants()[0]!;
    const revokedPayload = { ...v1.payload, grantVersion: 2, revoked: true, issuedAt: NOW + 1 };
    const v2 = signMediaAccessGrant(revokedPayload, SELLER_KP, { issuer: SELLER, issuedAt: NOW + 1 });
    persistence.putGrant(v2);

    const allGrants = persistence.listGrants();
    const latest = latestGrantVersion(allGrants, MEDIA.id, order.buyerPubkey, order.id);
    expect(latest).toBe(2);
    const candidate = allGrants.find((e) => e.payload.grantVersion === latest)!;

    const decision = evaluateMediaAccessGrant({
      envelope: candidate,
      media: MEDIA,
      actorPubkey: order.buyerPubkey,
      order,
      now: NOW + 2,
      latestKnownGrantVersion: latest,
    });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) throw new Error("unreachable");
    expect(decision.reason).toBe("revoked");

    // Replaying the OLD, still-validly-signed v1 is also rejected — superseded.
    const staleDecision = evaluateMediaAccessGrant({
      envelope: v1,
      media: MEDIA,
      actorPubkey: order.buyerPubkey,
      order,
      now: NOW + 2,
      latestKnownGrantVersion: latest,
    });
    expect(staleDecision.allowed).toBe(false);
    if (staleDecision.allowed) throw new Error("unreachable");
    expect(staleDecision.reason).toBe("superseded");
  });

  it("BYPASS 5 (Master-Seed-only shortcut): a real grant denial refuses BEFORE any wrap/decrypt call is ever reached — wrapMediaAccessGrantRelease() never calls its authority when denied", async () => {
    const order = toAccepted(buildOrder()); // never paid -> never qualifies
    let authorityCalled = false;
    const fakeAuthority = {
      encryptNip44Wire: async () => {
        authorityCalled = true;
        return "should-never-be-called";
      },
    };
    const result = await wrapMediaAccessGrantRelease({
      envelope: undefined,
      media: MEDIA,
      actorPubkey: order.buyerPubkey,
      order,
      now: NOW,
      merchantAccountIndex: 0,
      releasePayload: new Uint8Array([1, 2, 3]),
      authority: fakeAuthority as unknown as WrapMediaAccessGrantReleaseInput["authority"],
    });
    expect(result.outcome).toBe("denied");
    expect(authorityCalled).toBe(false);
  });
});
