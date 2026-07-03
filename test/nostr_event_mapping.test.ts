import { describe, it, expect } from "vitest";
import {
  boardToNostrCandidate,
  marketplaceListingToNostrCandidate,
  moderationSignalToNostrCandidate,
  socialEventToNostrCandidate,
} from "../src/federation/nostr_mapping.js";
import { NOSTR_EVENT_CANDIDATE_KINDS } from "../src/federation/types.js";
import type { ModerationSignalInput } from "../src/federation/types.js";
import type { SocialEventDescriptor } from "../src/social/event.js";
import type { BoardDescriptor } from "../src/social/board.js";
import type { MarketplaceListingDescriptor } from "../src/marketplace/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrMappingSource from "../src/federation/nostr_mapping.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import federationTypesSource from "../src/federation/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const mappingSources = [nostrMappingSource, federationTypesSource].join("\n");
const runtimeSources = [runtimeSource, runtimeTypesSource].join("\n");

const publicPost: SocialEventDescriptor = {
  id: "evt-1",
  kind: "post",
  visibility: "public",
  authorRef: "author-1",
  createdAt: 1000,
  metadata: { note: "sample" },
};

describe("socialEventToNostrCandidate", () => {
  it("1. maps a public post to a text_note_placeholder candidate", () => {
    const decision = socialEventToNostrCandidate(publicPost);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
    expect(decision.candidate?.kindLabel).toBe("text_note_placeholder");
    expect(decision.candidate?.pubkeyRef).toBe("author-1");
  });

  it("2. maps a public reply to a reply_placeholder candidate", () => {
    const reply: SocialEventDescriptor = { ...publicPost, kind: "reply" };
    const decision = socialEventToNostrCandidate(reply);
    expect(decision.allowed).toBe(true);
    expect(decision.candidate?.kindLabel).toBe("reply_placeholder");
  });

  it("3. rejects chat activity unconditionally, even when public", () => {
    const chat: SocialEventDescriptor = { ...publicPost, kind: "chat" };
    const decision = socialEventToNostrCandidate(chat);
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("rejected");
    expect(decision.candidate).toBeUndefined();
  });

  it("4. rejects non-public visibility (followers/community/private_placeholder)", () => {
    for (const visibility of ["followers", "community", "private_placeholder"] as const) {
      const decision = socialEventToNostrCandidate({ ...publicPost, visibility });
      expect(decision.allowed).toBe(false);
      expect(decision.candidate).toBeUndefined();
    }
  });

  it("5. drops/rejects sensitive metadata (payment/entitlement/dm/buyer/etc.)", () => {
    for (const key of ["paymentId", "entitlementRef", "dmBody", "buyerRef", "downloadUrl"]) {
      const decision = socialEventToNostrCandidate({
        ...publicPost,
        metadata: { [key]: "x" },
      });
      expect(decision.allowed).toBe(false);
      expect(decision.state).toBe("rejected");
    }
  });

  it("6. contentPreview is a fixed placeholder, never real content", () => {
    const decision = socialEventToNostrCandidate(publicPost);
    expect(decision.candidate?.contentPreview).toMatch(/placeholder preview/);
  });

  it("7. does not mutate its input", () => {
    const snapshot = JSON.stringify(publicPost);
    socialEventToNostrCandidate(publicPost);
    expect(JSON.stringify(publicPost)).toBe(snapshot);
  });
});

describe("boardToNostrCandidate", () => {
  const board: BoardDescriptor = {
    id: "board-1",
    kind: "thread",
    title: "General Discussion",
    topics: [{ id: "t1", name: "General" }],
    categories: [{ id: "c1", name: "Discussion" }],
  };

  it("8. maps a board/thread to a candidate carrying the title and topic/category tags", () => {
    const decision = boardToNostrCandidate(board);
    expect(decision.allowed).toBe(true);
    expect(decision.candidate?.kindLabel).toBe("text_note_placeholder");
    expect(decision.candidate?.contentPreview).toBe("General Discussion");
    expect(decision.candidate?.tags).toContainEqual(["d", "board-1"]);
    expect(decision.candidate?.tags).toContainEqual(["t", "General"]);
    expect(decision.candidate?.tags).toContainEqual(["t", "Discussion"]);
  });

  it("9. maps a 'test' kind board to a test_placeholder candidate", () => {
    const decision = boardToNostrCandidate({ ...board, kind: "test" });
    expect(decision.candidate?.kindLabel).toBe("test_placeholder");
  });

  it("10. rejects a sensitive title/topic/category label", () => {
    expect(boardToNostrCandidate({ ...board, title: "my secret key" }).allowed).toBe(false);
    expect(
      boardToNostrCandidate({ ...board, topics: [{ id: "t1", name: "payment info" }] }).allowed,
    ).toBe(false);
    expect(
      boardToNostrCandidate({ ...board, categories: [{ id: "c1", name: "dm archive" }] }).allowed,
    ).toBe(false);
  });

  it("11. does not mutate its input", () => {
    const snapshot = JSON.stringify(board);
    boardToNostrCandidate(board);
    expect(JSON.stringify(board)).toBe(snapshot);
  });
});

