import { describe, it, expect } from "vitest";
import {
  bucketVerifiedTradeCount,
  isPersonaBoardDisclosureLayer,
  projectPersonaRecordToDisclosureLayer,
  type PersonaBoardAuthorizedView,
  type PersonaBoardInternalRecord,
  type PersonaBoardPublicView,
} from "../src/os/commerce/reputation/disclosure_layers.js";

const EPOCH_ID = "1".repeat(32);
const EPOCH_KEY = "a".repeat(64);

function fullRecord(overrides: Partial<PersonaBoardInternalRecord> = {}): PersonaBoardInternalRecord {
  return {
    epochId: EPOCH_ID,
    epochKeyPublicHex: EPOCH_KEY,
    verifiedTradeCount: 27,
    categoryBreakdown: { digital_good: 20, service: 7 },
    attestationRefs: ["ref-1", "ref-2", "ref-3"],
    asOf: 9_999,
    ...overrides,
  };
}

describe("commerce reputation: bucketVerifiedTradeCount", () => {
  it("buckets known boundary values correctly", () => {
    expect(bucketVerifiedTradeCount(0)).toBe("0");
    expect(bucketVerifiedTradeCount(1)).toBe("1-4");
    expect(bucketVerifiedTradeCount(4)).toBe("1-4");
    expect(bucketVerifiedTradeCount(5)).toBe("5-19");
    expect(bucketVerifiedTradeCount(19)).toBe("5-19");
    expect(bucketVerifiedTradeCount(20)).toBe("20-49");
    expect(bucketVerifiedTradeCount(49)).toBe("20-49");
    expect(bucketVerifiedTradeCount(50)).toBe("50+");
    expect(bucketVerifiedTradeCount(10_000)).toBe("50+");
  });

  it("fails closed to the widest bucket on malformed input, never throws", () => {
    expect(bucketVerifiedTradeCount(-1)).toBe("50+");
    expect(bucketVerifiedTradeCount(1.5)).toBe("50+");
    expect(bucketVerifiedTradeCount(Number.NaN)).toBe("50+");
    expect(bucketVerifiedTradeCount("27" as unknown as number)).toBe("50+");
  });
});

describe("commerce reputation: isPersonaBoardDisclosureLayer", () => {
  it("accepts the three known layers", () => {
    expect(isPersonaBoardDisclosureLayer("PUBLIC")).toBe(true);
    expect(isPersonaBoardDisclosureLayer("PSEUDONYMOUS_PROOF")).toBe(true);
    expect(isPersonaBoardDisclosureLayer("AUTHORIZED")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isPersonaBoardDisclosureLayer("PRIVATE")).toBe(false);
    expect(isPersonaBoardDisclosureLayer("")).toBe(false);
    expect(isPersonaBoardDisclosureLayer(undefined)).toBe(false);
  });
});

describe("commerce reputation: projectPersonaRecordToDisclosureLayer", () => {
  it("PUBLIC view exposes only the allowlisted, coarse fields", () => {
    const view = projectPersonaRecordToDisclosureLayer(fullRecord(), "PUBLIC") as PersonaBoardPublicView;
    expect(view.layer).toBe("PUBLIC");
    expect(view.epochId).toBe(EPOCH_ID);
    expect(view.verifiedTradeCountBucket).toBe("20-49");
    expect(view.primaryCategory).toBe("digital_good");
    expect(view.attestationRefs).toEqual(["ref-1", "ref-2", "ref-3"]);

    // Hard exclusion: no exact count, no full category breakdown, no epoch key.
    expect(view).not.toHaveProperty("verifiedTradeCount");
    expect(view).not.toHaveProperty("categoryBreakdown");
    expect(view).not.toHaveProperty("epochKeyPublicHex");
  });

  it("PSEUDONYMOUS_PROOF view is identical in field set to PUBLIC (by design, see file header)", () => {
    const record = fullRecord();
    const publicView = projectPersonaRecordToDisclosureLayer(record, "PUBLIC");
    const proofView = projectPersonaRecordToDisclosureLayer(record, "PSEUDONYMOUS_PROOF");
    expect(Object.keys(proofView).sort()).toEqual(
      ["layer", ...Object.keys(publicView).filter((k) => k !== "layer")].sort(),
    );
    expect((proofView as PersonaBoardPublicView).verifiedTradeCountBucket).toBe(
      (publicView as PersonaBoardPublicView).verifiedTradeCountBucket,
    );
  });

  it("AUTHORIZED view exposes exact figures and the full category breakdown", () => {
    const view = projectPersonaRecordToDisclosureLayer(fullRecord(), "AUTHORIZED") as PersonaBoardAuthorizedView;
    expect(view.layer).toBe("AUTHORIZED");
    expect(view.verifiedTradeCount).toBe(27);
    expect(view.categoryBreakdown).toEqual({ digital_good: 20, service: 7 });
    expect(view.epochKeyPublicHex).toBe(EPOCH_KEY);
    expect(view.attestationRefs).toEqual(["ref-1", "ref-2", "ref-3"]);
  });

  it("AUTHORIZED view still carries no real-identity/order/payment field (hard exclusion applies to every layer)", () => {
    const view = projectPersonaRecordToDisclosureLayer(fullRecord(), "AUTHORIZED");
    for (const forbidden of ["realName", "address", "email", "phone", "orderId", "paymentMetadata", "exactPriceCents"]) {
      expect(view).not.toHaveProperty(forbidden);
    }
  });

  it("primaryCategory is omitted when categoryBreakdown is empty", () => {
    const view = projectPersonaRecordToDisclosureLayer(
      fullRecord({ categoryBreakdown: {} }),
      "PUBLIC",
    ) as PersonaBoardPublicView;
    expect(view.primaryCategory).toBeUndefined();
  });

  it("primaryCategory picks the highest-count category, ignoring zero-count entries", () => {
    const view = projectPersonaRecordToDisclosureLayer(
      fullRecord({ categoryBreakdown: { digital_good: 0, service: 5, physical_good: 2 } }),
      "PUBLIC",
    ) as PersonaBoardPublicView;
    expect(view.primaryCategory).toBe("service");
  });

  it("throws on a malformed record (internal-caller contract, not a public boundary parser)", () => {
    expect(() =>
      projectPersonaRecordToDisclosureLayer(fullRecord({ epochId: "" }), "PUBLIC"),
    ).toThrow(RangeError);
    expect(() =>
      projectPersonaRecordToDisclosureLayer(fullRecord({ epochKeyPublicHex: "bad" }), "PUBLIC"),
    ).toThrow(RangeError);
  });

  it("throws on an unrecognized layer", () => {
    expect(() =>
      projectPersonaRecordToDisclosureLayer(fullRecord(), "PRIVATE" as never),
    ).toThrow(RangeError);
  });
});
