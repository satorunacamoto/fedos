import { describe, it, expect } from "vitest";
import { MockPromotionProvider } from "../src/promotion/adapter.js";
import { buildPromotionRequest, resolvePlacement } from "../src/promotion/policy.js";
import type { PromotionCandidate, PromotionRequest } from "../src/promotion/types.js";

function request(limit: number): PromotionRequest {
  return buildPromotionRequest(resolvePlacement("space_sidebar"), {
    spaceId: "lounge",
    limit,
  });
}

function candidate(id: string): PromotionCandidate {
  return {
    id,
    title: id,
    destination: `https://example.com/${id}`,
    sponsor: "example",
    priority: 1,
    weight: 1,
    metadata: {},
  };
}

describe("promotion adapter (mock)", () => {
  it("1. returns fixed candidates and echoes the placement", async () => {
    const provider = new MockPromotionProvider();
    const decision = await provider.getPromotions(request(5));
    expect(decision.reason).toBe("ok");
    expect(decision.placement.type).toBe("space_sidebar");
    expect(decision.selected.length).toBeGreaterThan(0);
    expect(decision.selected[0]?.sponsor).toBe("example");
  });

  it("2. honors the request limit", async () => {
    const provider = new MockPromotionProvider({
      candidates: [candidate("a"), candidate("b"), candidate("c")],
    });
    const decision = await provider.getPromotions(request(2));
    expect(decision.selected.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("3. a zero-limit request yields an empty decision", async () => {
    const provider = new MockPromotionProvider();
    const decision = await provider.getPromotions(request(0));
    expect(decision.selected).toEqual([]);
    expect(decision.reason).toBe("limit_zero");
  });

  it("4. reports no_candidates when the pool is empty", async () => {
    const provider = new MockPromotionProvider({ candidates: [] });
    const decision = await provider.getPromotions(request(3));
    expect(decision.selected).toEqual([]);
    expect(decision.reason).toBe("no_candidates");
  });

  it("5. does not mutate the request", async () => {
    const provider = new MockPromotionProvider();
    const req = request(2);
    const snapshot = JSON.stringify(req);
    await provider.getPromotions(req);
    expect(JSON.stringify(req)).toBe(snapshot);
  });
});