describe("marketplaceListingToNostrCandidate", () => {
  const listing: MarketplaceListingDescriptor = {
    idRef: "listing-1",
    creatorRef: "creator-1",
    kind: "digital_product_placeholder",
    visibility: "public",
    metadata: { note: "sample" },
  };

  it("12. maps a public listing to a marketplace_announcement_placeholder candidate", () => {
    const decision = marketplaceListingToNostrCandidate(listing);
    expect(decision.allowed).toBe(true);
    expect(decision.candidate?.kindLabel).toBe("marketplace_announcement_placeholder");
    expect(decision.candidate?.pubkeyRef).toBe("creator-1");
    expect(decision.candidate?.tags).toContainEqual(["d", "listing-1"]);
    expect(decision.candidate?.tags).toContainEqual(["p", "creator-1"]);
  });

  it("13. accepts unlisted visibility, rejects private", () => {
    expect(marketplaceListingToNostrCandidate({ ...listing, visibility: "unlisted" }).allowed).toBe(
      true,
    );
    expect(marketplaceListingToNostrCandidate({ ...listing, visibility: "private" }).allowed).toBe(
      false,
    );
  });

  it("14. never carries a price/payment/checkout/download/signed-URL field", () => {
    const decision = marketplaceListingToNostrCandidate(listing);
    const json = JSON.stringify(decision);
    expect(json).not.toMatch(/price|checkout|invoice|download|signedUrl/i);
  });

  it("15. drops/rejects sensitive metadata", () => {
    const decision = marketplaceListingToNostrCandidate({
      ...listing,
      metadata: { buyerRef: "someone", checkoutId: "abc" },
    });
    expect(decision.allowed).toBe(false);
  });

  it("16. does not mutate its input", () => {
    const snapshot = JSON.stringify(listing);
    marketplaceListingToNostrCandidate(listing);
    expect(JSON.stringify(listing)).toBe(snapshot);
  });
});

describe("moderationSignalToNostrCandidate", () => {
  const signal: ModerationSignalInput = {
    idRef: "mod-1",
    targetRef: "target-1",
    action: "hide_placeholder",
    reason: "off-topic",
    createdAt: 1000,
  };

  it("17. maps a clean moderation signal to a moderation_signal_placeholder candidate", () => {
    const decision = moderationSignalToNostrCandidate(signal);
    expect(decision.allowed).toBe(true);
    expect(decision.candidate?.kindLabel).toBe("moderation_signal_placeholder");
    expect(decision.candidate?.tags).toContainEqual(["fedos-target", "target-1"]);
  });

  it("18. rejects a sensitive reason or metadata", () => {
    expect(
      moderationSignalToNostrCandidate({ ...signal, reason: "payment dispute" }).allowed,
    ).toBe(false);
    expect(
      moderationSignalToNostrCandidate({ ...signal, metadata: { buyerRef: "x" } }).allowed,
    ).toBe(false);
  });

  it("19. does not mutate its input", () => {
    const snapshot = JSON.stringify(signal);
    moderationSignalToNostrCandidate(signal);
    expect(JSON.stringify(signal)).toBe(snapshot);
  });
});

