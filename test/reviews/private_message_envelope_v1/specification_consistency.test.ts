import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readdirSync, readFileSync, existsSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../../../package.json?raw";
import { assertFedosRootDependencyInvariant } from "../../helpers/fedos_root_dependency_invariant.js";

/**
 * Private Message Envelope and Encryption Activation V1 review --
 * specification consistency. Verifies, against REAL git state and REAL
 * file contents (not prose recall), that all 20 docs + index exist, are
 * non-trivial, cross-reference consistently, and that this review's own
 * Absolute Prohibitions (review-only, no src/README/package/Cargo
 * change, no Alpha number, p2p/ untouched) hold. Mirrors the pattern
 * already established by
 * test/reviews/conversation_foundation_v1/boundary_invariants.test.ts
 * and test/reviews/private_conversation_security/boundary_guards.test.ts.
 */

const REQUIRED_DOCS = [
  "index.md",
  "01_crypto_inventory.md",
  "02_storage_alignment.md",
  "03_envelope_boundary.md",
  "04_envelope_v1.md",
  "05_encryption_suites.md",
  "06_encryption_authority.md",
  "07_decryption_authority.md",
  "08_membership_readiness.md",
  "09_direct_key_strategy.md",
  "10_group_key_strategy.md",
  "11_key_epochs.md",
  "12_wasm_export_gap.md",
  "13_runtime_activation_gate.md",
  "14_associated_data.md",
  "15_nonce_replay.md",
  "16_failure_vocabulary.md",
  "17_retention_erasure.md",
  "18_protocol_mapping.md",
  "19_arc_packaging.md",
  "20_normative_next_arc.md",
];

const REQUIRED_TESTS = [
  "source_alignment.test.ts",
  "crypto_boundary_invariants.test.ts",
  "specification_consistency.test.ts",
];

const DOCS_DIR = "docs/reviews/private_message_envelope_v1";
const TEST_DIR = "test/reviews/private_message_envelope_v1";

function readAllDocs(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of REQUIRED_DOCS) {
    result[name] = readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
  }
  return result;
}

