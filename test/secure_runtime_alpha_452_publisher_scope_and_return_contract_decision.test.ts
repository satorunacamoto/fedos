import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_452_publisher_scope_and_return_contract_decision.md?raw";

describe("Secure Runtime Alpha 452 -- Publisher Scope and Return Contract Decision", () => {
  it("the doc adopts Option B: transport-only, boolean return", () => {
    expect(doc).toMatch(/ADOPTED\./);
    expect(doc).toMatch(/boolean success\/failure/i);
  });

  it("the doc explicitly rejects a result-object / retryPolicy shape", () => {
    expect(doc).toMatch(/REJECTED: a `reason`\/`outcome` field is Observation vocabulary/);
  });

  it("the doc rejects a Promise<void> return in favor of caller-visible success/failure", () => {
    expect(doc).toMatch(/REJECTED: this Arc's own instruction requires the CALLER be able to/);
  });

  it("the doc lists every absolute prohibition this Arc carries forward", () => {
    for (const term of [
      "Retry",
      "Backoff",
      "Observation",
      "ACK processing",
      "Pool",
      "GUI",
      "ActivityPub",
      "AT Protocol",
      "Session",
      "Ontology",
      "p2p/",
    ]) {
      expect(doc).toContain(term);
    }
  });

  it("the doc explains why this Arc is narrower than README's own Alpha 450 recommendation", () => {
    expect(doc).toMatch(/DELIBERATELY narrower/);
  });
});
