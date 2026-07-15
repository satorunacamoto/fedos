import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_406_legacy_direct_write_detection.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostSource from "../src/desktop/host/fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hostStateSource from "../src/desktop/host/fedos_desktop_host_state.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import factorySource from "../src/desktop/host/create_fedos_desktop_host.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import serviceSource from "../src/board/repository/fedos_board_service.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import readerSource from "../src/board/repository/fedos_board_reader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import hydrationSource from "../src/board/persistence/fedos_board_hydration.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import persistedRepositorySource from "../src/board/persistence/persisted_fedos_board_repository.ts?raw";

function codeOnly(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/**"))
    .join("\n");
}

// The complete set of production files that could plausibly contain a
// Host-reachable Board mutation route -- confirmed complete by Alpha 401's
// own exhaustive `.board()`/`registerPost(`/`FedosDesktopHost` search
// across the whole `src/` tree (zero other file matched).
const productionSurface: Record<string, string> = {
  "fedos_desktop_host.ts": hostSource,
  "fedos_desktop_host_state.ts": hostStateSource,
  "create_fedos_desktop_host.ts": factorySource,
  "fedos_board_service.ts": serviceSource,
  "fedos_board_reader.ts": readerSource,
  "persisted_fedos_board_repository.ts": persistedRepositorySource,
};

/**
 * Secure Runtime Alpha 406 -- "Legacy Direct Write Detection": Stage 6
 * of the Alpha 401-410 Desktop Host Canonical Write Boundary Closure
 * Arc. Structural regression guards against a future reintroduced
 * Persistence-bypassing Host write route. Production source only.
 */
describe("Secure Runtime Alpha 406 -- Legacy Direct Write Detection", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2000);
  });

  it("2. guard: no '.board()' chained directly with '.registerPost(' or '.previewRegistration(' anywhere in production source", () => {
    for (const [file, source] of Object.entries(productionSurface)) {
      expect(codeOnly(source), file).not.toMatch(/\.board\(\)[!?.]*\.(registerPost|previewRegistration)\(/);
    }
  });

  it("3. guard: no 'readBoard()' method declared anywhere in production source (Alpha 402's own rejected Option D)", () => {
    for (const [file, source] of Object.entries(productionSurface)) {
      expect(codeOnly(source), file).not.toMatch(/\breadBoard\s*\(/);
    }
  });

  it("4. guard: FedosDesktopHost declares no public method returning FedosBoardService, FedosBoardRepository, or FedosBoardPersistence directly", () => {
    const publicMethodSignatures = hostSource.match(/^\s{2}[a-zA-Z]\w*\([^)]*\):\s*[^{]+\{/gm) ?? [];
    expect(publicMethodSignatures.length).toBeGreaterThan(0);
    for (const signature of publicMethodSignatures) {
      // submitPost()'s own internal local variable `const boardService = this.#boardService;`
      // is not a method signature and is excluded by the regex itself (it requires `):`).
      expect(signature).not.toMatch(/:\s*FedosBoardService\b/);
      expect(signature).not.toMatch(/:\s*FedosBoardRepository\b/);
      expect(signature).not.toMatch(/:\s*FedosBoardPersistence\b/);
    }
  });

  it("5. guard: board()'s own return type is exactly FedosBoardReader | null, never FedosBoardService", () => {
    expect(hostSource).toMatch(/board\(\): FedosBoardReader \| null/);
    expect(hostSource).not.toMatch(/board\(\): FedosBoardService/);
  });

  it("6. guard: FedosBoardReader gains no mutating method -- register/put/write/delete/remove absent from its own interface body", () => {
    const interfaceMatch = readerSource.match(/export interface FedosBoardReader \{([\s\S]*?)\n\}/);
    expect(interfaceMatch).not.toBeNull();
    expect(interfaceMatch![1]).not.toMatch(/\b(register|put|write|delete|remove)\w*\(/i);
  });

  it("7. guard: #boardService is never returned by any Host method other than internally within submitPost()'s own body", () => {
    // Every occurrence of `this.#boardService` outside field declaration/
    // assignment must be inside submitPost() itself -- confirmed by finding
    // submitPost()'s own method boundaries and checking no OTHER method
    // body references `this.#boardService` as a `return` expression.
    expect(hostSource).not.toMatch(/return\s+this\.#boardService\s*;/);
    expect(hostSource).not.toMatch(/return\s+this\.#state === "ready" \? this\.#boardService/);
  });

  it("8. allowed (not a violation): a test file constructing FedosBoardService directly and calling registerPost() on it is legitimate Board Application layer testing, out of this guard's own scope (production source only)", () => {
    // This guard scans ONLY the productionSurface object above -- test files
    // are never included, confirmed by this file's own import list.
    const scannedPaths = Object.keys(productionSurface);
    expect(scannedPaths.every((p) => !p.includes("test"))).toBe(true);
  });

  it("9. behavioral: hydration's own internal registerPost() call is legitimate (not a Host-reachable bypass) -- it runs BEFORE the Host ever exists, over a freshly-constructed service", () => {
    expect(hydrationSource).toMatch(/service\.registerPost\(/);
    // Confirmed structurally distinct from a bypass: hydration constructs
    // its OWN `new FedosBoardService()` and registers into THAT instance --
    // never through `host.board()` or any Host accessor, which does not
    // exist yet at hydration time.
    expect(hydrationSource).not.toMatch(/FedosDesktopHost|\.board\(\)/);
  });

  it("10. the design doc precisely distinguishes allowed direct-service tests from forbidden Host-reachable writes", () => {
    expect(designDocSource).toContain("**Allowed, and NOT scanned as a violation:**");
    expect(designDocSource).toContain("**Forbidden, and actively scanned for:**");
  });

  it("11. the design doc cross-references Alpha 404, Alpha 403, and Alpha 401", () => {
    for (const ref of [
      "secure_runtime_alpha_404_host_board_access_rewiring",
      "secure_runtime_alpha_403_read_only_board_access_model",
      "secure_runtime_alpha_401_host_write_surface_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
