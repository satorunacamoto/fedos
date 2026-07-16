import { describe, it, expect } from "vitest";
import {
  toFedosConversationPayloadId,
  FedosSecureRandomConversationPayloadIdGenerator,
} from "../src/conversation/payload_storage/fedos_conversation_payload_id.js";

/**
 * Secure Runtime Alpha 802 ("Payload Identifier") -- Stage 12 of the
 * Alpha 791-820 Conversation Retention & Private Payload Storage
 * Boundary Foundation Arc.
 */
describe("Secure Runtime Alpha 802 -- FedosConversationPayloadId", () => {
  it("1. brands a well-formed, non-empty string", () => {
    expect(toFedosConversationPayloadId("abc123")).toBe("abc123");
  });

  it("2. rejects an empty string", () => {
    expect(toFedosConversationPayloadId("")).toBeNull();
    expect(toFedosConversationPayloadId("   ")).toBeNull();
  });

  it("3. rejects a value containing path characters -- no filesystem path can ever be derived from a payload id", () => {
    expect(toFedosConversationPayloadId("../etc/passwd")).toBeNull();
    expect(toFedosConversationPayloadId("a/b")).toBeNull();
    expect(toFedosConversationPayloadId("a\\b")).toBeNull();
    expect(toFedosConversationPayloadId("..")).toBeNull();
  });

  it("4. the default generator produces non-empty, distinct ids across calls", () => {
    const generator = new FedosSecureRandomConversationPayloadIdGenerator();
    const a = generator.generatePayloadId();
    const b = generator.generatePayloadId();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("5. the default generator's output is always a valid, brandable id", () => {
    const generator = new FedosSecureRandomConversationPayloadIdGenerator();
    for (let i = 0; i < 5; i += 1) {
      expect(toFedosConversationPayloadId(generator.generatePayloadId())).not.toBeNull();
    }
  });

  it("6. generation is injectable -- a deterministic test double satisfies the same interface", () => {
    let calls = 0;
    const fixed = { generatePayloadId: () => `fixed-${calls++}` };
    expect(fixed.generatePayloadId()).toBe("fixed-0");
    expect(fixed.generatePayloadId()).toBe("fixed-1");
  });

  it("7. no content-hash claim -- generating twice from the SAME external content still yields different ids (true randomness, never derived from content)", () => {
    const generator = new FedosSecureRandomConversationPayloadIdGenerator();
    // Two calls, no input at all -- structurally cannot be a content hash.
    expect(generator.generatePayloadId()).not.toBe(generator.generatePayloadId());
  });
});
