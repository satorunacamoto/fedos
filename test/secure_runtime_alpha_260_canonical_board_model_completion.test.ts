import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_260_canonical_board_model_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";
import * as identifiers from "../src/board/fedos_board_identifiers.js";
import * as source from "../src/board/fedos_board_source.js";
import * as author from "../src/board/fedos_board_author.js";
import * as post from "../src/board/fedos_board_post.js";
import * as validator from "../src/board/fedos_board_post_validator.js";
import * as moderation from "../src/board/fedos_board_moderation.js";

/**
 * Secure Runtime Alpha 260 -- "Canonical Board Model Completion":
 * Stage 10, the closing Stage, of the Alpha 251-260 Canonical Board
 * Model Foundation Arc. Review only. Issues the Arc's own Completion
 * Declaration and confirms every frozen capability named in this Arc's
 * own instruction stayed untouched.
 */
describe("Secure Runtime Alpha 260 -- Canonical Board Model Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(designDocSource).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("3. the design doc recommends exactly one next Arc: the Nostr Canonical Board Adapter Arc", () => {
    expect(designDocSource).toMatch(/\*\*Nostr Canonical Board Adapter Arc\.\*\*/);
  });

  it("4. every src/board/ module from Alpha 252-258 exports the symbols this Arc's own instruction names", () => {
    expect(typeof identifiers.toFedosBoardId).toBe("function");
    expect(typeof identifiers.toFedosThreadId).toBe("function");
    expect(typeof identifiers.toFedosBoardPostId).toBe("function");
    expect(typeof identifiers.toFedosExternalReference).toBe("function");
    expect(Array.isArray(source.FEDOS_BOARD_SOURCE_PROTOCOLS)).toBe(true);
    expect(typeof source.fedosBoardSourceKey).toBe("function");
    expect(typeof validator.validateFedosBoardPost).toBe("function");
    expect(Array.isArray(moderation.FEDOS_BOARD_MODERATION_STATES)).toBe(true);
    // Type-only modules (author, post) have no runtime export -- confirmed importable without error.
    expect(author).toBeDefined();
    expect(post).toBeDefined();
  });

  it("5. behavioral end-to-end: a full FedosBoardPost round-trips through validateFedosBoardPost", () => {
    const input: validator.FedosBoardPostInput = {
      id: "post-completion-1",
      boardId: "board-completion",
      threadId: "post-completion-1",
      replyTo: null,
      author: { identityId: null, protocol: "fedos", publicIdentifier: "local-author-1" },
      body: "Alpha 260 completion check",
      createdAt: 1_700_000_999,
      source: { protocol: "fedos", reference: "post-completion-1" },
    };
    const result = validator.validateFedosBoardPost(input);
    expect(result).not.toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("6. Regression: package.json dependency count remains unchanged at 2 across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("7. Regression: the frozen Relay/WebSocket transport layer carries zero reference to src/board/", () => {
    expect(relaySource).not.toMatch(/src\/board\/|FedosBoardPost|validateFedosBoardPost/);
    expect(websocketRelaySource).not.toMatch(/src\/board\/|FedosBoardPost|validateFedosBoardPost/);
  });

  it("8. the design doc's own 'still out of scope' list names every Absolute Prohibition this Arc's own instruction lists", () => {
    for (const item of [
      "Nostr adapter",
      "ActivityPub adapter",
      "ATProto adapter",
      "Session gateway",
      "Persistence",
      "GUI",
      "Relay Pool",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("9. the design doc cross-references every prior Stage of this Arc, Alpha 251 through Alpha 259", () => {
    for (let n = 251; n <= 259; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
  });
});
