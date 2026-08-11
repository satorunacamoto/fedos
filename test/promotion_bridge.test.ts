import { describe, it, expect } from "vitest";
import {
  buildChatPlacement,
  buildProductPlacement,
  buildSearchPlacement,
  buildSpacePlacement,
  buildThreadPlacement,
} from "../src/os/_legacy_prototype/promotion/bridge.js";
import type { GroupChat } from "../src/os/_legacy_prototype/chat/types.js";
import type { Product } from "../src/os/commerce/catalog/types.js";
import type { CommunitySpace } from "../src/os/_legacy_prototype/community/types.js";

const OWNER = "a".repeat(64);

function space(): CommunitySpace {
  return {
    id: "lounge",
    type: "community",
    name: "Lounge",
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [OWNER],
    admins: [],
    moderators: [],
    members: [],
  };
}

function chat(): GroupChat {
  return {
    id: "lounge-chat",
    kind: "group",
    visibility: "public",
    postPolicy: "open",
    participants: [OWNER],
    admins: [OWNER],
    spaceId: "lounge",
  };
}

function product(): Product {
  return {
    id: "prod-1",
    kind: "pdf",
    title: "Guide",
    creatorPubkey: OWNER,
    priceCents: 500,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: ["lounge"],
    linkedEventIds: [],
    assetIds: [],
  };
}

describe("promotion bridge", () => {
  it("1. thread bridge targets the thread (and space) slot", () => {
    const req = buildThreadPlacement("thread-1", "thread_inline", {
      spaceId: "lounge",
    });
    expect(req.placement.type).toBe("thread_inline");
    expect(req.placement.context).toBe("thread");
    expect(req.threadId).toBe("thread-1");
    expect(req.spaceId).toBe("lounge");
    expect(req.chatId).toBeUndefined();
  });

  it("2. space bridge targets the space slot", () => {
    const req = buildSpacePlacement(space());
    expect(req.placement.type).toBe("space_header"); // default
    expect(req.spaceId).toBe("lounge");
    expect(req.threadId).toBeUndefined();
  });

  it("3. chat bridge carries the chat's linked space", () => {
    const req = buildChatPlacement(chat(), "chat_footer");
    expect(req.placement.type).toBe("chat_footer");
    expect(req.chatId).toBe("lounge-chat");
    expect(req.spaceId).toBe("lounge"); // from chat.spaceId
  });

  it("4. product bridge adds a kind tag and links the product's space", () => {
    const req = buildProductPlacement(product(), { tags: ["promo"] });
    expect(req.placement.type).toBe("product_sidebar");
    expect(req.productId).toBe("prod-1");
    expect(req.spaceId).toBe("lounge"); // first linkedSpaceId
    expect(req.tags).toEqual(["kind:pdf", "promo"]);
  });

  it("5. search bridge carries only query tags (no entity ids)", () => {
    const req = buildSearchPlacement({ tags: ["nostr", "guide"], spaceId: "lounge" });
    expect(req.placement.type).toBe("search_result");
    expect(req.tags).toEqual(["nostr", "guide"]);
    expect(req.spaceId).toBeUndefined(); // dropped for a search slot
    expect(req.threadId).toBeUndefined();
  });

  it("6. does not mutate its inputs", () => {
    const sp = space();
    const ch = chat();
    const pr = product();
    const spSnap = JSON.stringify(sp);
    const chSnap = JSON.stringify(ch);
    const prSnap = JSON.stringify(pr);
    buildSpacePlacement(sp);
    buildChatPlacement(ch);
    buildProductPlacement(pr);
    expect(JSON.stringify(sp)).toBe(spSnap);
    expect(JSON.stringify(ch)).toBe(chSnap);
    expect(JSON.stringify(pr)).toBe(prSnap);
  });
});
