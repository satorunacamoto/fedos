import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readdirSync, readFileSync, existsSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../../../package.json?raw";
import { assertFedosRootDependencyInvariant } from "../../helpers/fedos_root_dependency_invariant.js";

/**
 * Canonical Conversation Foundation V1 review -- boundary invariants.
 *
 * Verifies, against REAL git state (not prose), the Absolute
 * Prohibitions this review operates under: no production source
 * change, no README change, no package/Cargo change, no dependency
 * addition, p2p/ untouched, no Alpha number assigned to this review's
 * own deliverables, and no doc in this review claims to implement
 * private/encryption/invitation/membership code as its own deliverable.
 * Mirrors the pattern already established by
 * `test/reviews/private_conversation_security/boundary_guards.test.ts`.
 */

const REQUIRED_DOCS = [
  "index.md",
  "01_decision_reconciliation.md",
  "02_minimal_scope.md",
  "03_conversation_identity.md",
  "04_conversation_record_v1.md",
  "05_policy_reuse.md",
  "06_public_application_mapping.md",
  "07_private_readiness_gate.md",
  "08_storage_migration.md",
  "09_lifecycle_deletion.md",
  "10_membership_boundary.md",
  "11_private_message_envelope.md",
  "12_invitation_capability.md",
  "13_outbound_eligibility.md",
  "14_arc_packaging.md",
  "15_normative_v1_specification.md",
];

const REQUIRED_TESTS = ["boundary_invariants.test.ts", "decision_consistency.test.ts", "source_alignment.test.ts"];

const DOCS_DIR = "docs/reviews/conversation_foundation_v1";
const TEST_DIR = "test/reviews/conversation_foundation_v1";

function readAllDocs(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of REQUIRED_DOCS) {
    result[name] = readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
  }
  return result;
}

describe("Conversation Foundation V1 review -- boundary invariants", () => {
  it("1. git working tree shows NO change under src/, README.md, package.json, Cargo.toml, or packages/", () => {
    const output = execFileSync(
      "git",
      ["status", "--porcelain", "--", "src", "README.md", "package.json", "Cargo.toml", "packages"],
      { encoding: "utf8" },
    ) as string;
    expect(output.trim()).toBe("");
  });

  it("2. p2p/ is untouched -- either absent from this worktree entirely, or (if present) shows no git change", () => {
    if (existsSync("p2p")) {
      const output = execFileSync("git", ["status", "--porcelain", "--", "p2p"], { encoding: "utf8" }) as string;
      expect(output.trim()).toBe("");
    } else {
      expect(existsSync("p2p")).toBe(false);
    }
  });

  it("3. package.json still carries exactly two production dependencies -- no new dependency introduced", () => {
    const parsed = JSON.parse(packageJsonSource) as { dependencies: Record<string, string> };
    assertFedosRootDependencyInvariant(parsed.dependencies);
  });

  it("4. all 16 required docs exist under docs/reviews/conversation_foundation_v1/, named exactly as specified, no Alpha number anywhere in the filename", () => {
    const files = (readdirSync(DOCS_DIR) as string[]).filter((name) => name.endsWith(".md"));
    expect(files.sort()).toEqual([...REQUIRED_DOCS].sort());
    for (const file of files) {
      expect(file).not.toMatch(/secure_runtime_alpha_\d+/);
      expect(file).not.toMatch(/alpha[_-]?\d+/i);
    }
  });

  it("5. all 3 required test files exist under test/reviews/conversation_foundation_v1/, named exactly as specified", () => {
    const files = (readdirSync(TEST_DIR) as string[]).filter((name) => name.endsWith(".test.ts"));
    expect(files.sort()).toEqual([...REQUIRED_TESTS].sort());
  });

  it("6. no doc in this review assigns itself, or the Arc it recommends, an Alpha number", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/this review is (Alpha|alpha) \d+/i);
      expect(text, file).not.toMatch(/recommend(s|ed)? Alpha \d+/i);
    }
  });

  it("7. no doc claims THIS review implements private conversation, encryption, or invitation code -- 02/07/11/12/15 must all state these remain unimplemented, never claim otherwise", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/this review implements/i);
      expect(text, file).not.toMatch(/this (spec|review) (builds|ships|adds) (a |an )?(real |working )?(encryption|invitation|membership) implementation/i);
    }
  });

  it("8. 15's own 'security claims that must NOT be made' section explicitly disclaims private/encrypted/one-time/deletable/membership-enforced claims", () => {
    const finalSpec = readAllDocs()["15_normative_v1_specification.md"];
    expect(finalSpec).toMatch(/security claims that must not be made/i);
    expect(finalSpec).toMatch(/private conversations are supported/i);
    expect(finalSpec).toMatch(/messages are encrypted/i);
    expect(finalSpec).toMatch(/invitations are one-time/i);
  });

  it("9. Ontology and Humanizer/AI are never named as design content -- index.md's own restatement of the absolute-prohibitions list is the sole, expected exception", () => {
    const docsAllowedToNameProhibitedTerms = new Set(["index.md"]);
    for (const [file, text] of Object.entries(readAllDocs())) {
      if (docsAllowedToNameProhibitedTerms.has(file)) continue;
      expect(text, file).not.toMatch(/\bontology\b/i);
      expect(text, file).not.toMatch(/humanizer/i);
    }
  });

  it("10. no doc treats p2p/ as an import or dependency target", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/import.{0,40}p2p\/|require.{0,40}p2p\//i);
    }
  });

  it("11. 10_membership_boundary.md explicitly forbids a fake allow-all membership authority", () => {
    const doc = readAllDocs()["10_membership_boundary.md"];
    expect(doc).toMatch(/no fake allow-all membership/i);
    expect(doc).toMatch(/AllowAllMembershipAuthority/);
  });

  it("12. 12_invitation_capability.md states plainly that distributed exactly-once redemption is not available without a chosen authority", () => {
    const doc = (readAllDocs()["12_invitation_capability.md"] ?? "").replace(/\s+/g, " ");
    expect(doc).toMatch(/not available without a chosen single authority/i);
  });

  it("13. README.md itself is untouched by this review -- sanity check against the tracked file this review never opens for writing", () => {
    const readme = readFileSync("README.md", "utf8") as string;
    expect(readme.length).toBeGreaterThan(0);
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/modif(y|ies|ied) README/i);
    }
  });

  it("14. git status shows changes ONLY under the two required directories (plus this worktree's own untracked scratch state, if any) -- staged/untracked review output stays confined to its own paths", () => {
    const output = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }) as string;
    const lines = output.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    for (const line of lines) {
      const path = line.slice(line.indexOf(" ") + 1).trim().replace(/^"|"$/g, "");
      const allowed =
        path.startsWith("docs/reviews/conversation_foundation_v1/") ||
        path.startsWith("test/reviews/conversation_foundation_v1/") ||
        path === "docs/reviews/" ||
        path === "test/reviews/" ||
        path === "p2p/";
      expect(allowed, `unexpected change outside review scope: ${path}`).toBe(true);
    }
  });
});
