import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync } from "node:fs";
// @ts-expect-error `node:child_process` has no type declarations without `@types/node` in this project's tsconfig.
import { execSync } from "node:child_process";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import documentSource from "../../../src/conversation/search/fedos_conversation_search_document.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import indexSource from "../../../src/conversation/search/fedos_conversation_search_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keywordIndexSource from "../../../src/conversation/search/fedos_conversation_search_keyword_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import archiveIndexSource from "../../../src/conversation/search/fedos_conversation_search_archive_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import participantIndexSource from "../../../src/conversation/search/fedos_conversation_search_participant_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import modeIndexSource from "../../../src/conversation/search/fedos_conversation_search_mode_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import envelopeIdSource from "../../../src/conversation/envelope/fedos_conversation_envelope_id.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import retentionAuthoritySource from "../../../src/conversation/retention/fedos_payload_retention_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import archiveCollectorSource from "../../../src/conversation/archive/fedos_conversation_archive_collector.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import archiveRestoreSource from "../../../src/conversation/archive/fedos_conversation_archive_restore.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import executionSpecSource from "../../../docs/secure_runtime_alpha_2501_2580_execution_spec.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import completionDeclarationSource from "../../../docs/secure_runtime_alpha_2501_2580_completion_declaration.md?raw";

/**
 * Private Conversation Search V1 runtime audit -- source alignment.
 * Verifies, against this worktree's own real checked-out
 * src/conversation/search/ (staged Secure Runtime Alpha 2501-2580) and
 * its real dependencies, the "current implementation reality" claims
 * Reviews 01-20 of this audit make: the Keyword Index is a
 * plaintext-term inverted index with no retention gate, the Archive
 * Index consumes bundle envelopes unconditionally, the Participant
 * Index's resolution cache outlives removeDocument(), the Mode/Archive
 * sub-index removal methods are unreachable from the facade,
 * FedosConversationEnvelopeId carries no chronological meaning, and
 * Archive Collector/Restore still never reference the Retention
 * domain. Never asserts that any retention-gating fix has been made --
 * that would contradict this audit's own central finding.
 *
 * UPDATE (Secure Runtime Alpha 2581-2620, "Conversation Search Retention
 * Authority and Index Purge Hardening"): this Arc closed the central
 * finding (Review 11) by threading a narrow FedosPayloadRetentionAuthority
 * dependency into the FACADE ONLY (`fedos_conversation_search_index.ts`).
 * Assertions 7-9 and 14 below, which pinned the PRE-FIX absence of that
 * gate, are updated to assert the POST-FIX reality instead -- this is a
 * genuinely stale-test update, not a relaxation of this audit's own
 * historical record (the numbered .md documents themselves are UNCHANGED
 * and remain an accurate account of what was true when this audit was
 * written). Every other assertion in this file is unaffected: the Archive
 * Index conversion function, the Participant Index's cache lifetime,
 * Archive Collector/Restore, and FedosConversationEnvelopeId are all
 * untouched by Alpha 2581-2620.
 */

const DOCS_DIR = "docs/reviews/private_conversation_search_runtime_v1";
const TEST_DIR = "test/reviews/private_conversation_search_runtime_v1";

