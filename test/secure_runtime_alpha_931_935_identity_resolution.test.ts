/**
 * Secure Runtime Alpha 931–935 — Conversation Identity Resolution.
 * Unit coverage for the four Stage-1..4 resolvers plus their Stage-5
 * composition (`FedosConversationKeyResolver`), including the genuine
 * cryptographic composition over the EXISTING, unmodified Alpha 681–720
 * Nostr Identity Binding Authority.
 */
import { describe, it, expect } from "vitest";
import {
  DelegatingFedosConversationIdentityResolver,
} from "../src/conversation/encryption/identity/fedos_conversation_identity_resolver.js";
import {
  MembershipFedosConversationParticipantResolver,
} from "../src/conversation/encryption/identity/fedos_conversation_participant_resolver.js";
import {
  FixedFedosConversationLocalAccountIndexAuthority,
} from "../src/conversation/encryption/identity/fedos_conversation_local_account_index_authority.js";
import {
  resolveFedosConversationCounterpartyPublicKeyHex,
} from "../src/conversation/encryption/identity/fedos_conversation_counterparty_public_key_resolver.js";
import { FedosConversationKeyResolver } from "../src/conversation/encryption/identity/fedos_conversation_key_resolver.js";
import {
  AnonymousLocalFedosConversationCreatorIdentityAuthority,
  StaticFedosConversationCreatorIdentityAuthority,
  FEDOS_ANONYMOUS_LOCAL_CREATOR,
} from "../src/conversation/construction/fedos_conversation_creator_identity_authority.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { FedosSigningAuthorityNostrAuthorBinding } from "../src/board/runtime/identity/fedos_nostr_author_binding_authority.js";
import type { FedosNostrSigningAuthority } from "../src/nostr/sign/fedos_nostr_signing_authority.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";

const CONVERSATION_ID = "private-draft::direct::alpha-931" as FedosConversationId;
const ALICE_NOSTR_HEX = "a".repeat(64);
const BOB_NOSTR_HEX = "b".repeat(64);
const ALICE: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: ALICE_NOSTR_HEX, identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: BOB_NOSTR_HEX, identityId: null };
const NOW = 1_700_000_000;

function fakeSigningAuthority(mapping: Record<number, string>): FedosNostrSigningAuthority {
  return {
    signEvent: async () => null,
    publicIdentityForAccount: async (accountIndex: number) => {
      const hex = mapping[accountIndex];
      return hex === undefined ? null : { accountIndex, publicKeyHex: hex };
    },
  };
}

describe("Alpha 931 -- FedosConversationIdentityResolver", () => {
  it("1. delegates to the injected FedosConversationCreatorIdentityAuthority verbatim", () => {
    const resolver = new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE));
    expect(resolver.resolveLocalParticipant()).toEqual({ outcome: "resolved", creator: ALICE });
  });

  it("2. anonymous-local passes through unmodified", () => {
    const resolver = new DelegatingFedosConversationIdentityResolver(new AnonymousLocalFedosConversationCreatorIdentityAuthority());
    expect(resolver.resolveLocalParticipant()).toEqual({ outcome: "anonymous-local", creator: FEDOS_ANONYMOUS_LOCAL_CREATOR });
  });
});

describe("Alpha 932 -- FedosConversationParticipantResolver", () => {
  it("1. not-member -- the local participant has no Membership at all", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const resolver = new MembershipFedosConversationParticipantResolver(membershipAuthority);
    expect(resolver.resolveCounterparty(CONVERSATION_ID, ALICE)).toEqual({ outcome: "not-member" });
  });

  it("2. no-counterparty -- local is the ONLY active member", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    const resolver = new MembershipFedosConversationParticipantResolver(membershipAuthority);
    expect(resolver.resolveCounterparty(CONVERSATION_ID, ALICE)).toEqual({ outcome: "no-counterparty" });
  });

  it("3. resolved -- exactly one other active member is the counterparty", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);
    const resolver = new MembershipFedosConversationParticipantResolver(membershipAuthority);
    const result = resolver.resolveCounterparty(CONVERSATION_ID, ALICE);
    expect(result.outcome).toBe("resolved");
    if (result.outcome !== "resolved") return;
    expect(result.counterparty.participant).toEqual(BOB);
    expect(result.local.participant).toEqual(ALICE);
  });

  it("4. ambiguous-counterparty -- two or more OTHER active members (group, out of V1 scope)", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const carol: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null };
    membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);
    membershipAuthority.admit(CONVERSATION_ID, carol, "member", NOW);
    const resolver = new MembershipFedosConversationParticipantResolver(membershipAuthority);
    expect(resolver.resolveCounterparty(CONVERSATION_ID, ALICE)).toEqual({ outcome: "ambiguous-counterparty" });
  });

  it("5. not-member -- local Membership exists but is revoked (not active)", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    membershipAuthority.revoke(CONVERSATION_ID, ALICE, NOW + 1);
    const resolver = new MembershipFedosConversationParticipantResolver(membershipAuthority);
    expect(resolver.resolveCounterparty(CONVERSATION_ID, ALICE)).toEqual({ outcome: "not-member" });
  });

  it("6. no-counterparty -- the only OTHER member is revoked, not active", () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);
    membershipAuthority.revoke(CONVERSATION_ID, BOB, NOW + 1);
    const resolver = new MembershipFedosConversationParticipantResolver(membershipAuthority);
    expect(resolver.resolveCounterparty(CONVERSATION_ID, ALICE)).toEqual({ outcome: "no-counterparty" });
  });
});

