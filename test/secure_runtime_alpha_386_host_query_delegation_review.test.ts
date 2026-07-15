import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_386_host_query_delegation_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

/**
 * Secure Runtime Alpha 386 -- "Host Query Delegation Review": Stage 6
 * of the Alpha 381-390 Canonical Board Query Host Integration &
 * Startup Failure Closure Arc. Review only. No delegation methods
 * added -- callers use host.query() directly.
 */
describe("Secure Runtime Alpha 386 -- Host Query Delegation Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. structural: no READ delegation/convenience method exists on the Host -- exactly six read/lifecycle public methods, plus submitPost() (Alpha 395's own WRITE boundary, not a Query delegation method) and the constructor", () => {
    const code = codeOnly(hostSource);
    const publicMethodNames = (code.match(/^\s{2}(?:async )?(\w+)\(/gm) ?? [])
      .map((m: string) => m.replace(/^\s*(?:async )?/, "").replace("(", ""))
      .filter((name: string) => name !== "constructor");
    // Alpha 395 (Arc 391-400) adds submitPost() -- the canonical Host-owned
    // WRITE boundary. Alpha 419 (Arc 411-420) additionally adds
    // submitPostWithOutbox() -- an ADDITIVE, explicit-outbound-targets write
    // boundary that itself calls submitPost() internally. NEITHER is a
    // Query-delegation/convenience method (the kind this Stage's own
    // Objective declined to add) -- both are this repository's own
    // write-coordination API, added by later Arcs for different, unrelated
    // reasons. This Stage's own finding -- no
    // recentBoardPosts()/threadPosts()/queryBoard() READ delegation method --
    // still holds exactly, confirmed by test 3 below.
    expect(publicMethodNames.sort()).toEqual(
      ["state", "start", "stop", "desktop", "board", "query", "submitPost", "submitPostWithOutbox"].sort(),
    );
  });

  it("3. structural: no recentBoardPosts/threadPosts/queryBoard method exists anywhere in the Host file", () => {
    expect(hostSource).not.toMatch(/recentBoardPosts|threadPosts|queryBoard/);
  });

  it("4. the design doc adopts Option A explicitly", () => {
    expect(designDocSource).toContain("**Option A**, exactly as this Arc's own instruction states.");
  });

  it("5. the design doc rejects Options B and C, each with a stated reason", () => {
    expect(designDocSource).toContain("- **Option B — add all Query methods to Host**");
    expect(designDocSource).toContain("- **Option C — add only one common read operation**");
    expect(designDocSource).toMatch(/Rejected: this creates TWO public read APIs/);
    expect(designDocSource).toMatch(/Rejected: an\s*arbitrary asymmetry/);
  });

  it("6. the design doc confirms no current caller requires delegation, by inspection", () => {
    expect(designDocSource).toContain("## 4. No current caller requires it");
  });

  it("7. the design doc leaves room for a FUTURE façade without contradicting this Stage's own minimalism", () => {
    expect(designDocSource).toContain(
      "## 5. A future façade may still delegate selected operations",
    );
  });

  it("8. the design doc cross-references Alpha 385, Alpha 384, and Alpha 381", () => {
    for (const ref of [
      "secure_runtime_alpha_385_board_service_access_review",
      "secure_runtime_alpha_384_host_query_access_boundary",
      "secure_runtime_alpha_381_host_query_integration_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
