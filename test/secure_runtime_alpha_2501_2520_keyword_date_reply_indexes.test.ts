import { describe, it, expect } from "vitest";
import { FedosConversationSearchKeywordIndex } from "../src/os/messenger/conversations/search/fedos_conversation_search_keyword_index.js";
import { FedosConversationSearchDateIndex } from "../src/os/messenger/conversations/search/fedos_conversation_search_date_index.js";
import { FedosConversationSearchReplyIndex } from "../src/os/messenger/conversations/search/fedos_conversation_search_reply_index.js";
import type { FedosConversationSearchEnvelopeDocument } from "../src/os/messenger/conversations/search/fedos_conversation_search_document.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationEnvelopeId } from "../src/os/messenger/conversations/envelope/fedos_conversation_envelope_id.js";
import type { FedosConversationMembershipId } from "../src/os/messenger/conversations/membership/fedos_conversation_membership_id.js";

const CONVERSATION_ID = "private-draft::direct::req-1" as FedosConversationId;
const SENDER = "private-draft::direct::req-1::fedos::alice" as FedosConversationMembershipId;

function doc(
  envelopeId: string,
  overrides: Partial<FedosConversationSearchEnvelopeDocument> = {},
): FedosConversationSearchEnvelopeDocument {
  return {
    envelopeId: envelopeId as FedosConversationEnvelopeId,
    conversationId: CONVERSATION_ID,
    senderMembershipId: SENDER,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
    text: null,
    ...overrides,
  };
}

describe("Secure Runtime Alpha 2501-2520 -- Keyword Index", () => {
  it("1. finds a document by a single contained token, case-insensitively", () => {
    const index = new FedosConversationSearchKeywordIndex();
    index.indexDocument(doc("e1", { text: "Hello Nostr World" }));
    expect(index.search("nostr")).toEqual(["e1"]);
    expect(index.search("NOSTR")).toEqual(["e1"]);
  });

  it("2. AND-semantics: every query token must be present", () => {
    const index = new FedosConversationSearchKeywordIndex();
    index.indexDocument(doc("e1", { text: "hello world" }));
    index.indexDocument(doc("e2", { text: "hello nostr" }));
    expect(index.search("hello")).toEqual(["e1", "e2"]);
    expect(index.search("hello world")).toEqual(["e1"]);
    expect(index.search("hello nostr")).toEqual(["e2"]);
    expect(index.search("hello missing")).toEqual([]);
  });

  it("3. a document with null text indexes nothing", () => {
    const index = new FedosConversationSearchKeywordIndex();
    index.indexDocument(doc("e1", { text: null }));
    expect(index.has("e1" as FedosConversationEnvelopeId)).toBe(false);
    expect(index.search("anything")).toEqual([]);
  });

  it("4. empty/all-separator query returns empty, never every document", () => {
    const index = new FedosConversationSearchKeywordIndex();
    index.indexDocument(doc("e1", { text: "hello" }));
    expect(index.search("")).toEqual([]);
    expect(index.search("   !!!   ")).toEqual([]);
  });

  it("5. removeDocument fully reverses indexDocument", () => {
    const index = new FedosConversationSearchKeywordIndex();
    index.indexDocument(doc("e1", { text: "hello world" }));
    index.removeDocument("e1" as FedosConversationEnvelopeId);
    expect(index.has("e1" as FedosConversationEnvelopeId)).toBe(false);
    expect(index.search("hello")).toEqual([]);
  });

  it("6. re-indexing the same id updates its own tokens without leaking stale ones", () => {
    const index = new FedosConversationSearchKeywordIndex();
    index.indexDocument(doc("e1", { text: "alpha" }));
    index.removeDocument("e1" as FedosConversationEnvelopeId);
    index.indexDocument(doc("e1", { text: "beta" }));
    expect(index.search("alpha")).toEqual([]);
    expect(index.search("beta")).toEqual(["e1"]);
  });
});

