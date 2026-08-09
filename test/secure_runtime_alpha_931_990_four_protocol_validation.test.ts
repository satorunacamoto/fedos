/**
 * Secure Runtime Alpha 931–990 — Four-Protocol Validation.
 *
 * This repository's own "four protocol" convention (grepped from
 * `FEDOS_BOARD_SOURCE_PROTOCOLS`, `src/board/fedos_board_source.ts`, and
 * the existing `test/secure_runtime_alpha_637_four_protocol_boundary.test.ts`/
 * `docs/secure_runtime_alpha_309_four_protocol_board_integration.md`
 * family) names the FOUR externally-sourced protocol labels this
 * codebase recognizes: `"nostr"`, `"activitypub"`, `"atproto"`,
 * `"session"` — `"fedos"` is the fifth, LOCAL label, never counted among
 * the "four". `FedosConversationParticipantAuthority`
 * (`src/conversation/membership/fedos_conversation_participant_reference.ts`)
 * reuses this exact five-plus-one vocabulary, adding only
 * `"temporary-capability"` for the Capability domain.
 *
 * "Protocol-agnostic/consistent" for THIS Arc means: `ConversationParticipantResolver`
 * (Alpha 932) and `ConversationKeyResolver` (Alpha 935) must behave
 * IDENTICALLY regardless of which protocol label a Membership's
 * `participant.authority` carries — Membership resolution itself must
 * never special-case a protocol, and ONLY the pairwise ECDH key-strategy
 * boundary (Alpha 890's own Direct-mode/Nostr-only scope,
 * `09_direct_key_strategy.md`) — never Membership resolution — is what
 * narrows key material to `"nostr"` counterparties. This is DIFFERENT
 * from `test/secure_runtime_alpha_637_four_protocol_boundary.test.ts`'s
 * own "several protocols coexist in the SAME feed" property (this Arc
 * has no feed) — the property tested here is "Membership/Participant
 * resolution treats every protocol identically; only the FINAL key-hex
 * extraction step narrows to Nostr, honestly and for every protocol
 * that fails it".
 */
import { describe, it, expect } from "vitest";
import { FEDOS_BOARD_SOURCE_PROTOCOLS } from "../src/os/messenger/board/fedos_board_source.js";
import { FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";
import { MembershipFedosConversationParticipantResolver } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_participant_resolver.js";
import { resolveFedosConversationCounterpartyPublicKeyHex } from "../src/os/messenger/conversations/encryption/identity/fedos_conversation_counterparty_public_key_resolver.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/os/messenger/conversations/membership/in_memory_fedos_conversation_membership_authority.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosConversationParticipantReference, FedosConversationParticipantAuthority } from "../src/os/messenger/conversations/membership/fedos_conversation_participant_reference.js";

const CONVERSATION_ID = "private-draft::direct::alpha-4proto" as FedosConversationId;
const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const NOW = 1_700_004_000;

describe("Alpha 931-990 -- what 'four protocols' means in THIS codebase", () => {
  it("1. the FOUR externally-sourced protocol labels are exactly nostr/activitypub/atproto/session -- 'fedos' is the fifth, LOCAL label, never one of the four", () => {
    expect(FEDOS_BOARD_SOURCE_PROTOCOLS).toEqual(["fedos", "nostr", "activitypub", "atproto", "session"]);
    const externallySourced = FEDOS_BOARD_SOURCE_PROTOCOLS.filter((p) => p !== "fedos");
    expect(externallySourced).toEqual(["nostr", "activitypub", "atproto", "session"]);
    expect(externallySourced).toHaveLength(4);
  });

  it("2. FedosConversationParticipantAuthority reuses that SAME five-label vocabulary verbatim, plus exactly one Capability-domain addition", () => {
    expect(FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES).toEqual([
      "fedos",
      "nostr",
      "activitypub",
      "atproto",
      "session",
      "temporary-capability",
    ]);
  });
});

describe("Alpha 932 -- FedosConversationParticipantResolver is protocol-agnostic across all four external protocols", () => {
  const externalAuthorities = FEDOS_BOARD_SOURCE_PROTOCOLS.filter((p) => p !== "fedos") as readonly FedosConversationParticipantAuthority[];

  for (const authority of externalAuthorities) {
    it(`1. resolves a "${authority}" counterparty identically to every other protocol -- same outcome shape, same fields`, () => {
      const counterparty: FedosConversationParticipantReference = { authority, publicIdentifier: `${authority}-counterparty-id`, identityId: null };
      const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
      membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
      membershipAuthority.admit(CONVERSATION_ID, counterparty, "member", NOW);
      const resolver = new MembershipFedosConversationParticipantResolver(membershipAuthority);
      const result = resolver.resolveCounterparty(CONVERSATION_ID, ALICE);
      expect(result.outcome).toBe("resolved");
      if (result.outcome !== "resolved") return;
      expect(result.counterparty.participant).toEqual(counterparty);
    });
  }

  it("2. ambiguous-counterparty triggers identically regardless of WHICH protocols the extra members carry (mixed protocols, still ambiguous)", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(CONVERSATION_ID, { authority: "nostr", publicIdentifier: "n1", identityId: null }, "member", NOW);
    membershipAuthority.admit(CONVERSATION_ID, { authority: "activitypub", publicIdentifier: "ap1", identityId: null }, "member", NOW);
    const resolver = new MembershipFedosConversationParticipantResolver(membershipAuthority);
    expect(resolver.resolveCounterparty(CONVERSATION_ID, ALICE)).toEqual({ outcome: "ambiguous-counterparty" });
  });
});

describe("Alpha 934 -- resolveFedosConversationCounterpartyPublicKeyHex narrows HONESTLY: only nostr resolves, every other protocol fails closed the SAME way", () => {
  const nonNostrAuthorities = FEDOS_CONVERSATION_PARTICIPANT_AUTHORITIES.filter((a) => a !== "nostr");

  for (const authority of nonNostrAuthorities) {
    it(`1. "${authority}" fails closed to 'unsupported-authority', never a silent guess`, () => {
      const ref: FedosConversationParticipantReference = { authority, publicIdentifier: "whatever-shaped-identifier", identityId: null };
      expect(resolveFedosConversationCounterpartyPublicKeyHex(ref)).toEqual({ outcome: "unsupported-authority" });
    });
  }

  it("2. nostr is the ONLY authority that can ever resolve -- consistent with Alpha 890's own pairwise/Direct-mode, ECDH-only key-strategy boundary", () => {
    const ref: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "d".repeat(64), identityId: null };
    expect(resolveFedosConversationCounterpartyPublicKeyHex(ref)).toEqual({ outcome: "resolved", publicKeyHex: "d".repeat(64) });
  });
});
