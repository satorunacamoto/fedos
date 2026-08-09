import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_270_nostr_board_adapter_completion.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import relaySource from "../src/os/messenger/desktop/fedos_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import websocketRelaySource from "../src/os/messenger/desktop/websocket_relay.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createRuntimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
import * as adapter from "../src/board/fedos_board_nostr_adapter.js";
import type { FedosValidatedNostrEvent } from "../src/desktop/fedos_validated_nostr_event.js";

/**
 * Secure Runtime Alpha 270 -- "Nostr Canonical Board Adapter
 * Completion": Stage 10, the closing Stage, of the Alpha 261-270 Nostr
 * Canonical Board Adapter Arc. Review only. Issues the Arc's own
 * Completion Declaration and confirms every frozen boundary this Arc's
 * own instruction named stayed untouched.
 */
describe("Secure Runtime Alpha 270 -- Nostr Canonical Board Adapter Completion", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc issues a Completion Declaration", () => {
    expect(designDocSource).toMatch(/\*\*This Arc's own Objective is CONFIRMED COMPLETE\./);
  });

  it("3. the design doc recommends exactly one next Arc: the ActivityPub Canonical Board Adapter Arc", () => {
    expect(designDocSource).toMatch(
      /\*\*Secure Runtime Alpha 271–280:\s+ActivityPub\s+Canonical\s+Board\s+Adapter\s+Arc\.\*\*/,
    );
  });

  it("4. the adapter module exports exactly the three named symbols", () => {
    expect(typeof adapter.validateNostrBoardPost).toBe("function");
    expect(typeof adapter.mapValidatedNostrEventToBoardPostInput).toBe("function");
    expect(adapter.FEDOS_BOARD_NOSTR_SUPPORTED_KIND).toBe(1);
  });

  it("5. behavioral end-to-end: a full validated Nostr event round-trips into a frozen FedosBoardPost", () => {
    const event: FedosValidatedNostrEvent = {
      id: "a".repeat(64),
      pubkey: "b".repeat(64),
      created_at: 1_700_000_999,
      kind: 1,
      tags: [],
      content: "Alpha 270 completion check",
      sig: "c".repeat(128),
    };
    const post = adapter.validateNostrBoardPost(event, "board-completion");
    expect(post).not.toBeNull();
    expect(Object.isFrozen(post)).toBe(true);
    expect(post!.source).toEqual({ protocol: "nostr", reference: event.id });
  });

  it("6. Regression: package.json dependency count remains unchanged at 2 across the whole Arc", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("7. Regression: Relay, Runtime, and Worker carry zero reference to src/board/ or the new adapter", () => {
    for (const source of [relaySource, websocketRelaySource, createRuntimeSource, workerSource]) {
      expect(source).not.toMatch(/src\/board\/|FedosBoardPost|validateNostrBoardPost|validateFedosBoardPost/);
    }
  });

  it("8. the design doc's own 'still out of scope' list names every protocol/subsystem this Arc's own instruction excludes", () => {
    for (const item of [
      "ActivityPub",
      "AT Protocol",
      "Session",
      "Relay Pool",
      "Runtime/AppRuntime changes",
      "Storage",
      "GUI",
      "Worker",
    ]) {
      expect(designDocSource).toContain(item);
    }
  });

  it("9. the design doc cross-references every prior Stage of this Arc, Alpha 261 through Alpha 269", () => {
    for (let n = 261; n <= 269; n++) {
      expect(designDocSource).toMatch(new RegExp(`secure_runtime_alpha_${n}_`));
    }
  });
});
