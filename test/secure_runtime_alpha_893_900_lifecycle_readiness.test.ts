/**
 * Secure Runtime Alpha 893–900 — Phase A gate: lifecycle vocabulary,
 * draft record compatibility, mode validator extension, readiness axes,
 * overall readiness, and public V1 isolation.
 */

import { describe, it, expect } from "vitest";
import {
  FEDOS_CONVERSATION_CONSTRUCTIBLE_LIFECYCLE_STATE,
  FEDOS_CONVERSATION_LIFECYCLE_STATES,
  isFedosConversationLifecycleState,
} from "../src/os/messenger/conversations/construction/fedos_conversation_lifecycle_state.js";
import { validateFedosConversationDraftRecord } from "../src/os/messenger/conversations/construction/fedos_conversation_draft_record_validator.js";
import { validateFedosConversationRecord } from "../src/os/messenger/conversations/fedos_conversation_record_validator.js";
import {
  evaluateFedosConversationReadiness,
  type FedosConversationReadinessAxisStates,
} from "../src/os/messenger/conversations/readiness/fedos_conversation_readiness.js";
import { FEDOS_CONVERSATION_READINESS_AXES } from "../src/os/messenger/conversations/readiness/fedos_conversation_readiness_axis.js";

const CREATOR = { authority: "fedos", publicIdentifier: "creator-1", identityId: null };

function draftInput(overrides: Record<string, unknown> = {}) {
  return {
    id: "private-draft::private-group::req1",
    mode: "private-group",
    lifecycleState: "draft",
    policyReference: "private-group-draft-v1",
    creator: CREATOR,
    createdAt: 1_700_000_000,
    ...overrides,
  };
}

function readyStates(overrides: Partial<FedosConversationReadinessAxisStates> = {}): FedosConversationReadinessAxisStates {
  return {
    identity: "ready",
    conversationPersistence: "ready",
    policy: "ready",
    creatorMembership: "ready",
    capability: "not-required",
    encryption: "unavailable",
    payloadStorage: "ready",
    retention: "ready",
    protocolDelivery: "not-required",
    ...overrides,
  };
}

describe("Alpha 893 — lifecycle vocabulary", () => {
  it("names four states but only ever constructs draft", () => {
    expect(FEDOS_CONVERSATION_LIFECYCLE_STATES).toEqual(["draft", "active", "closed", "tombstoned"]);
    expect(FEDOS_CONVERSATION_CONSTRUCTIBLE_LIFECYCLE_STATE).toBe("draft");
  });

  it("recognizes known states and rejects others", () => {
    expect(isFedosConversationLifecycleState("draft")).toBe(true);
    expect(isFedosConversationLifecycleState("active")).toBe(true);
    expect(isFedosConversationLifecycleState("nonsense")).toBe(false);
  });
});

describe("Alpha 894/895 — draft record validator", () => {
  it("accepts a well-formed private-group draft", () => {
    const record = validateFedosConversationDraftRecord(draftInput());
    expect(record).not.toBeNull();
    expect(record!.mode).toBe("private-group");
    expect(record!.lifecycleState).toBe("draft");
    expect(record!.policyReference).toBe("private-group-draft-v1");
  });

  it("accepts a direct draft with matching policy reference", () => {
    const record = validateFedosConversationDraftRecord(
      draftInput({ id: "private-draft::direct::r2", mode: "direct", policyReference: "direct-draft-v1" }),
    );
    expect(record).not.toBeNull();
    expect(record!.mode).toBe("direct");
  });

  it("rejects public mode (that belongs on the public record)", () => {
    expect(validateFedosConversationDraftRecord(draftInput({ mode: "public" }))).toBeNull();
  });

  it("rejects any lifecycle state other than draft — active can never be constructed", () => {
    expect(validateFedosConversationDraftRecord(draftInput({ lifecycleState: "active" }))).toBeNull();
    expect(validateFedosConversationDraftRecord(draftInput({ lifecycleState: "closed" }))).toBeNull();
  });

  it("rejects a policy reference that does not match the mode", () => {
    expect(validateFedosConversationDraftRecord(draftInput({ policyReference: "direct-draft-v1" }))).toBeNull();
  });

  it("rejects an unknown/extra field", () => {
    expect(validateFedosConversationDraftRecord(draftInput({ isEncrypted: true } as never))).toBeNull();
  });
});

describe("Alpha 900 — public V1 record validator is byte-for-byte unchanged", () => {
  it("still rejects every non-public mode", () => {
    const base = {
      id: "board1::thread1",
      mode: "private-group",
      boardId: "board1",
      rootThreadId: "thread1",
      rootPostId: "thread1",
      policyReference: "public-v1",
      createdAt: 1_700_000_000,
    };
    expect(validateFedosConversationRecord(base)).toBeNull();
    expect(validateFedosConversationRecord({ ...base, mode: "direct" })).toBeNull();
  });

  it("still accepts a valid public record", () => {
    const record = validateFedosConversationRecord({
      id: "board1::thread1",
      mode: "public",
      boardId: "board1",
      rootThreadId: "thread1",
      rootPostId: "thread1",
      policyReference: "public-v1",
      createdAt: 1_700_000_000,
    });
    expect(record).not.toBeNull();
    expect(record!.mode).toBe("public");
  });
});

describe("Alpha 898/899 — readiness axes + overall evaluation", () => {
  it("has exactly nine named axes", () => {
    expect(FEDOS_CONVERSATION_READINESS_AXES).toHaveLength(9);
    expect(FEDOS_CONVERSATION_READINESS_AXES).toContain("encryption");
    expect(FEDOS_CONVERSATION_READINESS_AXES).toContain("creatorMembership");
  });

  it("returns draft-ready when every draft axis is ready but encryption is unavailable", () => {
    const readiness = evaluateFedosConversationReadiness(readyStates());
    expect(readiness.overall).toBe("draft-ready");
    expect(readiness.axes).toHaveLength(9);
  });

  it("returns activation-ready ONLY when encryption proves ready", () => {
    const readiness = evaluateFedosConversationReadiness(readyStates({ encryption: "ready" }));
    expect(readiness.overall).toBe("activation-ready");
  });

  it("returns blocked when a draft-required axis fails", () => {
    expect(evaluateFedosConversationReadiness(readyStates({ creatorMembership: "unavailable" })).overall).toBe("blocked");
    expect(evaluateFedosConversationReadiness(readyStates({ payloadStorage: "unavailable" })).overall).toBe("blocked");
  });

  it("does NOT block a draft on encryption or protocolDelivery", () => {
    expect(evaluateFedosConversationReadiness(readyStates({ protocolDelivery: "unavailable" })).overall).toBe("draft-ready");
    expect(evaluateFedosConversationReadiness(readyStates({ encryption: "failed" })).overall).toBe("draft-ready");
  });

  it("treats a requested-but-failed capability as blocking, not-required capability as fine", () => {
    expect(evaluateFedosConversationReadiness(readyStates({ capability: "failed" })).overall).toBe("blocked");
    expect(evaluateFedosConversationReadiness(readyStates({ capability: "ready" })).overall).toBe("draft-ready");
  });
});
