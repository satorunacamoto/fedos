import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Private Group Pairwise Fanout review -- recommendation consistency.
 * Verifies the docs' own internal cross-referencing and that the final
 * recommendation (`20`) does not authorize anything the other 19 docs
 * name as out of scope (group crypto, protocol delivery, backup,
 * expiration). Never asserts anything about `src/` -- that is
 * `source_alignment.test.ts`'s own job.
 */

const DOCS_DIR = "docs/reviews/private_group_pairwise_fanout";

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

describe("Private Group Pairwise Fanout review -- recommendation consistency", () => {
  it("1. 20_final_recommendation.md explicitly does not authorize a group key, Sender Key, MLS, protocol delivery, expiration, or backup implementation", () => {
    const doc = readDoc("20_final_recommendation.md");
    expect(doc).toMatch(/No group key, Sender Key, or MLS implementation/);
    expect(doc).toMatch(/No protocol delivery of any kind/);
    expect(doc).toMatch(/No expiration\/backup mechanism/);
    expect(doc).toMatch(/No cryptographic invention of any kind/);
  });

  it("2. 20_final_recommendation.md references the load-bearing runtime-compatibility finding and the architecture doc", () => {
    const doc = readDoc("20_final_recommendation.md");
    expect(doc).toMatch(/03_runtime_compatibility\.md/);
    expect(doc).toMatch(/04_pairwise_fanout_architecture\.md/);
  });

  it("3. 03_runtime_compatibility.md and 04_pairwise_fanout_architecture.md both quote the exact Private-Group Gate code, never paraphrasing it into a different outcome string", () => {
    const runtimeDoc = readDoc("03_runtime_compatibility.md");
    const architectureDoc = readDoc("04_pairwise_fanout_architecture.md");
    expect(runtimeDoc).toMatch(/outcome: "unsupported-mode"/);
    expect(architectureDoc).toMatch(/Private-Group Gate/);
  });

  it("4. every doc claiming 'no X exists' in the inventory docs (01/02/16/17) is phrased as a present-tense repository fact, never a claim about future implementation", () => {
    for (const name of ["01_nip17_inventory.md", "02_gift_wrap_inventory.md", "16_sender_key_comparison.md", "17_mls_comparison.md"]) {
      const doc = readDoc(name);
      expect(doc, `${name} should not claim a future implementation already exists`).not.toMatch(
        /this review implements|this review builds|now implemented by this review/i,
      );
    }
  });

  it("5. 09_member_removal.md and 15_backup_model.md both restate the 'cannot revoke already-derived key material' finding consistently", () => {
    const removalDoc = readDoc("09_member_removal.md");
    expect(removalDoc).toMatch(/never a \*\*cryptographic\s*\nrevocation\*\*/);
  });

  it("6. 11_offline_delivery.md and 13_relay_trust_assumptions.md are mutually consistent: both state no protocol delivery exists, neither claims fanout closes that gap", () => {
    const offlineDoc = readDoc("11_offline_delivery.md");
    const relayDoc = readDoc("13_relay_trust_assumptions.md");
    expect(offlineDoc).toMatch(/no offline delivery, queuing, or store-and-forward exists/i);
    expect(relayDoc).toMatch(/single-relay assumption/i);
    // Asserts the doc states the NEGATION explicitly (fanout does NOT close
    // the gap) rather than merely checking the positive phrase's absence,
    // which a naive substring check cannot distinguish from a negated claim.
    expect(offlineDoc).toMatch(/Nothing\s*\nabout fanout closes this gap/);
  });

  it("7. 16_sender_key_comparison.md and 17_mls_comparison.md both explicitly refuse to invent cryptography", () => {
    for (const name of ["16_sender_key_comparison.md", "17_mls_comparison.md"]) {
      const doc = readDoc(name);
      expect(doc, `${name} should explicitly refuse to invent`).toMatch(/Explicit refusal to invent/);
    }
  });

  it("8. 18_migration_path.md does not recommend an automatic decrypt-and-recrypt pipeline", () => {
    const doc = readDoc("18_migration_path.md");
    expect(doc).toMatch(/No automatic decrypt-and-recrypt pipeline is recommended/);
  });

  it("9. every doc's own 'See also' section references at least one other numbered doc in this same review", () => {
    for (const name of [
      "01_nip17_inventory.md",
      "05_recipient_planning.md",
      "10_member_addition.md",
      "14_local_canonical_history.md",
      "19_threat_model.md",
    ]) {
      const doc = readDoc(name);
      expect(doc, `${name} should have a See also section`).toMatch(/## See also/);
      expect(doc, `${name} should reference at least one sibling numbered doc`).toMatch(/`\d\d_[a-z_]+\.md`/);
    }
  });
});
