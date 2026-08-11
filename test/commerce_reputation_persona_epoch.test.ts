import { describe, it, expect } from "vitest";
import {
  isPersonaEpochCurrentlyValid,
  isWellFormedPersonaEpoch,
  isWellFormedPersonaEpochId,
  isWellFormedPersonaEpochKeyPublicHex,
  PERSONA_EPOCH_DEFAULT_CLOCK_SKEW_TOLERANCE_SECONDS,
  type PersonaEpoch,
} from "../src/os/commerce/reputation/persona_epoch.js";
import {
  isWellFormedReputationAttestationPayload,
  isWellFormedTradeCompletionAttestationPayload,
  type ReputationAttestationPayload,
  type TradeCompletionAttestationPayload,
} from "../src/os/commerce/reputation/attestation_types.js";
import {
  isWellFormedCommerceTrustIssuanceRequest,
  NoopCommerceTrustIssuancePort,
  type CommerceTrustIssuanceRequest,
} from "../src/os/commerce/reputation/trust_issuance_port.js";
import {
  buildEpochCarryOverStatementPayload,
  isWellFormedEpochCarryOverStatementPayload,
  EPOCH_CARRY_OVER_LINKABILITY_WARNING,
} from "../src/os/commerce/reputation/carry_over.js";

const HEX_A = "a".repeat(64);
const HEX_B = "b".repeat(64);
const HEX_C = "c".repeat(64);
const EPOCH_ID_1 = "1".repeat(32);
const EPOCH_ID_2 = "2".repeat(32);

function validEpoch(overrides: Partial<PersonaEpoch> = {}): PersonaEpoch {
  return {
    epochId: EPOCH_ID_1,
    epochKeyPublicHex: HEX_A,
    validFrom: 1_000,
    validUntil: 2_000,
    ...overrides,
  };
}

describe("commerce reputation: PersonaEpoch", () => {
  it("well-formed hex/id checkers accept valid values", () => {
    expect(isWellFormedPersonaEpochKeyPublicHex(HEX_A)).toBe(true);
    expect(isWellFormedPersonaEpochId(EPOCH_ID_1)).toBe(true);
  });

  it("well-formed hex/id checkers reject malformed values", () => {
    expect(isWellFormedPersonaEpochKeyPublicHex("not-hex")).toBe(false);
    expect(isWellFormedPersonaEpochKeyPublicHex(HEX_A.slice(0, 63))).toBe(false);
    expect(isWellFormedPersonaEpochKeyPublicHex(123)).toBe(false);
    expect(isWellFormedPersonaEpochId("")).toBe(false);
    expect(isWellFormedPersonaEpochId("zz")).toBe(false);
  });

  it("isWellFormedPersonaEpoch accepts a valid epoch", () => {
    expect(isWellFormedPersonaEpoch(validEpoch())).toBe(true);
  });

  it("isWellFormedPersonaEpoch accepts an optional predecessorEpochId", () => {
    expect(isWellFormedPersonaEpoch(validEpoch({ predecessorEpochId: EPOCH_ID_2 }))).toBe(true);
  });

  it("isWellFormedPersonaEpoch rejects non-object / null", () => {
    expect(isWellFormedPersonaEpoch(null)).toBe(false);
    expect(isWellFormedPersonaEpoch("epoch")).toBe(false);
    expect(isWellFormedPersonaEpoch(undefined)).toBe(false);
  });

  it("isWellFormedPersonaEpoch rejects validUntil <= validFrom", () => {
    expect(isWellFormedPersonaEpoch(validEpoch({ validFrom: 2_000, validUntil: 2_000 }))).toBe(false);
    expect(isWellFormedPersonaEpoch(validEpoch({ validFrom: 2_000, validUntil: 1_000 }))).toBe(false);
  });

  it("isWellFormedPersonaEpoch rejects a malformed key or id", () => {
    expect(isWellFormedPersonaEpoch(validEpoch({ epochKeyPublicHex: "bad" }))).toBe(false);
    expect(isWellFormedPersonaEpoch(validEpoch({ epochId: "" }))).toBe(false);
    expect(isWellFormedPersonaEpoch(validEpoch({ predecessorEpochId: "bad" }))).toBe(false);
  });

  it("isPersonaEpochCurrentlyValid: true strictly inside the window", () => {
    expect(isPersonaEpochCurrentlyValid(validEpoch(), 1_500)).toBe(true);
  });

  it("isPersonaEpochCurrentlyValid: false well before/after the window even with default tolerance", () => {
    expect(isPersonaEpochCurrentlyValid(validEpoch(), 100)).toBe(false);
    expect(isPersonaEpochCurrentlyValid(validEpoch(), 10_000)).toBe(false);
  });

  it("isPersonaEpochCurrentlyValid: default clock-skew tolerance applies at the edges", () => {
    const epoch = validEpoch();
    const justBefore = epoch.validFrom - PERSONA_EPOCH_DEFAULT_CLOCK_SKEW_TOLERANCE_SECONDS;
    const justAfter = epoch.validUntil + PERSONA_EPOCH_DEFAULT_CLOCK_SKEW_TOLERANCE_SECONDS;
    expect(isPersonaEpochCurrentlyValid(epoch, justBefore)).toBe(true);
    expect(isPersonaEpochCurrentlyValid(epoch, justAfter)).toBe(true);
    expect(isPersonaEpochCurrentlyValid(epoch, justBefore - 1)).toBe(false);
    expect(isPersonaEpochCurrentlyValid(epoch, justAfter + 1)).toBe(false);
  });

  it("isPersonaEpochCurrentlyValid: a caller-supplied tolerance of 0 is honored exactly", () => {
    const epoch = validEpoch();
    expect(isPersonaEpochCurrentlyValid(epoch, epoch.validFrom, 0)).toBe(true);
    expect(isPersonaEpochCurrentlyValid(epoch, epoch.validFrom - 1, 0)).toBe(false);
  });

  it("isPersonaEpochCurrentlyValid: fails closed on a malformed epoch or malformed inputs", () => {
    expect(isPersonaEpochCurrentlyValid({}, 1_500)).toBe(false);
    expect(isPersonaEpochCurrentlyValid(validEpoch(), Number.NaN)).toBe(false);
    expect(isPersonaEpochCurrentlyValid(validEpoch(), 1_500, -1)).toBe(false);
  });
});

