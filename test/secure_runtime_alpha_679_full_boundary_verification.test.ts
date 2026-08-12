import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardRuntimeSource from "../src/os/messenger/board/runtime/fedos_board_runtime.ts?raw";
// @ts-expect-error see above.
import authorAuthoritySource from "../src/os/messenger/board/runtime/identity/fedos_desktop_public_author_authority.ts?raw";
// @ts-expect-error see above.
import anonymousAuthoritySource from "../src/os/messenger/board/runtime/identity/anonymous_local_public_author_authority.ts?raw";
// @ts-expect-error see above.
import policyAuthoritySource from "../src/os/messenger/board/runtime/policy/fedos_conversation_policy_authority.ts?raw";
// @ts-expect-error see above.
import policySource from "../src/os/messenger/board/runtime/policy/fedos_conversation_policy.ts?raw";
// @ts-expect-error see above.
import eligibilityEvaluatorSource from "../src/os/messenger/board/runtime/eligibility/fedos_outbound_eligibility_evaluator.ts?raw";
// @ts-expect-error see above.
import desktopRuntimeSource from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime.ts?raw";
// @ts-expect-error see above.
import runtimeConfigSource from "../src/os/messenger/desktop/runtime/fedos_desktop_runtime_config.ts?raw";
import { readFileSync } from "node:fs";
import { assertFedosRootDependencyInvariant, assertFedosRootDevDependencyInvariant } from "./helpers/fedos_root_dependency_invariant.js";

const ARC_SOURCE_FILES: Record<string, string> = {
  "fedos_board_runtime.ts": boardRuntimeSource as string,
  "fedos_desktop_public_author_authority.ts": authorAuthoritySource as string,
  "anonymous_local_public_author_authority.ts": anonymousAuthoritySource as string,
  "fedos_conversation_policy_authority.ts": policyAuthoritySource as string,
  "fedos_conversation_policy.ts": policySource as string,
  "fedos_outbound_eligibility_evaluator.ts": eligibilityEvaluatorSource as string,
  "fedos_desktop_runtime.ts": desktopRuntimeSource as string,
  "fedos_desktop_runtime_config.ts": runtimeConfigSource as string,
};

/** Only actual `import ... from "..."` lines -- prose in doc comments may freely NAME an excluded module without tripping these guards. */
function importLines(source: string): string[] {
  return source.split("\n").filter((line) => /^\s*import\b/.test(line));
}

/**
 * Secure Runtime Alpha 679 ("Full Boundary Verification") — Stage 9 of
 * Phase D of the Alpha 641-680 Arc. Every check below inspects actual
 * `import` statements only, never whole-file prose -- this Arc's own
 * doc comments freely NAME excluded modules (p2p/, Worker, crypto, ...)
 * to explain WHY they are absent, which would otherwise trip a naive
 * whole-file substring search.
 */
describe("Secure Runtime Alpha 679 -- Full Boundary Verification", () => {
  it("1. no Worker coupling anywhere in this Arc's own files", () => {
    for (const [name, source] of Object.entries(ARC_SOURCE_FILES)) {
      for (const line of importLines(source)) {
        expect(line, name).not.toMatch(/worker\.js|src\/worker/i);
      }
    }
  });

  it("2. no GUI/rendering import anywhere in this Arc's own files", () => {
    for (const [name, source] of Object.entries(ARC_SOURCE_FILES)) {
      for (const line of importLines(source)) {
        expect(line, name).not.toMatch(/react|from ".*dom"/i);
      }
    }
  });

  it("3. no private/direct command, membership, invitation, encryption, pseudonym, Ontology, or Humanizer/AI reference in any exported symbol name", () => {
    const forbidden = [
      "createPrivateThread",
      "createDirectMessage",
      "InviteToken",
      "Pseudonym",
      "Ontology",
      "Humanizer",
    ];
    for (const [name, source] of Object.entries(ARC_SOURCE_FILES)) {
      for (const exportLine of source.split("\n").filter((line: string) => /^export /.test(line))) {
        for (const term of forbidden) {
          expect(exportLine, `${name}: "${exportLine.trim()}"`).not.toContain(term);
        }
      }
    }
  });

  it("4. no p2p/ import anywhere in this Arc's own files", () => {
    for (const [name, source] of Object.entries(ARC_SOURCE_FILES)) {
      for (const line of importLines(source)) {
        expect(line, name).not.toMatch(/p2p\//);
      }
    }
  });

  it("5. no new dependency -- package.json dependency/devDependency counts unchanged (2 production, 3 dev)", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8") as string);
    assertFedosRootDependencyInvariant(packageJson.dependencies);
    assertFedosRootDevDependencyInvariant(packageJson.devDependencies);
  });

  it("6. Cargo.toml is untouched by this Arc -- no Rust change", () => {
    const cargoToml = readFileSync("packages/fedos-core-rust/Cargo.toml", "utf8") as string;
    expect(cargoToml).not.toMatch(/Alpha 6[4-8]\d/);
  });

  it("7. no Relay import in the new Identity/Policy/Eligibility modules", () => {
    for (const name of [
      "fedos_desktop_public_author_authority.ts",
      "anonymous_local_public_author_authority.ts",
      "fedos_conversation_policy_authority.ts",
      "fedos_conversation_policy.ts",
      "fedos_outbound_eligibility_evaluator.ts",
    ]) {
      for (const line of importLines(ARC_SOURCE_FILES[name]!)) {
        expect(line, name).not.toMatch(/FedosRelay|fedos_relay/i);
      }
    }
  });

  it("8. no crypto/signing/master-seed import in the new Identity/Policy/Eligibility modules", () => {
    for (const name of [
      "fedos_desktop_public_author_authority.ts",
      "anonymous_local_public_author_authority.ts",
      "fedos_conversation_policy_authority.ts",
      "fedos_conversation_policy.ts",
      "fedos_outbound_eligibility_evaluator.ts",
    ]) {
      for (const line of importLines(ARC_SOURCE_FILES[name]!)) {
        expect(line, name).not.toMatch(/src\/crypto|nostr\/sign|master_seed/);
      }
    }
  });
});
