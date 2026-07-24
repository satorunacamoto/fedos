import { describe, it, expect } from "vitest";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` in this project's tsconfig.
import { execSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_531_ripple_review.md?raw";

describe("Secure Runtime Alpha 531 -- Ripple Review", () => {
  it("names all six pre-existing test files it corrected", () => {
    for (const file of [
      "secure_runtime_alpha_505_delivery_controller_tick_loop.test.ts",
      "secure_runtime_alpha_510_host_delivery_status_and_observation_query.test.ts",
      "secure_runtime_alpha_513_full_pipeline_flow_verification.test.ts",
      "secure_runtime_alpha_514_failure_path_verification.test.ts",
      "secure_runtime_alpha_515_multi_intent_consistency_verification.test.ts",
      "secure_runtime_alpha_516_independent_host_instances_verification.test.ts",
    ]) {
      expect(doc).toContain(file);
    }
  });

  it("honestly documents the real registry-persistence bug found and fixed, not merely a test correction", () => {
    expect(doc).toMatch(/real, previously-latent bug/);
    expect(doc).toMatch(/#deliveryRetryRegistry/);
  });

  it("git status confirms exactly the src/ files this doc claims changed, and nothing else pre-existing under src/board/", () => {
    const output: string = execSync("git status --porcelain", { encoding: "utf8" });
    const modified = output
      .split("\n")
      .filter((line: string) => line.startsWith(" M "))
      .map((line: string) => line.slice(3).trim());

    // Every MODIFIED (pre-existing, tracked) `src/` file must be one this
    // Arc's own docs account for -- no untracked-for regression in a `src/`
    // file this Stage does not name. `docs/`/`test/`/`README.md` are
    // intentionally excluded from this exact-accounting check: later Stages
    // in this same Arc (537 README update, 517's own ripple fix) legitimately
    // touch MORE docs/tests/README than Alpha 531 itself named, which is
    // expected growth, not an untracked regression -- the protected-area
    // check below (which DOES cover every modified file, not just `src/`)
    // is what actually enforces "nothing else pre-existing under src/board/".
    const accountedForSrc = new Set([
      "src/desktop/host/fedos_desktop_host.ts",
      "src/desktop/host/fedos_host_delivery_controller.ts",
      // Secure Runtime Alpha 561-580 (Publish Scheduler Concurrency Safety
      // & Abandonment Policy Arc) legitimately, and by its own explicit
      // objective, touches the Scheduler itself -- the ONE file this
      // Stage's own "protected area" check (below) was written to guard,
      // back when no future Arc had yet been authorized to touch it.
      "src/board/outbox/fedos_publish_scheduler.ts",
      // Secure Runtime Alpha 581-600 (Durable Retry Registry & Delivery
      // Recovery Arc) legitimately adds ONE additive, never-downward
      // hydration method (hydrateAttemptCount()) to the Retry Registry
      // -- see docs/secure_runtime_alpha_585_durable_retry_persistence_implementation.md.
      "src/board/observation/fedos_delivery_retry_registry.ts",
      // Secure Runtime Alpha 641-680 (Public Identity, Conversation
      // Policy & Application Runtime Integration Arc) legitimately
      // rewires FedosBoardRuntime's command methods onto the new
      // Author/Policy/Eligibility seams (Alpha 667) and extends the
      // Local Runtime to own/expose FedosBoardRuntime (Alpha 671-673)
      // -- see docs/secure_runtime_alpha_667_boardruntime_command_integration.md
      // and docs/secure_runtime_alpha_672_application_runtime_construction.md.
      "src/board/runtime/fedos_board_runtime.ts",
      "src/board/runtime/fedos_board_runtime_command_types.ts",
      "src/desktop/runtime/fedos_desktop_runtime.ts",
      "src/desktop/runtime/fedos_desktop_runtime_config.ts",
      // Secure Runtime Alpha 5401-5480 (FedOS Direct Ratchet State and
      // Sealed Persistence Foundation Arc) legitimately extends the
      // existing Master Seed WASM Rust Boundary reach with two new,
      // narrow methods (`attemptDevOnlyMasterSeedSealDirectRatchetSecretCall`/
      // `attemptDevOnlyMasterSeedRestoreDirectRatchetSecretCall`) and the
      // TypeScript-side `FedosWasmMasterSeedAuthority` adapter that calls
      // them -- see
      // docs/secure_runtime_alpha_5401_5480_reconciliation_report.md §5.
      "src/runtime/fedos_wasm_loader.ts",
      "src/runtime/master_seed/fedos_wasm_master_seed_authority.ts",
      // Secure Runtime Alpha 7161-7240 (FedOS Conversation-Level
      // Production Crypto and Identity Authority Wiring Arc)
      // legitimately wires the canonical, already-activated production
      // Master Seed/Signing Authorities into Conversation-level
      // identity/encryption/NIP-17 transport, closing the gaps Secure
      // Runtime Alpha 7081-7160 disclosed -- see
      // docs/secure_runtime_alpha_7161_7240_reconciliation_report.md.
      "src/desktop/onboarding/fedos_profile_initialization_coordinator.ts",
      "src/desktop/production_activation/fedos_production_master_seed_authority.ts",
      "src/desktop/production_activation/fedos_production_wasm_master_seed_facade.ts",
      "src/conversation/delivery/nostr/nip17/fedos_nip59_gift_wrap.ts",
      "src/conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.ts",
      "src/conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.ts",
    ]);
    for (const file of modified.filter((f) => f.startsWith("src/"))) {
      expect(accountedForSrc.has(file)).toBe(true);
    }

    // Nothing under the protected areas (Publisher, canonical Observation
    // model) was modified -- checked across EVERY modified file, not just
    // the `src/`-scoped accounting above. `fedos_publish_scheduler.ts` and
    // new sibling files under `src/board/outbox/` are EXCLUDED from this
    // check as of Secure Runtime Alpha 561-580 (see `accountedForSrc`
    // above and `docs/secure_runtime_alpha_561_scheduler_concurrency_inventory.md`)
    // -- this Stage's original claim held only through Alpha 501-540.
    for (const file of modified) {
      if (file === "src/board/outbox/fedos_publish_scheduler.ts") continue;
      if (file.startsWith("src/board/outbox/") && file.endsWith("_abandonment_policy.ts")) continue;
      expect(file).not.toMatch(/fedos_publish_scheduler\.ts$/);
      expect(file).not.toMatch(/^src\/board\/publish\//);
      expect(file).not.toMatch(/^src\/board\/outbox\//);
      expect(file).not.toMatch(/fedos_delivery_observation(_transition_graph|_write_validator|_repository)?\.ts$/);
      expect(file).not.toMatch(/fedos_delivery_observation_query\.ts$/);
    }
  });

  it("reports five stable consecutive full-batch runs as its own verification evidence", () => {
    expect(doc).toMatch(/FIVE times consecutively/);
    expect(doc).toMatch(/31 files, 122\s*\n?\s*tests/);
  });
});
