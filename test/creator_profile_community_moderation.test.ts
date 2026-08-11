import { describe, it, expect } from "vitest";
import {
  renderCreatorProfilePreview,
  renderCreatorProfilePreviewPage,
  SAMPLE_CREATOR_PROFILES,
} from "../src/os/_legacy_prototype/render/creator_profile_preview.js";
import type { CreatorProfileDescriptor } from "../src/os/commerce/creator/profile.js";
import {
  CREATOR_TRUST_LABELS,
  reviewCreatorProfile,
  sanitizeCreatorProfileMetadata,
} from "../src/os/commerce/creator/profile.js";
import {
  COMMUNITY_MODERATION_POLICY_KINDS,
  COMMUNITY_MODERATION_TARGET_KINDS,
  COMMUNITY_MODERATION_REQUESTED_ACTIONS,
  reviewCommunityModerationTarget,
} from "../src/os/_legacy_prototype/community/moderation.js";
import type { CommunityModerationTargetInput } from "../src/os/_legacy_prototype/community/moderation.js";
import {
  handleRequest,
  isCreatorPreviewEnabled,
} from "../src/os/_legacy_prototype/worker.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import creatorProfilePreviewSource from "../src/os/_legacy_prototype/render/creator_profile_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import creatorProfileSource from "../src/os/commerce/creator/profile.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import communityModerationSource from "../src/os/_legacy_prototype/community/moderation.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

const previewSource = creatorProfilePreviewSource as string;
const boundarySources = [creatorProfileSource, communityModerationSource].join("\n");

const XSS_TITLE = `<script>alert('xss')</script>`;

