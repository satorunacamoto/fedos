import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_291_existing_session_inventory.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionBoundarySource from "../src/identity/session_boundary.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../package.json?raw";

/**
 * Secure Runtime Alpha 291 -- "Existing Session Inventory": Stage 1 of
 * the Session Canonical Board Gateway Adapter Arc (Alpha 291-300).
 * Review only. Confirms no Session-messenger code exists in this
 * repository before this Arc, and flags src/identity/session_boundary.ts
 * as an unrelated, differently-scoped "session" (web/app lifecycle, not
 * the Session messenger).
 */
describe("Secure Runtime Alpha 291 -- Existing Session Inventory", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. structural: session_boundary.ts is confirmed to be about web/app session lifecycle, not the Session messenger", () => {
    expect(sessionBoundarySource).toMatch(/session-lifecycle EVENT was requested/);
    expect(sessionBoundarySource).not.toMatch(/Oxen|messenger|onion/i);
  });

  it("3. the design doc explicitly flags this naming collision and confirms session_boundary.ts is not reused", () => {
    expect(designDocSource).toMatch(/A critical naming collision, found and resolved first/);
    expect(designDocSource).toMatch(/This file is NOT reused by this Arc in any way/);
  });

  it("4. structural: package.json carries no Session/Oxen-related dependency", () => {
    const pkg = JSON.parse(packageJsonSource);
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).toEqual(["@noble/curves", "@noble/hashes"]);
  });

  it("5. the design doc confirms FedosBoardSourceProtocol already reserves 'session' with a Gateway-shaped convention", () => {
    expect(designDocSource).toMatch(/a\s*\ngateway-assigned reference to a published board message/);
  });

  it("6. the design doc concludes new files belong under src/board/session/, never src/session/", () => {
    expect(designDocSource).toContain("src/board/session/");
    expect(designDocSource).toMatch(/never under `src\/session\/`/);
  });

  it("7. the design doc cross-references Alpha 290, Alpha 266, Alpha 253, and Alpha 153", () => {
    for (const ref of [
      "secure_runtime_alpha_290_atproto_board_adapter_completion",
      "secure_runtime_alpha_266_nostr_board_adapter_implementation",
      "secure_runtime_alpha_253_board_source_provenance",
      "secure_runtime_alpha_153_session_atproto_wallet_root",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });
});
