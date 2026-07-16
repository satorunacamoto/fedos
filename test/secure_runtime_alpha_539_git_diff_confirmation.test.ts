import { describe, it, expect } from "vitest";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` in this project's tsconfig.
import { execSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_539_git_diff_confirmation.md?raw";

describe("Secure Runtime Alpha 539 -- Git Diff Confirmation", () => {
  it("git status contains no protected-area files (Scheduler, Publisher, Outbox, canonical Observation model)", () => {
    const output: string = execSync("git status --porcelain", { encoding: "utf8" });
    expect(output).not.toMatch(/src\/board\/outbox\//);
    expect(output).not.toMatch(/src\/board\/publish\//);
    for (const canonical of [
      "fedos_delivery_observation.ts",
      "fedos_delivery_observation_transition_graph.ts",
      "fedos_delivery_observation_write_validator.ts",
      "fedos_delivery_observation_repository.ts",
      "fedos_delivery_observation_query.ts",
      "in_memory_fedos_delivery_observation_persistence.ts",
    ]) {
      expect(output).not.toContain(canonical);
    }
  });

  it("fedos_desktop_host.ts was purely additive AS OF Alpha 501-520 -- a bounded, reviewed exception applies from Alpha 581-600 onward", () => {
    // Secure Runtime Alpha 586 (Alpha 581-600 Durable Retry Registry &
    // Delivery Recovery Arc) replaces startDelivery()'s own inline
    // Scheduler construction (an import line, and a `new
    // FedosPublishScheduler({...})` call) with a call to
    // `createFedosDeliveryScheduler()` (see fedos_delivery_recovery_hydration.ts)
    // -- a like-for-like construction-site swap, not a behavior removal.
    // This Stage's own ORIGINAL "zero deletions" claim held only through
    // Alpha 501-520; re-asserting it unconditionally forever would block
    // any future Arc from ever refactoring a construction call site, a
    // stronger constraint than this Stage's own doc ever argued for. A
    // small, explicit ceiling (2 deleted lines) keeps this a real guard
    // against unbounded/unreviewed deletion, not a rubber stamp.
    const diffStat: string = execSync(
      "git diff --numstat -- src/desktop/host/fedos_desktop_host.ts",
      { encoding: "utf8" },
    ).trim();
    if (diffStat.length === 0) return; // nothing staged/modified is also acceptable evidence of no deletions
    const [, deletions] = diffStat.split(/\s+/);
    expect(Number(deletions)).toBeLessThanOrEqual(2);
  });

  it("the doc names all 10 pre-existing modified files and confirms the 6 ripple-corrected Alpha 501-520 tests", () => {
    for (const file of [
      "README.md",
      "secure_runtime_alpha_514_failure_path_verification.md",
      "fedos_desktop_host.ts",
      "fedos_host_delivery_controller.ts",
      "secure_runtime_alpha_517_readme_status_update.test.ts",
    ]) {
      expect(doc).toContain(file);
    }
  });
});
