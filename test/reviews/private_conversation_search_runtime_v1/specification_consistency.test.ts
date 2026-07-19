import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";

/**
 * Private Conversation Search V1 runtime audit -- specification
 * consistency. Verifies this audit's own 20 documents' internal
 * agreement with each other: exactly one severity-ranked findings list
 * and one two-path recommendation in Review 20, no document claims a
 * fix was implemented, no Alpha number is assigned anywhere, the
 * central finding (Review 11) is consistently restated wherever later
 * documents depend on it (17, 18, 20), and the index.md navigation
 * table is complete and in order. Never asserts that any of the
 * findings were resolved -- that is a claim only a future Arc's own
 * completion declaration could make.
 */

const DOCS_DIR = "docs/reviews/private_conversation_search_runtime_v1";

const ALL_DOC_NAMES: readonly string[] = [
  "index.md",
  "01_implementation_inventory.md",
  "02_deviation_from_review_20.md",
  "03_domain_separation_honored.md",
  "04_keyword_index_is_option_2.md",
  "05_in_memory_lifetime_extension.md",
  "06_local_only_placement_preserved.md",
  "07_placement_guarantee_has_no_guardrail.md",
  "08_metadata_leakage_from_stored_index.md",
  "09_metadata_leakage_at_query_time.md",
  "10_archive_corpus_compatibility_confirmed.md",
  "11_retention_bypass_risk_realized.md",
  "12_sender_key_interaction.md",
  "13_mode_index_is_labeling_only.md",
  "14_recipient_asymmetry_unaffected.md",
  "15_no_ranking_as_recommended.md",
  "16_match_quality_signals_available_but_unused.md",
  "17_deleted_conversations.md",
  "18_restored_conversations.md",
  "19_future_vector_search.md",
  "20_findings_summary_and_recommendation.md",
];

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

describe("Private Conversation Search V1 runtime audit -- governing prohibitions honored everywhere", () => {
  it("1. no document anywhere in this audit claims a production source fix was made by this review", () => {
    for (const name of ALL_DOC_NAMES) {
      const doc = readDoc(name);
      expect(doc, `${name} must not claim this review itself fixed the retention-gating gap`).not.toMatch(
        /this (review|audit) (adds|implements|fixes|patches|closes) (a |an )?(retention gate|fix)/i,
      );
    }
  });

  it("2. every numbered document (01-20) opens with 'Audit only. No production source change is made anywhere in this review.'", () => {
    for (const name of ALL_DOC_NAMES) {
      if (name === "index.md") continue;
      const doc = readDoc(name);
      expect(doc, `${name} must open with the audit-only disclaimer`).toMatch(/Audit only\. No production source change is made anywhere in this review\./);
    }
  });

  it("3. no Alpha number is assigned anywhere in this audit's own 21 documents", () => {
    for (const name of ALL_DOC_NAMES) {
      const doc = readDoc(name);
      expect(doc, `${name} must not assign a new Alpha number to this review or its recommended Arc`).not.toMatch(
        /this (review|audit|Arc) is (Secure Runtime )?Alpha \d+/i,
      );
    }
    const index = readDoc("index.md");
    expect(index).toMatch(/No Alpha number\s+is assigned to this review/);
  });

  it("4. index.md and Review 20 both state that no production source, README, package.json, or Cargo.toml change is made by this review", () => {
    const index = readDoc("index.md");
    const doc20 = readDoc("20_findings_summary_and_recommendation.md");
    expect(index).toMatch(/No production source, README, `package\.json`, or\s*\n?`Cargo\.toml` change is made anywhere in this review/);
    expect(doc20).toMatch(/No production source change is made anywhere in this review/);
  });
});

