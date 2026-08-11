import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_501_existing_host_and_delivery_boundary_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import createHostSource from "../src/os/messenger/desktop/host/create_fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import stateSource from "../src/os/messenger/desktop/host/fedos_desktop_host_state.ts?raw";

describe("Secure Runtime Alpha 501 -- Existing Host and Delivery Boundary Inventory", () => {
  it("FedosDesktopHost's own Scheduler/Publisher/Observation wiring is added later in this same Arc (Alpha 507), not by this Stage itself", () => {
    // This Stage (Alpha 501) is review-only and adds no such field itself;
    // Alpha 507 (same Arc, same commit) adds it at exactly the paths this
    // doc's own §2 names -- confirmed present here rather than asserting
    // continued absence, since both land in one commit.
    expect(hostSource).toMatch(/Scheduler|Publisher|Observation/);
    expect(createHostSource).toMatch(/Scheduler|Publisher|Observation/);
  });

  it("FedosDesktopHostState remains the closed six-token union", () => {
    expect(stateSource).toMatch(
      /export type FedosDesktopHostState =\s*\n\s*\| "constructed"\s*\n\s*\| "starting"\s*\n\s*\| "ready"\s*\n\s*\| "stopping"\s*\n\s*\| "stopped"\s*\n\s*\| "failed";/,
    );
  });

  it("the doc records the fire-and-forget tick() problem this Arc must solve", () => {
    expect(doc).toMatch(/UNOBSERVABLE from outside/);
  });

  it("the doc cross-references Alpha 419, 497, and 333", () => {
    for (const ref of [
      "secure_runtime_alpha_419_host_submit_outbox_coordination",
      "secure_runtime_alpha_497_scheduler_contract_rewiring",
      "secure_runtime_alpha_333_desktop_host_state_model",
    ]) {
      expect(doc).toContain(ref);
    }
  });
});
