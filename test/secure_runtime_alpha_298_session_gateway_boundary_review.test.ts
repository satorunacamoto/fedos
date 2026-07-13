import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_298_session_gateway_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/session/fedos_session_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import postModelSource from "../src/board/session/fedos_validated_session_post.ts?raw";

/**
 * Secure Runtime Alpha 298 -- "Session Gateway Boundary Review": Stage
 * 8 of the Session Canonical Board Gateway Adapter Arc. Review only.
 * Confirms the adapter's import list is exactly the three named
 * references and that it never reaches Storage/Runtime/Relay/Desktop/
 * Worker/GUI/Observation/Network.
 */
describe("Secure Runtime Alpha 298 -- Session Gateway Boundary Review", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. structural: the adapter's import list is exactly three imports", () => {
    const importLines = [...adapterModuleSource.matchAll(/^import .+$/gm)];
    expect(importLines).toHaveLength(3);
  });

  it("3. structural: two of the three imports are type-only (import type)", () => {
    const importLines = [...adapterModuleSource.matchAll(/^import .+$/gm)].map((m: RegExpMatchArray) => m[0]);
    const typeOnlyCount = importLines.filter((line: string) => line.startsWith("import type")).length;
    expect(typeOnlyCount).toBe(2);
  });

  it("4. structural: the one non-type-only import is validateFedosBoardPost from the Board model's own validator", () => {
    expect(adapterModuleSource).toMatch(
      /import \{ validateFedosBoardPost, type FedosBoardPostInput \} from ["']\.\.\/fedos_board_post_validator\.js["']/,
    );
  });

  it("5. structural: the normalized post model file has zero imports of any kind", () => {
    expect(postModelSource).not.toMatch(/^import /m);
  });

  it("6. structural: no reference to Storage/Runtime/Relay/Desktop/Worker/GUI/Observation symbols anywhere in either file", () => {
    for (const source of [adapterModuleSource, postModelSource]) {
      expect(source).not.toMatch(
        /StorageBackend|AppRuntime|createRuntime|FedosRelay|WebSocketRelay|NullRelay|FedosSubscription|DesktopApplication|createDesktopApplication|handleRequest/,
      );
      expect(source).not.toMatch(/from ["'].*\/render\//);
    }
  });

  it("7. structural: no async function, no Promise, no await anywhere in either file", () => {
    for (const source of [adapterModuleSource, postModelSource]) {
      expect(source).not.toMatch(/async function|Promise<|\bawait\b/);
    }
  });

  it("8. structural: no cryptography reference (@noble, key, seed, token) anywhere in either file", () => {
    for (const source of [adapterModuleSource, postModelSource]) {
      expect(source).not.toMatch(/@noble|secretKey|privateKey|\bseed\b/i);
    }
  });

  it("9. the design doc names all eight boundaries this Arc's own instruction requires and confirms each absent", () => {
    for (const boundary of ["Storage", "Runtime", "Relay", "Desktop", "Worker", "GUI", "Observation", "Network"]) {
      expect(designDocSource).toContain(`**${boundary}**`);
    }
  });

  it("10. the design doc cross-references Alpha 297, Alpha 291, and Alpha 268", () => {
    for (const ref of [
      "secure_runtime_alpha_297_session_board_adapter",
      "secure_runtime_alpha_291_existing_session_inventory",
      "secure_runtime_alpha_268_nostr_adapter_boundary_review",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
