/**
 * Secure Runtime Alpha 7081-7160 — Failure matrix. Proves the closed,
 * signed invitation pipeline fails CLOSED (never a throw, never a
 * fabricated acceptance) on malformed/hostile/mismatched input. Uses
 * mocked, narrow dependencies (no real WASM needed) so these run
 * unconditionally, mirroring the established convention throughout this
 * codebase's own failure-matrix test files.
 */
import { describe, it, expect } from "vitest";
import { FedosConversationInvitationInboundCoordinator } from "../src/conversation/invitation_bootstrap/fedos_conversation_invitation_inbound_coordinator.js";
import { FedosConversationInvitationOutboundCoordinator } from "../src/conversation/invitation_bootstrap/fedos_conversation_invitation_outbound_coordinator.js";
import { InMemoryFedosConversationInvitationReceivedPersistence } from "../src/conversation/invitation_bootstrap/persistence/in_memory_fedos_conversation_invitation_received_persistence.js";
import { canonicalSerializeFedosConversationInvitationContent } from "../src/conversation/invitation_bootstrap/fedos_conversation_invitation_advertisement.js";
import { encodeFedosConversationInvitationControlPayload } from "../src/conversation/invitation_bootstrap/fedos_conversation_invitation_control_payload.js";
import { authorizeFedosConversationInvitationContent } from "../src/conversation/invitation_bootstrap/fedos_conversation_invitation_authentication.js";
import { InMemoryFedosConversationMembershipAuthority } from "../src/conversation/membership/in_memory_fedos_conversation_membership_authority.js";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { serializeForId } from "../src/nostr/event.js";

// Real BIP-340 Schnorr keypairs (not mocks) -- so the REAL `NobleSignatureVerifier`
// this feature's own inbound coordinator uses can genuinely verify these signatures.
const ALICE_PRIVKEY = schnorr.utils.randomSecretKey();
const ALICE_PUBKEY = bytesToHex(schnorr.getPublicKey(ALICE_PRIVKEY));
const BOB_PRIVKEY = schnorr.utils.randomSecretKey();
const BOB_PUBKEY = bytesToHex(schnorr.getPublicKey(BOB_PRIVKEY));
const MALLORY_PRIVKEY = schnorr.utils.randomSecretKey();
const MALLORY_PUBKEY = bytesToHex(schnorr.getPublicKey(MALLORY_PRIVKEY));

const PRIVKEY_BY_PUBKEY = new Map<string, Uint8Array>([
  [ALICE_PUBKEY, ALICE_PRIVKEY],
  [BOB_PUBKEY, BOB_PRIVKEY],
  [MALLORY_PUBKEY, MALLORY_PRIVKEY],
]);

function fakeSigningAuthority(pubkeyHex: string, valid = true) {
  return {
    async publicIdentityForAccount(accountIndex: number) {
      return { accountIndex, publicKeyHex: pubkeyHex };
    },
    async signEvent(req: { readonly content: string; readonly createdAt: number }) {
      if (!valid) return null;
      const privkey = PRIVKEY_BY_PUBKEY.get(pubkeyHex)!;
      const event = { pubkey: pubkeyHex, created_at: req.createdAt, kind: 1, tags: [["t", "fedos-conversation-invitation-v1"]], content: req.content };
      const idBytes = sha256(new TextEncoder().encode(serializeForId(event)));
      const id = bytesToHex(idBytes);
      const sig = bytesToHex(schnorr.sign(idBytes, privkey));
      return { ...event, id, sig };
    },
  } as never;
}