describe("Private Conversation Search V1 runtime audit -- cross-document agreement", () => {
  it("5. Review 20's findings list ranks the retention-gating gap first, at High severity, and names two remediation paths without choosing between them", () => {
    const doc20 = readDoc("20_findings_summary_and_recommendation.md");
    expect(doc20).toMatch(/1\. \*\*\(High\) No retention gating anywhere in the ingestion path\.\*\*/);
    expect(doc20).toMatch(/\(a\) Retrofit the recommendation, cheaply\./);
    expect(doc20).toMatch(/\(b\) Follow the prior review's own recommendation as originally/);
    expect(doc20).toMatch(/does not choose between \(a\) and \(b\)/);
  });

  it("6. Review 11's central finding is restated consistently by Review 17 (deletion policy), Review 18 (restore ordering), and Review 20 (summary)", () => {
    const doc11 = readDoc("11_retention_bypass_risk_realized.md");
    const doc17 = readDoc("17_deleted_conversations.md");
    const doc18 = readDoc("18_restored_conversations.md");
    const doc20 = readDoc("20_findings_summary_and_recommendation.md");
    expect(doc11).toMatch(/single highest-severity finding/);
    expect(doc17).toMatch(/Review 11 of this audit/);
    expect(doc18).toMatch(/Review 11 of this audit/);
    expect(doc20).toMatch(/Review 11/);
  });

  it("7. Review 02's deviation finding and Review 04's Option-2 finding agree on which option was built, and neither claims Option 1 or Option 3 was built", () => {
    const doc02 = readDoc("02_deviation_from_review_20.md");
    const doc04 = readDoc("04_keyword_index_is_option_2.md");
    expect(doc02).toMatch(/\*\*Option 2\*\*/);
    expect(doc04).toMatch(/exactly Option 2's defining property/);
    expect(doc02).not.toMatch(/this implementation is \*\*Option 1\*\*|this implementation is \*\*Option 3\*\*/);
  });

  it("8. Review 03 (what was done correctly) and Reviews 04/11 (what was not) are not contradictory -- Review 03 never claims retention gating exists", () => {
    const doc03 = readDoc("03_domain_separation_honored.md");
    expect(doc03).not.toMatch(/retention gate|evaluatePayloadAccess/i);
    expect(doc03).toMatch(/missing the one dependency/);
  });

  it("9. Reviews 12-14 (Sender-Key/Group) each disclose cross-branch grounding to commit 5b55ed6, consistent with index.md's own base-commit disclosure", () => {
    for (const name of ["12_sender_key_interaction.md", "13_mode_index_is_labeling_only.md", "14_recipient_asymmetry_unaffected.md"]) {
      const doc = readDoc(name);
      expect(doc, `${name} should cite commit 5b55ed6`).toMatch(/5b55ed6/);
    }
    const index = readDoc("index.md");
    expect(index).toMatch(/5b55ed6/);
  });

  it("10. index.md's reading-order table lists all 20 docs in ascending numeric order with no gap or duplicate", () => {
    const index = readDoc("index.md");
    const rows = index.split("\n").filter((l: string) => /^\| \d\d \|/.test(l));
    const numbers = rows.map((r: string) => Number(r.match(/^\| (\d\d) \|/)?.[1]));
    expect(numbers.length).toBe(20);
    for (let i = 0; i < numbers.length; i += 1) {
      expect(numbers[i]).toBe(i + 1);
    }
  });

  it("11. Review 19 (future vector search) explicitly builds on Reviews 04/05/08/11's own findings rather than introducing an unrelated new concern", () => {
    const doc19 = readDoc("19_future_vector_search.md");
    expect(doc19).toMatch(/Review 11 of this audit/);
    expect(doc19).toMatch(/Reviews\s*\n?04-05\/08/);
  });

  it("12. every 'Low'/'Medium'/'Informational' severity finding named in Review 20 traces to a specific earlier-numbered review document", () => {
    const doc20 = readDoc("20_findings_summary_and_recommendation.md");
    expect(doc20).toMatch(/\(Review 17\)/);
    expect(doc20).toMatch(/\(Review 15\)/);
    expect(doc20).toMatch(/\(Review 13\)/);
    expect(doc20).toMatch(/\(Review 07\)/);
  });
});