const EXPECTED_DOCS: readonly string[] = [
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

const MIN_CHARS = 900;

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

describe("Private Conversation Search V1 runtime audit -- deliverable structure", () => {
  it("1. index.md exists and is non-trivial", () => {
    const index = readDoc("index.md");
    expect(index.length).toBeGreaterThan(MIN_CHARS);
  });

  it("2. every one of the 20 numbered audit docs exists on disk", () => {
    const entries = readdirSync(DOCS_DIR) as string[];
    for (const expected of EXPECTED_DOCS) {
      expect(entries).toContain(expected);
    }
  });

  it("3. exactly 21 files exist in the docs directory -- index + 20 reviews, no stray or missing file", () => {
    const entries = (readdirSync(DOCS_DIR) as string[]).filter((name) => name.endsWith(".md"));
    expect(entries.length).toBe(21);
  });

  it("4. every numbered doc is non-trivial and opens with the correct heading", () => {
    for (const name of EXPECTED_DOCS) {
      const content = readDoc(name);
      expect(content.length, `${name} should be substantive`).toBeGreaterThan(MIN_CHARS);
      const number = name.slice(0, 2);
      expect(content.split("\n")[0], `${name}'s first line`).toMatch(new RegExp(`^# Review ${number} `));
    }
  });

  it("5. exactly 3 test files exist in this audit's own test directory", () => {
    const entries = (readdirSync(TEST_DIR) as string[]).filter((name) => name.endsWith(".test.ts"));
    expect(entries.sort()).toEqual(
      ["encryption_boundary_invariants.test.ts", "source_alignment.test.ts", "specification_consistency.test.ts"].sort(),
    );
  });

  it("6. every changed/untracked repository path is either this audit's own deliverable, or a pre-existing path this audit does not modify", () => {
    // [Alpha 2581-2620 update] the previous `.map((l) => l.trim())` stripped a
    // MODIFIED (non-untracked) line's own leading " M " status prefix down to
    // "M ", shifting the later `slice(3)` by one character -- invisible while
    // this audit's own base commit only ever added new ("??") files, but a
    // real off-by-one once Alpha 2581-2620 legitimately MODIFIES an existing
    // tracked file (the facade). Trimming is now deferred to after the status
    // prefix is sliced off; the allowlist's own scope is unchanged.
    const status = execSync("git status --porcelain", { encoding: "utf8" }) as string;
    const lines = status.split("\n").filter((l: string) => l.trim().length > 0);
    const PRE_EXISTING_ALLOWLIST = [
      "README.md",
      "docs/secure_runtime_alpha_2501_2580_completion_declaration.md",
      "docs/secure_runtime_alpha_2501_2580_execution_spec.md",
      "docs/secure_runtime_alpha_2581_2620_execution_spec.md",
      "docs/secure_runtime_alpha_2581_2620_completion_declaration.md",
      "src/conversation/search/",
      "test/secure_runtime_alpha_2501_2520_keyword_date_reply_indexes.test.ts",
      "test/secure_runtime_alpha_2521_2540_participant_mode_indexes.test.ts",
      "test/secure_runtime_alpha_2541_2560_search_index_incremental_and_delete.test.ts",
      "test/secure_runtime_alpha_2561_2580_archive_index_and_large_dataset.test.ts",
      "test/secure_runtime_alpha_2581_2600_retention_ingestion_gate_and_purge.test.ts",
      "test/secure_runtime_alpha_2601_2620_archive_restart_query_race_and_compat.test.ts",
      ".tmp_gen/",
      "p2p/",
    ];
    for (const line of lines) {
      const path = line.slice(3).trim().replace(/^"|"$/g, "");
      const inReviewScope =
        path.startsWith("docs/reviews/private_conversation_search_runtime_v1/") ||
        path.startsWith("test/reviews/private_conversation_search_runtime_v1/");
      const inPreExistingScope = PRE_EXISTING_ALLOWLIST.some((allowed) => path.startsWith(allowed));
      expect(inReviewScope || inPreExistingScope, `unexpected changed/untracked path introduced by this audit: ${path}`).toBe(true);
    }
  });
});

describe("Private Conversation Search V1 runtime audit -- source alignment (central finding)", () => {
  it("7. [Alpha 2581-2620 update] every search sub-index EXCEPT the facade still has no import from src/conversation/retention/ -- the fix imports the type into the facade only", () => {
    const subIndexFiles = [documentSource, keywordIndexSource, archiveIndexSource, participantIndexSource, modeIndexSource] as string[];
    for (const src of subIndexFiles) {
      expect(src).not.toMatch(/from ["']\.\.\/retention\//);
    }
    expect(indexSource as string).toMatch(/from ["']\.\.\/retention\/fedos_payload_retention_authority\.js["']/);
  });

  it("8. [Alpha 2581-2620 update] FedosConversationSearchIndexDependencies is now the SAME Pick of draftPersistence/membershipAuthority, additively intersected with a new, narrow retentionAuthority dependency", () => {
    expect(indexSource as string).toMatch(/Pick<\s*\n?\s*FedosConversationRuntimeDependencies,\s*\n?\s*"draftPersistence" \| "membershipAuthority"\s*\n?\s*>\s*&\s*\{/);
    expect(indexSource as string).toMatch(/readonly retentionAuthority: FedosConversationSearchRetentionAuthorityDependency/);
  });

  it("9. [Alpha 2581-2620 update] indexEnvelope/indexEnvelopes/indexArchiveBundle now gate through evaluatePayloadAccess, but still never CALL readPayload (a prose mention in a comment is not a call) -- Search Runtime still never reads a payload byte", () => {
    expect(indexSource as string).toMatch(/evaluatePayloadAccess/);
    // A dot-prefixed invocation would be a real call; this file's own comments only ever mention
    // `readPayload()` inside backticks, mirroring this audit's own Review 4b precision for exactly
    // this "rhetorical comment citation, never a call" distinction.
    expect(indexSource as string).not.toMatch(/\.readPayload\(/);
  });

  it("10. the Keyword Index tokenizes to raw, unhashed, lower-cased terms -- confirms Option 2, not a blind/HMAC index", () => {
    expect(keywordIndexSource as string).toMatch(/text\.toLowerCase\(\)\.match\(TOKEN_PATTERN\)/);
    expect(keywordIndexSource as string).not.toMatch(/hmac|createHmac|sha256|blind/i);
  });

  it("11. the Keyword Index's search() passes the raw query string into tokenize() with no wrapping -- confirms query-time plaintext exposure", () => {
    expect(keywordIndexSource as string).toMatch(/search\(query: string\): readonly FedosConversationEnvelopeId\[\] \{\s*\n\s*const queryTokens = tokenize\(query\);/);
  });

  it("12. the Archive Index converts bundle envelopes into documents with no retention/access check in the conversion function", () => {
    expect(archiveIndexSource as string).toMatch(/export function fedosConversationSearchDocumentsFromArchiveBundle/);
    expect(archiveIndexSource as string).not.toMatch(/[Rr]etention/);
  });

  it("13. the Participant Index's resolution cache is never cleared by removeDocument()", () => {
    const removeDocumentBody = (participantIndexSource as string).match(/removeDocument\(envelopeId[^)]*\)[^{]*\{([\s\S]*?)\n {2}\}/)?.[1] ?? "";
    expect(removeDocumentBody).not.toMatch(/#resolvedByMembershipId/);
  });

  it("14. [Alpha 2581-2620 update] forgetConversation()/removeConversation() exist on the Archive/Mode sub-indexes and are now reachable from the facade once a conversation's indexed Envelope count reaches zero", () => {
    expect(archiveIndexSource as string).toMatch(/forgetConversation\(conversationId: FedosConversationId\): void/);
    expect(modeIndexSource as string).toMatch(/removeConversation\(conversationId: FedosConversationId\): void/);
    expect(indexSource as string).toMatch(/this\.#mode\.removeConversation/);
    expect(indexSource as string).toMatch(/this\.#archive\.forgetConversation/);
  });

  it("15. FedosConversationEnvelopeId is an opaque, randomly-generated string with no protocol or chronological meaning", () => {
    expect(envelopeIdSource as string).toMatch(/no protocol meaning/);
    expect(envelopeIdSource as string).toMatch(/randomBytes/);
  });

  it("16. the Retention Authority still separates pure preview (evaluatePayloadAccess) from mutation, and still exists at the same import path this audit cites", () => {
    expect(retentionAuthoritySource as string).toMatch(/evaluatePayloadAccess/);
    expect(retentionAuthoritySource as string).toMatch(/PURE previews \(no/);
  });

  it("17. neither the Archive Collector nor Archive Restore references the Retention domain anywhere -- the prior review's Review 11 finding, reconfirmed on the current base", () => {
    expect(archiveCollectorSource as string).not.toMatch(/[Rr]etention/);
    expect(archiveRestoreSource as string).not.toMatch(/[Rr]etention/);
  });

  it("18. the execution spec's own 'deliberately out of scope' section names four boundaries, and retention gating is not a fifth", () => {
    const scopeSection = (executionSpecSource as string).split("Deliberately out of scope")[1] ?? "";
    expect(scopeSection.length).toBeGreaterThan(50);
    expect(scopeSection).not.toMatch(/[Rr]etention/);
  });

  it("19. the completion declaration's own 'named, deliberate boundaries' section does not name retention gating either", () => {
    const boundariesSection = (completionDeclarationSource as string).split("Named, deliberate boundaries")[1] ?? "";
    expect(boundariesSection.length).toBeGreaterThan(50);
    expect(boundariesSection).not.toMatch(/[Rr]etention/);
  });

  it("20. src/conversation/group/ and src/conversation/delivery/ remain absent from this worktree's own checked-out src/conversation/ -- confirms this audit's own cross-branch grounding disclosure (Reviews 12-14) is still accurate", () => {
    const entries = readdirSync("src/conversation") as string[];
    expect(entries).not.toContain("group");
    expect(entries).not.toContain("delivery");
  });
});
