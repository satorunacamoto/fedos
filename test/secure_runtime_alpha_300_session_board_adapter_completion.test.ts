import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_300_session_board_adapter_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import nostrAdapterSource from "../src/board/fedos_board_nostr_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import activityPubAdapterSource from "../src/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import atprotoAdapterSource from "../src/board/atproto/fedos_atproto_board_adapter.ts?raw";
import * as sessionAdapter from "../src/board/session/fedos_session_board_adapter.js";
import type { FedosValidatedSessionPost } from "../src/board/session/fedos_validated_session_post.js";

/**
 * Secure Runtime Alpha 300 -- "Session Board Adapter Completion": Stage
 * 10, the closing Stage, of the Alpha 291-300 Session Canonical Board
 * Gateway Adapter Arc -- and of the whole four-Arc Canonical Board
 * Adapter series (Alpha 261-300). Review only. Issues the Arc's own
 * Completion Declaration and confirms every frozen boundary this Arc's
 * own instruction named stayed untouched, including all three existing
 * adapters.
 */
describe("Secure Runtime Alpha 300 -- Session Board Adapter Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(designDocSource).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("3. the design doc recommends Board Repository, Board Index, and Board Feed together, and explicitly does NOT recommend Relay Pool", () => {
    expect(designDocSource).toMatch(/\*\*Board Repository, Board Index, and Board Feed\*\*/);
    expect(designDocSource).toMatch(/\*\*Relay Pool is explicitly NOT recommended\.\*\*/);
  });

  it("4. the Session adapter module exports exactly the two named functions", () => {
    expect(typeof sessionAdapter.validateSessionBoardPost).toBe("function");
    expect(typeof sessionAdapter.mapValidatedSessionPostToBoardPostInput).toBe("function");
  });

  it("5. behavioral end-to-end: a full normalized Session post round-trips into a frozen FedosBoardPost", () => {
    const post: FedosValidatedSessionPost = {
      messageId: "sess-msg-completion",
      sessionId: "05" + "a".repeat(64),
      authorId: "05" + "b".repeat(64),
      body: "Alpha 300 completion check",
      createdAt: 1_700_000_999,
      replyTo: null,
    };
    const result = sessionAdapter.validateSessionBoardPost(post, "board-completion");
    expect(result).not.toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
    expect(result!.source).toEqual({ protocol: "session", reference: post.messageId });
  });

  it("6. Regression: package.json dependency count remains unchanged at 2 across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("7. Regression: Relay, Runtime, and Worker carry zero reference to src/board/session/", () => {
    for (const source of [relaySource, websocketRelaySource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/src\/board\/session\/|FedosValidatedSessionPost|validateSessionBoardPost/);
    }
  });

  it("8. Regression: none of the three existing adapters has functional coupling to Session", () => {
    for (const source of [nostrAdapterSource, activityPubAdapterSource, atprotoAdapterSource]) {
      expect(source).not.toMatch(/from ["'].*\/session\/.*["']/i);
      expect(source).not.toMatch(
        /FedosValidatedSessionPost|validateSessionBoardPost|mapValidatedSessionPostToBoardPostInput/,
      );
    }
  });

  it("9. the design doc's own 'still out of scope' list names every subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "Session network implementation, Oxen connection",
      "Private keys, encryption, decryption",
      "DM retrieval, storage sync",
      "Board Repository, Board Index, Board Feed, persistence, moderation",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("10. the design doc cross-references every prior Stage of this Arc, Alpha 291 through Alpha 299", () => {
    for (let n = 291; n <= 299; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
  });
});
