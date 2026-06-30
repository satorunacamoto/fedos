import { describe, it, expect } from "vitest";
import {
  buildPromotionRequest,
  canShowPromotion,
  filterPromotionContext,
  resolvePlacement,
} from "../src/promotion/policy.js";
import type { PromotionRequest } from "../src/promotion/types.js";

const VIEWER = "a".repeat(64);

describe("promotion policy", () => {
  it("1. resolvePlacement maps a slot to its surface family + label", () => {
    expect(resolvePlacement("thread_header")).toEqual({
      type: "thread_header",
      context: "thread",
      label: "Thread header",
    });
    expect(resolvePlacement("space_sidebar").context).toBe("space");
    expect(resolvePlacement("chat_inline").context).toBe("chat");
    expect(resolvePlacement("product_sidebar").context).toBe("product");
    expect(resolvePlacement("search_result").context).toBe("search");
  });

  it("2. buildPromotionRequest assembles a request (default limit, deduped tags)", () => {
    const req = buildPromotionRequest(resolvePlacement("space_header"), {
      viewerPubkey: VIEWER,
      spaceId: "lounge",
      tags: ["a", "a", "", "b"],
    });
    expect(req.placement.type).toBe("space_header");
    expect(req.viewerPubkey).toBe(VIEWER);
    expect(req.spaceId).toBe("lounge");
    expect(req.tags).toEqual(["a", "b"]); // deduped, empties dropped
    expect(req.limit).toBe(1); // default
  });

  it("buildPromotionRequest floors a negative limit at 0", () => {
    const req = buildPromotionRequest(resolvePlacement("space_header"), { limit: -3 });
    expect(req.limit).toBe(0);
  });

  it("3. filterPromotionContext drops ids irrelevant to the placement", () => {
    const raw = buildPromotionRequest(resolvePlacement("space_header"), {
      spaceId: "lounge",
      threadId: "t1",
      chatId: "c1",
      productId: "p1",
    });
    const filtered = filterPromotionContext(raw);
    expect(filtered.spaceId).toBe("lounge"); // kept for a space slot
    expect(filtered.threadId).toBeUndefined();
    expect(filtered.chatId).toBeUndefined();
    expect(filtered.productId).toBeUndefined();
  });

  it("filterPromotionContext keeps spaceId + threadId for a thread slot", () => {
    const raw = buildPromotionRequest(resolvePlacement("thread_inline"), {
      spaceId: "lounge",
      threadId: "t1",
      productId: "p1",
    });
    const filtered = filterPromotionContext(raw);
    expect(filtered.spaceId).toBe("lounge");
    expect(filtered.threadId).toBe("t1");
    expect(filtered.productId).toBeUndefined();
  });

  it("filterPromotionContext drops all entity ids for a search slot", () => {
    const raw = buildPromotionRequest(resolvePlacement("search_result"), {
      spaceId: "lounge",
      threadId: "t1",
      tags: ["query"],
    });
    const filtered = filterPromotionContext(raw);
    expect(filtered.spaceId).toBeUndefined();
    expect(filtered.threadId).toBeUndefined();
    expect(filtered.tags).toEqual(["query"]);
  });

  it("canShowPromotion gates on a positive limit only", () => {
    const base = buildPromotionRequest(resolvePlacement("space_header"), { limit: 2 });
    expect(canShowPromotion(base)).toBe(true);
    expect(canShowPromotion({ ...base, limit: 0 })).toBe(false);
  });

  it("4. does not mutate its inputs", () => {
    const raw: PromotionRequest = buildPromotionRequest(
      resolvePlacement("chat_header"),
      { spaceId: "lounge", chatId: "c1", productId: "p1", tags: ["x", "x"] },
    );
    const snapshot = JSON.stringify(raw);
    filterPromotionContext(raw);
    canShowPromotion(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });
});
