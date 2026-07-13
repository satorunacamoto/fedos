import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_278_activitypub_mutation_boundary.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import mutationBoundarySource from "../src/board/activitypub/fedos_activitypub_mutation_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/activitypub/fedos_activitypub_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import postModelSource from "../src/board/activitypub/fedos_validated_activitypub_post.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPostSource from "../src/board/fedos_board_post.ts?raw";
import {
  FEDOS_ACTIVITYPUB_OBSERVED_MUTATION_KINDS,
  type FedosActivityPubMutationObservation,
} from "../src/board/activitypub/fedos_activitypub_mutation_boundary.js";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 278 -- "Create/Update/Delete Boundary Review":
 * Stage 8 of the ActivityPub Canonical Board Adapter Arc. Adds
 * src/board/activitypub/fedos_activitypub_mutation_boundary.ts --
 * types and label constants only, kept separate from FedosBoardPost,
 * never wired into the Board Adapter.
 */
describe("Secure Runtime Alpha 278 -- Create/Update/Delete Boundary Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. FEDOS_ACTIVITYPUB_OBSERVED_MUTATION_KINDS carries exactly the three named kinds, all _placeholder-suffixed", () => {
    expect([...FEDOS_ACTIVITYPUB_OBSERVED_MUTATION_KINDS].sort()).toEqual(
      ["create_placeholder", "delete_placeholder", "update_placeholder"].sort(),
    );
    for (const kind of FEDOS_ACTIVITYPUB_OBSERVED_MUTATION_KINDS) {
      expect(kind.endsWith("_placeholder")).toBe(true);
    }
  });

  it("3. structural: no boolean deleted/updated field anywhere IN CODE", () => {
    expect(codeOnly(mutationBoundarySource)).not.toMatch(/deleted:\s*boolean|updated:\s*boolean/i);
  });

  it("4. structural: this file is inert -- no function/class definition IN CODE, types and constants only", () => {
    expect(codeOnly(mutationBoundarySource)).not.toMatch(/\bfunction\b|\bclass\b/);
    expect(mutationBoundarySource).not.toMatch(/from ["']\.\.\/\.\.\/storage\/|fetch\(|WebSocket/);
  });

  it("5. structural: FedosActivityPubMutationObservation is never referenced by the Board Adapter or the normalized post model", () => {
    expect(adapterModuleSource).not.toMatch(/FedosActivityPubMutationObservation|FedosActivityPubObservedMutationKind/);
    expect(postModelSource).not.toMatch(/FedosActivityPubMutationObservation|FedosActivityPubObservedMutationKind/);
  });

  it("6. structural: FedosBoardPost's own field set carries no deleted/updated/mutation field (unmodified this Arc)", () => {
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

  it("7. behavioral: an observation record links to a post only by objectId, distinct kinds for create/update/delete", () => {
    const observation: FedosActivityPubMutationObservation = {
      objectId: "https://example.social/users/alice/statuses/1",
      kind: "delete_placeholder",
      observedAt: 1_700_000_000,
    };
    expect(observation.objectId).toBe("https://example.social/users/alice/statuses/1");
    expect(FEDOS_ACTIVITYPUB_OBSERVED_MUTATION_KINDS).toContain("create_placeholder");
    expect(FEDOS_ACTIVITYPUB_OBSERVED_MUTATION_KINDS).toContain("update_placeholder");
  });

  it("8. the design doc confirms Delete must not delete the canonical post automatically", () => {
    expect(designDocSource).toMatch(/\*\*A `Delete` activity must NOT delete the canonical post automatically\.\*\*/);
  });

  it("9. the design doc confirms FedosBoardPost must not be mutated in place for Update", () => {
    expect(designDocSource).toMatch(
      /\*\*`FedosBoardPost` is immutable \(Alpha 255\) and MUST NOT be mutated in\s*\nplace\*\*/,
    );
  });

  it("10. the design doc cross-references Alpha 277 and Alpha 258", () => {
    for (const ref of [
      "secure_runtime_alpha_277_activitypub_board_adapter",
      "secure_runtime_alpha_258_moderation_deletion_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