function validTradeCompletionPayload(
  overrides: Partial<TradeCompletionAttestationPayload> = {},
): TradeCompletionAttestationPayload {
  return {
    attestorEpochKeyPublicHex: HEX_A,
    subjectEpochId: EPOCH_ID_1,
    tradeRefDigestHex: HEX_B,
    category: "digital_good",
    outcome: "completed_as_agreed",
    completedAt: 1_000,
    formatVersion: 1,
    ...overrides,
  };
}

describe("commerce reputation: TradeCompletionAttestationPayload", () => {
  it("accepts a well-formed payload", () => {
    expect(isWellFormedTradeCompletionAttestationPayload(validTradeCompletionPayload())).toBe(true);
  });

  it("rejects a payload missing a required field", () => {
    const { category: _category, ...rest } = validTradeCompletionPayload();
    expect(isWellFormedTradeCompletionAttestationPayload(rest)).toBe(false);
  });

  it("rejects an unrecognized category or outcome", () => {
    expect(isWellFormedTradeCompletionAttestationPayload(validTradeCompletionPayload({ category: "bogus" as never }))).toBe(false);
    expect(isWellFormedTradeCompletionAttestationPayload(validTradeCompletionPayload({ outcome: "bogus" as never }))).toBe(false);
  });

  it("rejects a payload with a raw order id / unexpected extra field (allowlist enforcement)", () => {
    const withExtra = { ...validTradeCompletionPayload(), rawOrderId: "order-123" };
    expect(isWellFormedTradeCompletionAttestationPayload(withExtra)).toBe(false);
  });

  it("rejects a comment/free-text field even if someone tries to add one", () => {
    const withComment = { ...validTradeCompletionPayload(), comment: "great trade!" };
    expect(isWellFormedTradeCompletionAttestationPayload(withComment)).toBe(false);
  });

  it("rejects a malformed tradeRefDigestHex", () => {
    expect(isWellFormedTradeCompletionAttestationPayload(validTradeCompletionPayload({ tradeRefDigestHex: "short" }))).toBe(false);
  });
});

function validReputationAttestationPayload(
  overrides: Partial<ReputationAttestationPayload> = {},
): ReputationAttestationPayload {
  return {
    subjectEpochId: EPOCH_ID_1,
    subjectEpochKeyPublicHex: HEX_A,
    verifiedTradeCount: 12,
    attestationRefs: ["ref-1", "ref-2"],
    asOf: 5_000,
    formatVersion: 1,
    ...overrides,
  };
}

describe("commerce reputation: ReputationAttestationPayload", () => {
  it("accepts a well-formed payload", () => {
    expect(isWellFormedReputationAttestationPayload(validReputationAttestationPayload())).toBe(true);
  });

  it("accepts an empty attestationRefs list", () => {
    expect(isWellFormedReputationAttestationPayload(validReputationAttestationPayload({ attestationRefs: [] }))).toBe(true);
  });

  it("rejects a negative or non-integer verifiedTradeCount", () => {
    expect(isWellFormedReputationAttestationPayload(validReputationAttestationPayload({ verifiedTradeCount: -1 }))).toBe(false);
    expect(isWellFormedReputationAttestationPayload(validReputationAttestationPayload({ verifiedTradeCount: 1.5 }))).toBe(false);
  });

  it("rejects an unexpected extra field", () => {
    const withExtra = { ...validReputationAttestationPayload(), exactPriceCents: 500 };
    expect(isWellFormedReputationAttestationPayload(withExtra)).toBe(false);
  });

  it("rejects a non-string entry in attestationRefs", () => {
    expect(
      isWellFormedReputationAttestationPayload(
        validReputationAttestationPayload({ attestationRefs: ["ref-1", 2 as unknown as string] }),
      ),
    ).toBe(false);
  });
});

