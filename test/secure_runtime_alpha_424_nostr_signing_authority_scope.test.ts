import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_424_nostr_signing_authority_scope.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import fedosBoardPostSource from "../src/board/fedos_board_post.ts?raw";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { existsSync } from "node:fs";

/**
 * Secure Runtime Alpha 424 -- "Signing Authority Scope Decision": Stage
 * 3 of the Alpha 422-430 Arc (Phase A). Design/decision only.
 */
describe("Secure Runtime Alpha 424 -- Signing Authority Scope Decision", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(3000);
  });

  it("2. the design doc adopts Option D and states so explicitly", () => {
    expect(designDocSource).toMatch(/\*\*Option D is adopted\.\*\*/);
  });

  it("3. the design doc rejects Option A (arbitrary hash signing) as a generic oracle", () => {
    expect(designDocSource).toMatch(
      /it turns the Secure Runtime into an\s*\nunrestricted signing oracle/,
    );
  });

  it("4. the design doc rejects Option C (FedosBoardPost coupling) explicitly", () => {
    expect(designDocSource).toMatch(/\*\*Rejected — unnecessary coupling/);
  });

  it("5. the design doc fixes kind to exactly {1}, not caller-supplied", () => {
    expect(designDocSource).toMatch(/`kind = 1` only/);
  });

  it("6. the design doc explicitly excludes caller-supplied pubkey, id, and sig", () => {
    expect(designDocSource).toMatch(/a caller-supplied\s*\n`pubkey`, `id`, or `sig`/);
  });

  it("7. structural: FedosBoardPost exists but this Stage's own decision does not import it into the signing boundary", () => {
    expect(fedosBoardPostSource).toMatch(/interface FedosBoardPost/);
    expect(designDocSource).not.toMatch(/import.*FedosBoardPost/);
  });

  it("8. the design doc cross-references Alpha 423 and Alpha 422", () => {
    for (const ref of [
      "secure_runtime_alpha_423_nostr_signing_boundary_options",
      "secure_runtime_alpha_422_nostr_signing_boundary_inventory",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("9. no signing authority source file exists as a result of this Stage", () => {
    expect(existsSync("src/desktop/fedos_nostr_signing_authority.ts")).toBe(false);
    expect(existsSync("src/desktop/fedos_wasm_nostr_signing_authority.ts")).toBe(false);
  });
});
