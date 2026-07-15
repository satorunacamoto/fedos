import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readme from "../README.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_517_readme_status_update.md?raw";

describe("Secure Runtime Alpha 517 -- README Status Update", () => {
  it("the new status entry is at the top, and the prior Alpha 481-490 entry is preserved beneath it", () => {
    const newIdx = readme.indexOf("Secure Runtime Alpha 501–520");
    const priorMarkerIdx = readme.indexOf("Prior status:");
    const oldIdx = readme.indexOf("Secure Runtime Alpha 481–490");
    expect(newIdx).toBeGreaterThan(-1);
    expect(priorMarkerIdx).toBeGreaterThan(newIdx);
    expect(oldIdx).toBeGreaterThan(priorMarkerIdx);
  });

  it("the new entry names the honestly-discovered retry/Observation limitation, not hidden", () => {
    expect(readme).toMatch(/does not grow across retries yet/);
  });

  it("the new entry names FedosHostDeliveryController and why it never calls Scheduler start()/stop()", () => {
    expect(readme).toContain("FedosHostDeliveryController");
    expect(readme).toMatch(/no external caller can await/);
  });

  it("the doc cross-references the discovered-limitation doc", () => {
    expect(doc).toContain("secure_runtime_alpha_514_failure_path_verification");
  });
});
