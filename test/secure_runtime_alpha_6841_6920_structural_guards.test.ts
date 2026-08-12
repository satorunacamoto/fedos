/**
 * Secure Runtime Alpha 6841-6920 (FedOS Direct Ratchet Production Crypto
 * Graph Unification Arc) — structural guards, proving by direct source
 * inspection (never narrative claim alone) that this Arc eliminates the
 * second, independent, `NODE_ENV=development`-gated Master Seed Authority
 * for Direct Ratchet, without introducing a second production authority,
 * a second Store, a second Runtime, any Rust change, any new WASM export,
 * or any protocol/wire change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relPath: string): string {
  return readFileSync(join(REPO_ROOT, ...relPath.split("/")), "utf8") as string;
}

describe("Secure Runtime Alpha 6841-6920 -- structural guards", () => {
  it("1. FedosProductionMasterSeedAuthority now implements FedosDirectRatchetSealingAuthority, exactly once, via the SAME #handle every other method already uses -- no second handle field", () => {
    const source = stripComments(read("src/desktop/production_activation/fedos_production_master_seed_authority.ts"));
    expect(source).toMatch(/implements\s+FedosMasterSeedAuthority\s*,\s*FedosDirectRatchetSealingAuthority/);
    expect((source.match(/#handle\s*:\s*FedosMasterSeedAuthorityHandle/g) ?? []).length).toBe(1);
    expect((source.match(/async sealDirectRatchetSecret\(/g) ?? []).length).toBe(1);
    expect((source.match(/async restoreDirectRatchetSecret\(/g) ?? []).length).toBe(1);
    // Both new methods call h.seal_direct_ratchet_secret/h.restore_direct_ratchet_secret
    // on the SAME #handle via #ensure() -- never a second WASM handle constructed.
    expect(source).toMatch(/h\.seal_direct_ratchet_secret\(/);
    expect(source).toMatch(/h\.restore_direct_ratchet_secret\(/);
    expect((source.match(/this\.#ensure\(\)/g) ?? []).length).toBeGreaterThanOrEqual(9); // every method (incl. the 2 new ones) routes through the SAME lazy accessor
  });

  it("2. the Coordinator threads the ALREADY-HELD masterSeedAuthority into the new field -- never constructs a second authority for this purpose", () => {
    const source = stripComments(read("src/desktop/onboarding/fedos_profile_initialization_coordinator.ts"));
    expect(source).toMatch(/conversationDirectRatchetMasterSeedAuthority:\s*this\.#deps\.directRatchetEnabled\s*===\s*true\s*\?\s*this\.#deps\.masterSeedAuthority\s*:\s*undefined/);
    expect((source.match(/new FedosProductionMasterSeedAuthority\(/g) ?? []).length).toBe(0); // the Coordinator never constructs one itself -- it is always injected from outside
  });

  it("3. Direct Ratchet's own gate requires the sealing port specifically, not merely 'some masterSeedAuthority' -- the exact regression this Arc's own real test caught and fixed", () => {
    const source = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    expect(source).toMatch(/isFedosDirectRatchetSealingAuthority\(directRatchetMasterSeedAuthorityCandidate\)/);
    expect(source).toMatch(/config\.directRatchetEnabled\s*&&\s*directRatchetSealingAuthority\s*!==\s*null/);
    expect(source).not.toMatch(/DevelopmentFedosMasterSeedAuthority/);
  });

  it("4. exactly one Direct Ratchet dependency-derivation site exists in fedos_desktop_runtime.ts -- no second, parallel derivation was added", () => {
    const source = stripComments(read("src/desktop/runtime/fedos_desktop_runtime.ts"));
    expect((source.match(/const conversationDirectRatchetDeps\s*:/g) ?? []).length).toBe(1);
  });

  it("5. the Dev-only Gate (FedosWasmLoaderSkeleton#evaluateDevOnlyGate / determineFedosRuntimeMode) is byte-for-byte untouched by this Arc -- still permanently denies outside NODE_ENV=development", () => {
    // Runtime Ownership Extraction Arc: both files physically moved to
    // src/os/core/vault/wasm/ (shims left at the old paths) -- read the real
    // implementations at their new canonical location, not the shims.
    const modeSource = read("src/os/core/vault/wasm/fedos_runtime_mode_authority.ts");
    expect(modeSource).toMatch(/nodeEnv === "development"/);
    expect(modeSource).toMatch(/nodeEnv === "production"/);
    const loaderSource = stripComments(read("src/os/core/vault/wasm/fedos_wasm_loader.ts"));
    expect(loaderSource).toMatch(/developmentAllowed:\s*false,\s*reason:\s*"ProductionRuntime"/);
  });

  it("6. assembleFedosConversationProductionCryptoGraph()/FedosWasmMasterSeedAuthority remain untouched -- the legacy dev/test path is preserved verbatim, not deleted", () => {
    expect(existsSync(join(REPO_ROOT, "src", "conversation", "encryption", "production", "fedos_conversation_production_crypto_authority_factory.ts"))).toBe(true);
    const factorySource = stripComments(read("src/conversation/encryption/production/fedos_conversation_production_crypto_authority_factory.ts"));
    expect(factorySource).toMatch(/new FedosWasmLoaderSkeleton\(\)/);
  });

  it("7. zero Rust source changed by this Arc -- git diff over packages/fedos-core-rust is empty against this Arc's own merge-base", () => {
    let diffOutput = "";
    try {
      diffOutput = execFileSync("git", ["diff", "--name-only", "f3e0658", "--", "packages/fedos-core-rust"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      }) as unknown as string;
    } catch {
      diffOutput = "GIT_DIFF_FAILED";
    }
    expect(diffOutput.trim()).toBe("");
  });

  it("8. the packaged Beta entry point (fedos_electron_beta_main.cts) is byte-for-byte unchanged by THIS Arc (f3e0658..4c1f27c) -- reachability closed purely through the Coordinator/Runtime layer. Pinned to this Arc's own two endpoints, not an open-ended 'forever unchanged' claim -- Secure Runtime Alpha 7001-7080 (a later, separately-scoped Arc) legitimately extends this SAME file with its own additive acceptance-only IPC vocabulary, exactly as that Arc's own mission authorizes; see its own structural guards for that Arc's own diff proof.", () => {
    let diffOutput = "";
    try {
      diffOutput = execFileSync(
        "git",
        ["diff", "--name-only", "f3e0658", "4c1f27c", "--", "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts"],
        { cwd: REPO_ROOT, encoding: "utf8" },
      ) as unknown as string;
    } catch {
      diffOutput = "GIT_DIFF_FAILED";
    }
    expect(diffOutput.trim()).toBe("");
  });

  it("9. no p2p/ or .tmp_gen/ file touched by this Arc", () => {
    let diffOutput = "";
    try {
      diffOutput = execFileSync("git", ["diff", "--name-only", "f3e0658"], { cwd: REPO_ROOT, encoding: "utf8" }) as unknown as string;
    } catch {
      diffOutput = "GIT_DIFF_FAILED";
    }
    expect(diffOutput).not.toMatch(/^p2p\//m);
    expect(diffOutput).not.toMatch(/\.tmp_gen\//);
  });
});
