import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_261_nostr_board_field_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import validatedEventSource from "../src/desktop/fedos_validated_nostr_event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import postModuleSource from "../src/board/fedos_board_post.ts?raw";

/**
 * Secure Runtime Alpha 261 -- "Nostr Board Field Inventory": Stage 1 of
 * the Nostr Canonical Board Adapter Arc (Alpha 261-270). Review only.
 * Confirms the field mapping table lists every field of both source
 * types and classifies each correctly.
 */
describe("Secure Runtime Alpha 261 -- Nostr Board Field Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc's own mapping table covers all seven FedosValidatedNostrEvent fields", () => {
    for (const field of ["id", "pubkey", "created_at", "kind", "tags", "content", "sig"]) {
      expect(designDocSource).toContain(`\`${field}\``);
    }
  });

  it("3. structural: FedosValidatedNostrEvent still has exactly the seven fields the table assumes", () => {
    const fieldMatches = [...validatedEventSource.matchAll(/^\s*readonly (\w+):/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(fieldMatches).toEqual(["id", "pubkey", "created_at", "kind", "tags", "content", "sig"]);
  });

  it("4. structural: FedosBoardPost still has exactly the eight fields the table assumes", () => {
    const fieldMatches = [...postModuleSource.matchAll(/^\s*readonly (\w+):/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(fieldMatches).toEqual([
      "id",
      "boardId",
      "threadId",
      "replyTo",
      "author",
      "body",
      "createdAt",
      "source",
    ]);
  });

  it("5. the design doc flags boardId and identityId as fields requiring explicit policy", () => {
    expect(designDocSource).toMatch(/\*\*Field requiring explicit policy\*\*/);
    expect(designDocSource).toContain("boardId");
    expect(designDocSource).toContain("identityId");
  });

  it("6. the design doc classifies kind and sig as NOT carried forward", () => {
    const occurrences = designDocSource.match(/\*\(not carried forward\)\*/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("7. the design doc cross-references Alpha 260, Alpha 259, Alpha 255, and Alpha 242", () => {
    for (const ref of [
      "secure_runtime_alpha_260_canonical_board_model_completion",
      "secure_runtime_alpha_259_protocol_neutrality_verification",
      "secure_runtime_alpha_255_canonical_board_post_model",
      "secure_runtime_alpha_242_validated_nostr_event_model",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
