import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_362_hydration_failure_policy.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import stateSource from "../src/desktop/host/fedos_desktop_host_state.ts?raw";

function normalize(source: string): string {
  return source.replace(/\s+/g, " ");
}

/**
 * Secure Runtime Alpha 362 -- "Hydration Failure Policy": Stage 2 of
 * the Alpha 361-370 Board Recovery & Host Robustness Arc.
 * Policy/design only, no code change. Fixes the INTENDED semantics: a
 * startup failure, by ANY signaling mechanism, must result in
 * state() === "failed".
 */
describe("Secure Runtime Alpha 362 -- Hydration Failure Policy", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc states the policy explicitly, bolded", () => {
    expect(normalize(designDocSource)).toContain(
      normalize(
        `**Any failure to produce a usable, hydrated
\`FedosBoardService\` during \`FedosDesktopHost.start()\` — regardless
of whether that failure is communicated by a RETURNED non-\`"hydrated"\`
outcome or by a THROWN exception — MUST result in \`state() ===
"failed"\` before \`start()\`'s own rejection reaches its caller.**`,
      ),
    );
  });

  it("3. the design doc names both failure-signaling shapes explicitly", () => {
    expect(designDocSource).toContain("**Returned outcome**");
    expect(designDocSource).toContain("**Thrown exception**");
  });

  it("4. structural: FedosDesktopHostState still requires the unconditional starting -> failed transition this policy depends on", () => {
    expect(stateSource).toMatch(/"starting"/);
    expect(stateSource).toMatch(/"failed"/);
  });

  it("5. the design doc explicitly states this is not a new rule invented by this Stage", () => {
    expect(normalize(designDocSource)).toContain(
      "This is not a new rule invented by this Stage",
    );
  });

  it("6. the design doc states no code is written or changed in this Stage", () => {
    expect(normalize(designDocSource)).toContain(
      "No code is written or changed anywhere in this Stage.",
    );
  });

  it("7. the design doc cross-references Alpha 361, Alpha 333, Alpha 335, and Alpha 336", () => {
    for (const ref of [
      "secure_runtime_alpha_361_host_failure_inventory",
      "secure_runtime_alpha_333_desktop_host_state_model",
      "secure_runtime_alpha_335_board_hydration_ownership",
      "secure_runtime_alpha_336_desktop_host_access_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
