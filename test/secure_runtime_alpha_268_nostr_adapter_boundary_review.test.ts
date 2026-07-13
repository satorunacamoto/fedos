import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_268_nostr_adapter_boundary_review.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterModuleSource from "../src/board/fedos_board_nostr_adapter.ts?raw";

/**
 * Secure Runtime Alpha 268 -- "Nostr Adapter Boundary Review": Stage 8
 * of the Nostr Canonical Board Adapter Arc. Review only. Confirms the
 * adapter's import list is exactly the three named references and that
 * it never reaches Relay/Runtime/Storage/GUI/Worker/Desktop state.
 */
describe("Secure Runtime Alpha 268 -- Nostr Adapter Boundary Review", () => {
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
      /import \{ validateFedosBoardPost, type FedosBoardPostInput \} from ["']\.\/fedos_board_post_validator\.js["']/,
    );
  });

  it("5. structural: no import of src/desktop/ other than the one type-only FedosValidatedNostrEvent reference", () => {
    const desktopImports = [...adapterModuleSource.matchAll(/from ["'](\.\.\/desktop\/[^"']+)["']/g)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(desktopImports).toEqual(["../desktop/fedos_validated_nostr_event.js"]);
  });

  it("6. structural: no reference to Relay/Runtime/Storage/GUI/Worker/Desktop-application symbols anywhere in the file", () => {
    expect(adapterModuleSource).not.toMatch(
      /FedosRelay|WebSocketRelay|NullRelay|FedosSubscription|AppRuntime|createRuntime|StorageBackend|DesktopApplication|createDesktopApplication|handleRequest/,
    );
  });

  it("7. structural: no async function, no Promise, no await anywhere in the file", () => {
    expect(adapterModuleSource).not.toMatch(/async function|Promise<|\bawait\b/);
  });

  it("8. structural: exactly three module-level const bindings besides the two exported functions", () => {
    const constNames = [...adapterModuleSource.matchAll(/^(?:export )?const (\w+)/gm)].map(
      (m: RegExpMatchArray) => m[1],
    );
    expect(constNames.sort()).toEqual(["FEDOS_BOARD_NOSTR_SUPPORTED_KIND", "HEX_64", "KNOWN_E_TAG_MARKERS"].sort());
  });

  it("9. the design doc cross-references Alpha 266 and Alpha 251", () => {
    for (const ref of [
      "secure_runtime_alpha_266_nostr_board_adapter_implementation",
      "secure_runtime_alpha_251_existing_board_model_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
