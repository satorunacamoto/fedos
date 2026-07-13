import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_311_existing_board_persistence_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import ciphertextStorageSource from "../src/runtime/fedos_runtime_ciphertext_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageBackendSource from "../src/runtime/fedos_runtime_storage_backend.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import d1IndexSource from "../src/indexer/d1_index.ts?raw";

/**
 * Secure Runtime Alpha 311 -- "Existing Board Persistence Inventory":
 * Stage 1 of the Canonical Board Persistence Boundary Arc (Alpha
 * 311-320). Review only. Confirms Secure Runtime ciphertext storage is
 * unsuitable BY TYPE for Board posts, D1MetadataIndex solves a
 * different (non-authoritative) problem, and p2p/ is confirmed isolated
 * without inspecting its internals.
 */
describe("Secure Runtime Alpha 311 -- Existing Board Persistence Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc answers all ten required inventory questions from its own §3", () => {
    for (let i = 1; i <= 10; i++) {
      expect(designDocSource).toMatch(new RegExp(`### 3\\.${i} `));
    }
  });

  it("3. structural: storeCiphertext/loadCiphertext/deleteCiphertext accept/return AeadCiphertextWire only", () => {
    expect(ciphertextStorageSource).toMatch(/STORES `AeadCiphertextWire` ONLY/);
  });

  it("4. structural: RuntimeStorageBackend.store/load accept/return AeadCiphertextWire, enforced at the type level", () => {
    expect(storageBackendSource).toMatch(/store\(id: string, wire: AeadCiphertextWire\): Promise<boolean>/);
    expect(storageBackendSource).toMatch(/load\(id: string\): Promise<AeadCiphertextWire \| null>/);
  });

  it("5. structural: D1MetadataIndex is confirmed non-authoritative, rebuildable, and lag-tolerant", () => {
    expect(d1IndexSource).toMatch(/NOT an audit log or an authoritative\/durable record/);
  });

  it("6. the design doc confirms p2p/ is a separate repository via its own .git directory, not inspected internally", () => {
    expect(designDocSource).toMatch(/its OWN `\.git`/);
  });

  it("7. the design doc concludes new files belong under src/board/persistence/", () => {
    expect(designDocSource).toContain("src/board/persistence/");
  });

  it("8. the design doc cross-references Alpha 310, Alpha 019, Alpha 021, and Alpha 258", () => {
    for (const ref of [
      "secure_runtime_alpha_310_board_repository_completion",
      "secure_runtime_alpha_019_secure_storage_foundation",
      "secure_runtime_alpha_021_storage_backend_abstraction",
      "secure_runtime_alpha_258_moderation_deletion_boundary",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
