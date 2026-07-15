import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_393_write_transaction_order.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";

/**
 * Secure Runtime Alpha 393 -- "Write Transaction Order": Stage 3 of
 * the Alpha 391-400 Desktop Host Durable Write Coordination Arc.
 * Review only. Fixes Validate -> Persistence -> Repository -> Query
 * visibility -> Success as the adopted order, Persistence strictly
 * before Repository.
 */
describe("Secure Runtime Alpha 393 -- Write Transaction Order", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc states the adopted order exactly, in order", () => {
    const normalized = designDocSource.replace(/\s+/g, " ");
    const validateIdx = normalized.indexOf("Validate");
    const persistenceIdx = normalized.indexOf("Persistence", validateIdx);
    const repositoryIdx = normalized.indexOf("Repository", persistenceIdx);
    const queryIdx = normalized.indexOf("Query visibility", repositoryIdx);
    const successIdx = normalized.indexOf("Success", queryIdx);
    expect(validateIdx).toBeGreaterThan(-1);
    expect(persistenceIdx).toBeGreaterThan(validateIdx);
    expect(repositoryIdx).toBeGreaterThan(persistenceIdx);
    expect(queryIdx).toBeGreaterThan(repositoryIdx);
    expect(successIdx).toBeGreaterThan(queryIdx);
  });

  it("3. the design doc explicitly rejects Repository-first ordering", () => {
    expect(designDocSource).toContain("**Repository first, Persistence second.** Rejected.");
  });

  it("4. the design doc explicitly rejects concurrent/best-effort writes, citing the synchronous ports", () => {
    expect(designDocSource).toContain('**Both concurrently / "best effort".** Rejected outright');
  });

  it("5. the design doc explains the poisoning risk that makes genuine pre-persistence validation necessary", () => {
    expect(designDocSource.replace(/\s+/g, " ")).toContain(
      "One bad write would brick the Host forever.",
    );
  });

  it("6. structural: once implemented (Alpha 395), the Host's own persistence write precedes its own repository write in source order", () => {
    const putPostIdx = hostSource.indexOf("this.#boardPersistence.putPost(");
    const registerPostIdx = hostSource.indexOf("boardService.registerPost(", putPostIdx === -1 ? 0 : putPostIdx);
    if (putPostIdx !== -1) {
      expect(registerPostIdx).toBeGreaterThan(putPostIdx);
    }
  });

  it("7. the design doc cross-references Alpha 392, Alpha 391, Alpha 318, and Alpha 315", () => {
    for (const ref of [
      "secure_runtime_alpha_392_write_coordination_ownership_decision",
      "secure_runtime_alpha_391_desktop_host_write_coordination_inventory",
      "secure_runtime_alpha_318_board_hydration_index_rebuild",
      "secure_runtime_alpha_315_board_persistence_port",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
