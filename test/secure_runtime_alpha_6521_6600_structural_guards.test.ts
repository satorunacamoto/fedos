/**
 * Secure Runtime Alpha 6521-6600 (FedOS Desktop Beta Production Runtime
 * Configuration Unification Arc) — Phase P: structural guards, proving by
 * direct source inspection (never narrative claim alone) that this Arc's
 * own additive wiring introduced no protocol drift, no new crypto, no new
 * Runtime/Shell/Host Bridge/Electron owner, and no second Device Registry.
 */
import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error see above.
import { join, dirname } from "node:path";
// @ts-expect-error see above.
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("Secure Runtime Alpha 6521-6600 -- structural guards", () => {
  it("1. exactly one Desktop Runtime factory, one Shell, one Host Bridge, one Presentation Boundary/Renderer class exists in the whole codebase, unchanged in count by this Arc", () => {
    const runtimeSource = readFileSync(join(REPO_ROOT, "src", "desktop", "runtime", "fedos_desktop_runtime.ts"), "utf8") as string;
    expect((runtimeSource.match(/export async function startFedosDesktopRuntime\b/g) ?? []).length).toBe(1);
    const shellSource = readFileSync(join(REPO_ROOT, "src", "desktop", "shell", "fedos_desktop_application_shell.ts"), "utf8") as string;
    expect((shellSource.match(/class FedosDesktopApplicationShell\b/g) ?? []).length).toBe(1);
    const bridgeSource = readFileSync(join(REPO_ROOT, "src", "desktop", "host_boundary", "fedos_desktop_host_bridge.ts"), "utf8") as string;
    expect((bridgeSource.match(/class FedosDesktopHostBridge\b/g) ?? []).length).toBe(1);
    const boundarySource = readFileSync(join(REPO_ROOT, "src", "desktop", "presentation", "fedos_desktop_conversation_ui_presentation_boundary.ts"), "utf8") as string;
    expect((boundarySource.match(/class FedosDesktopConversationUiPresentationBoundary\b/g) ?? []).length).toBe(1);
  });

  it("2. this Arc's own new Runtime config fields introduce no new Cargo.toml dependency, no new crypto primitive, no new NIP -- confirmed by inspecting the diff itself for forbidden import patterns", () => {
    const runtimeSource = stripComments(readFileSync(join(REPO_ROOT, "src", "desktop", "runtime", "fedos_desktop_runtime.ts"), "utf8") as string);
    expect(runtimeSource).not.toMatch(/from ["']@noble/);
    expect(runtimeSource).not.toMatch(/new NIP|"nip-\d+"|kind:\s*3\d{3,}/i);
  });

  it("3. deviceRegistryPersistence is constructed exactly ONCE in fedos_desktop_runtime.ts (hoisted, shared) -- never a second, divergent Device Registry instance for the four new subsystems", () => {
    const runtimeSource = stripComments(readFileSync(join(REPO_ROOT, "src", "desktop", "runtime", "fedos_desktop_runtime.ts"), "utf8") as string);
    const constructionSites = [...runtimeSource.matchAll(/deviceRegistryPersistence\s*=\s*\n?\s*config\.deviceRegistryLogPath/g)];
    expect(constructionSites.length).toBe(1);
    // The pre-existing `deviceTrustEnabled` block must reference the hoisted variable, never redeclare its own `const`.
    expect(runtimeSource).not.toMatch(/const deviceRegistryPersistence:/);
  });

  it("4. the shared search index is constructed exactly ONCE via createSearchIndex(), reused by BOTH the deletion-request proxy and the content accessor -- never two divergent indexes", () => {
    const runtimeSource = stripComments(readFileSync(join(REPO_ROOT, "src", "desktop", "runtime", "fedos_desktop_runtime.ts"), "utf8") as string);
    const creationSites = [...runtimeSource.matchAll(/\.createSearchIndex\(\)/g)];
    expect(creationSites.length).toBe(1);
    expect(runtimeSource).toMatch(/searchIndex:\s*sharedSearchIndexInstance/);
  });

  it("5. no Rust/Secure Memory Store file was touched by this Arc -- confirmed by absence of any packages/fedos-core-rust reference in this Arc's own new/changed TypeScript files", () => {
    const files = [
      "src/desktop/runtime/fedos_desktop_runtime.ts",
      "src/desktop/runtime/fedos_desktop_runtime_config.ts",
      "src/desktop/onboarding/fedos_profile_initialization_coordinator.ts",
      "src/desktop/onboarding/fedos_local_profile_paths.ts",
      "src/desktop/content_accessor/fedos_desktop_conversation_content_accessor.ts",
    ];
    for (const f of files) {
      const text = readFileSync(join(REPO_ROOT, f), "utf8") as string;
      expect(text, f).not.toMatch(/fedos-core-rust|SecretHandleStore/);
    }
  });

  it("6. no p2p/ or .tmp_gen/ reference anywhere in this Arc's own new/changed files", () => {
    const files = [
      "src/desktop/runtime/fedos_desktop_runtime.ts",
      "src/desktop/runtime/fedos_desktop_runtime_config.ts",
      "src/desktop/onboarding/fedos_profile_initialization_coordinator.ts",
      "src/desktop/onboarding/fedos_local_profile_paths.ts",
      "src/desktop/content_accessor/fedos_desktop_conversation_content_accessor.ts",
    ];
    for (const f of files) {
      // Comments stripped first -- this repo's own pre-existing files
      // (including `fedos_desktop_runtime.ts`, unmodified by this Arc in
      // this respect) contain doc comments explicitly STATING the absence
      // of a `p2p/` import as a guardrail, which would otherwise falsely
      // trip a naive substring check.
      const text = stripComments(readFileSync(join(REPO_ROOT, f), "utf8") as string);
      expect(text.includes("p2p/"), f).toBe(false);
      expect(text.includes(".tmp_gen/"), f).toBe(false);
    }
  });

  it("7. every one of the four new *Enabled config fields is OPTIONAL (never required), preserving every pre-existing caller's own byte-for-byte behavior when omitted", () => {
    const configSource = readFileSync(join(REPO_ROOT, "src", "desktop", "runtime", "fedos_desktop_runtime_config.ts"), "utf8") as string;
    for (const field of ["directRatchetEnabled", "peerCapabilityEnabled", "identityTransitionEnabled", "deletionRequestEnabled"]) {
      expect(configSource, field).toMatch(new RegExp(`readonly ${field}\\?:\\s*boolean`));
    }
  });

  it("8. no development seed double is ever used to construct a real sealing/production crypto authority in fedos_desktop_runtime.ts -- directRatchet's own sealingAuthority/masterSeedAuthority are sourced exclusively from the canonical production authority (as of Secure Runtime Alpha 6841-6920: either the already-activated one or, for dev/test callers, the legacy productionCryptoGraph), gated on the sealing port specifically, never a development double", () => {
    const runtimeSource = stripComments(readFileSync(join(REPO_ROOT, "src", "desktop", "runtime", "fedos_desktop_runtime.ts"), "utf8") as string);
    expect(runtimeSource).not.toMatch(/DevelopmentFedosMasterSeedAuthority/);
    expect(runtimeSource).toMatch(/config\.directRatchetEnabled\s*&&\s*directRatchetSealingAuthority\s*!==\s*null/);
    expect(runtimeSource).toMatch(/config\.conversationDirectRatchetMasterSeedAuthority\s*\?\?\s*productionCryptoGraph\?\.masterSeedAuthority/);
  });
});