describe("Creator profile preview UI", () => {
  it("1. renderCreatorProfilePreview escapes name/bio/category/trust labels", () => {
    const profile: CreatorProfileDescriptor = {
      creatorRef: XSS_TITLE,
      displayName: XSS_TITLE,
      bioPreview: XSS_TITLE,
      category: XSS_TITLE,
      trustLabels: ["test_placeholder"],
    };
    const html = renderCreatorProfilePreview(profile);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("2. shows a review state row without claiming verification", () => {
    const html = renderCreatorProfilePreview(SAMPLE_CREATOR_PROFILES[0]!);
    expect(html).toMatch(/review/);
    expect(html).toMatch(/accepted_placeholder|rejected/);
  });

  it("3. renderCreatorProfilePreviewPage renders every sample profile", () => {
    const html = renderCreatorProfilePreviewPage(SAMPLE_CREATOR_PROFILES);
    for (const profile of SAMPLE_CREATOR_PROFILES) {
      if (profile.displayName) expect(html).toContain(profile.displayName);
    }
  });

  it("4. contains no follow/subscribe/buy/message form, only a disabled button", () => {
    const html = renderCreatorProfilePreviewPage(SAMPLE_CREATOR_PROFILES);
    expect(html).not.toMatch(/<form/i);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/);
  });

  it("5. never shows metadata or a payment/entitlement field", () => {
    const profile: CreatorProfileDescriptor = {
      creatorRef: "c1",
      displayName: "Test Creator",
      metadata: { note: "internal-only-should-not-render" },
    };
    const html = renderCreatorProfilePreview(profile);
    expect(html).not.toContain("internal-only-should-not-render");
  });
});

describe("Creator profile / trust label boundary", () => {
  it("6. every trust label is a placeholder", () => {
    for (const label of CREATOR_TRUST_LABELS) {
      expect(label).toMatch(/_placeholder$/);
    }
  });

  it("7. a clean profile is accepted_placeholder", () => {
    const decision = reviewCreatorProfile({ creatorRef: "c1", displayName: "Test" });
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("8. rejects sensitive metadata (kyc/ssn/passport/dob/address/phone/email/document/government/verification)", () => {
    const markers = [
      "kyc",
      "ssn",
      "passport",
      "dob",
      "address",
      "phone",
      "email",
      "document",
      "government",
      "verification",
      "secret",
      "payment",
      "entitlement",
    ];
    for (const key of markers) {
      const decision = reviewCreatorProfile({ creatorRef: "c1", metadata: { [key]: "x" } });
      expect(decision.allowed).toBe(false);
    }
  });

  it("9. rejects a sensitive bio preview", () => {
    const decision = reviewCreatorProfile({ creatorRef: "c1", bioPreview: "my ssn is 123" });
    expect(decision.allowed).toBe(false);
  });

  it("10. sanitizeCreatorProfileMetadata drops sensitive entries", () => {
    const clean = sanitizeCreatorProfileMetadata({ kyc: "x", note: "keep" });
    expect(clean).toEqual({ note: "keep" });
  });

  it("11. does not mutate its input", () => {
    const profile: CreatorProfileDescriptor = { creatorRef: "c1", metadata: { note: "x" } };
    const snapshot = JSON.stringify(profile);
    reviewCreatorProfile(profile);
    expect(JSON.stringify(profile)).toBe(snapshot);
  });

  it("12. verified_placeholder is never produced by reviewCreatorProfile (no real verification exists)", () => {
    const decision = reviewCreatorProfile({ creatorRef: "c1", trustLabels: ["verified_placeholder"] });
    expect(decision.state).not.toBe("verified_placeholder");
    expect(["accepted_placeholder", "rejected"]).toContain(decision.state);
  });

  it("13. carries no payment/entitlement field on the type", () => {
    expect(creatorProfileSource).not.toMatch(
      /interface\s+CreatorProfileDescriptor[\s\S]{0,600}\breadonly\s+(price|payment|entitlement)\w*\s*[?:]/i,
    );
  });
});

describe("Community moderation policy boundary", () => {
  const cleanInput: CommunityModerationTargetInput = {
    idRef: "mod-1",
    targetRef: "post-1",
    targetKind: "post_placeholder",
    policyKind: "default_placeholder",
    action: "hide_placeholder",
  };

  it("14. every policy kind / target kind / requested action is a placeholder", () => {
    for (const kind of COMMUNITY_MODERATION_POLICY_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
    for (const kind of COMMUNITY_MODERATION_TARGET_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
    for (const action of COMMUNITY_MODERATION_REQUESTED_ACTIONS) {
      expect(action).toMatch(/_placeholder$/);
    }
  });

  it("15. never includes a delete/remove/purge action", () => {
    for (const action of COMMUNITY_MODERATION_REQUESTED_ACTIONS) {
      expect(action).not.toMatch(/delete|remove|purge/i);
    }
  });

  it("16. maps hide/mute/filter actions to their matching visibility decision", () => {
    expect(reviewCommunityModerationTarget(cleanInput).decision).toBe("hidden_placeholder");
    expect(
      reviewCommunityModerationTarget({ ...cleanInput, action: "mute_placeholder" }).decision,
    ).toBe("muted_placeholder");
    expect(
      reviewCommunityModerationTarget({ ...cleanInput, action: "filter_placeholder" }).decision,
    ).toBe("filtered_placeholder");
  });

  it("17. rejects sensitive reason/metadata instead of returning a visibility decision", () => {
    const bySensitiveReason = reviewCommunityModerationTarget({ ...cleanInput, reason: "contains secret" });
    expect(bySensitiveReason.decision).toBe("rejected");
    const bySensitiveMetadata = reviewCommunityModerationTarget({
      ...cleanInput,
      metadata: { token: "x" },
    });
    expect(bySensitiveMetadata.decision).toBe("rejected");
  });

  it("18. does not mutate its input", () => {
    const snapshot = JSON.stringify(cleanInput);
    reviewCommunityModerationTarget(cleanInput);
    expect(JSON.stringify(cleanInput)).toBe(snapshot);
  });

  it("19. carries no content/body/bytes field on the type", () => {
    expect(communityModerationSource).not.toMatch(
      /interface\s+CommunityModerationTargetInput[\s\S]{0,600}\breadonly\s+(content|body|bytes)\s*[?:]/i,
    );
  });

  it("20. source contains no delete/remove/purge action wording", () => {
    expect(communityModerationSource).not.toMatch(/["']delete_placeholder["']|["']remove_placeholder["']|["']purge_placeholder["']/);
  });
});

describe("Worker creator preview route", () => {
  it("21. no creatorPreview flag -> normal board route", async () => {
    const res = await handleRequest(new Request("https://example.com/"));
    const body = await res.text();
    expect(body).not.toMatch(/creator-profile-preview-page/);
  });

  it("22. ?creatorPreview=1 -> creator profile preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?creatorPreview=1"));
    const body = await res.text();
    expect(body).toMatch(/creator-profile-preview-page/);
  });

  it("23. ?creatorPreview=true -> creator profile preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?creatorPreview=true"));
    const body = await res.text();
    expect(body).toMatch(/creator-profile-preview-page/);
  });

  it("24. boardPreview takes precedence over creatorPreview when both present", async () => {
    const res = await handleRequest(
      new Request("https://example.com/?boardPreview=1&creatorPreview=1"),
    );
    const body = await res.text();
    expect(body).toMatch(/board-preview-page/);
    expect(body).not.toMatch(/creator-profile-preview-page/);
  });

  it("25. isCreatorPreviewEnabled recognizes only 1/true", () => {
    expect(isCreatorPreviewEnabled(new URL("https://x.com/?creatorPreview=1"))).toBe(true);
    expect(isCreatorPreviewEnabled(new URL("https://x.com/?creatorPreview=true"))).toBe(true);
    expect(isCreatorPreviewEnabled(new URL("https://x.com/?creatorPreview=yes"))).toBe(false);
  });

  it("26. existing routes are unaffected", async () => {
    const res = await handleRequest(new Request("https://example.com/?relay=bad-relay"));
    expect(res.status).toBe(400);
  });
});

