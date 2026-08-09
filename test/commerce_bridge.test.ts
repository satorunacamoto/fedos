import { describe, it, expect } from "vitest";
import {
  canPromoteProductInSpace,
  productFromSpace,
} from "../src/os/commerce/catalog/bridge.js";
import { productFromEvent } from "../src/os/commerce/catalog/adapters/nostr/bridge.js";
import type { CommunitySpace, GroupSpace } from "../src/os/_legacy_prototype/community/types.js";
import type { NostrEvent } from "../src/nostr/types.js";

const OWNER = "a".repeat(64);
const MEMBER = "c".repeat(64);
const STRANGER = "d".repeat(64);

function openCommunity(): CommunitySpace {
  return {
    id: "lounge",
    type: "community",
    name: "Lounge",
    description: "the lounge",
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [OWNER],
    admins: [],
    moderators: [],
    members: [MEMBER],
  };
}

function privateGroup(): GroupSpace {
  return {
    id: "vault",
    type: "group",
    name: "Vault",
    visibility: "private",
    membershipPolicy: "invite_only",
    postPolicy: "members",
    owners: [OWNER],
    admins: [],
    moderators: [],
    members: [MEMBER],
  };
}

function note(): NostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: OWNER,
    created_at: 1,
    kind: 1,
    tags: [],
    content: "x",
    sig: "b".repeat(128),
  };
}

describe("commerce bridge", () => {
  it("1. productFromSpace links the space and defaults from it", () => {
    const product = productFromSpace(openCommunity(), {
      id: "prod-1",
      kind: "pdf",
      priceCents: 900,
    });
    expect(product.id).toBe("prod-1");
    expect(product.kind).toBe("pdf");
    expect(product.title).toBe("Lounge");
    expect(product.description).toBe("the lounge");
    expect(product.creatorPubkey).toBe(OWNER);
    expect(product.priceCents).toBe(900);
    expect(product.status).toBe("draft");
    expect(product.visibility).toBe("public"); // mirrors the space
    expect(product.linkedSpaceIds).toEqual(["lounge"]);
    expect(product.linkedEventIds).toEqual([]);
  });

  it("2. productFromEvent links the event and defaults the creator to the author", () => {
    const product = productFromEvent(note(), { id: "prod-2", kind: "zip" });
    expect(product.id).toBe("prod-2");
    expect(product.kind).toBe("zip");
    expect(product.creatorPubkey).toBe(OWNER);
    expect(product.status).toBe("draft");
    expect(product.visibility).toBe("private");
    expect(product.linkedEventIds).toEqual(["1".repeat(64)]);
    expect(product.linkedSpaceIds).toEqual([]);
  });

  it("3. the creator may promote a product where they can post", () => {
    const space = openCommunity();
    const product = productFromSpace(space, { id: "prod-1", creatorPubkey: OWNER });
    expect(canPromoteProductInSpace(OWNER, product, space).allowed).toBe(true);
  });

  it("4. a non-creator may not promote the product", () => {
    const space = openCommunity();
    const product = productFromSpace(space, { id: "prod-1", creatorPubkey: OWNER });
    const denied = canPromoteProductInSpace(STRANGER, product, space);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/creator/);
  });

  it("5. the creator cannot promote in a space they cannot post to", () => {
    const space = privateGroup();
    // OWNER created the product but is not a poster in this (other) private space.
    const foreignSpace: GroupSpace = { ...space, owners: [STRANGER], members: [] };
    const product = productFromEvent(note(), { id: "prod-2", creatorPubkey: OWNER });
    const denied = canPromoteProductInSpace(OWNER, product, foreignSpace);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/cannot promote in space/);
  });

  it("6. does not mutate its inputs", () => {
    const space = openCommunity();
    const ev = note();
    const spaceSnap = JSON.stringify(space);
    const evSnap = JSON.stringify(ev);
    const product = productFromSpace(space, { id: "prod-1" });
    productFromEvent(ev, { id: "prod-2" });
    canPromoteProductInSpace(OWNER, product, space);
    expect(JSON.stringify(space)).toBe(spaceSnap);
    expect(JSON.stringify(ev)).toBe(evSnap);
  });
});
