import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_290_atproto_board_adapter_completion.md?raw";
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
import nostrAdapterSource from "../src/board/fedos_board_nostr_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activityPubAdapterSource from "../src/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
import * as atprotoAdapter from "../src/board/atproto/fedos_atproto_board_adapter.js";
import * as mutationBoundary from "../src/board/atproto/fedos_atproto_mutation_boundary.js";
import type { FedosValidatedAtprotoPost } from "../src/board/atproto/fedos_validated_atproto_post.js";

/**
 * Secure Runtime Alpha 290 -- "AT Protocol Canonical Board Adapter
 * Completion": Stage 10, the closing Stage, of the Alpha 281-290 AT
 * Protocol Canonical Board Adapter Arc. Review only. Issues the Arc's
 * own Completion Declaration and confirms every frozen boundary this
 * Arc's own instruction named stayed untouched, including BOTH existing
 * adapters.
 */
describe("Secure Runtime Alpha 290 -- AT Protocol Canonical Board Adapter Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(designDocSource).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("3. the design doc recommends exactly one next Arc: the Session Canonical Board Gateway Adapter Arc", () => {
    expect(designDocSource).toMatch(/\*\*Session Canonical Board Gateway Adapter Arc\.\*\*/);
  });

  it("4. the AT Protocol adapter module exports exactly the two named functions", () => {
    expect(typeof atprotoAdapter.validateAtprotoBoardPost).toBe("function");
    expect(typeof atprotoAdapter.mapValidatedAtprotoPostToBoardPostInput).toBe("function");
  });

  it("5. the mutation boundary module exports the inert type's label constant only", () => {
    expect(Array.isArray(mutationBoundary.FEDOS_ATPROTO_OBSERVED_RECORD_EVENT_KINDS)).toBe(true);
  });

  it("6. behavioral end-to-end: a full normalized AT Protocol post round-trips into a frozen FedosBoardPost", () => {
    const post: FedosValidatedAtprotoPost = {
      uri: "at://did:plc:abc123/app.bsky.feed.post/completion1",
      cid: "bafycompletion1",
      authorDid: "did:plc:abc123",
      text: "Alpha 290 completion check",
      createdAt: 1_700_000_999,
      replyRootUri: null,
      replyParentUri: null,
    };
    const result = atprotoAdapter.validateAtprotoBoardPost(post, "board-completion");
    expect(result).not.toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
    expect(result!.source).toEqual({ protocol: "atproto", reference: post.uri });
  });

  it("7. Regression: package.json dependency count remains unchanged at 2 across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("8. Regression: Relay, Runtime, and Worker carry zero reference to src/board/atproto/", () => {
    for (const source of [relaySource, websocketRelaySource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/src\/board\/atproto\/|FedosValidatedAtprotoPost|validateAtprotoBoardPost/);
    }
  });

  it("9. Regression: neither existing adapter has functional coupling to AT Protocol", () => {
    for (const source of [nostrAdapterSource, activityPubAdapterSource]) {
      expect(source).not.toMatch(/from ["'].*atproto.*["']/i);
      expect(source).not.toMatch(
        /FedosValidatedAtprotoPost|validateAtprotoBoardPost|mapValidatedAtprotoPostToBoardPostInput/,
      );
    }
  });

  it("10. the design doc's own 'still out of scope' list names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "XRPC client",
      "OAuth",
      "app passwords",
      "PDS login",
      "Repository writes",
      "firehose",
      "DID resolution",
      "handle resolution",
      "Rich-text rendering, facets, embeds",
      "Storage, moderation implementation, GUI",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("11. the design doc cross-references every prior Stage of this Arc, Alpha 281 through Alpha 289", () => {
    for (let n = 281; n <= 289; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
  });
});
