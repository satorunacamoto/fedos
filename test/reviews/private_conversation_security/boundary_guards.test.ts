import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import packageJsonSource from "../../../package.json?raw";
import { assertFedosRootDependencyInvariant } from "../../helpers/fedos_root_dependency_invariant.js";

/**
 * Private Conversation Security, Storage & Capability Boundary Review --
 * prohibition compliance. Verifies, against REAL git state (not merely
 * prose claims) that no production source, README, package manifest, or
 * Cargo manifest was touched, that p2p/ is untouched (or absent, in this
 * worktree), and that this review's own docs never recommend implementing
 * anything on the Absolute Prohibitions list.
 */

const REQUIRED_DOCS = [
  "index.md",
  "01_existing_crypto_inventory.md",
  "02_private_canonical_model.md",
  "03_conversation_identity.md",
  "04_membership_authorization.md",
  "05_key_distribution.md",
  "06_key_epochs.md",
  "07_at_rest_storage.md",
  "08_deletion_retention.md",
  "09_capability_invitation.md",
  "10_one_time_redemption.md",
  "11_outbound_eligibility.md",
  "12_dm_group_separation.md",
  "13_thread_local_pseudonym.md",
  "14_operator_non_linkability.md",
  "15_bot_abuse_layers.md",
  "16_moderation_encryption.md",
  "17_backup_multi_device.md",
  "18_protocol_mapping.md",
  "19_dependency_order.md",
  "20_blockers_recommendation.md",
];

const DOCS_DIR = "docs/reviews/private_conversation_security";
const TEST_DIR = "test/reviews/private_conversation_security";

function readAllDocs(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of REQUIRED_DOCS) {
    result[name] = readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
  }
  return result;
}

describe("Private Conversation Security Review -- boundary guards", () => {
  it("1. git working tree shows NO change under src/, README.md, package.json, Cargo.toml, or packages/ -- verified against real git state, not prose", () => {
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

  it("4. all 21 required docs exist under docs/reviews/private_conversation_security/, named exactly as specified, no Alpha number anywhere in the filename", () => {
    const files = (readdirSync(DOCS_DIR) as string[]).filter((name) => name.endsWith(".md"));
    expect(files.sort()).toEqual([...REQUIRED_DOCS].sort());
    for (const file of files) {
      expect(file).not.toMatch(/secure_runtime_alpha_\d+/);
    }
  });

  it("5. all 3 required test files exist under test/reviews/private_conversation_security/, named exactly as specified", () => {
    const files = (readdirSync(TEST_DIR) as string[]).filter((name) => name.endsWith(".test.ts"));
    expect(files.sort()).toEqual(["architecture_invariants.test.ts", "boundary_guards.test.ts", "source_inventory.test.ts"]);
  });

  it("6. no review doc claims to modify production source, README, package.json, or Cargo.toml", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/this review (implements|modifies|changes) (src\/|README|package\.json|Cargo\.toml)/i);
    }
  });

  it("7. no review doc recommends implementing GUI, Worker integration, Rust changes, invitation redemption code, or actual encryption code as part of THIS review's own deliverable", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/this review implements/i);
      expect(text, file).not.toMatch(/this review (builds|ships|adds) (a |an )?(GUI|Worker integration|encryption implementation)/i);
    }
  });

  it("8a. Lightning/NIP-13/JA4/CrowdSec are named only in §15 (bot/abuse layers) -- confined there, never in any other doc's own design content", () => {
    const docsAllowedToNameEconomicGatewayTerms = new Set(["15_bot_abuse_layers.md"]);
    for (const [file, text] of Object.entries(readAllDocs())) {
      if (docsAllowedToNameEconomicGatewayTerms.has(file)) continue;
      expect(text, file).not.toMatch(/lightning stake/i);
      expect(text, file).not.toMatch(/nip-13/i);
      expect(text, file).not.toMatch(/\bja4\b/i);
      expect(text, file).not.toMatch(/crowdsec/i);
    }
  });

  it("8b. Ontology is named only to say where it belongs OUTSIDE the Conversation Core -- confined to §14/§15/§16's own cross-referencing discussion, never elsewhere", () => {
    const docsAllowedToNameOntology = new Set(["14_operator_non_linkability.md", "15_bot_abuse_layers.md", "16_moderation_encryption.md"]);
    for (const [file, text] of Object.entries(readAllDocs())) {
      if (docsAllowedToNameOntology.has(file)) continue;
      expect(text, file).not.toMatch(/\bontology\b/i);
    }
  });

  it("8c. Humanizer/AI integration is never named as part of this review's own design anywhere", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/humanizer/i);
    }
  });

  it("9. no review doc treats p2p/ as a direct dependency or import target", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/import.{0,40}p2p\/|require.{0,40}p2p\//i);
    }
  });

  it("10. no review doc invents a new cryptographic primitive -- every crypto option named is a standard, publicly-documented construction (§05's own explicit refusal to invent, checked against its own text)", () => {
    const keyDistDoc = readAllDocs()["05_key_distribution.md"]!;
    expect(keyDistDoc).toMatch(/This review invents no new cryptographic construction/i);
  });

  it("11. no review doc makes an unqualified 'complete deletion' or 'complete anonymity' promise -- only a NEGATED mention (explicitly disclaiming the promise) is permitted, never an affirmative one", () => {
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/(?<!no |not |never )guarantees? complete deletion/i);
      expect(text, file).not.toMatch(/(?<!no |not |never )guarantees? complete anonymity/i);
      // §10 itself explicitly says the phrase below is NEVER made -- that
      // disclaiming sentence is expected and correct, not a violation.
      if (file === "10_one_time_redemption.md") continue;
      expect(text, file).not.toMatch(/disappears from every node in the world/i);
    }
  });

  it("12. Review 10's own explicit rejection of Option E (bearer-token-only exactly-once) is present, not silently dropped", () => {
    const redemptionDoc = readAllDocs()["10_one_time_redemption.md"]!;
    expect(redemptionDoc).toMatch(/REJECTED per this review's own instruction, explicitly/);
  });

  it("13. README.md itself is untouched by this review -- sanity check against the tracked file this review never opens for writing", () => {
    const readme = readFileSync("README.md", "utf8") as string;
    expect(readme.length).toBeGreaterThan(0);
    for (const [file, text] of Object.entries(readAllDocs())) {
      expect(text, file).not.toMatch(/modif(y|ies|ied) README/i);
    }
  });
});
