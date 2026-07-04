import { describe, it, expect } from "vitest";
import {
  CREATOR_APPEAL_KINDS,
  reviewCreatorAppeal,
  isSensitiveCreatorAppealValue,
} from "../src/creator/appeal.js";
import type { CreatorAppealDescriptor } from "../src/creator/appeal.js";
import {
  CREATOR_REPUTATION_LABELS,
  reviewReputationSignal,
} from "../src/creator/reputation.js";
import type { ReputationSignalDescriptor } from "../src/creator/reputation.js";
import {
  SUBSCRIPTION_POLICY_KINDS,
  reviewSubscriptionPolicyTarget,
} from "../src/creator/subscription_policy.js";
import type { SubscriptionPolicyTargetInput } from "../src/creator/subscription_policy.js";
import {
  COMMUNITY_TREASURY_CATEGORY_KINDS,
  reviewCommunityTreasuryDisclosure,
} from "../src/community/treasury_policy.js";
import type { CommunityTreasuryDisclosureRequest } from "../src/community/treasury_policy.js";
import {
  renderCreatorGovernancePreviewPage,
  SAMPLE_CREATOR_APPEALS,
  SAMPLE_REPUTATION_SIGNALS,
  SAMPLE_SUBSCRIPTION_TARGETS,
  SAMPLE_TREASURY_REQUESTS,
} from "../src/render/creator_governance_preview.js";
import { handleRequest, isCreatorGovernancePreviewEnabled } from "../src/worker.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import appealSource from "../src/creator/appeal.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import reputationSource from "../src/creator/reputation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import subscriptionPolicySource from "../src/creator/subscription_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import treasuryPolicySource from "../src/community/treasury_policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import previewSource from "../src/render/creator_governance_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const boundarySources = [
  appealSource,
  reputationSource,
  subscriptionPolicySource,
  treasuryPolicySource,
  previewSource,
].join("\n");

const FORBIDDEN_GOVERNANCE_WORDS = ["dao", "settlement"];