async function buildInvitation(inviterPubkey: string, inviteePubkey: string, opts?: { readonly expired?: boolean; readonly wrongContentSignature?: boolean }) {
  const now = 1_000_000;
  const content = {
    conversationId: "private-draft::direct::abc123",
    inviter: { authority: "nostr" as const, publicIdentifier: inviterPubkey, identityId: null },
    invitee: { authority: "nostr" as const, publicIdentifier: inviteePubkey, identityId: null },
    issuedAt: now,
    // A structurally-valid content ALWAYS has expiresAt > issuedAt -- the
    // "expired" case must be relative to the INBOUND coordinator's own
    // clock (1_000_500 below), not to issuedAt, to reach the runtime
    // expiry check rather than failing structural validation first.
    expiresAt: opts?.expired ? now + 1 : now + 1000,
    nonce: "0".repeat(32),
  };
  const canonicalContent = opts?.wrongContentSignature ? "tampered" : canonicalSerializeFedosConversationInvitationContent(content);
  const auth = await authorizeFedosConversationInvitationContent(fakeSigningAuthority(inviterPubkey), 0, now, canonicalContent);
  return { schemaVersion: 1 as const, ...content, accountAuthorization: auth! };
}

function makeInbound(localPubkey: string, membershipAuthority = new InMemoryFedosConversationMembershipAuthority()) {
  return new FedosConversationInvitationInboundCoordinator({
    membershipAuthority,
    identityResolver: { resolveLocalParticipant: () => ({ outcome: "resolved", creator: { authority: "fedos", publicIdentifier: "anonymous-local", identityId: null } }) },
    signingAuthority: fakeSigningAuthority(localPubkey),
    accountIndex: 0,
    localDeviceRef: "device-1",
    clock: () => 1_000_500,
    receivedPersistence: new InMemoryFedosConversationInvitationReceivedPersistence(),
    reactivateConversation: async () => ({ outcome: "reactivated", mode: "direct" }),
  });
}