describe("NostrEventCandidate never carries actual Nostr event fields", () => {
  it("20. every candidate-kind label is a placeholder label", () => {
    for (const kind of NOSTR_EVENT_CANDIDATE_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });

  it("21. no candidate ever carries an id/sig/real pubkey field", () => {
    const decisions = [
      socialEventToNostrCandidate(publicPost),
      boardToNostrCandidate({ id: "b1", kind: "board", title: "Title" }),
      marketplaceListingToNostrCandidate({
        idRef: "l1",
        creatorRef: "c1",
        kind: "test_placeholder",
        visibility: "public",
      }),
      moderationSignalToNostrCandidate({ action: "mute_placeholder" }),
    ];
    for (const decision of decisions) {
      expect(decision.candidate).not.toHaveProperty("id");
      expect(decision.candidate).not.toHaveProperty("sig");
      expect(decision.candidate).not.toHaveProperty("privateKey");
      expect(decision.candidate).not.toHaveProperty("pubkey");
    }
  });

  it("22. types declare no id/sig/privateKey field on NostrEventCandidate", () => {
    expect(federationTypesSource).not.toMatch(
      /interface\s+NostrEventCandidate[\s\S]{0,500}\breadonly\s+id\s*[?:]/,
    );
    expect(federationTypesSource).not.toMatch(
      /interface\s+NostrEventCandidate[\s\S]{0,500}\breadonly\s+sig\s*[?:]/,
    );
    expect(federationTypesSource).not.toMatch(
      /interface\s+NostrEventCandidate[\s\S]{0,500}\breadonly\s+privateKey\s*[?:]/,
    );
  });

  it("23. never throws", () => {
    expect(() => socialEventToNostrCandidate(publicPost)).not.toThrow();
    expect(() => boardToNostrCandidate({ kind: "test", title: "t" })).not.toThrow();
    expect(() =>
      marketplaceListingToNostrCandidate({
        kind: "test_placeholder",
        visibility: "public",
      }),
    ).not.toThrow();
    expect(() => moderationSignalToNostrCandidate({ action: "filter_placeholder" })).not.toThrow();
  });
});

describe("Nostr mapping boundary is pure and free of real network/signing", () => {
  it("24. imports no relay/WebSocket/HTTP/signing/crypto library", () => {
    const importLines = mappingSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = [
      "ws",
      "websocket",
      "node-fetch",
      "node:http",
      "node:https",
      "@noble/curves",
      "@noble/hashes",
      "secp256k1",
    ];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it("25. issues no fetch, opens no WebSocket, and calls no signing/serialization API", () => {
    expect(mappingSources).not.toMatch(/\bfetch\s*\(/);
    expect(mappingSources).not.toMatch(/\bnew\s+WebSocket\s*\(/);
    expect(mappingSources).not.toMatch(/\bsignEvent\s*\(|\bschnorr\.sign\s*\(|\bsign\s*\(/);
    expect(mappingSources).not.toMatch(/nip44\s*\(|nip17\s*\(|nip0?4\s*\(/i);
    expect(mappingSources).not.toMatch(/JSON\.stringify\s*\(\s*\[\s*["']EVENT["']/);
  });

  it("26. does not import PaymentProvider, EntitlementProvider, StorageBackend, or CryptoProvider", () => {
    expect(mappingSources).not.toMatch(/from\s+['"].*payment\//);
    expect(mappingSources).not.toMatch(/from\s+['"].*creator\//);
    expect(mappingSources).not.toMatch(/from\s+['"].*storage\//);
    expect(mappingSources).not.toMatch(/from\s+['"].*crypto\//);
    expect(mappingSources).not.toMatch(
      /:\s*(PaymentProvider|EntitlementProvider|StorageBackend|CryptoProvider)\b/,
    );
  });

  it("27. Runtime source does not select or call the Nostr mapping functions", () => {
    expect(runtimeSources).not.toMatch(
      /socialEventToNostrCandidate|boardToNostrCandidate|marketplaceListingToNostrCandidate|moderationSignalToNostrCandidate/,
    );
    expect(runtimeSources).not.toMatch(/from\s+['"].*nostr_mapping\//);
  });

  it("28. Worker source does not select or call the Nostr mapping functions", () => {
    expect(workerSource).not.toMatch(
      /socialEventToNostrCandidate|boardToNostrCandidate|marketplaceListingToNostrCandidate|moderationSignalToNostrCandidate/,
    );
    expect(workerSource).not.toMatch(/from\s+['"].*nostr_mapping\//);
  });
});
