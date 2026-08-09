/**
 * Secure Runtime Alpha 7081-7160 — account-level authentication for the
 * Conversation Invitation advertisement. Mirrors
 * `fedos_ratchet_peer_capability_authentication.ts`'s own EXACT pattern:
 * a fixed kind-1 Nostr event, signed via the existing, unwidened
 * `FedosNostrSigningAuthority`, verified via the existing
 * `NobleSignatureVerifier` (real BIP-340 Schnorr). The inviter's public
 * identity is read ONLY from the cryptographically-verified
 * `event.pubkey`, never accepted as caller input. A fixed `t` tag plus a
 * domain string embedded in the signed content (distinct from every
 * other signed-content domain in this codebase, including Peer
 * Capability's own) prevents this signature from ever being confused
 * with a different record kind.
 *
 * No Device-level signature tier (unlike Peer Capability) — this Arc's
 * own narrower scope only needs to prove "a real account genuinely
 * issued this invitation," which account-level Nostr signing already
 * does; adding a second, optional evidence tier is not required to
 * satisfy this Arc's own mission and is left to a future Arc if ever
 * needed.
 */
import type { FedosNostrWireEvent } from "../../../../desktop/fedos_nostr_wire_event.js";
import { NobleSignatureVerifier } from "../../../../nostr/noble_signature.js";
import type { NostrEvent, NostrTag } from "../../../../nostr/types.js";
import type { FedosNostrSigningAuthority } from "../../../../nostr/sign/fedos_nostr_signing_authority.js";

/** Recognizable, non-authenticating marker tag — the real boundary is the domain string embedded in the record's own canonical content. */
export const FEDOS_CONVERSATION_INVITATION_NOSTR_TAG: readonly [string, string] = ["t", "fedos-conversation-invitation-v1"];
const FIXED_NOSTR_KIND = 1;

export interface FedosConversationInvitationAccountAuthorizationV1 {
  readonly event: FedosNostrWireEvent;
}

/** `null` on a signing-authority failure (no Master Seed held, WASM unavailable, etc.) — fails closed, never throws. */
export async function authorizeFedosConversationInvitationContent(
  signingAuthority: FedosNostrSigningAuthority,
  accountIndex: number,
  createdAt: number,
  canonicalContent: string,
): Promise<FedosConversationInvitationAccountAuthorizationV1 | null> {
  const event = await signingAuthority.signEvent({
    accountIndex,
    createdAt,
    kind: FIXED_NOSTR_KIND,
    tags: [FEDOS_CONVERSATION_INVITATION_NOSTR_TAG],
    content: canonicalContent,
  });
  if (event === null) return null;
  return Object.freeze({ event });
}

export type FedosConversationInvitationAccountAuthorizationOutcome = "valid" | "wrong-kind" | "content-mismatch" | "invalid-signature";

export interface FedosConversationInvitationAccountAuthorizationVerification {
  readonly outcome: FedosConversationInvitationAccountAuthorizationOutcome;
  /** Populated ONLY on `"valid"` — the cryptographically-verified signer. Never a caller claim. */
  readonly accountPublicKeyHex: string | null;
}

function toMutableNostrEvent(event: FedosNostrWireEvent): NostrEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((tag): NostrTag => [...tag]),
    content: event.content,
    sig: event.sig,
  };
}

function tagsMatch(tags: readonly (readonly string[])[]): boolean {
  return (
    tags.length === 1 &&
    tags[0]!.length === FEDOS_CONVERSATION_INVITATION_NOSTR_TAG.length &&
    tags[0]!.every((field, i) => field === FEDOS_CONVERSATION_INVITATION_NOSTR_TAG[i])
  );
}

/**
 * Verifies an account authorization against the EXACT `canonicalContent`
 * the caller reconstructs from the record it received (never the
 * event's own `content` trusted blind). Fails closed with a specific,
 * non-sensitive outcome; never throws.
 */
export async function verifyFedosConversationInvitationAccountAuthorization(
  authorization: FedosConversationInvitationAccountAuthorizationV1,
  canonicalContent: string,
): Promise<FedosConversationInvitationAccountAuthorizationVerification> {
  const { event } = authorization;
  if (event.kind !== FIXED_NOSTR_KIND) return { outcome: "wrong-kind", accountPublicKeyHex: null };
  if (!tagsMatch(event.tags) || event.content !== canonicalContent) {
    return { outcome: "content-mismatch", accountPublicKeyHex: null };
  }
  const verified = await NobleSignatureVerifier.verify(toMutableNostrEvent(event));
  if (!verified) return { outcome: "invalid-signature", accountPublicKeyHex: null };
  return { outcome: "valid", accountPublicKeyHex: event.pubkey };
}
