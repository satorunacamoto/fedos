import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_409_outbound_publish_readiness_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/os/messenger/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 409 -- "Outbound Publish Readiness Review":
 * Stage 9 of the Alpha 401-410 Desktop Host Canonical Write Boundary
 * Closure Arc. Review only -- no Outbox code of any kind.
 */
describe("Secure Runtime Alpha 409 -- Outbound Publish Readiness Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(4000);
  });

  it("2. the design doc adopts Option C explicitly, matching this Arc's own preferred candidate", () => {
    expect(designDocSource).toContain(
      "**Option C — Preferred, adopted exactly as this Arc's own instruction",
    );
  });

  it("3. the design doc rejects Option D outright, citing the structural (not preferential) reason", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain("**Option D** is rejected outright, for a structural reason, not a preference");
  });

  it("4. the design doc rejects Option B, citing the fail-closed philosophy since Alpha 307/393", () => {
    expect(designDocSource).toContain("**Option B** is rejected:");
  });

  it("5. the design doc reviews all four future protocol targets separately, refusing to unify their transport or success model", () => {
    for (const target of ["Nostr Relay publish", "ActivityPub delivery", "AT Protocol repository write", "Session outbound Gateway"]) {
      expect(designDocSource).toContain(target);
    }
    expect(designDocSource).toContain("Do not pretend they share one\ntransport or one success model.");
  });

  it("6. the design doc names the future conceptual flow without any schema/API/field proposal", () => {
    expect(designDocSource).toContain("durable canonical Board write        (SOLVED");
    expect(designDocSource).toContain("durable Outbox intent                (FUTURE");
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "no field, no schema, no API, no file for any of the three FUTURE boxes is proposed here.",
    );
  });

  it("7. structural: submitPost()'s own body remains Outbox-free -- the Outbox this Stage reviewed (unimplemented as of Arc 401-410) was later added, Arc 411-420, as the ADDITIVE submitPostWithOutbox() surface only, never inside submitPost() itself", () => {
    const submitPostMatch = hostSource.match(
      /submitPost\(post: FedosBoardPost\): FedosDesktopHostSubmitPostResult \{([\s\S]*?)\n {2}\}/,
    );
    expect(submitPostMatch).not.toBeNull();
    expect(submitPostMatch![1]).not.toMatch(/Outbox/);
  });

  it("8. Regression: package.json dependency count remains unchanged at 2, no new dependency for a future publisher", () => {
    const pkg = JSON.parse(packageJsonSource);
    expect(Object.keys(pkg.dependencies ?? {}).length).toBe(2);
  });

  it("9. the design doc cross-references Alpha 408, Alpha 393, and Alpha 307", () => {
    for (const ref of [
      "secure_runtime_alpha_408_host_write_failure_boundary_verification",
      "secure_runtime_alpha_393_write_transaction_order",
      "secure_runtime_alpha_307_board_application_service",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
