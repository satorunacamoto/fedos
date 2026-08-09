import { describe, it, expect } from "vitest";
import {
  validateFedosConversationRecord,
  type FedosConversationRecordInput,
} from "../src/os/messenger/conversations/fedos_conversation_record_validator.js";

const VALID: FedosConversationRecordInput = {
  id: "board-a::thread-1",
  mode: "public",
  boardId: "board-a",
  rootThreadId: "thread-1",
  rootPostId: "thread-1",
  policyReference: "public-v1",
  createdAt: 1_700_000_000,
};

/**
 * Secure Runtime Alpha 747 ("Root Mapping Contract") / Alpha 748
 * ("Conversation Record Validation") -- Stages 7-8 of the Alpha 741-760
 * Canonical Conversation Identity and Record Foundation Arc.
 */
describe("Secure Runtime Alpha 748 -- Conversation Record Validation", () => {
  it("1. accepts a well-formed candidate", () => {
    const record = validateFedosConversationRecord(VALID);
    expect(record).not.toBeNull();
    expect(record?.id).toBe("board-a::thread-1");
    expect(record?.mode).toBe("public");
  });

  it("2. rejects mode !== 'public', including the two recognized-but-unsupported literals", () => {
    expect(validateFedosConversationRecord({ ...VALID, mode: "private-group" })).toBeNull();
    expect(validateFedosConversationRecord({ ...VALID, mode: "direct" })).toBeNull();
    expect(validateFedosConversationRecord({ ...VALID, mode: "bogus" })).toBeNull();
  });

  it("3. Root Mapping Contract: rejects rootPostId !== rootThreadId", () => {
    expect(validateFedosConversationRecord({ ...VALID, rootPostId: "some-other-post" })).toBeNull();
  });

  it("4. rejects empty/malformed boardId, rootThreadId, rootPostId", () => {
    expect(validateFedosConversationRecord({ ...VALID, boardId: "" })).toBeNull();
    expect(validateFedosConversationRecord({ ...VALID, rootThreadId: "" })).toBeNull();
    expect(validateFedosConversationRecord({ ...VALID, rootPostId: "" })).toBeNull();
    expect(validateFedosConversationRecord({ ...VALID, id: "" })).toBeNull();
  });

  it("5. rejects createdAt outside FedosBoardPost's own accepted range", () => {
    expect(validateFedosConversationRecord({ ...VALID, createdAt: -1 })).toBeNull();
    expect(validateFedosConversationRecord({ ...VALID, createdAt: 1.5 })).toBeNull();
    expect(validateFedosConversationRecord({ ...VALID, createdAt: 99_999_999_999 })).toBeNull();
  });

  it("6. rejects any policyReference other than 'public-v1'", () => {
    expect(validateFedosConversationRecord({ ...VALID, policyReference: "public-v2" })).toBeNull();
    expect(validateFedosConversationRecord({ ...VALID, policyReference: "" })).toBeNull();
  });

  it("7. rejects an unknown/extra field -- exact field set only", () => {
    expect(validateFedosConversationRecord({ ...VALID, extra: "nope" } as unknown as FedosConversationRecordInput)).toBeNull();
  });

  it("8. rejects a missing field", () => {
    const { mode: _mode, ...withoutMode } = VALID;
    expect(validateFedosConversationRecord(withoutMode as unknown as FedosConversationRecordInput)).toBeNull();
  });

  it("9. never throws for malformed input, including non-object input", () => {
    expect(() => validateFedosConversationRecord(null as unknown as FedosConversationRecordInput)).not.toThrow();
    expect(validateFedosConversationRecord(null as unknown as FedosConversationRecordInput)).toBeNull();
    expect(() => validateFedosConversationRecord(undefined as unknown as FedosConversationRecordInput)).not.toThrow();
    expect(() => validateFedosConversationRecord("not an object" as unknown as FedosConversationRecordInput)).not.toThrow();
  });

  it("10. the result is frozen -- no field can be reassigned after construction", () => {
    const record = validateFedosConversationRecord(VALID)!;
    expect(Object.isFrozen(record)).toBe(true);
  });

  it("11. deep-copies -- the returned record is not the caller's own input reference", () => {
    const record = validateFedosConversationRecord(VALID)!;
    expect(record).not.toBe(VALID);
  });
});
