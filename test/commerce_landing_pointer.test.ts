import { describe, it, expect } from "vitest";
import { buildCommerceLandingPointer } from "../src/os/commerce/order/landing_pointer.js";
import type { CommerceBuyerActivitySummary, CommerceSellerActivitySummary } from "../src/os/commerce/order/activity_summary.js";

/**
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) — proves the
 * "where is my order?" landing pointer is bounded (one bucketed line, not
 * a feed) and never fabricates a claim from missing/all-zero data.
 */

const ZERO_BUYER: CommerceBuyerActivitySummary = {
  draft: 0,
  awaitingSellerAcceptance: 0,
  readyToPay: 0,
  inFulfillment: 0,
  readyToAcknowledge: 0,
  readyToComplete: 0,
  readyReceipts: 0,
};

const ZERO_SELLER: CommerceSellerActivitySummary = {
  newSubmitted: 0,
  unpaid: 0,
  paidReadyToFulfill: 0,
  fulfillingInProgress: 0,
  completedAwaitingReceipt: 0,
};

describe("buildCommerceLandingPointer", () => {
  it("both undefined -> null text (never a fabricated 'all clear')", () => {
    expect(buildCommerceLandingPointer(undefined, undefined)).toEqual({ text: null });
  });

  it("both all-zero -> null text (nothing to point at)", () => {
    expect(buildCommerceLandingPointer(ZERO_BUYER, ZERO_SELLER)).toEqual({ text: null });
  });

  it("buyer has a ready-to-pay order -> a Shop line naming it", () => {
    const result = buildCommerceLandingPointer({ ...ZERO_BUYER, readyToPay: 2 }, ZERO_SELLER);
    expect(result.text).not.toBeNull();
    expect(result.text).toMatch(/Shop:/);
    expect(result.text).toMatch(/2 orders ready to pay/);
  });

  it("singular vs. plural noun agreement", () => {
    const one = buildCommerceLandingPointer({ ...ZERO_BUYER, readyToPay: 1 }, ZERO_SELLER);
    expect(one.text).toMatch(/1 order ready to pay/);
    expect(one.text).not.toMatch(/1 orders/);
  });

  it("seller has new submitted + unpaid orders -> a My Store line naming both", () => {
    const result = buildCommerceLandingPointer(ZERO_BUYER, { ...ZERO_SELLER, newSubmitted: 3, unpaid: 1 });
    expect(result.text).toMatch(/My Store:/);
    expect(result.text).toMatch(/3 new orders/);
    expect(result.text).toMatch(/1 order awaiting buyer payment/);
  });

  it("both roles have outstanding items -> both lines present, space-joined, still one bounded string", () => {
    const result = buildCommerceLandingPointer(
      { ...ZERO_BUYER, readyToComplete: 1 },
      { ...ZERO_SELLER, paidReadyToFulfill: 2 },
    );
    expect(result.text).toMatch(/Shop:/);
    expect(result.text).toMatch(/My Store:/);
  });

  it("a role present but genuinely all-zero contributes no line even when the other role has activity", () => {
    const result = buildCommerceLandingPointer(ZERO_BUYER, { ...ZERO_SELLER, newSubmitted: 1 });
    expect(result.text).not.toMatch(/Shop:/);
    expect(result.text).toMatch(/My Store:/);
  });

  it("a missing (undefined) role never fabricates a line for it, even if the other role has activity", () => {
    const result = buildCommerceLandingPointer(undefined, { ...ZERO_SELLER, newSubmitted: 1 });
    expect(result.text).not.toMatch(/Shop:/);
    expect(result.text).toMatch(/My Store:/);
  });

  it("buyer 'awaitingSellerAcceptance' only surfaces when nothing else buyer-side needs attention (deliberately the lowest-priority buyer line)", () => {
    const withOther = buildCommerceLandingPointer({ ...ZERO_BUYER, awaitingSellerAcceptance: 5, readyToPay: 1 }, ZERO_SELLER);
    expect(withOther.text).not.toMatch(/awaiting seller acceptance/);
    const onlyAwaiting = buildCommerceLandingPointer({ ...ZERO_BUYER, awaitingSellerAcceptance: 5 }, ZERO_SELLER);
    expect(onlyAwaiting.text).toMatch(/5 orders awaiting seller acceptance/);
  });
});
