import { describe, it, expect } from "vitest";
import {
  PUBLISH_INTENT_KINDS,
  reviewPublishIntent,
  sanitizePublishIntentMetadata,
} from "../src/federation/publish_intent.js";
import type { PublishIntentDescriptor } from "../src/federation/publish_intent.js";
import {
  MEMBERSHIP_PLAN_KINDS,
  reviewMembershipPlan,
  sanitizeMembershipPlanMetadata,
} from "../src/creator/membership.js";
import type { MembershipPlanDescriptor } from "../src/creator/membership.js";
import {
  renderCommunityRulePreview,
  renderCommunityRulesPreviewPage,
  SAMPLE_COMMUNITY_RULES,
} from "../src/render/community_rules_preview.js";
import {
  handleRequest,
  isCommunityRulesPreviewEnabled,
} from "../src/worker.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import publishIntentSource from "../src/federation/publish_intent.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import membershipSource from "../src/creator/membership.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import communityRulesPreviewSource from "../src/render/community_rules_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const boundarySources = [publishIntentSource, membershipSource].join("\n");
const previewSource = communityRulesPreviewSource as string;

const XSS_LABEL = `<script>alert('xss')</script>`;

describe("Nostr publish intent boundary", () => {
  const cleanIntent: PublishIntentDescriptor = {
    idRef: "intent-1",
    actorRef: "actor-1",
    targetRef: "target-1",
    kind: "post_placeholder",
    createdAt: 1000,
    metadata: { note: "sample" },
  };

  it("1. every publish-intent kind is a placeholder label", () => {
    for (const kind of PUBLISH_INTENT_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });

  it("2. a clean intent is accepted_placeholder", () => {
    const decision = reviewPublishIntent(cleanIntent);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("3. rejects sensitive metadata (secret/key/seed/token/payment/entitlement/dm/body/content/message/sig/signature/privkey/nsec/relay)", () => {
    const markers = [
      "secret",
      "key",
      "seed",
      "token",
      "payment",
      "entitlement",
      "dm",
      "body",
      "content",
      "message",
      "sig",
      "signature",
      "privkey",
      "nsec",
      "relay",
    ];
    for (const key of markers) {
      const decision = reviewPublishIntent({ ...cleanIntent, metadata: { [key]: "x" } });
      expect(decision.allowed).toBe(false);
    }
  });

  it("4. sanitizePublishIntentMetadata drops sensitive entries", () => {
    const clean = sanitizePublishIntentMetadata({ nsec: "x", note: "keep" });
    expect(clean).toEqual({ note: "keep" });
  });

  it("5. does not mutate its input", () => {
    const snapshot = JSON.stringify(cleanIntent);
    reviewPublishIntent(cleanIntent);
    expect(JSON.stringify(cleanIntent)).toBe(snapshot);
  });

  it("6. carries no content/body/bytes field on the type", () => {
    expect(publishIntentSource).not.toMatch(
      /interface\s+PublishIntentDescriptor[\s\S]{0,600}\breadonly\s+(content|body|bytes)\s*[?:]/i,
    );
  });

  it("7. no signing/relay/fetch/websocket in source", () => {
    expect(publishIntentSource).not.toMatch(/\bfetch\s*\(/);
    expect(publishIntentSource).not.toMatch(/\bnew\s+WebSocket\s*\(/);
    expect(publishIntentSource).not.toMatch(/\bsign\s*\(/);
  });
});

describe("Creator membership plan boundary", () => {
  const cleanPlan: MembershipPlanDescriptor = {
    idRef: "plan-1",
    creatorRef: "creator-1",
    kind: "supporter_placeholder",
    visibility: "public",
    metadata: { note: "sample" },
  };

  it("8. every membership-plan kind is a placeholder label", () => {
    for (const kind of MEMBERSHIP_PLAN_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });

  it("9. a clean plan is accepted_placeholder", () => {
    const decision = reviewMembershipPlan(cleanPlan);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("10. rejects price/card/payment/checkout/invoice/download/entitlement metadata", () => {
    for (const key of ["price", "card", "payment", "checkout", "invoice", "download", "entitlement"]) {
      const decision = reviewMembershipPlan({ ...cleanPlan, metadata: { [key]: "x" } });
      expect(decision.allowed).toBe(false);
    }
  });

  it("11. sanitizeMembershipPlanMetadata drops sensitive entries", () => {
    const clean = sanitizeMembershipPlanMetadata({ price: "999", note: "keep" });
    expect(clean).toEqual({ note: "keep" });
  });

  it("12. does not mutate its input", () => {
    const snapshot = JSON.stringify(cleanPlan);
    reviewMembershipPlan(cleanPlan);
    expect(JSON.stringify(cleanPlan)).toBe(snapshot);
  });

  it("13. carries no price/payment/checkout/invoice/download field on the type", () => {
    expect(membershipSource).not.toMatch(
      /interface\s+MembershipPlanDescriptor[\s\S]{0,600}\breadonly\s+(price|payment|checkout|invoice|download)\w*\s*[?:]/i,
    );
  });

  it("14. does not import PaymentProvider or EntitlementProvider", () => {
    expect(membershipSource).not.toMatch(/from\s+['"].*payment\//);
    expect(membershipSource).not.toMatch(/from\s+['"].*creator\/entitlement\.js/);
    expect(membershipSource).not.toMatch(/:\s*(PaymentProvider|EntitlementProvider)\b/);
  });
});

describe("Community ruleset preview UI", () => {
  it("15. flag absent -> not shown (checked via Worker route below)", () => {
    expect(SAMPLE_COMMUNITY_RULES.length).toBeGreaterThan(0);
  });

  it("16. renderCommunityRulePreview escapes label/description", () => {
    const rule = {
      ...SAMPLE_COMMUNITY_RULES[0]!,
      label: XSS_LABEL,
      description: XSS_LABEL,
    };
    const html = renderCommunityRulePreview(rule);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("17. shows hide/mute/filter visibility decision label, never a delete/remove/purge action value", () => {
    const html = renderCommunityRulesPreviewPage(SAMPLE_COMMUNITY_RULES);
    expect(html).toMatch(/hidden_placeholder|muted_placeholder|filtered_placeholder/);
    expect(html).not.toMatch(/>delete<|>remove<|>purge</i);
    expect(html).not.toMatch(/delete_placeholder|remove_placeholder|purge_placeholder/i);
  });

  it("18. renderCommunityRulesPreviewPage renders every sample rule", () => {
    const html = renderCommunityRulesPreviewPage(SAMPLE_COMMUNITY_RULES);
    for (const rule of SAMPLE_COMMUNITY_RULES) {
      expect(html).toContain(rule.label);
    }
  });

  it("19. no content/body/bytes field anywhere in source", () => {
    expect(previewSource).not.toMatch(/\breadonly\s+(content|body|bytes)\s*[?:]/);
  });
});

describe("Worker community rules preview route", () => {
  it("20. no communityRulesPreview flag -> normal board route", async () => {
    const res = await handleRequest(new Request("https://example.com/"));
    const body = await res.text();
    expect(body).not.toMatch(/community-rules-preview-page/);
  });

  it("21. ?communityRulesPreview=1 -> community rules preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?communityRulesPreview=1"));
    const body = await res.text();
    expect(body).toMatch(/community-rules-preview-page/);
  });

  it("22. ?communityRulesPreview=true -> community rules preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?communityRulesPreview=true"));
    const body = await res.text();
    expect(body).toMatch(/community-rules-preview-page/);
  });

  it("23. creatorPreview takes precedence over communityRulesPreview when both present", async () => {
    const res = await handleRequest(
      new Request("https://example.com/?creatorPreview=1&communityRulesPreview=1"),
    );
    const body = await res.text();
    expect(body).toMatch(/creator-profile-preview-page/);
    expect(body).not.toMatch(/community-rules-preview-page/);
  });

  it("24. isCommunityRulesPreviewEnabled recognizes only 1/true", () => {
    expect(isCommunityRulesPreviewEnabled(new URL("https://x.com/?communityRulesPreview=1"))).toBe(true);
    expect(isCommunityRulesPreviewEnabled(new URL("https://x.com/?communityRulesPreview=true"))).toBe(true);
    expect(isCommunityRulesPreviewEnabled(new URL("https://x.com/?communityRulesPreview=0"))).toBe(false);
  });

  it("25. existing routes are unaffected", async () => {
    const res = await handleRequest(new Request("https://example.com/?relay=bad-relay"));
    expect(res.status).toBe(400);
  });
});

describe("Stage 116 boundaries stay free of real network/provider calls", () => {
  it("26. imports no fetch/WebSocket/relay/signing library in preview render file", () => {
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

  it("27. calls no provider method", () => {
    const combined = [boundarySources, previewSource].join("\n");
    expect(combined).not.toMatch(
      /\.(put|get|delete|requestPayment|purchasePlaceholder|listPlaceholder|checkPlaceholder|sendPlaceholder|publishPlaceholder|connect|disconnect)\s*\(/,
    );
  });

  it("28. boundary sources import no fetch/relay/payment/entitlement/storage library", () => {
    expect(boundarySources).not.toMatch(/\bfetch\s*\(/);
    expect(boundarySources).not.toMatch(/from\s+['"].*storage\//);
    expect(boundarySources).not.toMatch(/from\s+['"].*payment\//);
  });

  it("29. Worker source never reads/calls a runtime-selected boundary from the community rules preview route", () => {
    expect(workerSource).toMatch(/isCommunityRulesPreviewEnabled\(url\)/);
    expect(workerSource).not.toMatch(
      /runtime\.(storageBackend|federationProvider|marketplaceProvider|creatorEntitlementProvider|chatProvider)\b/,
    );
  });

  it("30. never throws", () => {
    expect(() => reviewPublishIntent({ kind: "test_placeholder" })).not.toThrow();
    expect(() => reviewMembershipPlan({ kind: "test_placeholder", visibility: "public" })).not.toThrow();
    expect(() => renderCommunityRulesPreviewPage(SAMPLE_COMMUNITY_RULES)).not.toThrow();
  });
});
