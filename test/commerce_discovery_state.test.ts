import { describe, expect, it } from "vitest";

import {
  deriveCommerceDiscoveryView,
  describeCommerceDiscoveryStatus,
  COMMERCE_DISCOVERY_NO_LISTINGS_TEXT,
  type CommerceDiscoverySnapshot,
} from "../src/os/commerce/index.js";

/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) —
 * targeted tests for `deriveCommerceDiscoveryView` (arc mandate item 2:
 * "Explicitly and visibly distinguish LOCAL DEMO / OFFLINE / CONNECTING /
 * SYNCING / CONNECTED / SYNC FAILED / NO LISTINGS states").
 */

function baseSnapshot(overrides: Partial<CommerceDiscoverySnapshot> = {}): CommerceDiscoverySnapshot {
  return {
    networkProfile: "direct",
    hasConfiguredRelay: true,
    inFlight: false,
    hasEverAttempted: true,
    lastAttemptSucceeded: true,
    realListingCount: 3,
    ...overrides,
  };
}

describe("deriveCommerceDiscoveryView -- the seven required states", () => {
  it("1. networkProfile local-only always yields local-demo, regardless of relay/attempt state", () => {
    const view = deriveCommerceDiscoveryView(
      baseSnapshot({ networkProfile: "local-only", hasConfiguredRelay: true, inFlight: true, lastAttemptSucceeded: false }),
    );
    expect(view.status).toBe("local-demo");
  });

  it("2. no relay configured (and not local-only) yields offline", () => {
    const view = deriveCommerceDiscoveryView(baseSnapshot({ hasConfiguredRelay: false }));
    expect(view.status).toBe("offline");
  });

  it("3. an in-flight FIRST-ever attempt yields connecting", () => {
    const view = deriveCommerceDiscoveryView(
      baseSnapshot({ inFlight: true, hasEverAttempted: false, lastAttemptSucceeded: null }),
    );
    expect(view.status).toBe("connecting");
  });

  it("4. an in-flight SUBSEQUENT attempt yields syncing", () => {
    const view = deriveCommerceDiscoveryView(baseSnapshot({ inFlight: true, hasEverAttempted: true }));
    expect(view.status).toBe("syncing");
  });

  it("5. the most recent completed attempt failing yields sync-failed", () => {
    const view = deriveCommerceDiscoveryView(baseSnapshot({ lastAttemptSucceeded: false }));
    expect(view.status).toBe("sync-failed");
  });

  it("6. a completed, successful attempt yields connected", () => {
    const view = deriveCommerceDiscoveryView(baseSnapshot({ lastAttemptSucceeded: true }));
    expect(view.status).toBe("connected");
  });

  it("7. no-listings is orthogonal -- co-occurs with connected", () => {
    const view = deriveCommerceDiscoveryView(baseSnapshot({ realListingCount: 0 }));
    expect(view.status).toBe("connected");
    expect(view.noListings).toBe(true);
  });

  it("8. no-listings also co-occurs with offline and local-demo", () => {
    const offline = deriveCommerceDiscoveryView(baseSnapshot({ hasConfiguredRelay: false, realListingCount: 0 }));
    expect(offline.status).toBe("offline");
    expect(offline.noListings).toBe(true);

    const demo = deriveCommerceDiscoveryView(baseSnapshot({ networkProfile: "local-only", realListingCount: 0 }));
    expect(demo.status).toBe("local-demo");
    expect(demo.noListings).toBe(true);
  });

  it("9. a non-zero realListingCount is never reported as no-listings", () => {
    const view = deriveCommerceDiscoveryView(baseSnapshot({ realListingCount: 1 }));
    expect(view.noListings).toBe(false);
  });
});

describe("priority order (each check short-circuits the ones below it)", () => {
  it("10. local-only wins over an in-flight attempt", () => {
    expect(deriveCommerceDiscoveryView(baseSnapshot({ networkProfile: "local-only", inFlight: true })).status).toBe("local-demo");
  });

  it("11. no-relay wins over an in-flight attempt (never fabricates connecting/syncing with nothing to connect to)", () => {
    expect(deriveCommerceDiscoveryView(baseSnapshot({ hasConfiguredRelay: false, inFlight: true })).status).toBe("offline");
  });

  it("12. in-flight wins over a stale prior failure", () => {
    expect(
      deriveCommerceDiscoveryView(baseSnapshot({ inFlight: true, hasEverAttempted: true, lastAttemptSucceeded: false })).status,
    ).toBe("syncing");
  });
});

describe("describeCommerceDiscoveryStatus -- non-jargon text, exact required badge vocabulary", () => {
  it("13. every one of the six connection-status badges matches the arc mandate's own required word verbatim", () => {
    expect(describeCommerceDiscoveryStatus("local-demo").badge).toBe("LOCAL DEMO");
    expect(describeCommerceDiscoveryStatus("offline").badge).toBe("OFFLINE");
    expect(describeCommerceDiscoveryStatus("connecting").badge).toBe("CONNECTING");
    expect(describeCommerceDiscoveryStatus("syncing").badge).toBe("SYNCING");
    expect(describeCommerceDiscoveryStatus("connected").badge).toBe("CONNECTED");
    expect(describeCommerceDiscoveryStatus("sync-failed").badge).toBe("SYNC FAILED");
  });

  it("14. no detail text mentions relay/Nostr/IPC jargon", () => {
    const statuses = ["local-demo", "offline", "connecting", "syncing", "connected", "sync-failed"] as const;
    for (const status of statuses) {
      const text = describeCommerceDiscoveryStatus(status);
      expect(text.detail.toLowerCase()).not.toMatch(/relay|nostr|ipc/);
    }
  });

  it("15. the no-listings text is fixed, distinct, and never used as a status label itself", () => {
    expect(COMMERCE_DISCOVERY_NO_LISTINGS_TEXT).toMatch(/no real sellers/i);
  });
});

describe("purity", () => {
  it("16. never reads the clock or any ambient state -- identical snapshot always yields identical result", () => {
    const snapshot = baseSnapshot();
    const a = deriveCommerceDiscoveryView(snapshot);
    const b = deriveCommerceDiscoveryView(snapshot);
    expect(a).toEqual(b);
  });
});