describe("Alpha 933 -- FedosConversationLocalAccountIndexAuthority (AccountIndex resolution)", () => {
  it("1. defaults to 0 -- mirrors Alpha 689's own adopted default", () => {
    expect(new FixedFedosConversationLocalAccountIndexAuthority().localAccountIndex()).toBe(0);
  });

  it("2. honors an explicit configured value -- fixed, never inferred", () => {
    expect(new FixedFedosConversationLocalAccountIndexAuthority(7).localAccountIndex()).toBe(7);
  });

  it("3. fails closed to 0 for a negative/non-integer constructor argument, never throws", () => {
    expect(new FixedFedosConversationLocalAccountIndexAuthority(-1).localAccountIndex()).toBe(0);
    expect(new FixedFedosConversationLocalAccountIndexAuthority(1.5).localAccountIndex()).toBe(0);
  });
});

describe("Alpha 934 -- resolveFedosConversationCounterpartyPublicKeyHex (Counterparty PublicKey resolution)", () => {
  it("1. resolved -- a well-formed nostr counterparty", () => {
    expect(resolveFedosConversationCounterpartyPublicKeyHex(BOB)).toEqual({ outcome: "resolved", publicKeyHex: BOB_NOSTR_HEX });
  });

  it("2. unsupported-authority -- fedos/activitypub/atproto/session/temporary-capability all fail closed", () => {
    for (const authority of ["fedos", "activitypub", "atproto", "session", "temporary-capability"] as const) {
      const ref: FedosConversationParticipantReference = { authority, publicIdentifier: "whatever", identityId: null };
      expect(resolveFedosConversationCounterpartyPublicKeyHex(ref)).toEqual({ outcome: "unsupported-authority" });
    }
  });

  it("3. invalid-public-key -- uppercase hex, npub-form, and short/long strings all fail closed", () => {
    for (const publicIdentifier of ["A".repeat(64), "npub1abcdef", "ab".repeat(31), "ab".repeat(33)]) {
      const ref: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier, identityId: null };
      expect(resolveFedosConversationCounterpartyPublicKeyHex(ref)).toEqual({ outcome: "invalid-public-key" });
    }
  });
});

