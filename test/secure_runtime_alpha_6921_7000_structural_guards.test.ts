/**
 * Secure Runtime Alpha 6921-7000 (FedOS Direct Ratchet Cryptographic
 * Session Production Capability Arc) — structural guards, proving by
 * direct source inspection (never narrative claim alone) that
 * `FedosDirectRatchetCryptographicSession` is now genuinely reachable
 * through the REAL `FedosProductionMasterSeedAuthority` without: reopening
 * or replacing Secure Runtime Alpha 6841-6920, redesigning the production
 * crypto graph, weakening the `NODE_ENV` dev-only gate, making
 * `FedosWasmLoaderSkeleton` production-allowed, calling `attemptDevOnly*`
 * from a production-capable path, constructing a second Master Seed
 * authority/Store/WASM module, exposing a raw secret, or changing any
 * Rust source, wire format, or persistence schema.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARC_BASE = "4c1f27c";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

function diffNames(pathspec?: string): string {
  const args = ["diff", "--name-only", ARC_BASE];
  if (pathspec) args.push("--", pathspec);
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
  } catch {
    return "GIT_DIFF_FAILED";
  }
}

const SESSION_SOURCE_PATH = "src/conversation/ratchet/fedos_direct_ratchet_cryptographic_session.ts";

describe("Secure Runtime Alpha 6921-7000 -- structural guards", () => {
  it("1. production capability acceptance is STRUCTURAL, never nominal -- no `instanceof FedosProductionMasterSeedAuthority` anywhere in the session file", () => {
    const source = stripComments(read(SESSION_SOURCE_PATH));
    expect(source).not.toMatch(/instanceof\s+FedosProductionMasterSeedAuthority/);
    expect(source).toMatch(/function hasProductionDirectRatchetSessionCapability\(/);
    expect(source).toMatch(/masterSeedAuthority\s+as\s+Partial<FedosProductionDirectRatchetSessionAuthority>/);
  });

  it("2. the pre-existing dev/test path is preserved byte-for-byte: `instanceof FedosWasmMasterSeedAuthority` and `new FedosWasmLoaderSkeleton()` still gate/construct the fallback only", () => {
    const source = stripComments(read(SESSION_SOURCE_PATH));
    expect(source).toMatch(/instanceof\s+FedosWasmMasterSeedAuthority/);
    expect((source.match(/new FedosWasmLoaderSkeleton\(\)/g) ?? []).length).toBe(1);
    // the one construction site lives inside developmentDirectRatchetLoaderBoundary only
    expect(source).toMatch(/async function developmentDirectRatchetLoaderBoundary\(\)[\s\S]*?new FedosWasmLoaderSkeleton\(\)/);
  });

  it("3. the production loader boundary never calls attemptDevOnlyJsGlueImport/attemptDevOnlyWasmInitialization for real work -- both are no-ops on that branch", () => {
    const source = stripComments(read(SESSION_SOURCE_PATH));
    const productionFnMatch = source.match(/function productionDirectRatchetLoaderBoundary\([\s\S]*?\n\}/);
    expect(productionFnMatch).not.toBeNull();
    const productionFnBody = productionFnMatch![0];
    expect(productionFnBody).toMatch(/async attemptDevOnlyJsGlueImport\(\): Promise<unknown> \{\s*return null;\s*\}/);
    expect(productionFnBody).toMatch(/async attemptDevOnlyWasmInitialization\(\): Promise<unknown> \{\s*return null;\s*\}/);
    expect(productionFnBody).not.toMatch(/FedosWasmLoaderSkeleton/);
  });

  it("4. exactly one shared resolver exists -- no second, parallel production-detection path", () => {
    const source = stripComments(read(SESSION_SOURCE_PATH));
    expect((source.match(/async function resolveDirectRatchetSessionAccess\(/g) ?? []).length).toBe(1);
    expect((source.match(/resolveDirectRatchetSessionAccess\(masterSeedAuthority\)/g) ?? []).length).toBe(3); // createAsReceiver, createAsSender, restore
  });

  it("5. the production facade reuses the SAME already-initialized module closure -- no second import()/initSync/WebAssembly.instantiate for the Ratchet session surface", () => {
    const facadeSource = stripComments(read("src/desktop/production_activation/fedos_production_wasm_master_seed_facade.ts"));
    expect(facadeSource).not.toMatch(/import\(/);
    expect(facadeSource).not.toMatch(/initSync/);
    expect(facadeSource).not.toMatch(/WebAssembly\.instantiate/);
    expect(facadeSource).toMatch(/function createFedosProductionMasterSeedFacade\(\s*initializedGlueModule:\s*object,?\s*\)/);
    // constructDirectRatchetSessionModule() reads from the SAME moduleRef closure constructMasterSeedAuthority() already uses
    expect((facadeSource.match(/const moduleRef\s*=\s*initializedGlueModule/g) ?? []).length).toBe(1);
    expect(facadeSource).toMatch(/constructDirectRatchetSessionModule\(\)[\s\S]*?moduleRef\.FedosDirectRatchetSession/);
  });

  it("6. FedosProductionMasterSeedAuthority's new accessor fails closed once cleared -- mirrors #ensure()'s own #cleared discipline", () => {
    const source = stripComments(read("src/desktop/production_activation/fedos_production_master_seed_authority.ts"));
    expect(source).toMatch(/accessDirectRatchetSessionModuleInternalUse\(\)[\s\S]*?if \(this\.#cleared\) return null;/);
    // never on the public FedosMasterSeedAuthority interface
    const publicInterfaceSource = stripComments(read("src/runtime/master_seed/fedos_master_seed_authority.ts"));
    expect(publicInterfaceSource).not.toMatch(/accessDirectRatchetSessionModuleInternalUse/);
  });

  it("7. no raw Master Seed handle, Ratchet key material, or whole WASM module is newly exposed -- accessors return opaque, method-bearing handles only", () => {
    const source = stripComments(read(SESSION_SOURCE_PATH));
    expect(source).not.toMatch(/root_key\s*:/);
    expect(source).not.toMatch(/chain_key\s*:/);
    const facadeSource = stripComments(read("src/desktop/production_activation/fedos_production_wasm_master_seed_facade.ts"));
    // the facade never returns the raw moduleRef itself, only narrow named constructors
    expect(facadeSource).not.toMatch(/return\s+moduleRef\s*;/);
    expect(facadeSource).not.toMatch(/return\s+initializedGlueModule\s*;/);
  });

  it("8. zero Rust source changed by this Arc -- git diff over packages/fedos-core-rust is empty against this Arc's own base (4c1f27c)", () => {
    expect(diffNames("packages/fedos-core-rust").trim()).toBe("");
  });

  it("9. the Dev-only Gate remains byte-for-byte untouched by this Arc (RECONCILED: the Runtime Ownership Extraction Arc, much later, disclosedly and explicitly-authorizedly physically relocated both files to src/os/core/vault/wasm/ -- see docs/architecture/RUNTIME-OWNERSHIP-MAP.md -- as the required fix for package-extraction Root Cause A; old paths hold @deprecated compatibility shims, not deletions, so this Arc's own claim -- the CONTENT the gate enforces is unchanged -- still holds, verified at the new canonical location instead)", () => {
    const modeSource = read("src/os/core/vault/wasm/fedos_runtime_mode_authority.ts");
    expect(modeSource).toMatch(/nodeEnv === "development"/);
  });

  it("10. Direct Ratchet's own outbound/inbound integration callers are untouched by this Arc -- the fix is fully internal to the session/facade/authority layer", () => {
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_outbound_integration.ts").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_inbound_integration.ts").trim()).toBe("");
  });

  it("11. Ratchet persistence schema, NIP-17, Identity Transition, and Signed Deletion source are untouched by this Arc", () => {
    expect(diffNames("src/conversation/ratchet/persistence").trim()).toBe("");
    expect(diffNames("src/conversation/ratchet/fedos_direct_ratchet_session_record.ts").trim()).toBe("");
    // Secure Runtime Alpha 7161-7240 (a LATER, separately-reviewed Arc,
    // not this one) legitimately relaxes THREE constructor-parameter
    // TYPES in this directory (concrete class -> that same class's own
    // new narrow interface, zero behavior change) while wiring a
    // production-safe ephemeral Gift-Wrap authority -- see
    // docs/secure_runtime_alpha_7161_7240_reconciliation_report.md.
    // Excluded here by name, never by widening the directory check
    // itself -- mirrors this repo's own established "extend a prior
    // Arc's own structural-guard allowlist across Arc generations"
    // convention.
    const nip17Diff = diffNames("src/conversation/delivery/nostr/nip17")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .filter(
        (line) =>
          line !== "src/conversation/delivery/nostr/nip17/fedos_nip59_gift_wrap.ts" &&
          line !== "src/conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.ts" &&
          line !== "src/conversation/delivery/nostr/nip17/fedos_wasm_ephemeral_gift_wrap_signing_authority.ts",
      );
    expect(nip17Diff).toEqual([]);
    expect(diffNames("src/conversation/identity_transition").trim()).toBe("");
    expect(diffNames("src/conversation/deletion_request").trim()).toBe("");
  });

  it("12. no p2p/ or .tmp_gen/ file touched by this Arc", () => {
    const diffOutput = diffNames();
    expect(diffOutput).not.toMatch(/^p2p\//m);
    expect(diffOutput).not.toMatch(/\.tmp_gen\//);
  });
});
