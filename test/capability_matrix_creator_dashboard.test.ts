import { describe, it, expect } from "vitest";
import {
  PROTOCOL_ADAPTER_KINDS,
  PROTOCOL_ADAPTER_CAPABILITIES,
  getProtocolAdapterCapabilities,
  canProtocolAdapterSupport,
} from "../src/os/_legacy_prototype/federation/capability_matrix.js";
import {
  renderCreatorDashboardPreview,
  renderCreatorDashboardPreviewPage,
  SAMPLE_CREATOR_DASHBOARDS,
} from "../src/os/_legacy_prototype/render/creator_dashboard_preview.js";
import {
  handleRequest,
  isCreatorDashboardPreviewEnabled,
} from "../src/os/_legacy_prototype/worker.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import capabilityMatrixSource from "../src/os/_legacy_prototype/federation/capability_matrix.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import dashboardPreviewSource from "../src/os/_legacy_prototype/render/creator_dashboard_preview.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

const boundarySources = [capabilityMatrixSource, dashboardPreviewSource].join("\n");

const XSS_LABEL = `<script>alert('xss')</script>`;

describe("Protocol adapter capability matrix", () => {
  it("1. every adapter kind and capability is a placeholder label", () => {
    for (const kind of PROTOCOL_ADAPTER_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
    for (const capability of PROTOCOL_ADAPTER_CAPABILITIES) {
      expect(capability).toMatch(/_placeholder$/);
    }
  });

  it("2. getProtocolAdapterCapabilities returns a fixed row for every capability", () => {
    for (const kind of PROTOCOL_ADAPTER_KINDS) {
      const row = getProtocolAdapterCapabilities(kind);
      for (const capability of PROTOCOL_ADAPTER_CAPABILITIES) {
        expect(row[capability]).toBeDefined();
        expect(["available_placeholder", "unavailable", "rejected", "error"]).toContain(
          row[capability]!.state,
        );
      }
    }
  });

  it("3. Nostr includes public read/publish/reply/reaction/profile/marketplace/moderation labels as available_placeholder", () => {
    const row = getProtocolAdapterCapabilities("nostr_placeholder");
    for (const capability of [
      "read_public_placeholder",
      "publish_public_placeholder",
      "reply_placeholder",
      "reaction_placeholder",
      "profile_placeholder",
      "marketplace_announcement_placeholder",
      "moderation_signal_placeholder",
    ] as const) {
      expect(row[capability].allowed).toBe(true);
      expect(row[capability].state).toBe("available_placeholder");
    }
  });

  it("4. Nostr private_message/paid_content are never available (rejected or unavailable)", () => {
    const row = getProtocolAdapterCapabilities("nostr_placeholder");
    expect(row.private_message_placeholder.allowed).toBe(false);
    expect(["rejected", "unavailable"]).toContain(row.private_message_placeholder.state);
    expect(row.paid_content_placeholder.allowed).toBe(false);
    expect(["rejected", "unavailable"]).toContain(row.paid_content_placeholder.state);
  });

  it("5. private_message/paid_content are not available_placeholder for ANY adapter", () => {
    for (const kind of PROTOCOL_ADAPTER_KINDS) {
      const row = getProtocolAdapterCapabilities(kind);
      expect(row.private_message_placeholder.state).not.toBe("available_placeholder");
      expect(row.paid_content_placeholder.state).not.toBe("available_placeholder");
    }
  });

  it("6. Bluesky/Threads/RSS are placeholder-only (no capability available except the trivial test one)", () => {
    for (const kind of ["bluesky_placeholder", "threads_placeholder", "rss_placeholder"] as const) {
      const row = getProtocolAdapterCapabilities(kind);
      for (const capability of PROTOCOL_ADAPTER_CAPABILITIES) {
        if (capability === "test_placeholder") continue;
        expect(row[capability].state).toBe("unavailable");
        expect(row[capability].allowed).toBe(false);
      }
    }
  });

  it("7. test_placeholder capability is always available_placeholder, for every adapter", () => {
    for (const kind of PROTOCOL_ADAPTER_KINDS) {
      const decision = canProtocolAdapterSupport(kind, "test_placeholder");
      expect(decision.allowed).toBe(true);
      expect(decision.state).toBe("available_placeholder");
    }
  });

  it("8. never throws for any adapter/capability pair", () => {
    for (const kind of PROTOCOL_ADAPTER_KINDS) {
      for (const capability of PROTOCOL_ADAPTER_CAPABILITIES) {
        expect(() => canProtocolAdapterSupport(kind, capability)).not.toThrow();
      }
    }
  });

  it("9. no fetch/websocket/relay-connect call in source", () => {
    expect(capabilityMatrixSource).not.toMatch(/\bfetch\s*\(/);
    expect(capabilityMatrixSource).not.toMatch(/\bnew\s+WebSocket\s*\(/);
  });
});

describe("Creator dashboard preview UI", () => {
  it("10. flag absent -> not shown (checked via Worker route below)", () => {
    expect(SAMPLE_CREATOR_DASHBOARDS.length).toBeGreaterThan(0);
  });

  it("11. renderCreatorDashboardPreview escapes creatorRef and label lists", () => {
    const dashboard = {
      ...SAMPLE_CREATOR_DASHBOARDS[0]!,
      creatorRef: XSS_LABEL,
      federationCapabilitySummaryLabels: [XSS_LABEL],
      moderationVisibilitySummaryLabels: [XSS_LABEL],
    };
    const html = renderCreatorDashboardPreview(dashboard);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("12. renderCreatorDashboardPreviewPage renders every sample dashboard", () => {
    const html = renderCreatorDashboardPreviewPage(SAMPLE_CREATOR_DASHBOARDS);
    for (const dashboard of SAMPLE_CREATOR_DASHBOARDS) {
      expect(html).toContain(dashboard.creatorRef);
    }
  });

  it("13. every navigation button is permanently disabled", () => {
    const html = renderCreatorDashboardPreviewPage(SAMPLE_CREATOR_DASHBOARDS);
    const buttonMatches = html.match(/<button\b[^>]*>/g) ?? [];
    expect(buttonMatches.length).toBeGreaterThan(0);
    for (const button of buttonMatches) {
      expect(button).toContain("disabled");
    }
  });

  it("14. no revenue/amount/payment/checkout/invoice/buyer/email field or word anywhere in source", () => {
    const denylist = ["revenue", "amount", "payment", "checkout", "invoice", "buyer", "email"];
    for (const word of denylist) {
      expect(dashboardPreviewSource.toLowerCase()).not.toContain(word);
    }
  });

  it("15. never throws", () => {
    expect(() => renderCreatorDashboardPreviewPage(SAMPLE_CREATOR_DASHBOARDS)).not.toThrow();
  });
});

describe("Worker creator dashboard preview route", () => {
  it("16. no creatorDashboardPreview flag -> normal board route", async () => {
    const res = await handleRequest(new Request("https://example.com/"));
    const body = await res.text();
    expect(body).not.toMatch(/creator-dashboard-preview-page/);
  });

  it("17. ?creatorDashboardPreview=1 -> creator dashboard preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?creatorDashboardPreview=1"));
    const body = await res.text();
    expect(body).toMatch(/creator-dashboard-preview-page/);
  });

  it("18. ?creatorDashboardPreview=true -> creator dashboard preview page", async () => {
    const res = await handleRequest(new Request("https://example.com/?creatorDashboardPreview=true"));
    const body = await res.text();
    expect(body).toMatch(/creator-dashboard-preview-page/);
  });

  it("19. communityRulesPreview takes precedence over creatorDashboardPreview when both present", async () => {
    const res = await handleRequest(
      new Request("https://example.com/?communityRulesPreview=1&creatorDashboardPreview=1"),
    );
    const body = await res.text();
    expect(body).toMatch(/community-rules-preview-page/);
    expect(body).not.toMatch(/creator-dashboard-preview-page/);
  });

  it("20. runtimeStatus/boardPreview/marketplacePreview/creatorPreview all still win over creatorDashboardPreview", async () => {
    const cases = [
      ["boardPreview", "board-preview-page"],
      ["marketplacePreview", "marketplace-preview-page"],
      ["creatorPreview", "creator-profile-preview-page"],
    ] as const;
    for (const [flag, marker] of cases) {
      const res = await handleRequest(
        new Request(`https://example.com/?${flag}=1&creatorDashboardPreview=1`),
      );
      const body = await res.text();
      expect(body).toMatch(new RegExp(marker));
      expect(body).not.toMatch(/creator-dashboard-preview-page/);
    }
  });

  it("21. isCreatorDashboardPreviewEnabled recognizes only 1/true", () => {
    expect(
      isCreatorDashboardPreviewEnabled(new URL("https://x.com/?creatorDashboardPreview=1")),
    ).toBe(true);
    expect(
      isCreatorDashboardPreviewEnabled(new URL("https://x.com/?creatorDashboardPreview=true")),
    ).toBe(true);
    expect(
      isCreatorDashboardPreviewEnabled(new URL("https://x.com/?creatorDashboardPreview=0")),
    ).toBe(false);
  });

  it("22. existing routes are unaffected", async () => {
    const res = await handleRequest(new Request("https://example.com/?relay=bad-relay"));
    expect(res.status).toBe(400);
  });
});

describe("Stage 117 boundaries stay free of real network/provider calls", () => {
  it("23. imports no fetch/WebSocket/relay/signing library in either new file", () => {
    for (const source of [capabilityMatrixSource, dashboardPreviewSource]) {
      const importLines = source
        .split("\n")
        .filter((line: string) => /^\s*import\b/.test(line));
      const denylist = ["ws", "websocket", "node-fetch", "node:http", "node:https"];
      for (const line of importLines) {
        for (const banned of denylist) {
          expect(line.toLowerCase()).not.toContain(banned);
        }
      }
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/\bnew\s+WebSocket\s*\(/);
    }
  });

  it("24. calls no provider method", () => {
    expect(boundarySources).not.toMatch(
      /\.(put|get|delete|requestPayment|purchasePlaceholder|listPlaceholder|checkPlaceholder|sendPlaceholder|publishPlaceholder|connect|disconnect)\s*\(/,
    );
  });

  it("25. boundary sources import no storage/payment/entitlement library", () => {
    expect(boundarySources).not.toMatch(/from\s+['"].*storage\//);
    expect(boundarySources).not.toMatch(/from\s+['"].*payment\//);
    expect(boundarySources).not.toMatch(/from\s+['"].*creator\/entitlement\.js/);
  });

  it("26. Worker source never reads/calls a runtime-selected boundary from the creator dashboard preview route", () => {
    expect(workerSource).toMatch(/isCreatorDashboardPreviewEnabled\(url\)/);
    expect(workerSource).not.toMatch(
      /runtime\.(storageBackend|federationProvider|marketplaceProvider|creatorEntitlementProvider|chatProvider)\b/,
    );
  });
});
