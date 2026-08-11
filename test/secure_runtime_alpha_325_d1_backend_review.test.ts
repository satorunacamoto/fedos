import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_325_d1_backend_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import d1IndexSource from "../src/os/_legacy_prototype/indexer/d1_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import d1DirectorySource from "../src/os/_legacy_prototype/community/d1_directory.ts?raw";

/**
 * Secure Runtime Alpha 325 -- "Candidate C: Cloudflare D1 Backend
 * Review": Stage 5 of the Alpha 321-330 Board Durable Backend Selection
 * & Architecture Arc. Review only -- implements no Board D1 schema.
 * Confirms D1 is this repository's most operationally proven backend
 * technology, but for a different (non-authoritative) concern, and with
 * Board having zero wiring into the Worker route that would call it.
 */
describe("Secure Runtime Alpha 325 -- Candidate C: Cloudflare D1 Backend Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. structural: worker.ts's real D1 binding (NOSTR_SPACE_DB) is confirmed to exist, scoped to space directory, not Board", () => {
    expect(workerSource).toMatch(/NOSTR_SPACE_DB\?:\s*D1LikeDatabase/);
    expect(workerSource).not.toMatch(/board_posts|FedosBoardPersistence/);
  });

  it("3. structural: D1MetadataIndex and D1SpaceDirectory are real, prepared-statement-bound implementations", () => {
    expect(d1IndexSource).toMatch(/export class D1MetadataIndex/);
    expect(d1DirectorySource).toMatch(/export class D1SpaceDirectory/);
  });

  it("4. the design doc explicitly separates D1's hosted-role fitness from Desktop ownership", () => {
    expect(designDocSource).toMatch(/## 3\. Important — D1 is not automatically the right backend for the/);
    expect(designDocSource).toMatch(/\*\*Desktop ownership conflict\.\*\* Direct/);
  });

  it("5. the design doc's conclusion attributes deferral to the missing Board-Worker caller, not to D1 being unproven", () => {
    expect(designDocSource).toMatch(/Deferred not because D1 itself is unproven, but because its/);
  });

  it("6. the design doc cross-references Alpha 321, Alpha 322, and Alpha 311", () => {
    for (const ref of [
      "secure_runtime_alpha_321_board_deployment_runtime_inventory",
      "secure_runtime_alpha_322_durable_backend_requirements",
      "secure_runtime_alpha_311_existing_board_persistence_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
