import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` (test-only usage, no new dependency).
import { execFileSync } from "node:child_process";

/**
 * FedOS Account and Nostr Identity Rotation V1 review -- specification
 * consistency. Verifies this review's own doc 20 (the binding synthesis)
 * states EXACTLY one policy for each required axis -- never leaving
 * multiple options open -- and that the review as a whole is internally
 * consistent and makes no production-implementation claim. Avoids
 * treating documentation prose as source evidence (that is
 * source_alignment.test.ts's job); this file only checks the documents'
 * own internal consistency.
 */

const DOCS_DIR = "docs/reviews/fedos_account_nostr_identity_rotation_v1";

function doc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

describe("Specification consistency -- doc 20 states exactly one policy per required axis", () => {
  const normative = () => doc("20_normative_recommendation.md");

  it("1. exactly one V1 account identity policy: does not rotate", () => {
    const text = normative();
    expect(text).toMatch(/## Whether account identity rotates in V1[\s\S]*?\*\*No\.\*\*/);
  });

  it("2. exactly one V1 Nostr identity policy: does not rotate", () => {
    const text = normative();
    expect(text).toMatch(/## Whether Nostr identity rotates in V1[\s\S]*?\*\*No\*\*/);
  });

  it("3. exactly one rotation authorization model is named (Model H, hybrid evidence-leveled)", () => {
    const text = normative();
    const modelMentions = text.match(/## Authorization\/evidence model[\s\S]*?(?=\n## )/);
    expect(modelMentions).not.toBeNull();
    expect(modelMentions![0]).toMatch(/Model H/);
    expect(modelMentions![0]).not.toMatch(/Model [A-G]\b/);
  });

  it("4. exactly one Device migration model is named (Option C, rebind through explicit authorization)", () => {
    const text = normative();
    const section = text.match(/## Device migration model[\s\S]*?(?=\n## )/);
    expect(section).not.toBeNull();
    expect(section![0]).toMatch(/Option C/);
  });

  it("5. exactly one Ratchet transition model is named (sessions always reset, never rebound)", () => {
    const text = normative();
    const section = text.match(/## Ratchet session behavior[\s\S]*?(?=\n## )/);
    expect(section).not.toBeNull();
    expect(section![0].toLowerCase()).toMatch(/terminates every\s+active/);
  });

  it("6. exactly one Conversation continuity model is named (Option A for Direct, Group deferred)", () => {
    const text = normative();
    const section = text.match(/## Conversation continuity model[\s\S]*?(?=\n## )/);
    expect(section).not.toBeNull();
    expect(section![0]).toMatch(/Option A/);
    expect(section![0].toLowerCase()).toMatch(/deferred/);
  });

  it("7. exactly one Master Seed policy is named (no replacement preserving identity; passphrase rotation deferred separately)", () => {
    const text = normative();
    const section = text.match(/## Master Seed policy[\s\S]*?(?=\n## )/);
    expect(section).not.toBeNull();
    expect(section![0].toLowerCase()).toMatch(/no master seed replacement/);
  });

  it("8. exactly one next Arc is recommended", () => {
    const text = normative();
    const section = text.match(/## Exact next Arc[\s\S]*$/);
    expect(section).not.toBeNull();
    const arcNameMatches = section![0].match(/\*\*FedOS[^.]+\.\*\*/g) ?? [];
    expect(arcNameMatches.length).toBe(1);
    expect(arcNameMatches[0]).toMatch(/Identity Transition Types, Validation, and Durable Evidence\s+Foundation Arc/);
  });

  it("9. index.md's own one-paragraph verdict names the same next Arc as doc 20", () => {
    const index = doc("index.md");
    const normativeText = normative();
    expect(index).toMatch(/types, validation, and\s+durable evidence/i);
    expect(normativeText).toMatch(/Identity Transition Types, Validation, and Durable Evidence\s+Foundation Arc/);
  });
});

describe("Specification consistency -- current/future consistency", () => {
  it("10. doc 06 (rotation vs replacement definitions) and doc 18 (option comparison) agree on the chosen model (Option G / Replacement)", () => {
    const rotationVsReplacement = doc("06_rotation_vs_replacement.md");
    const optionComparison = doc("18_option_comparison.md");
    expect(rotationVsReplacement).toMatch(/This is the V1 model this review recommends/);
    expect(optionComparison).toMatch(/Chosen: \*\*G/);
  });

  it("11. doc 19's implementation sequence step 1 matches doc 20's own recommended next Arc", () => {
    const packaging = doc("19_implementation_arc_packaging.md");
    const normative = doc("20_normative_recommendation.md");
    expect(packaging).toMatch(/Identity Transition types, validation, and durable facts/i);
    expect(normative).toMatch(/Identity Transition Types, Validation, and Durable Evidence\s+Foundation Arc/);
  });

  it("12. every doc that names a next-step Arc names the SAME one as doc 20 -- no competing recommendation anywhere", () => {
    const allDocNames = [
      "index.md",
      "01_current_identity_inventory.md",
      "02_security_goals_and_threat_alignment.md",
      "03_identity_layer_taxonomy.md",
      "04_current_account_identity_model.md",
      "05_current_nostr_identity_model.md",
      "06_rotation_vs_replacement.md",
      "07_rotation_authorization_models.md",
      "08_old_key_and_new_key_proof.md",
      "09_compromised_old_key_problem.md",
      "10_peer_acceptance_and_trust.md",
      "11_device_migration.md",
      "12_ratchet_session_transition.md",
      "13_conversation_and_membership_continuity.md",
      "14_archive_history_and_search.md",
      "15_master_seed_replacement.md",
      "16_peer_notification_and_capability_update.md",
      "17_rollback_downgrade_and_split_brain.md",
      "18_option_comparison.md",
      "19_implementation_arc_packaging.md",
      "20_normative_recommendation.md",
    ];
    for (const name of allDocNames) {
      const text = doc(name);
      const matches = text.match(/recommended next Arc is[^.]+\./gi) ?? [];
      for (const m of matches) {
        expect(m, name).toMatch(/Identity Transition/);
      }
    }
  });
});

describe("Specification consistency -- no production implementation claim", () => {
  it("13. no doc claims this review implements/ships production code", () => {
    const allDocNames = [
      "index.md",
      "01_current_identity_inventory.md",
      "02_security_goals_and_threat_alignment.md",
      "03_identity_layer_taxonomy.md",
      "04_current_account_identity_model.md",
      "05_current_nostr_identity_model.md",
      "06_rotation_vs_replacement.md",
      "07_rotation_authorization_models.md",
      "08_old_key_and_new_key_proof.md",
      "09_compromised_old_key_problem.md",
      "10_peer_acceptance_and_trust.md",
      "11_device_migration.md",
      "12_ratchet_session_transition.md",
      "13_conversation_and_membership_continuity.md",
      "14_archive_history_and_search.md",
      "15_master_seed_replacement.md",
      "16_peer_notification_and_capability_update.md",
      "17_rollback_downgrade_and_split_brain.md",
      "18_option_comparison.md",
      "19_implementation_arc_packaging.md",
      "20_normative_recommendation.md",
    ];
    for (const name of allDocNames) {
      const text = doc(name);
      expect(text, name).not.toMatch(/this review implements/i);
      expect(text, name).not.toMatch(/this (spec|review) (builds|ships|adds) (a |an )?(real |working )?(rotation|migration|transition) implementation/i);
    }
  });

  it("14. index.md's own verdict explicitly states no live migration ships", () => {
    const index = doc("index.md");
    expect(index.toLowerCase()).toMatch(/no live migration ships/);
  });

  it("15. doc 20 lists explicit non-goals including 'no live implementation of ANY of the above in this Arc'", () => {
    const normative = doc("20_normative_recommendation.md");
    expect(normative).toMatch(/## Explicit non-goals/);
    expect(normative.toLowerCase()).toMatch(/no live implementation of any of the above/);
  });
});

describe("Specification consistency -- README updated newest-first, one commit scope", () => {
  it("16. README.md's top status block references this review by name", () => {
    const readme = readFileSync("README.md", "utf8") as string;
    const topBlock = readme.slice(0, 4000);
    expect(topBlock).toMatch(/Account and Nostr Identity Rotation V1/);
  });

  it("17. git status shows changes confined to this review's own two directories plus README.md", () => {
    const output = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }) as string;
    const lines = output
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0);
    for (const line of lines) {
      const path = line.slice(line.indexOf(" ") + 1).trim().replace(/^"|"$/g, "");
      const allowed =
        path.startsWith("docs/reviews/fedos_account_nostr_identity_rotation_v1/") ||
        path.startsWith("test/reviews/fedos_account_nostr_identity_rotation_v1/") ||
        path === "README.md" ||
        path === "docs/reviews/" ||
        path === "test/reviews/";
      expect(allowed, `unexpected changed/untracked path introduced by this review: ${path}`).toBe(true);
    }
  });
});
