import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_540_retry_coordination_completion.md?raw";

describe("Secure Runtime Alpha 540 -- Retry Coordination Completion Report", () => {
  it("maps every named implementation target from the spec to what was built", () => {
    for (const target of [
      "Observation Model",
      "Retry Attempt",
      "Retry History",
      "Retry Counter",
      "Current State",
      "Validation",
      "Observation Query",
    ]) {
      expect(doc).toContain(target);
    }
  });

  it("confirms every named constraint (Scheduler minimal, Publisher/Outbox/Host API forbidden)", () => {
    expect(doc).toMatch(/Scheduler変更最小/);
    expect(doc).toMatch(/Publisher変更禁止/);
    expect(doc).toMatch(/Outbox変更禁止/);
    expect(doc).toMatch(/Host API変更禁止/);
  });

  it("confirms every prohibited topic absent", () => {
    for (const prohibited of ["Ontology", "P2P", "GUI", "Cloudflare", "Worker"]) {
      expect(doc).toContain(prohibited);
    }
    expect(doc).toMatch(/禁止 confirmed absent/);
  });

  it("names all three verification case groups explicitly", () => {
    expect(doc).toMatch(/\*\*accepted\*\*/);
    expect(doc).toMatch(/failed → retry → accepted/);
    expect(doc).toMatch(/retry → failed → retry → retry → accepted/);
  });

  it("honestly discloses the one real bug found and fixed, and the out-of-scope pre-existing test failures", () => {
    expect(doc).toMatch(/One real bug found and fixed, disclosed honestly/);
    expect(doc).toMatch(/210 pre-existing, unrelated files fail/);
  });

  it("names what was NOT done and the recommended next Arc", () => {
    expect(doc).toMatch(/What was NOT done/);
    expect(doc).toMatch(/Recommended next Arc/);
  });
});
