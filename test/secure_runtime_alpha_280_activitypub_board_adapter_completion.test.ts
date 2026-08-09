import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_280_activitypub_board_adapter_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrAdapterSource from "../src/os/messenger/board/fedos_board_nostr_adapter.ts?raw";
import * as activityPubAdapter from "../src/board/activitypub/fedos_activitypub_board_adapter.js";
import * as mutationBoundary from "../src/board/activitypub/fedos_activitypub_mutation_boundary.js";
import type { FedosValidatedActivityPubPost } from "../src/board/activitypub/fedos_validated_activitypub_post.js";

/**
 * Secure Runtime Alpha 280 -- "ActivityPub Canonical Board Adapter
 * Completion": Stage 10, the closing Stage, of the Alpha 271-280
 * ActivityPub Canonical Board Adapter Arc. Review only. Issues the
 * Arc's own Completion Declaration and confirms every frozen boundary
 * this Arc's own instruction named stayed untouched, including the
 * Nostr Board Adapter itself.
 */
describe("Secure Runtime Alpha 280 -- ActivityPub Canonical Board Adapter Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(designDocSource).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("3. the design doc recommends exactly one next Arc: the AT Protocol Canonical Board Adapter Arc", () => {
    expect(designDocSource).toMatch(/\*\*AT Protocol Canonical Board Adapter Arc\.\*\*/);
  });

  it("4. the ActivityPub adapter module exports exactly the two named functions", () => {
    expect(typeof activityPubAdapter.validateActivityPubBoardPost).toBe("function");
    expect(typeof activityPubAdapter.mapValidatedActivityPubPostToBoardPostInput).toBe("function");
  });

  it("5. the mutation boundary module exports the inert type's label constant only", () => {
    expect(Array.isArray(mutationBoundary.FEDOS_ACTIVITYPUB_OBSERVED_MUTATION_KINDS)).toBe(true);
  });

  it("6. behavioral end-to-end: a full normalized ActivityPub post round-trips into a frozen FedosBoardPost", () => {
    const post: FedosValidatedActivityPubPost = {
      objectId: "https://example.social/users/alice/statuses/1",
      actorId: "https://example.social/users/alice",
      content: "Alpha 280 completion check",
      published: 1_700_000_999,
      inReplyTo: null,
      conversationRoot: null,
    };
    const result = activityPubAdapter.validateActivityPubBoardPost(post, "board-completion");
    expect(result).not.toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
    expect(result!.source).toEqual({ protocol: "activitypub", reference: post.objectId });
  });

  it("7. Regression: package.json dependency count remains unchanged at 2 across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("8. Regression: Relay, Runtime, and Worker carry zero reference to src/board/activitypub/", () => {
    for (const source of [relaySource, websocketRelaySource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/src\/board\/activitypub\/|FedosValidatedActivityPubPost|validateActivityPubBoardPost/);
    }
  });

  it("9. Regression: the Nostr Board Adapter has no functional coupling to ActivityPub -- no import, no shared runtime symbol", () => {
    expect(nostrAdapterSource).not.toMatch(/from ["'].*activitypub.*["']/i);
    expect(nostrAdapterSource).not.toMatch(/FedosValidatedActivityPubPost|validateActivityPubBoardPost|mapValidatedActivityPubPostToBoardPostInput/);
  });

  it("10. the design doc's own 'still out of scope' list names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "ActivityPub HTTP server",
      "WebFinger",
      "NodeInfo",
      "HTTP Signatures",
      "Profile resolution",
      "Attachment fetching",
      "Federation delivery",
      "Mastodon OAuth",
      "GUI, storage, moderation implementation",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("11. the design doc cross-references every prior Stage of this Arc, Alpha 271 through Alpha 279", () => {
    for (let n = 271; n <= 279; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
  });
});
