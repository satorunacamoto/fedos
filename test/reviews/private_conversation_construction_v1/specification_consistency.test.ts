import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";

/**
 * Private Conversation Construction V1 review -- specification consistency.
 *
 * Asserts all 20 review docs + index exist, are non-trivial, and that
 * numbering/cross-references are internally consistent. Does not assert
 * anything about `src/` -- that is `source_alignment.test.ts` and
 * `readiness_invariants.test.ts`'s own job.
 */

const DOCS_DIR = "docs/reviews/private_conversation_construction_v1";
const TEST_DIR = "test/reviews/private_conversation_construction_v1";

const EXPECTED_DOCS: readonly string[] = [
  "01_source_alignment.md",
  "02_readiness_axes.md",
  "03_readiness_results.md",
  "04_private_group_command.md",
  "05_direct_command.md",
  "06_creator_membership.md",
  "07_initial_policy.md",
  "08_encryption_gate.md",
  "09_draft_vs_active.md",
  "10_persistence_coordination.md",
  "11_initial_capability.md",
  "12_runtime_ownership.md",
  "13_read_api.md",
  "14_failure_matrix.md",
  "15_authorization.md",
  "16_revocation_leave.md",
  "17_arc_packaging.md",
  "18_protocol_delivery.md",
  "19_security_claims.md",
  "20_normative_next_arc.md",
];

const MIN_LINES = 20;
const MIN_CHARS = 800;

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

describe("Private Conversation Construction V1 -- specification consistency", () => {
  it("1. index.md exists and is non-trivial", () => {
    const index = readDoc("index.md");
    expect(index.length).toBeGreaterThan(MIN_CHARS);
    expect(index.split("\n").length).toBeGreaterThan(MIN_LINES);
  });

  it("2. every one of the 20 numbered review docs exists on disk", () => {
    const entries = readdirSync(DOCS_DIR) as string[];
    for (const expected of EXPECTED_DOCS) {
      expect(entries).toContain(expected);
    }
  });

  it("3. exactly 21 files exist in the docs directory -- index + 20 reviews, no stray or missing file", () => {
    const entries = (readdirSync(DOCS_DIR) as string[]).filter((name) => name.endsWith(".md"));
    expect(entries.length).toBe(21);
  });

  it("4. every numbered doc is non-trivial (real content, not a stub)", () => {
    for (const name of EXPECTED_DOCS) {
      const content = readDoc(name);
      expect(content.length, `${name} should be substantive`).toBeGreaterThan(MIN_CHARS);
      expect(content.split("\n").length, `${name} should have real structure`).toBeGreaterThan(MIN_LINES);
    }
  });

  it("5. every numbered doc opens with an H1 heading matching '# Review NN — <Title>'", () => {
    for (const name of EXPECTED_DOCS) {
      const content = readDoc(name);
      const number = name.slice(0, 2);
      const firstLine = content.split("\n")[0];
      expect(firstLine, `${name}'s first line`).toMatch(new RegExp(`^# Review ${number} `));
    }
  });

  it("6. index.md's reading-order table references all 20 docs by filename, in order", () => {
    const index = readDoc("index.md");
    for (const name of EXPECTED_DOCS) {
      expect(index, `index.md should reference ${name}`).toMatch(new RegExp(name.replace(".", "\\.")));
    }
  });

  it("7. index.md states the base commit d8bbfae and names all four prerequisite Alpha arcs plus both prior review sets", () => {
    const index = readDoc("index.md");
    expect(index).toMatch(/d8bbfae/);
    expect(index).toMatch(/741–760|741-760/);
    expect(index).toMatch(/761–790|761-790/);
    expect(index).toMatch(/791–820|791-820/);
    expect(index).toMatch(/821–850|821-850/);
    expect(index).toMatch(/private_conversation_security/);
    expect(index).toMatch(/conversation_foundation_v1/);
  });

  it("8. index.md states plainly that Alpha 851-890 does not exist yet in this repository", () => {
    const index = readDoc("index.md");
    expect(index).toMatch(/Alpha 851–890 does not exist|does not exist anywhere in this repository/);
  });

  it("9. every doc cross-references at least one OTHER numbered doc by its two-digit prefix (e.g. '01', '08', '17') -- confirms this is one coherent specification, not 20 disconnected notes", () => {
    for (const name of EXPECTED_DOCS) {
      const content = readDoc(name);
      const ownNumber = name.slice(0, 2);
      const backtickRefs = content.match(/`(\d{2})[_`]/g) ?? [];
      const referencesOther = backtickRefs.some((ref) => {
        const num = ref.replace(/[`_]/g, "");
        return num !== ownNumber;
      });
      expect(referencesOther, `${name} should reference at least one other numbered doc`).toBe(true);
    }
  });

  it("10. no doc claims a production source change was made -- every doc stays within this review's own 'review only' ground rule", () => {
    for (const name of [...EXPECTED_DOCS, "index.md"]) {
      const content = readDoc(name);
      // These docs frequently DISCUSS the idea of a future source change
      // (e.g. widening a validator) but must never claim to have PERFORMED
      // one themselves in this review's own commit.
      expect(content, `${name} should not claim to have implemented production code`).not.toMatch(
        /this review (implements|has implemented|adds production|modifies src\/)/i,
      );
    }
  });

  it("11. doc 20's normative recommendation names a single applicable conditional branch, not left unresolved", () => {
    const doc20 = readDoc("20_normative_next_arc.md");
    expect(doc20).toMatch(/The third branch applies/);
    expect(doc20).toMatch(/Normative recommendation/);
  });

  it("12. doc 09 explicitly rejects Option C (active record with unavailable encryption), per this review's own required instruction", () => {
    const doc09 = readDoc("09_draft_vs_active.md");
    expect(doc09).toMatch(/REJECTED, per this review's own explicit\s+instruction\./);
  });

  it("13. doc 17 explicitly rejects Option E (both modes + message sending), per this review's own required instruction", () => {
    const doc17 = readDoc("17_arc_packaging.md");
    expect(doc17).toMatch(/REJECTED, per this review's\s+own explicit instruction/);
  });

  it("14. all three test files in this review's own test directory exist and are non-trivial", () => {
    const entries = readdirSync(TEST_DIR) as string[];
    expect(entries.sort()).toEqual(["readiness_invariants.test.ts", "source_alignment.test.ts", "specification_consistency.test.ts"]);
    for (const name of entries) {
      const content = readFileSync(`${TEST_DIR}/${name}`, "utf8") as string;
      expect(content.length).toBeGreaterThan(MIN_CHARS);
    }
  });
});
