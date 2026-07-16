import { describe, it, expect } from "vitest";
import {
  FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES,
  type FedosConversationParticipantReference,
} from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import {
  FEDOS_CONVERSATION_PARTICIPANT_PUBLIC_IDENTIFIER_MAX_LENGTH,
  validateFedosConversationParticipantReference,
} from "../src/conversation/membership/fedos_conversation_participant_reference_validator.js";

describe("Secure Runtime Alpha 762-763 -- Participant Reference Decision and Validation", () => {
  it("1. every known authority validates", () => {
    for (const authority of FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES) {
      const result = validateFedosConversationParticipantReference({
        authority,
        publicIdentifier: "npub1abc",
        identityId: null,
      });
      expect(result).not.toBeNull();
      expect(result?.authority).toBe(authority);
    }
  });

  it("2. unknown authority rejected", () => {
    expect(
      validateFedosConversationParticipantReference({
        authority: "carrier-pigeon",
        publicIdentifier: "npub1abc",
        identityId: null,
      }),
    ).toBeNull();
  });

  it("3. empty publicIdentifier rejected", () => {
    expect(
      validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "", identityId: null }),
    ).toBeNull();
  });

  it("4. oversized publicIdentifier rejected", () => {
    const oversized = "x".repeat(FEDOS_CONVERSATION_PARTICIPANT_PUBLIC_IDENTIFIER_MAX_LENGTH + 1);
    expect(
      validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: oversized, identityId: null }),
    ).toBeNull();
  });

  it("5. max-length publicIdentifier accepted (boundary)", () => {
    const boundary = "x".repeat(FEDOS_CONVERSATION_PARTICIPANT_PUBLIC_IDENTIFIER_MAX_LENGTH);
    expect(
      validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: boundary, identityId: null }),
    ).not.toBeNull();
  });

  it("6. unknown/extra field rejected", () => {
    expect(
      validateFedosConversationParticipantReference({
        authority: "nostr",
        publicIdentifier: "npub1abc",
        identityId: null,
        displayName: "Quiet Badger",
      }),
    ).toBeNull();
  });

  it("7. missing field rejected", () => {
    expect(validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1abc" })).toBeNull();
  });

  it("8. non-object candidate never throws, returns null", () => {
    expect(validateFedosConversationParticipantReference(null)).toBeNull();
    expect(validateFedosConversationParticipantReference(undefined)).toBeNull();
    expect(validateFedosConversationParticipantReference("nostr")).toBeNull();
    expect(validateFedosConversationParticipantReference(42)).toBeNull();
    expect(() => validateFedosConversationParticipantReference(Symbol("x"))).not.toThrow();
  });

  it("9. valid identityId string accepted; empty identityId string rejected", () => {
    expect(
      validateFedosConversationParticipantReference({ authority: "fedos", publicIdentifier: "id-1", identityId: "local-1" }),
    ).not.toBeNull();
    expect(
      validateFedosConversationParticipantReference({ authority: "fedos", publicIdentifier: "id-1", identityId: "" }),
    ).toBeNull();
  });

  it("10. result is deep-frozen, never the caller's own reference", () => {
    const candidate = { authority: "nostr" as const, publicIdentifier: "npub1abc", identityId: null };
    const result = validateFedosConversationParticipantReference(candidate) as FedosConversationParticipantReference;
    expect(result).not.toBe(candidate);
    expect(Object.isFrozen(result)).toBe(true);
    expect(() => {
      (result as { authority: string }).authority = "session";
    }).toThrow();
  });

  it("11. no implicit cross-protocol identity equivalence -- same publicIdentifier, different authority, are structurally distinct references", () => {
    const a = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "same-value", identityId: null });
    const b = validateFedosConversationParticipantReference({ authority: "activitypub", publicIdentifier: "same-value", identityId: null });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.authority).not.toBe(b?.authority);
  });

  it("12. no display name, avatar, secret, or signing field is ever accepted -- structural guard on the type's own field set", () => {
    const source = validateFedosConversationParticipantReference({
      authority: "nostr",
      publicIdentifier: "npub1abc",
      identityId: null,
    });
    expect(Object.keys(source as object).sort()).toEqual(["authority", "identityId", "publicIdentifier"]);
  });
});
