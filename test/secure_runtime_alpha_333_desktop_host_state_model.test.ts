import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_333_desktop_host_state_model.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import stateSource from "../src/os/messenger/desktop/host/fedos_desktop_host_state.ts?raw";
import type { FedosDesktopHostState } from "../src/desktop/host/fedos_desktop_host_state.js";

/**
 * Secure Runtime Alpha 333 -- "Desktop Host State Model": Stage 3 of
 * the Alpha 331-340 Desktop Host Runtime Foundation Arc. Adds
 * src/desktop/host/fedos_desktop_host_state.ts, exporting
 * FedosDesktopHostState -- a closed six-token union, no error
 * payload.
 */
describe("Secure Runtime Alpha 333 -- Desktop Host State Model", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: the type is a closed six-token string-literal union, the ONLY export", () => {
    expect(stateSource).toMatch(
      /export type FedosDesktopHostState =\s*\|\s*"constructed"\s*\|\s*"starting"\s*\|\s*"ready"\s*\|\s*"stopping"\s*\|\s*"stopped"\s*\|\s*"failed";/,
    );
    const exportCount = (stateSource.match(/^export /gm) ?? []).length;
    expect(exportCount).toBe(1);
  });

  it("3. structural: no interface/object shape attached to the type -- a bare string-literal union only", () => {
    expect(stateSource).not.toMatch(/export interface|export class /);
  });

  it("4. type-level: every named token is a valid FedosDesktopHostState value", () => {
    const values: FedosDesktopHostState[] = ["constructed", "starting", "ready", "stopping", "stopped", "failed"];
    expect(values).toHaveLength(6);
  });

  it("5. the design doc fixes all five required transitions", () => {
    expect(designDocSource).toMatch(/constructed → starting/);
    expect(designDocSource).toMatch(/starting {4}→ ready/);
    expect(designDocSource).toMatch(/starting {4}→ failed/);
    expect(designDocSource).toMatch(/ready {7}→ stopping/);
    expect(designDocSource).toMatch(/stopping {4}→ stopped/);
  });

  it("6. the design doc explicitly rejects an error payload on failed", () => {
    expect(designDocSource).toMatch(/\*\*No\.\*\* Reviewed and rejected/);
  });

  it("7. the design doc forbids failed → ready without a new instance, citing Alpha 062", () => {
    expect(designDocSource).toMatch(/failed → ready.*without constructing a brand-new/s);
    expect(designDocSource).toContain("secure_runtime_alpha_062_identity_bootstrap_reset_review");
  });

  it("8. the design doc cross-references Alpha 332, Alpha 060, and Alpha 098", () => {
    for (const ref of [
      "secure_runtime_alpha_332_desktop_host_responsibility_decision",
      "secure_runtime_alpha_060_identity_bootstrap_status",
      "secure_runtime_alpha_098_ready_state",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