describe("Secure Runtime Alpha 2501-2520 -- Date Index", () => {
  it("1. envelopesBetween is an inclusive range scan", () => {
    const index = new FedosConversationSearchDateIndex();
    index.indexDocument(doc("e1", { createdAt: 100 }));
    index.indexDocument(doc("e2", { createdAt: 200 }));
    index.indexDocument(doc("e3", { createdAt: 300 }));
    expect(index.envelopesBetween(100, 200)).toEqual(["e1", "e2"]);
    expect(index.envelopesBetween(101, 299)).toEqual(["e2"]);
    expect(index.envelopesBetween(100, 300)).toEqual(["e1", "e2", "e3"]);
  });

  it("2. results are sorted by (createdAt, envelopeId) regardless of insertion order", () => {
    const index = new FedosConversationSearchDateIndex();
    index.indexDocument(doc("z", { createdAt: 100 }));
    index.indexDocument(doc("a", { createdAt: 100 }));
    index.indexDocument(doc("m", { createdAt: 50 }));
    expect(index.envelopesBetween(0, 1000)).toEqual(["m", "a", "z"]);
  });

  it("3. removeDocument removes the entry and createdAtOf returns null afterward", () => {
    const index = new FedosConversationSearchDateIndex();
    index.indexDocument(doc("e1", { createdAt: 100 }));
    expect(index.createdAtOf("e1" as FedosConversationEnvelopeId)).toBe(100);
    index.removeDocument("e1" as FedosConversationEnvelopeId);
    expect(index.createdAtOf("e1" as FedosConversationEnvelopeId)).toBeNull();
    expect(index.envelopesBetween(0, 1000)).toEqual([]);
  });
});

describe("Secure Runtime Alpha 2501-2520 -- Reply Index", () => {
  it("1. a root message (replyToEnvelopeId null) is never itself a parent-index key", () => {
    const index = new FedosConversationSearchReplyIndex();
    index.indexDocument(doc("root", { replyToEnvelopeId: null }));
    expect(index.parentOf("root" as FedosConversationEnvelopeId)).toBeNull();
    expect(index.repliesTo("root" as FedosConversationEnvelopeId)).toEqual([]);
  });

  it("2. repliesTo/parentOf reflect a real reply thread", () => {
    const index = new FedosConversationSearchReplyIndex();
    index.indexDocument(doc("root", {}));
    index.indexDocument(doc("child-1", { replyToEnvelopeId: "root" as FedosConversationEnvelopeId }));
    index.indexDocument(doc("child-2", { replyToEnvelopeId: "root" as FedosConversationEnvelopeId }));
    expect(index.repliesTo("root" as FedosConversationEnvelopeId)).toEqual(["child-1", "child-2"]);
    expect(index.parentOf("child-1" as FedosConversationEnvelopeId)).toBe("root");
  });

  it("3. removeDocument detaches from the parent's children set without throwing", () => {
    const index = new FedosConversationSearchReplyIndex();
    index.indexDocument(doc("root", {}));
    index.indexDocument(doc("child-1", { replyToEnvelopeId: "root" as FedosConversationEnvelopeId }));
    index.removeDocument("child-1" as FedosConversationEnvelopeId);
    expect(index.repliesTo("root" as FedosConversationEnvelopeId)).toEqual([]);
    expect(index.parentOf("child-1" as FedosConversationEnvelopeId)).toBeNull();
  });

  it("4. removing a parent leaves the child's own recorded parent pointer as-is (no cascading delete)", () => {
    const index = new FedosConversationSearchReplyIndex();
    index.indexDocument(doc("root", {}));
    index.indexDocument(doc("child-1", { replyToEnvelopeId: "root" as FedosConversationEnvelopeId }));
    index.removeDocument("root" as FedosConversationEnvelopeId);
    expect(index.parentOf("child-1" as FedosConversationEnvelopeId)).toBe("root");
  });
});
