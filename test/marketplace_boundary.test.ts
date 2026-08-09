import { describe, it, expect } from "vitest";
import { NoopMarketplaceProvider } from "../src/os/commerce/marketplace/noop_marketplace.js";
import { MARKETPLACE_ITEM_KINDS } from "../src/os/commerce/marketplace/types.js";
import type {
  MarketplaceListDecision,
  MarketplaceListingDescriptor,
  MarketplaceProvider,
  MarketplacePurchaseDecision,
  MarketplacePurchaseRequest,
  MarketplaceStatus,
} from "../src/os/commerce/marketplace/types.js";
import { createRuntime, selectMarketplaceProvider } from "../src/os/_legacy_prototype/runtime/create_runtime.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import marketplaceTypesSource from "../src/os/commerce/marketplace/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopMarketplaceSource from "../src/os/commerce/marketplace/noop_marketplace.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

const marketplaceSources = [marketplaceTypesSource, noopMarketplaceSource].join("\n");

const cleanListing: MarketplaceListingDescriptor = {
  idRef: "listing-1",
  creatorRef: "creator-1",
  kind: "digital_product_placeholder",
  visibility: "public",
  metadata: { note: "sample" },
};

describe("NoopMarketplaceProvider", () => {
  it("1. is always unavailable", () => {
    const provider = new NoopMarketplaceProvider();
    const status = provider.status();
    expect(status.allowed).toBe(false);
    expect(status.state).toBe("unavailable");
  });

  it("2. listPlaceholder denies and returns no items", async () => {
    const provider = new NoopMarketplaceProvider();
    const decision = await provider.listPlaceholder();
    expect(decision.allowed).toBe(false);
    expect(decision.items).toEqual([]);
  });

  it("3. purchasePlaceholder denies and grants nothing", async () => {
    const provider = new NoopMarketplaceProvider();
    const request: MarketplacePurchaseRequest = { listingRef: "listing-1" };
    const decision = await provider.purchasePlaceholder(request);
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });

  it("4. never throws", async () => {
    const provider = new NoopMarketplaceProvider();
    expect(() => provider.status()).not.toThrow();
    await expect(provider.listPlaceholder()).resolves.toBeDefined();
    await expect(provider.purchasePlaceholder({})).resolves.toBeDefined();
  });
});

describe("MarketplaceProvider labels", () => {
  it("5. every marketplace-item kind is a placeholder label", () => {
    for (const kind of MARKETPLACE_ITEM_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });

  it("6. a listing carries no price/payment/checkout/download/bytes field", () => {
    expect(Object.keys(cleanListing).sort()).toEqual(
      ["creatorRef", "idRef", "kind", "metadata", "visibility"].sort(),
    );
    for (const forbidden of ["price", "payment", "checkout", "download", "bytes", "url"]) {
      expect(marketplaceTypesSource.toLowerCase()).not.toMatch(
        new RegExp(`readonly\\s+\\w*${forbidden}\\w*\\s*[?:]`, "i"),
      );
    }
  });
});

describe("Stage 111 — Marketplace provider runtime selection", () => {
  it("7. no overrides -> NoopMarketplaceProvider", () => {
    expect(selectMarketplaceProvider()).toBeInstanceOf(NoopMarketplaceProvider);
    expect(createRuntime().marketplaceProvider).toBeInstanceOf(NoopMarketplaceProvider);
  });

  it("8. overrides.marketplaceProvider wins", () => {
    const stub = new NoopMarketplaceProvider();
    expect(selectMarketplaceProvider(undefined, { marketplaceProvider: stub })).toBe(stub);
    expect(createRuntime(undefined, { marketplaceProvider: stub }).marketplaceProvider).toBe(stub);
  });

  it("9. createRuntime does not call listPlaceholder/purchasePlaceholder", async () => {
    let listCalls = 0;
    let purchaseCalls = 0;
    const spy: MarketplaceProvider = {
      status: (): MarketplaceStatus => ({ allowed: false, state: "unavailable" }),
      listPlaceholder: async (): Promise<MarketplaceListDecision> => {
        listCalls += 1;
        return { allowed: false, state: "unavailable", items: [] };
      },
      purchasePlaceholder: async (
        _r: MarketplacePurchaseRequest,
      ): Promise<MarketplacePurchaseDecision> => {
        purchaseCalls += 1;
        return { allowed: false, state: "unavailable" };
      },
    };
    const rt = createRuntime(undefined, { marketplaceProvider: spy });
    expect(rt.marketplaceProvider).toBe(spy);
    expect(listCalls).toBe(0);
    expect(purchaseCalls).toBe(0);
  });

  it("10. Worker source does not select or call a MarketplaceProvider", () => {
    expect(workerSource).not.toMatch(/\bMarketplaceProvider\b/);
    expect(workerSource).not.toMatch(/NoopMarketplaceProvider/);
    expect(workerSource).not.toMatch(/\.listPlaceholder\s*\(|\.purchasePlaceholder\s*\(/);
  });
});

describe("marketplace boundary is decoupled and free of real payment", () => {
  it("11. imports no PaymentProvider, Stripe/Lightning library, or fetch", () => {
    const importLines = marketplaceSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = ["stripe", "lightning", "lnd", "lnurl", "bolt11", "paypal", "braintree"];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
      expect(line).not.toMatch(/from\s+['"].*payment\//);
    }
    expect(marketplaceSources).not.toMatch(/\bfetch\s*\(/);
  });

  it("12. does not construct or reference a PurchaseGrant", () => {
    // Doc comments legitimately NAME `PurchaseGrant` when explaining that
    // this boundary does not issue one; the real invariant is no
    // import/construction.
    expect(marketplaceSources).not.toMatch(/from\s+['"].*commerce\//);
    expect(marketplaceSources).not.toMatch(/:\s*PurchaseGrant\b/);
    expect(marketplaceSources).not.toMatch(/new\s+PurchaseGrant\b/);
    expect(marketplaceSources).not.toMatch(/\{\s*productId/);
  });

  it("13. does not import StorageBackend or any CryptoProvider", () => {
    expect(marketplaceSources).not.toMatch(/from\s+['"].*storage\//);
    expect(marketplaceSources).not.toMatch(/from\s+['"].*crypto\//);
    expect(marketplaceSources).not.toMatch(/:\s*(StorageBackend|CryptoProvider)\b/);
  });

  it("14. does not mutate its input", async () => {
    const provider = new NoopMarketplaceProvider();
    const request: MarketplacePurchaseRequest = { listingRef: "listing-1" };
    const snapshot = JSON.stringify(request);
    await provider.purchasePlaceholder(request);
    expect(JSON.stringify(request)).toBe(snapshot);
  });

  it("15. Runtime source does not construct a checkout/download URL for marketplace selection", () => {
    expect(runtimeSource).not.toMatch(/checkoutUrl|downloadUrl|signedUrl/i);
  });
});