describe("Private Message Envelope V1 review -- specification consistency", () => {
  it("1. all 21 required docs exist under docs/reviews/private_message_envelope_v1/, named exactly as specified, no Alpha number anywhere in the filename", () => {
    const files = (readdirSync(DOCS_DIR) as string[]).filter((name) => name.endsWith(".md"));
    expect(files.sort()).toEqual([...REQUIRED_DOCS].sort());
    for (const file of files) {
      expect(file).not.toMatch(/secure_runtime_alpha_\d+/);
      expect(file).not.toMatch(/alpha[_-]?\d+/i);
    }
  });

  it("2. all 3 required test files exist under test/reviews/private_message_envelope_v1/, named exactly as specified", () => {
    const files = (readdirSync(TEST_DIR) as string[]).filter((name) => name.endsWith(".test.ts"));
    expect(files.sort()).toEqual([...REQUIRED_TESTS].sort());
  });

  it("3. every numbered doc is non-trivial -- at least 1500 characters, more than a filler stub", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      if (file === "index.md") continue;
      expect(text.length, `${file} length`).toBeGreaterThan(1500);
    }
  });

  it("4. index.md is non-trivial and names the Base and Prerequisite Note this review's own task requires", () => {
    const index = readFileSync(`${DOCS_DIR}/index.md`, "utf8") as string;
    expect(index.length).toBeGreaterThan(1500);
    expect(index).toMatch(/Base and Prerequisite Note/);
    expect(index).toMatch(/Alpha 821[–-]850/);
    expect(index).toMatch(/does not exist/i);
    expect(index).toMatch(/9c1f52c/);
  });

  it("5. no doc claims Alpha 821-850 exists, was read, or was branched from -- the substitution is documented honestly, not silently invented", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/branched from Alpha 821/i);
      expect(text, file).not.toMatch(/Alpha 821[–-]850['s]* own (source|implementation|design doc)/i);
    }
  });

  it("6. every doc 01-20 cross-references at least one prior-review document (SEC or CFv1) via a 'See also' section", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      if (file === "index.md") continue;
      expect(text, file).toMatch(/## See also/);
      expect(text, file).toMatch(/docs\/reviews\/(private_conversation_security|conversation_foundation_v1)\//);
    }
  });

  it("7. doc numbering in filenames matches the numbering referenced inside index.md's own navigation table", () => {
    const index = readAllDocs()["index.md"];
    for (const doc of REQUIRED_DOCS) {
      if (doc === "index.md") continue;
      expect(index, doc).toContain(doc);
    }
  });

  it("8. no doc claims THIS review implements encryption, envelope, or membership code as its own deliverable", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/this review implements/i);
      expect(text, file).not.toMatch(/this (spec|review) (builds|ships|adds) (a |an )?(real |working )?(encryption|envelope|membership) implementation/i);
    }
  });

  it("9. 10_group_key_strategy.md explicitly states it does not solve Private Group key management", () => {
    const doc = readAllDocs()["10_group_key_strategy.md"];
    expect(doc).toMatch(/not solved here/i);
    expect(doc).toMatch(/Package C4/);
  });

  it("10. 20_normative_next_arc.md recommends exactly one unconditional next Arc (Package C2)", () => {
    const doc = readAllDocs()["20_normative_next_arc.md"];
    expect(doc).toMatch(/Package C2/);
    expect(doc).toMatch(/exactly one, unconditional/i);
  });

  it("11. 18_protocol_mapping.md marks protocol-research items explicitly and performs no web search", () => {
    const doc = readAllDocs()["18_protocol_mapping.md"];
    expect(doc).toMatch(/requires official protocol research/i);
    expect(doc).toMatch(/No web search performed/i);
  });

  it("12. no doc asserts a future Package (C1-C4) has already been built -- all are framed as not-yet-implemented", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/Package C[1-4] has been built/i);
      expect(text, file).not.toMatch(/Package C[1-4] is (already )?(complete|implemented|shipped)/i);
    }
  });

  it("13. git working tree shows NO change under src/, README.md, package.json, Cargo.toml, or packages/", () => {
    const output = execFileSync(
      "git",
      ["status", "--porcelain", "--", "src", "README.md", "package.json", "Cargo.toml", "packages"],
      { encoding: "utf8" },
    ) as string;
    expect(output.trim()).toBe("");
  });

  it("14. p2p/ is untouched -- either absent from this worktree entirely, or (if present) shows no git change", () => {
    if (existsSync("p2p")) {
      const output = execFileSync("git", ["status", "--porcelain", "--", "p2p"], { encoding: "utf8" }) as string;
      expect(output.trim()).toBe("");
    } else {
      expect(existsSync("p2p")).toBe(false);
    }
  });

  it("15. package.json still carries exactly two production dependencies -- no new dependency introduced", () => {
    const parsed = JSON.parse(packageJsonSource as string) as { dependencies: Record<string, string> };
    assertFedosRootDependencyInvariant(parsed.dependencies);
  });

  it("16. no doc in this review assigns itself, or the Arc it recommends, an Alpha number", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/this review is (Alpha|alpha) \d+/i);
      expect(text, file).not.toMatch(/recommend(s|ed)? Alpha \d+/i);
    }
  });

  it("17. README.md itself is untouched by this review -- sanity check against the tracked file this review never opens for writing", () => {
    const readme = readFileSync("README.md", "utf8") as string;
    expect(readme.length).toBeGreaterThan(0);
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/modif(y|ies|ied) README/i);
    }
  });

  it("18. git status shows changes ONLY under this review's own two directories -- staged/untracked review output stays confined to its own paths", () => {
    const output = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }) as string;
    const lines = output
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);
    for (const line of lines) {
      const path = line.slice(line.indexOf(" ") + 1).trim().replace(/^"|"$/g, "");
      const allowed =
        path.startsWith("docs/reviews/private_message_envelope_v1/") ||
        path.startsWith("test/reviews/private_message_envelope_v1/") ||
        path === "docs/reviews/" ||
        path === "test/reviews/" ||
        path === "p2p/";
      expect(allowed, `unexpected change outside review scope: ${path}`).toBe(true);
    }
  });

  it("19. 08_membership_readiness.md explicitly forbids a fake allow-all membership shortcut for Direct mode specifically", () => {
    const doc = (readAllDocs()["08_membership_readiness.md"] ?? "").replace(/\s+/g, " ");
    expect(doc).toMatch(/no fake allow-all membership/i);
  });

  it("20. 16_failure_vocabulary.md preserves the no-oracle AEAD discipline -- never proposes distinguishing wrong-key from tampered-ciphertext", () => {
    const doc = readAllDocs()["16_failure_vocabulary.md"];
    expect(doc).toMatch(/no-oracle/i);
    expect(doc).toMatch(/must not be broken/i);
  });
});