describe("Alpha 935 -- FedosConversationKeyResolver (composition, THE named Alpha 890 blocker)", () => {
  function membershipWithBoth(): InMemoryFedosConversationMembershipAuthority {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    membershipAuthority.admit(CONVERSATION_ID, ALICE, "owner", NOW);
    membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);
    return membershipAuthority;
  }

  it("1. identity-unavailable -- the identity resolver itself is unavailable", async () => {
    const identityResolver = { resolveLocalParticipant: () => ({ outcome: "unavailable" as const }) };
    const resolver = new FedosConversationKeyResolver({
      identityResolver,
      participantResolver: new MembershipFedosConversationParticipantResolver(membershipWithBoth()),
      accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(),
    });
    expect(await resolver.resolve(CONVERSATION_ID)).toEqual({ outcome: "identity-unavailable" });
  });

  it("2. not-member -- local participant resolves but has no Membership", async () => {
    const resolver = new FedosConversationKeyResolver({
      identityResolver: new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE)),
      participantResolver: new MembershipFedosConversationParticipantResolver(new InMemoryFedosConversationMembershipAuthority()),
      accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(),
    });
    expect(await resolver.resolve(CONVERSATION_ID)).toEqual({ outcome: "not-member" });
  });

  it("3. identity-binding-unavailable -- local is nostr but NO binding authority was injected", async () => {
    const resolver = new FedosConversationKeyResolver({
      identityResolver: new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE)),
      participantResolver: new MembershipFedosConversationParticipantResolver(membershipWithBoth()),
      accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
    });
    expect(await resolver.resolve(CONVERSATION_ID)).toEqual({ outcome: "identity-binding-unavailable" });
  });

  it("4. identity-binding-mismatch -- the REAL Alpha 681-720 binding authority rejects a wrong account index", async () => {
    const signingAuthority = fakeSigningAuthority({ 0: "f".repeat(64) }); // account 0 derives to a DIFFERENT key than ALICE's
    const bindingAuthority = new FedosSigningAuthorityNostrAuthorBinding(signingAuthority);
    const resolver = new FedosConversationKeyResolver({
      identityResolver: new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE)),
      participantResolver: new MembershipFedosConversationParticipantResolver(membershipWithBoth()),
      accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
      nostrAuthorBindingAuthority: bindingAuthority,
    });
    expect(await resolver.resolve(CONVERSATION_ID)).toEqual({ outcome: "identity-binding-mismatch" });
  });

  it("5. resolved -- the REAL Alpha 681-720 binding authority confirms account 0 truly derives ALICE's own key", async () => {
    const signingAuthority = fakeSigningAuthority({ 0: ALICE_NOSTR_HEX });
    const bindingAuthority = new FedosSigningAuthorityNostrAuthorBinding(signingAuthority);
    const membershipAuthority = membershipWithBoth();
    const resolver = new FedosConversationKeyResolver({
      identityResolver: new DelegatingFedosConversationIdentityResolver(new StaticFedosConversationCreatorIdentityAuthority(ALICE)),
      participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
      accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
      nostrAuthorBindingAuthority: bindingAuthority,
    });
    const result = await resolver.resolve(CONVERSATION_ID);
    expect(result.outcome).toBe("resolved");
    if (result.outcome !== "resolved") return;
    expect(result.localAccountIndex).toBe(0);
    expect(result.counterpartyPublicKeyHex).toBe(BOB_NOSTR_HEX);
    expect(result.senderMembershipId).toBe(membershipAuthority.findMembership(CONVERSATION_ID, ALICE)!.id);
  });

  it("6. no binding check at all for a non-nostr local participant (anonymous-local) -- skips straight to resolved", async () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    membershipAuthority.admit(CONVERSATION_ID, FEDOS_ANONYMOUS_LOCAL_CREATOR, "owner", NOW);
    membershipAuthority.admit(CONVERSATION_ID, BOB, "member", NOW);
    const resolver = new FedosConversationKeyResolver({
      identityResolver: new DelegatingFedosConversationIdentityResolver(new AnonymousLocalFedosConversationCreatorIdentityAuthority()),
      participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
      accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
      // Deliberately no nostrAuthorBindingAuthority injected -- must not be required for a non-nostr local identity.
    });
    const result = await resolver.resolve(CONVERSATION_ID);
    expect(result).toEqual({
      outcome: "resolved",
      localAccountIndex: 0,
      counterpartyPublicKeyHex: BOB_NOSTR_HEX,
      senderMembershipId: membershipAuthority.findMembership(CONVERSATION_ID, FEDOS_ANONYMOUS_LOCAL_CREATOR)!.id,
    });
  });

  it("7. unsupported-counterparty-authority -- the counterparty is not nostr (four-protocol-adjacent honesty)", async () => {
    const membershipAuthority = new InMemoryFedosConversationMembershipAuthority();
    const atprotoCounterparty: FedosConversationParticipantReference = { authority: "atproto", publicIdentifier: "did:plc:xyz", identityId: null };
    membershipAuthority.admit(CONVERSATION_ID, FEDOS_ANONYMOUS_LOCAL_CREATOR, "owner", NOW);
    membershipAuthority.admit(CONVERSATION_ID, atprotoCounterparty, "member", NOW);
    const resolver = new FedosConversationKeyResolver({
      identityResolver: new DelegatingFedosConversationIdentityResolver(new AnonymousLocalFedosConversationCreatorIdentityAuthority()),
      participantResolver: new MembershipFedosConversationParticipantResolver(membershipAuthority),
      accountIndexAuthority: new FixedFedosConversationLocalAccountIndexAuthority(0),
    });
    expect(await resolver.resolve(CONVERSATION_ID)).toEqual({ outcome: "unsupported-counterparty-authority" });
  });
});
