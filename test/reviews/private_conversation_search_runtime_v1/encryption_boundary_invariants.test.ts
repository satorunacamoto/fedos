import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import documentSource from "../../../src/os/messenger/conversations/search/fedos_conversation_search_document.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import indexSource from "../../../src/os/messenger/conversations/search/fedos_conversation_search_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import keywordIndexSource from "../../../src/os/messenger/conversations/search/fedos_conversation_search_keyword_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import dateIndexSource from "../../../src/os/messenger/conversations/search/fedos_conversation_search_date_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import replyIndexSource from "../../../src/os/messenger/conversations/search/fedos_conversation_search_reply_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import participantIndexSource from "../../../src/os/messenger/conversations/search/fedos_conversation_search_participant_index.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import archiveIndexSource from "../../../src/os/messenger/conversations/search/fedos_conversation_search_archive_index.ts?raw";

/**
 * Private Conversation Search V1 runtime audit -- encryption/privacy
 * boundary invariants. Verifies the specific source-level facts this
 * audit's Reviews 04-05, 08-09, and 11/17-18 build every finding on:
 * the Keyword Index stores raw plaintext tokens with no bound on
 * lifetime, no sub-index touches the network or filesystem, the
 * Search Envelope Document type excludes ciphertext/key-material
 * fields, and no sub-index accepts or checks a retention/access
 * decision anywhere. Also verifies this audit's own 20 documents state
 * their central finding (no retention gating) consistently. Never
 * asserts that any retention-gating fix has been made -- doing so
 * would contradict this audit's own central finding (Review 11).
 *
 * UPDATE (Secure Runtime Alpha 2581-2620): the central finding (Review
 * 11) is now closed in the FACADE only -- assertions 4 and 6 below,
 * which pinned the PRE-FIX absence of that gate, are updated to assert
 * the POST-FIX reality. The historical .md documents themselves are
 * UNCHANGED. Every other assertion here (document field exclusions,
 * no network/filesystem access, unbounded Keyword Index lifetime, the
 * caller-supplied plaintext boundary, and every doc-consistency check)
 * is unaffected -- none of those facts changed.
 */

const DOCS_DIR = "docs/reviews/private_conversation_search_runtime_v1";

function readDoc(name: string): string {
  return readFileSync(`${DOCS_DIR}/${name}`, "utf8") as string;
}

