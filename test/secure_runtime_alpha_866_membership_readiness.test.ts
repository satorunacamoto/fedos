import { describe, it, expect } from "vitest";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/board/fedos_board_identifiers.js";
import { validateFedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference_validator.js";
import {
  evaluateFedosConversationCryptoReadiness,
  FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH,
} from "../src/conversation/encryption/fedos_conversation_membership_readiness.js";

const conversationId = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-a")!);
const alice = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1alice", identityId: null })!;
const bob = validateFedosConversationParticipantReference({ authority: "nostr", publicIdentifier: "npub1bob", identityId: null })!;

/**
 * Secure Runtime Alpha 866 ("Membership Readiness") -- Stage 6 of Phase B
 * of the Alpha 851-890 Private Message Envelope and Encryption Authority
 * Activation Arc.
 */
describe("Secure Runtime Alpha 866 -- evaluateFedosConversationCryptoReadiness", () => {
  it("1. ready -- an active member, a supported suite, and keyEpoch 0", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    const result = evaluateFedosConversationCryptoReadiness(authority, conversationId, alice, "ChaCha20Poly1305", 0);
    expect(result).toEqual({ outcome: "ready" });
  });

  it("2. not-member -- no membership exists at all (a real findMembership() lookup, never a hard-coded true)", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    const result = evaluateFedosConversationCryptoReadiness(authority, conversationId, bob, "ChaCha20Poly1305", 0);
    expect(result).toEqual({ outcome: "not-member" });
  });

  it("3. not-member -- a revoked membership is not ready", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    authority.revoke(conversationId, alice, 1_700_000_500);
    const result = evaluateFedosConversationCryptoReadiness(authority, conversationId, alice, "ChaCha20Poly1305", 0);
    expect(result).toEqual({ outcome: "not-member" });
  });

  it("4. not-member -- a left membership is not ready", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    authority.leave(conversationId, alice, 1_700_000_500);
    const result = evaluateFedosConversationCryptoReadiness(authority, conversationId, alice, "ChaCha20Poly1305", 0);
    expect(result).toEqual({ outcome: "not-member" });
  });

  it("5. unsupported-suite -- checked before any membership lookup", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    const result = evaluateFedosConversationCryptoReadiness(authority, conversationId, alice, "xchacha20poly1305", 0);
    expect(result).toEqual({ outcome: "unsupported-suite" });
  });

  it("6. unsupported-epoch -- Direct mode's own adopted answer: only keyEpoch 0 is ever valid", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    const result = evaluateFedosConversationCryptoReadiness(authority, conversationId, alice, "ChaCha20Poly1305", 1);
    expect(result).toEqual({ outcome: "unsupported-epoch" });
  });

  it("7. FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH is 0", () => {
    expect(FEDOS_CONVERSATION_ENVELOPE_SUPPORTED_KEY_EPOCH).toBe(0);
  });

  it("8. accepts the other real suite, Aes256Gcm", () => {
    const authority = new InMemoryFedosConversationMembershipAuthority();
    authority.admit(conversationId, alice, "member", 1_700_000_000);
    const result = evaluateFedosConversationCryptoReadiness(authority, conversationId, alice, "Aes256Gcm", 0);
    expect(result).toEqual({ outcome: "ready" });
  });
});
