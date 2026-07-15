import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_523_attempt_subject_id_design_decision.md?raw";

describe("Secure Runtime Alpha 523 -- Attempt Subject ID Design Decision", () => {
  it("adopts the ::attempt::N suffix shape", () => {
    expect(doc).toContain("${originalSubjectId}::attempt::${attemptNumber}");
  });

  it("rejects a random/GUID attempt token, citing the no-randomness discipline", () => {
    expect(doc).toMatch(/no randomness, no clock read/);
  });

  it("rejects a new field on FedosDeliveryObservation itself", () => {
    expect(doc).toMatch(/A numeric field added to `FedosDeliveryObservation` itself/);
  });
});