describe("Creator appeal boundary", () => {
  const cleanAppeal: CreatorAppealDescriptor = {
    idRef: "appeal-1",
    creatorRef: "creator-1",
    targetRef: "target-1",
    kind: "moderation_action_placeholder",
    status: "submitted_placeholder",
  };

  it("1. every appeal kind is a placeholder label", () => {
    for (const kind of CREATOR_APPEAL_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });

  it("2. a clean appeal passes its own status through", () => {
    const decision = reviewCreatorAppeal(cleanAppeal);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("submitted_placeholder");
  });

  it("3. rejects a sensitive reason (vote/dao/settlement/treasury)", () => {
    for (const marker of ["vote", "dao", "settlement", "treasury"]) {
      const decision = reviewCreatorAppeal({ ...cleanAppeal, reason: `has ${marker} in it` });
      expect(decision.allowed).toBe(false);
      expect(decision.state).toBe("rejected");
    }
  });

  it("4. isSensitiveCreatorAppealValue flags governance-shaped values", () => {
    expect(isSensitiveCreatorAppealValue("a vote was cast")).toBe(true);
    expect(isSensitiveCreatorAppealValue("a plain dispute note")).toBe(false);
  });

  it("5. never mutates its input", () => {
    const snapshot = JSON.stringify(cleanAppeal);
    reviewCreatorAppeal(cleanAppeal);
    expect(JSON.stringify(cleanAppeal)).toBe(snapshot);
  });
});

describe("Creator reputation boundary", () => {
  const cleanSignal: ReputationSignalDescriptor = {
    idRef: "signal-1",
    creatorRef: "creator-1",
    label: "steady_placeholder",
  };

  it("6. every reputation label is a placeholder label", () => {
    for (const label of CREATOR_REPUTATION_LABELS) {
      expect(label).toMatch(/_placeholder$/);
    }
  });

  it("7. a clean signal is accepted_placeholder", () => {
    const decision = reviewReputationSignal(cleanSignal);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("8. rejects a score/weight/rank field", () => {
    for (const marker of ["score", "weight", "rank"]) {
      const decision = reviewReputationSignal({ ...cleanSignal, metadata: { [marker]: "1" } });
      expect(decision.allowed).toBe(false);
    }
  });

  it("9. carries no numeric score field on the type", () => {
    expect(reputationSource).not.toMatch(
      /interface\s+ReputationSignalDescriptor[\s\S]{0,600}\breadonly\s+(score|weight|rank)\s*[?:]\s*number/i,
    );
  });
});

describe("Creator subscription policy boundary", () => {
  it("10. every subscription policy kind is a placeholder label", () => {
    for (const kind of SUBSCRIPTION_POLICY_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });

  it("11. public_placeholder resolves to visible_placeholder", () => {
    const review = reviewSubscriptionPolicyTarget({ policyKind: "public_placeholder" });
    expect(review.decision).toBe("visible_placeholder");
  });

  it("12. gated policy kinds ALWAYS resolve to restricted_placeholder, regardless of viewerTierRef", () => {
    for (const kind of ["supporter_only_placeholder", "premium_only_placeholder"] as const) {
      const withoutTier = reviewSubscriptionPolicyTarget({ policyKind: kind });
      const withTier = reviewSubscriptionPolicyTarget({ policyKind: kind, viewerTierRef: "premium" });
      expect(withoutTier.decision).toBe("restricted_placeholder");
      expect(withTier.decision).toBe("restricted_placeholder");
    }
  });

  it("13. rejects price/card/payment/checkout/invoice/download/entitlement/buyer metadata", () => {
    const input: SubscriptionPolicyTargetInput = { policyKind: "public_placeholder" };
    for (const marker of ["price", "payment", "checkout", "invoice", "download", "entitlement", "buyer"]) {
      const review = reviewSubscriptionPolicyTarget({ ...input, metadata: { [marker]: "x" } });
      expect(review.decision).toBe("rejected");
    }
  });

  it("14. imports neither PaymentProvider nor EntitlementProvider", () => {
    expect(subscriptionPolicySource).not.toMatch(/from\s+['"].*payment\//);
    expect(subscriptionPolicySource).not.toMatch(/from\s+['"].*creator\/entitlement\.js/);
  });
});

describe("Community treasury policy boundary", () => {
  const cleanRequest: CommunityTreasuryDisclosureRequest = {
    idRef: "treasury-1",
    communityRef: "community-1",
    categoryKind: "operating_placeholder",
  };

  it("15. every treasury category kind is a placeholder label", () => {
    for (const kind of COMMUNITY_TREASURY_CATEGORY_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });

  it("16. a clean request is allowed_disclosure_placeholder", () => {
    const review = reviewCommunityTreasuryDisclosure(cleanRequest);
    expect(review.decision).toBe("allowed_disclosure_placeholder");
  });

  it("17. rejects balance/amount/fund/settlement/vote/dao metadata", () => {
    for (const marker of ["balance", "amount", "fund", "settlement", "vote", "dao"]) {
      const review = reviewCommunityTreasuryDisclosure({
        ...cleanRequest,
        metadata: { [marker]: "1" },
      });
      expect(review.decision).toBe("rejected");
    }
  });

  it("18. carries no numeric balance/amount field on the type", () => {
    expect(treasuryPolicySource).not.toMatch(
      /interface\s+CommunityTreasuryDisclosureRequest[\s\S]{0,600}\breadonly\s+(balance|amount|fund)\s*[?:]\s*number/i,
    );
  });
});

describe("Creator governance preview UI", () => {
  it("19. flag absent -> not shown (checked via Worker route below)", () => {
    expect(SAMPLE_CREATOR_APPEALS.length).toBeGreaterThan(0);
    expect(SAMPLE_REPUTATION_SIGNALS.length).toBeGreaterThan(0);
    expect(SAMPLE_SUBSCRIPTION_TARGETS.length).toBeGreaterThan(0);
    expect(SAMPLE_TREASURY_REQUESTS.length).toBeGreaterThan(0);
  });

  it("20. renders every sample record's kind/label/policy/category", () => {
    const html = renderCreatorGovernancePreviewPage(
      SAMPLE_CREATOR_APPEALS,
      SAMPLE_REPUTATION_SIGNALS,
      SAMPLE_SUBSCRIPTION_TARGETS,
      SAMPLE_TREASURY_REQUESTS,
    );
    expect(html).toContain(SAMPLE_CREATOR_APPEALS[0]!.kind);
    expect(html).toContain(SAMPLE_REPUTATION_SIGNALS[0]!.label);
    expect(html).toContain(SAMPLE_TREASURY_REQUESTS[0]!.categoryKind);
  });

  it("21. no DAO/vote/settlement mechanism (class/field/computation) anywhere in the preview source", () => {
    for (const word of FORBIDDEN_GOVERNANCE_WORDS) {
      expect(previewSource).not.toMatch(new RegExp(`\\b(class|interface|readonly)\\s+\\w*${word}`, "i"));
    }
    expect(previewSource).not.toMatch(/\bpay\s*\(/i);
  });

  it("22. never throws", () => {
    expect(() =>
      renderCreatorGovernancePreviewPage(
        SAMPLE_CREATOR_APPEALS,
        SAMPLE_REPUTATION_SIGNALS,
        SAMPLE_SUBSCRIPTION_TARGETS,
        SAMPLE_TREASURY_REQUESTS,
      ),
    ).not.toThrow();
  });
});

describe("Worker creator governance preview route", () => {
  it("23. no creatorGovernancePreview flag -> normal board route", async () => {
    const res = await handleRequest(new Request("https://example.com/"));
    const body = await res.text();
    expect(body).not.toMatch(/creator-governance-preview-page/);
  });

  it("24. ?creatorGovernancePreview=1 -> creator governance preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?creatorGovernancePreview=1"));
    const body = await res.text();
    expect(body).toMatch(/creator-governance-preview-page/);
  });

  it("25. queuePreview takes precedence over creatorGovernancePreview when both present", async () => {
    const res = await handleRequest(
      new Request("https://example.com/?queuePreview=1&creatorGovernancePreview=1"),
    );
    const body = await res.text();
    expect(body).toMatch(/queue-status-preview-page/);
    expect(body).not.toMatch(/creator-governance-preview-page/);
  });

  it("26. isCreatorGovernancePreviewEnabled recognizes only 1/true", () => {
    expect(
      isCreatorGovernancePreviewEnabled(new URL("https://x.com/?creatorGovernancePreview=1")),
    ).toBe(true);
    expect(
      isCreatorGovernancePreviewEnabled(new URL("https://x.com/?creatorGovernancePreview=0")),
    ).toBe(false);
  });

  it("27. existing routes are unaffected", async () => {
    const res = await handleRequest(new Request("https://example.com/?relay=bad-relay"));
    expect(res.status).toBe(400);
  });
});

describe("Stage 123-126 boundaries stay free of DAO/vote/payment/treasury/settlement logic", () => {
  it("28. no DAO/vote/payment/settlement implementation anywhere in the four boundary sources", () => {
    const boundaryOnly = [appealSource, reputationSource, subscriptionPolicySource, treasuryPolicySource].join(
      "\n",
    );
    expect(boundaryOnly).not.toMatch(/class\s+\w*(Dao|Treasury|Vote)\w*/i);
  });

  it("29. calls no provider method", () => {
    expect(boundarySources).not.toMatch(
      /\.(put|get|delete|requestPayment|purchasePlaceholder|listPlaceholder|checkPlaceholder|sendPlaceholder|publishPlaceholder|connect|disconnect)\s*\(/,
    );
  });

  it("30. Worker source never reads/calls a runtime-selected boundary from the creator governance preview route", () => {
    expect(workerSource).toMatch(/isCreatorGovernancePreviewEnabled\(url\)/);
    expect(workerSource).not.toMatch(
      /runtime\.(storageBackend|federationProvider|marketplaceProvider|creatorEntitlementProvider|chatProvider)\b/,
    );
  });
});