describe("Stage 115 boundaries stay free of real network/provider calls", () => {
  it("27. imports no fetch/WebSocket/relay/signing library", () => {
    const importLines = previewSource
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = ["ws", "websocket", "node-fetch", "node:http", "node:https"];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
    expect(previewSource).not.toMatch(/\bfetch\s*\(/);
    expect(previewSource).not.toMatch(/\bnew\s+WebSocket\s*\(/);
  });

  it("28. calls no provider method", () => {
    expect(previewSource).not.toMatch(
      /\.(put|get|delete|requestPayment|purchasePlaceholder|listPlaceholder|checkPlaceholder|sendPlaceholder|publishPlaceholder|connect|disconnect)\s*\(/,
    );
  });

  it("29. does not import StorageBackend/PaymentProvider/EntitlementProvider/ChatProvider/MarketplaceProvider instances", () => {
    expect(previewSource).not.toMatch(/from\s+['"].*storage\/noop_storage\.js/);
    expect(previewSource).not.toMatch(/from\s+['"].*payment\/noop_payment\.js/);
    expect(previewSource).not.toMatch(/from\s+['"].*creator\/entitlement\.js/);
    expect(previewSource).not.toMatch(/from\s+['"].*chat\/noop_chat\.js/);
    expect(previewSource).not.toMatch(/from\s+['"].*marketplace\/noop_marketplace\.js/);
  });

  it("30. boundary sources import no fetch/relay/payment/entitlement/storage library", () => {
    expect(boundarySources).not.toMatch(/\bfetch\s*\(/);
    expect(boundarySources).not.toMatch(/from\s+['"].*storage\//);
    expect(boundarySources).not.toMatch(/from\s+['"].*federation\//);
    expect(boundarySources).not.toMatch(/from\s+['"].*payment\//);
  });

  it("31. Worker source never reads/calls a runtime-selected boundary from the creator preview route", () => {
    expect(workerSource).toMatch(/isCreatorPreviewEnabled\(url\)/);
    expect(workerSource).not.toMatch(
      /runtime\.(storageBackend|federationProvider|marketplaceProvider|creatorEntitlementProvider|chatProvider)\b/,
    );
  });

  it("32. never throws", () => {
    expect(() => renderCreatorProfilePreviewPage(SAMPLE_CREATOR_PROFILES)).not.toThrow();
    expect(() => reviewCreatorProfile({ creatorRef: "c1" })).not.toThrow();
    expect(() =>
      reviewCommunityModerationTarget({
        targetKind: "test_placeholder",
        policyKind: "test_placeholder",
        action: "hide_placeholder",
      }),
    ).not.toThrow();
  });
});