describe("Secure Runtime Alpha 7081-7160 -- failure matrix", () => {
  it("1. wrong recipient: invitation addressed to someone else fails closed", async () => {
    const invitation = await buildInvitation(ALICE_PUBKEY, BOB_PUBKEY);
    const inbound = makeInbound(MALLORY_PUBKEY);
    const payload = encodeFedosConversationInvitationControlPayload({ schemaVersion: 1, kind: "conversation-invitation", invitation });
    const result = await inbound.importRumorContent(new TextDecoder().decode(payload));
    expect(result.outcome).toBe("wrong-recipient");
  });

  it("2. expired invitation fails closed", async () => {
    const invitation = await buildInvitation(ALICE_PUBKEY, BOB_PUBKEY, { expired: true });
    const inbound = makeInbound(BOB_PUBKEY);
    const payload = encodeFedosConversationInvitationControlPayload({ schemaVersion: 1, kind: "conversation-invitation", invitation });
    const result = await inbound.importRumorContent(new TextDecoder().decode(payload));
    expect(result.outcome).toBe("expired");
  });

  it("3. tampered content (signature no longer matches canonical content) fails closed", async () => {
    const invitation = await buildInvitation(ALICE_PUBKEY, BOB_PUBKEY, { wrongContentSignature: true });
    const inbound = makeInbound(BOB_PUBKEY);
    const payload = encodeFedosConversationInvitationControlPayload({ schemaVersion: 1, kind: "conversation-invitation", invitation });
    const result = await inbound.importRumorContent(new TextDecoder().decode(payload));
    expect(result.outcome).toBe("bad-signature");
  });

  it("4. not an invitation payload at all falls through cleanly (never throws)", async () => {
    const inbound = makeInbound(BOB_PUBKEY);
    const result = await inbound.importRumorContent(JSON.stringify({ some: "unrelated content" }));
    expect(result.outcome).toBe("not-invitation-payload");
  });

  it("5. malformed JSON falls through cleanly (never throws)", async () => {
    const inbound = makeInbound(BOB_PUBKEY);
    const result = await inbound.importRumorContent("{not valid json");
    expect(result.outcome).toBe("not-invitation-payload");
  });

  it("6. oversized payload fails closed before any JSON.parse", async () => {
    const inbound = makeInbound(BOB_PUBKEY);
    const result = await inbound.importRumorContent("x".repeat(200_000));
    expect(result.outcome).toBe("not-invitation-payload");
  });

  it("7. duplicate delivery of the identical invitation is idempotent", async () => {
    const invitation = await buildInvitation(ALICE_PUBKEY, BOB_PUBKEY);
    const inbound = makeInbound(BOB_PUBKEY);
    const payload = encodeFedosConversationInvitationControlPayload({ schemaVersion: 1, kind: "conversation-invitation", invitation });
    const first = await inbound.importRumorContent(new TextDecoder().decode(payload));
    expect(first.outcome).toBe("accepted");
    const second = await inbound.importRumorContent(new TextDecoder().decode(payload));
    expect(second.outcome).toBe("duplicate");
  });

  it("8. outbound: invalid expiresInMs fails closed", async () => {
    const outbound = new FedosConversationInvitationOutboundCoordinator({
      membershipAuthority: new InMemoryFedosConversationMembershipAuthority(),
      identityResolver: { resolveLocalParticipant: () => ({ outcome: "resolved", creator: { authority: "fedos", publicIdentifier: "anonymous-local", identityId: null } }) },
      signingAuthority: fakeSigningAuthority(ALICE_PUBKEY),
      accountIndex: 0,
      idGenerator: { generateRequestId: () => "req-1", generateNonce: () => "0".repeat(32) },
      clock: () => 1_000_000,
      reactivateConversation: async () => ({ outcome: "reactivated", mode: "direct" }),
      sendMailboxNip17Control: async () => ({ outcome: "queued", envelopeId: "env-1" as never }),
    });
    const result = await outbound.createAndSendInvitation({ authority: "nostr", publicIdentifier: BOB_PUBKEY, identityId: null }, -1);
    expect(result.outcome).toBe("invalid-input");
  });

  it("9. outbound: signing unavailable fails closed", async () => {
    const outbound = new FedosConversationInvitationOutboundCoordinator({
      membershipAuthority: new InMemoryFedosConversationMembershipAuthority(),
      identityResolver: { resolveLocalParticipant: () => ({ outcome: "resolved", creator: { authority: "fedos", publicIdentifier: "anonymous-local", identityId: null } }) },
      signingAuthority: fakeSigningAuthority(ALICE_PUBKEY, false),
      accountIndex: 0,
      idGenerator: { generateRequestId: () => "req-1", generateNonce: () => "0".repeat(32) },
      clock: () => 1_000_000,
      reactivateConversation: async () => ({ outcome: "reactivated", mode: "direct" }),
      sendMailboxNip17Control: async () => ({ outcome: "queued", envelopeId: "env-1" as never }),
    });
    const result = await outbound.createAndSendInvitation({ authority: "nostr", publicIdentifier: BOB_PUBKEY, identityId: null });
    expect(result.outcome).toBe("signing-unavailable");
  });

  it("10. inbound: identity unavailable (no signing authority result) fails closed", async () => {
    const inbound = new FedosConversationInvitationInboundCoordinator({
      membershipAuthority: new InMemoryFedosConversationMembershipAuthority(),
      identityResolver: { resolveLocalParticipant: () => ({ outcome: "unavailable" }) },
      signingAuthority: { publicIdentityForAccount: async () => null, signEvent: async () => null } as never,
      accountIndex: 0,
      localDeviceRef: "device-1",
      clock: () => 1_000_500,
      receivedPersistence: new InMemoryFedosConversationInvitationReceivedPersistence(),
      reactivateConversation: async () => ({ outcome: "reactivated", mode: "direct" }),
    });
    const invitation = await buildInvitation(ALICE_PUBKEY, BOB_PUBKEY);
    const payload = encodeFedosConversationInvitationControlPayload({ schemaVersion: 1, kind: "conversation-invitation", invitation });
    const result = await inbound.importRumorContent(new TextDecoder().decode(payload));
    expect(result.outcome).toBe("identity-unavailable");
  });
});
