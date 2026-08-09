import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_386_host_query_delegation_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";

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

  it("2. structural: no Board-Query READ delegation/convenience method exists on the Host -- exactly ten read/lifecycle/delivery public methods, plus submitPost()/submitPostWithOutbox() (write boundaries, not Query delegation) and the constructor", () => {
    const code = codeOnly(hostSource);
    const publicMethodNames = (code.match(/^\s{2}(?:async )?(\w+)\(/gm) ?? [])
      .map((m: string) => m.replace(/^\s*(?:async )?/, "").replace("(", ""))
      .filter((name: string) => name !== "constructor");
    // Alpha 395 (Arc 391-400) adds submitPost() -- the canonical Host-owned
    // WRITE boundary. Alpha 419 (Arc 411-420) additionally adds
    // submitPostWithOutbox() -- an ADDITIVE, explicit-outbound-targets write
    // boundary that itself calls submitPost() internally. Alpha 508-510 (Arc
    // 501-520) additionally add startDelivery()/stopDelivery()/
    // deliveryStatus()/observationQuery() -- a Delivery LIFECYCLE boundary,
    // unrelated to Board Query. NONE of the six is a Board-Query
    // delegation/convenience method (the kind this Stage's own Objective
    // declined to add) -- all six are this repository's own write-
    // coordination or delivery-lifecycle API, added by later Arcs for
    // different, unrelated reasons. This Stage's own finding -- no
    // recentBoardPosts()/threadPosts()/queryBoard() READ delegation method --
    // still holds exactly, confirmed by test 3 below (a NEW invariant, not
    // merely a widened list: observationQuery() is a DIFFERENT read boundary,
    // over Delivery Observation, never Board Query, and is asserted NOT to
    // duplicate any FedosBoardQuery method name).
    expect(publicMethodNames.sort()).toEqual(
      [
        "state",
        "start",
        "stop",
        "desktop",
        "board",
        "query",
        "submitPost",
        "submitPostWithOutbox",
        "startDelivery",
        "stopDelivery",
        "deliveryStatus",
        "observationQuery",
      ].sort(),
    );
  });

  it("2b. NEW invariant (Alpha 501-520): observationQuery() is a Delivery Observation read boundary, never a Board Query delegation -- its own name and return type never collide with FedosBoardQuery's own recentFeed()/thread() method names", () => {
    expect(hostSource).toContain("observationQuery(): FedosDeliveryObservationQuery | null {");
    expect(codeOnly(hostSource)).not.toMatch(/recentFeed\(|thread\(/);
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