describe("Private Conversation Search V1 runtime audit -- boundary invariants (source)", () => {
  it("1. the Search Envelope Document type excludes payloadId, encryptionSuite, and keyEpoch -- no key-material or ciphertext-reference field", () => {
    expect(documentSource as string).not.toMatch(/readonly payloadId/);
    expect(documentSource as string).not.toMatch(/readonly encryptionSuite/);
    expect(documentSource as string).not.toMatch(/readonly keyEpoch/);
    expect(documentSource as string).toMatch(/readonly text: string \| null/);
  });

  it("2. no file in the search module touches the network or filesystem", () => {
    const files = [documentSource, indexSource, keywordIndexSource, dateIndexSource, replyIndexSource, participantIndexSource, archiveIndexSource] as string[];
    for (const src of files) {
      expect(src).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|readFileSync|writeFileSync|node:fs|node:net/);
    }
  });

  it("3. the Keyword Index's own token store has no size bound, TTL, or eviction of any kind -- confirms unbounded lifetime (Review 04-05)", () => {
    expect(keywordIndexSource as string).not.toMatch(/TTL|maxSize|evict|expire/i);
    expect(keywordIndexSource as string).toMatch(/#envelopesByToken = new Map<string, Set<FedosConversationEnvelopeId>>\(\);/);
  });

  it("4. [Alpha 2581-2620 update] the Archive Index still has no retention/access-decision reference of any kind; the facade now does, and only the facade", () => {
    expect(archiveIndexSource as string).not.toMatch(/FedosPayloadRetentionAuthority|FedosPayloadAccessEvaluation|evaluatePayloadAccess/);
    expect(indexSource as string).toMatch(/FedosPayloadRetentionAuthority/);
    expect(indexSource as string).toMatch(/evaluatePayloadAccess/);
  });

  it("4b. the Keyword Index's own two mentions of FedosPayloadRetentionAuthority are rhetorical comment citations only, never an import, call, or dependency", () => {
    expect(keywordIndexSource as string).toMatch(/FedosPayloadRetentionAuthority/);
    expect(keywordIndexSource as string).not.toMatch(/import[\s\S]{0,80}FedosPayloadRetentionAuthority/);
    expect(keywordIndexSource as string).not.toMatch(/FedosPayloadRetentionAuthority\s*[.(]/);
  });

  it("5. FedosConversationSearchEnvelopeInput and indexArchiveBundle's plaintextByEnvelopeId are both caller-supplied with no verification of how the plaintext was obtained", () => {
    expect(indexSource as string).toMatch(/interface FedosConversationSearchEnvelopeInput \{/);
    expect(indexSource as string).toMatch(/plaintextByEnvelopeId: ReadonlyMap<string, string>/);
  });

  it("6. [Alpha 2581-2620 update] removeEnvelope() purges the four content/metadata sub-indexes directly, and now also reaches the Mode/Archive sub-indexes (via #purgeConversationMetadataIfEmpty) once a conversation's indexed Envelope count reaches zero", () => {
    const removeEnvelopeBody = (indexSource as string).match(/removeEnvelope\(envelopeId[^)]*\)[^{]*\{([\s\S]*?)\n {2}\}/)?.[1] ?? "";
    expect(removeEnvelopeBody).toMatch(/#keyword\.removeDocument/);
    expect(removeEnvelopeBody).toMatch(/#date\.removeDocument/);
    expect(removeEnvelopeBody).toMatch(/#reply\.removeDocument/);
    expect(removeEnvelopeBody).toMatch(/#participant\.removeDocument/);
    expect(removeEnvelopeBody).toMatch(/#purgeConversationMetadataIfEmpty/);
    expect(indexSource as string).toMatch(
      /#purgeConversationMetadataIfEmpty\(conversationId: FedosConversationId\): void \{[\s\S]*?this\.#mode\.removeConversation[\s\S]*?this\.#archive\.forgetConversation/,
    );
  });
});

describe("Private Conversation Search V1 runtime audit -- doc consistency with source", () => {
  it("7. Review 01 states the central finding: no import from src/conversation/retention/ anywhere in the search module", () => {
    const doc = readDoc("01_implementation_inventory.md");
    expect(doc).toMatch(/None of these nine files imports from, or calls anything in,\s*\n?`src\/conversation\/retention\/`/);
  });

  it("8. Review 02 states the implementation is Option 2, the option the prior review never recommended", () => {
    const doc = readDoc("02_deviation_from_review_20.md");
    expect(doc).toMatch(/unambiguously\s*\n?\*\*Option 2\*\*/);
    expect(doc).toMatch(/never recommended/);
  });

  it("9. Review 11 (this audit's central finding) explicitly cites indexEnvelope/indexEnvelopes/indexArchiveBundle as ungated", () => {
    const doc = readDoc("11_retention_bypass_risk_realized.md");
    expect(doc).toMatch(/indexEnvelope\(\)/);
    expect(doc).toMatch(/indexArchiveBundle/);
    expect(doc).toMatch(/no\s+retention check of any kind/);
  });

  it("10. Review 17 and Review 18 both restate Review 11's finding consistently, mirroring the prior specification review's own repetition discipline", () => {
    const doc17 = readDoc("17_deleted_conversations.md");
    const doc18 = readDoc("18_restored_conversations.md");
    expect(doc17).toMatch(/Review 11 of this audit/);
    expect(doc18).toMatch(/Review 11 of this audit|Review 11 of the prior review/);
  });

  it("11. Review 20's findings summary ranks the retention-gating gap as the top severity finding and does not claim it was fixed", () => {
    const doc = readDoc("20_findings_summary_and_recommendation.md");
    expect(doc).toMatch(/\(High\) No retention gating anywhere in the ingestion path/);
    expect(doc).not.toMatch(/has been (fixed|resolved|patched)/i);
  });

  it("12. no document in this audit claims a retention gate, encryption-at-rest treatment, or blind/HMAC token construction was implemented", () => {
    for (const name of [
      "04_keyword_index_is_option_2.md",
      "05_in_memory_lifetime_extension.md",
      "11_retention_bypass_risk_realized.md",
      "20_findings_summary_and_recommendation.md",
    ]) {
      const doc = readDoc(name);
      expect(doc, `${name} must not claim a retention gate or blind index was implemented`).not.toMatch(
        /(implements|ships|adds|now (gates|calls)) (a |an )?(retention gate|evaluatePayloadAccess call|blind index|HMAC token)/i,
      );
    }
  });
});
