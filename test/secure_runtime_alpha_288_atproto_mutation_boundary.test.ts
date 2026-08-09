import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_288_atproto_mutation_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import mutationBoundarySource from "../src/os/messenger/board/atproto/fedos_atproto_mutation_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/os/messenger/board/atproto/fedos_atproto_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import postModelSource from "../src/os/messenger/board/atproto/fedos_validated_atproto_post.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPostSource from "../src/os/messenger/board/fedos_board_post.ts?raw";
import {
  FEDOS_ATPROTO_OBSERVED_RECORD_EVENT_KINDS,
  type FedosAtprotoRecordObservation,
} from "../src/board/atproto/fedos_atproto_mutation_boundary.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 288 -- "Record Update / Delete Boundary
 * Review": Stage 8 of the AT Protocol Canonical Board Adapter Arc.
 * Adds src/board/atproto/fedos_atproto_mutation_boundary.ts -- types
 * and label constants only, kept separate from FedosBoardPost, never
 * wired into the Board Adapter, carrying both uri and cid (unlike
 * ActivityPub's equivalent type).
 */
describe("Secure Runtime Alpha 288 -- Record Update / Delete Boundary Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. FEDOS_ATPROTO_OBSERVED_RECORD_EVENT_KINDS carries exactly the three named kinds, all _placeholder-suffixed", () => {
    expect([...FEDOS_ATPROTO_OBSERVED_RECORD_EVENT_KINDS].sort()).toEqual(
      ["deleted_record_placeholder", "initial_record_placeholder", "updated_record_placeholder"].sort(),
    );
    for (const kind of FEDOS_ATPROTO_OBSERVED_RECORD_EVENT_KINDS) {
      expect(kind.endsWith("_placeholder")).toBe(true);
    }
  });

  it("3. structural: no boolean deleted/updated/repost field anywhere IN CODE", () => {
    expect(codeOnly(mutationBoundarySource)).not.toMatch(/deleted:\s*boolean|updated:\s*boolean|repost:\s*boolean/i);
  });

  it("4. structural: this file is inert -- no function/class definition IN CODE, types and constants only", () => {
    expect(codeOnly(mutationBoundarySource)).not.toMatch(/\bfunction\b|\bclass\b/);
    expect(mutationBoundarySource).not.toMatch(/from ["']\.\.\/\.\.\/storage\/|fetch\(|WebSocket/);
  });

  it("5. structural: FedosAtprotoRecordObservation is never referenced by the Board Adapter or the normalized post model", () => {
    expect(adapterModuleSource).not.toMatch(/FedosAtprotoRecordObservation|FedosAtprotoObservedRecordEventKind/);
    expect(postModelSource).not.toMatch(/FedosAtprotoRecordObservation|FedosAtprotoObservedRecordEventKind/);
  });

  it("6. structural: FedosBoardPost's own field set carries no deleted/updated/repost/like-count/metadata field (unmodified this Arc)", () => {
    const fieldMatches = [...boardPostSource.matchAll(/^\s*readonly (\w+):/gm)].map((m: RegExpMatchArray) => m[1]);
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

  it("7. behavioral: an observation record carries both uri and cid, unlike ActivityPub's objectId-only equivalent", () => {
    const observation: FedosAtprotoRecordObservation = {
      uri: "at://did:plc:abc123/app.bsky.feed.post/xyz789",
      cid: "bafyabc123",
      kind: "updated_record_placeholder",
      observedAt: 1_700_000_000,
    };
    expect(observation.uri).toBe("at://did:plc:abc123/app.bsky.feed.post/xyz789");
    expect(observation.cid).toBe("bafyabc123");
    expect(FEDOS_ATPROTO_OBSERVED_RECORD_EVENT_KINDS).toContain("initial_record_placeholder");
    expect(FEDOS_ATPROTO_OBSERVED_RECORD_EVENT_KINDS).toContain("deleted_record_placeholder");
  });

  it("8. the design doc confirms a deleted record must not automatically erase canonical Board content", () => {
    expect(designDocSource).toMatch(/\*\*A deleted record must NOT automatically erase canonical Board\s*\ncontent\.\*\*/);
  });

  it("9. the design doc confirms FedosBoardPost must not be mutated in place for an updated record", () => {
    expect(designDocSource).toMatch(/\*\*`FedosBoardPost` is immutable \(Alpha 255\) and MUST NOT be mutated in\s*\nplace\.\*\*/);
  });

  it("10. the design doc cross-references Alpha 287, Alpha 283, Alpha 278, and Alpha 258", () => {
    for (const ref of [
      "secure_runtime_alpha_287_atproto_board_adapter",
      "secure_runtime_alpha_283_atproto_source_provenance",
      "secure_runtime_alpha_278_activitypub_mutation_boundary",
      "secure_runtime_alpha_258_moderation_deletion_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