function validIssuanceRequest(overrides: Partial<CommerceTrustIssuanceRequest> = {}): CommerceTrustIssuanceRequest {
  return {
    subjectPersonaEpochKeyPublicHex: HEX_A,
    tradeRefDigestHex: HEX_B,
    requestedScopes: ["signed-qr"],
    validFrom: 1_000,
    validUntil: 2_000,
    ...overrides,
  };
}

describe("commerce reputation: CommerceTrustIssuancePort (design scaffolding)", () => {
  it("isWellFormedCommerceTrustIssuanceRequest accepts a valid request", () => {
    expect(isWellFormedCommerceTrustIssuanceRequest(validIssuanceRequest())).toBe(true);
  });

  it("isWellFormedCommerceTrustIssuanceRequest rejects an empty requestedScopes list", () => {
    expect(isWellFormedCommerceTrustIssuanceRequest(validIssuanceRequest({ requestedScopes: [] }))).toBe(false);
  });

  it("isWellFormedCommerceTrustIssuanceRequest rejects an unrecognized scope", () => {
    expect(
      isWellFormedCommerceTrustIssuanceRequest(validIssuanceRequest({ requestedScopes: ["bogus-scope" as never] })),
    ).toBe(false);
  });

  it("isWellFormedCommerceTrustIssuanceRequest rejects validUntil <= validFrom", () => {
    expect(isWellFormedCommerceTrustIssuanceRequest(validIssuanceRequest({ validFrom: 2_000, validUntil: 1_000 }))).toBe(false);
  });

  it("NoopCommerceTrustIssuancePort never issues anything", async () => {
    const port = new NoopCommerceTrustIssuancePort();
    const result = await port.requestTradeCompletionIssuance(validIssuanceRequest());
    expect(result.outcome).toBe("unavailable");
    expect(result.envelope).toBeUndefined();
    expect(result.qrText).toBeUndefined();
  });
});

describe("commerce reputation: epoch carry-over (design only, bounded/linkable)", () => {
  it("builds a well-formed carry-over statement without a threshold claim", () => {
    const payload = buildEpochCarryOverStatementPayload(EPOCH_ID_1, HEX_A, EPOCH_ID_2, HEX_B, 1_000);
    expect(isWellFormedEpochCarryOverStatementPayload(payload)).toBe(true);
    expect(payload.thresholdClaim).toBeUndefined();
  });

  it("builds a well-formed carry-over statement with a bounded threshold claim", () => {
    const payload = buildEpochCarryOverStatementPayload(EPOCH_ID_1, HEX_A, EPOCH_ID_2, HEX_B, 1_000, {
      verifiedTradeCountAtLeast: 25,
    });
    expect(isWellFormedEpochCarryOverStatementPayload(payload)).toBe(true);
    expect(payload.thresholdClaim).toEqual({ verifiedTradeCountAtLeast: 25 });
  });

  it("throws when predecessor and successor epoch ids are the same", () => {
    expect(() => buildEpochCarryOverStatementPayload(EPOCH_ID_1, HEX_A, EPOCH_ID_1, HEX_B, 1_000)).toThrow(RangeError);
  });

  it("throws on a malformed key", () => {
    expect(() => buildEpochCarryOverStatementPayload(EPOCH_ID_1, "bad-key", EPOCH_ID_2, HEX_B, 1_000)).toThrow(RangeError);
  });

  it("throws on a negative threshold claim", () => {
    expect(() =>
      buildEpochCarryOverStatementPayload(EPOCH_ID_1, HEX_A, EPOCH_ID_2, HEX_B, 1_000, {
        verifiedTradeCountAtLeast: -1,
      }),
    ).toThrow(RangeError);
  });

  it("isWellFormedEpochCarryOverStatementPayload rejects an unexpected extra field", () => {
    const payload = buildEpochCarryOverStatementPayload(EPOCH_ID_1, HEX_A, EPOCH_ID_2, HEX_B, 1_000);
    const withExtra = { ...payload, realWorldName: "Alice" };
    expect(isWellFormedEpochCarryOverStatementPayload(withExtra)).toBe(false);
  });

  it("the linkability warning is a non-empty, human-readable string (must be surfaced verbatim by any future UI)", () => {
    expect(typeof EPOCH_CARRY_OVER_LINKABILITY_WARNING).toBe("string");
    expect(EPOCH_CARRY_OVER_LINKABILITY_WARNING.length).toBeGreaterThan(20);
    expect(EPOCH_CARRY_OVER_LINKABILITY_WARNING.toLowerCase()).toContain("link");
  });

  it("sanity: HEX_C fixture is well-formed (guards against a typo silently weakening other tests)", () => {
    expect(isWellFormedPersonaEpochKeyPublicHex(HEX_C)).toBe(true);
  });
});
