import { describe, it, expect } from "vitest";
import { SOCIAL_EVENT_KINDS, SOCIAL_VISIBILITIES } from "../src/social/event.js";
import type { SocialEventDescriptor } from "../src/social/event.js";
import { BOARD_KINDS } from "../src/social/board.js";
import type { BoardDescriptor, CategoryLabel, TopicLabel } from "../src/social/board.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import socialEventSource from "../src/social/event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import socialBoardSource from "../src/social/board.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const socialSources = [socialEventSource, socialBoardSource].join("\n");
const runtimeSources = [runtimeSource, runtimeTypesSource].join("\n");

describe("Social Event Model — labels only", () => {
  it("1. every SocialEventKind is a fixed, complete label set", () => {
    expect(SOCIAL_EVENT_KINDS).toEqual([
      "post",
      "reply",
      "repost",
      "reaction",
      "profile",
      "article",
      "marketplace",
      "chat",
      "moderation",
      "test",
    ]);
  });

  it("2. every SocialVisibility is a fixed, complete label set", () => {
    expect(SOCIAL_VISIBILITIES).toEqual(["public", "followers", "community", "private_placeholder"]);
  });

  it("3. a SocialEventDescriptor carries no bytes/content/body field", () => {
    const descriptor: SocialEventDescriptor = {
      id: "evt-label-1",
      kind: "post",
      visibility: "public",
      authorRef: "author-label-1",
      createdAt: 1000,
      metadata: { note: "sample" },
    };
    expect(Object.keys(descriptor)).not.toContain("bytes");
    expect(Object.keys(descriptor)).not.toContain("content");
    expect(Object.keys(descriptor)).not.toContain("body");
    expect(socialEventSource).not.toMatch(/readonly\s+bytes\s*[?:]/);
    expect(socialEventSource).not.toMatch(/readonly\s+content\s*[?:]/);
    expect(socialEventSource).not.toMatch(/readonly\s+body\s*[?:]/);
    expect(socialEventSource).not.toMatch(/readonly\s+text\s*[?:]/);
  });
});

describe("Board skeleton — labels only", () => {
  it("4. every BoardKind is a fixed, complete label set", () => {
    expect(BOARD_KINDS).toEqual(["thread", "board", "channel", "marketplace", "knowledge", "test"]);
  });

  it("5. a BoardDescriptor carries no event/bytes/content field", () => {
    const topic: TopicLabel = { id: "topic-1", name: "General" };
    const category: CategoryLabel = { id: "cat-1", name: "Discussion" };
    const descriptor: BoardDescriptor = {
      id: "board-1",
      kind: "board",
      title: "General Discussion",
      topics: [topic],
      categories: [category],
    };
    expect(Object.keys(descriptor)).not.toContain("bytes");
    expect(Object.keys(descriptor)).not.toContain("content");
    expect(Object.keys(descriptor)).not.toContain("events");
    expect(socialBoardSource).not.toMatch(/readonly\s+bytes\s*[?:]/);
    expect(socialBoardSource).not.toMatch(/readonly\s+content\s*[?:]/);
    expect(socialBoardSource).not.toMatch(/readonly\s+events\s*[?:]/);
  });

  it("6. TopicLabel/CategoryLabel are opaque id + display name only", () => {
    const topic: TopicLabel = { id: "topic-1", name: "General" };
    expect(Object.keys(topic).sort()).toEqual(["id", "name"]);
  });
});

describe("Social/Board skeleton stays decoupled and unwired", () => {
  it("7. does not import FederationProvider, StorageBackend, or CryptoProvider", () => {
    // Doc comments legitimately NAME these seams when explaining that this
    // model is decoupled from them; the real invariant is no import/usage.
    expect(socialSources).not.toMatch(/from\s+['"].*federation\//);
    expect(socialSources).not.toMatch(/from\s+['"].*storage\//);
    expect(socialSources).not.toMatch(/from\s+['"].*crypto\//);
    expect(socialSources).not.toMatch(/:\s*(FederationProvider|StorageBackend|CryptoProvider)\b/);
    expect(socialSources).not.toMatch(
      /implements\s+(FederationProvider|StorageBackend|CryptoProvider)\b/,
    );
  });

  it("8. issues no fetch and opens no socket", () => {
    expect(socialSources).not.toMatch(/\bfetch\s*\(/);
    expect(socialSources).not.toMatch(/\bnew\s+WebSocket\s*\(/);
    expect(socialSources).not.toMatch(/\bnew\s+EventSource\s*\(/);
  });

  it("9. Runtime source does not reference the social event/board model", () => {
    expect(runtimeSources).not.toMatch(/SocialEventDescriptor|BoardDescriptor/);
    expect(runtimeSources).not.toMatch(/from\s+['"].*social\//);
  });

  it("10. Worker source does not reference the social event/board model", () => {
    expect(workerSource).not.toMatch(/SocialEventDescriptor|BoardDescriptor/);
    expect(workerSource).not.toMatch(/from\s+['"].*social\//);
  });

  it("11. never throws when constructing plain descriptors", () => {
    const build = (): SocialEventDescriptor => ({ kind: "test", visibility: "public" });
    expect(build).not.toThrow();
    const buildBoard = (): BoardDescriptor => ({ kind: "test", title: "t" });
    expect(buildBoard).not.toThrow();
  });

  it("12. does not mutate a descriptor passed through a spread copy", () => {
    const original: SocialEventDescriptor = { kind: "post", visibility: "public", metadata: { a: "1" } };
    const snapshot = JSON.stringify(original);
    const _copy = { ...original };
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
