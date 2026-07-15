import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_524_retry_reason_and_final_state_encoding_decision.md?raw";

describe("Secure Runtime Alpha 524 -- Retry Reason and Final State Encoding Decision", () => {
  it("encodes into the existing reason field, never a new field", () => {
    expect(doc).toMatch(/never a new field/);
  });

  it("derives finality from the Scheduler's own unchanged abandoned signal", () => {
    expect(doc).toContain('"abandoned"');
    expect(doc).toMatch(/does not re-derive or second-guess/);
  });

  it("decodes fail-closed to isFinal: false on unrecognized input", () => {
    expect(doc).toMatch(/CONSERVATIVE reading: assume a retry might still happen/);
  });
});
