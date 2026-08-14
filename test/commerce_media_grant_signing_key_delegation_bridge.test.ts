import { describe, expect, it } from "vitest";
import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import {
  buildMediaGrantSigningKeyDelegationUnsignedEventRequest,
  COMMERCE_MEDIA_GRANT_DELEGATION_EVENT_KIND,
  COMMERCE_MEDIA_GRANT_DELEGATION_TAG,
  signMediaGrantSigningKeyDelegation,
  verifyMediaGrantSigningKeyDelegationEvent,
} from "../src/os/commerce/catalog/adapters/nostr/commerce_media_grant_signing_key_delegation_bridge.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";
import type {
  FedosNostrSigningAuthority,
  FedosNostrUnsignedEventRequest,
} from "../src/os/messenger/adapters/nostr/protocol/sign/fedos_nostr_signing_authority.js";
import { RejectAllSignatureVerifier } from "../src/os/messenger/adapters/nostr/protocol/signature.js";

/**
 * Real Digital Delivery mega-arc (Agent G, Grant Custody pass) — the
 * behavioral proof that a delegation certificate is a REAL cryptographic
 * binding to the real seller identity, never a rubber stamp: Mallory,
 * signing with her OWN real key, can never produce a certificate that
 * verifies as Bob's, no matter what she writes into the certificate's own
 * fields. Mirrors `commerce_private_media_release_bridge_fake_crypto.test.ts`'s
 * own `realSchnorrSigningAuthority()` fixture exactly (real Schnorr
 * sign/verify, no approximated crypto).
 */

const BOB_SECRET = new Uint8Array(32).fill(11);
const BOB_PUBKEY = bytesToHex(schnorr.getPublicKey(BOB_SECRET));
const MALLORY_SECRET = new Uint8Array(32).fill(66);
const MALLORY_PUBKEY = bytesToHex(schnorr.getPublicKey(MALLORY_SECRET));

const DELEGATE_KEY = "d".repeat(64);
const OTHER_DELEGATE_KEY = "e".repeat(64);

function realSchnorrSigningAuthority(secretKey: Uint8Array): FedosNostrSigningAuthority {
  return {
    async signEvent(request: FedosNostrUnsignedEventRequest): Promise<NostrEvent | null> {
      const pubkey = bytesToHex(schnorr.getPublicKey(secretKey));
      const preimage = JSON.stringify([0, pubkey, request.createdAt, request.kind, request.tags, request.content]);
      const id = bytesToHex(sha256(new TextEncoder().encode(preimage)));
      const sig = bytesToHex(schnorr.sign(hexToBytes(id), secretKey));
      return { id, pubkey, created_at: request.createdAt, kind: request.kind, tags: request.tags as string[][], content: request.content, sig };
    },
    async publicIdentityForAccount(accountIndex: number) {
      return { accountIndex, publicKeyHex: bytesToHex(schnorr.getPublicKey(secretKey)) };
    },
  };
}

const BOB_AUTHORITY = realSchnorrSigningAuthority(BOB_SECRET);
const MALLORY_AUTHORITY = realSchnorrSigningAuthority(MALLORY_SECRET);

describe("commerce_media_grant_signing_key_delegation_bridge: unsigned event construction", () => {
  it("builds a well-formed request with the fixed kind/tag/content shape", () => {
    const request = buildMediaGrantSigningKeyDelegationUnsignedEventRequest(DELEGATE_KEY, 0, 1_700_000_000);
    expect(request).not.toBeNull();
    expect(request?.kind).toBe(COMMERCE_MEDIA_GRANT_DELEGATION_EVENT_KIND);
    expect(request?.tags).toEqual([["t", COMMERCE_MEDIA_GRANT_DELEGATION_TAG]]);
    const content = JSON.parse(request?.content ?? "{}") as Record<string, unknown>;
    expect(content.delegateKeyPublicHex).toBe(DELEGATE_KEY);
    expect(content.purpose).toBe("commerce-media-access-grant-signing-key");
  });

  it("returns null for a malformed delegate key", () => {
    expect(buildMediaGrantSigningKeyDelegationUnsignedEventRequest("not-hex", 0, 1_700_000_000)).toBeNull();
  });
});

describe("commerce_media_grant_signing_key_delegation_bridge: real end-to-end sign + verify", () => {
  it("a certificate genuinely signed by Bob's real identity, for Bob's own delegate key, verifies VALID", async () => {
    const cert = await signMediaGrantSigningKeyDelegation(BOB_AUTHORITY, DELEGATE_KEY, 0, 1_700_000_000);
    expect(cert).not.toBeNull();
    const result = await verifyMediaGrantSigningKeyDelegationEvent(cert, {
      expectedSellerPubkeyHex: BOB_PUBKEY,
      expectedDelegateKeyPublicHex: DELEGATE_KEY,
    });
    expect(result).toEqual({ outcome: "valid", sellerPubkeyHex: BOB_PUBKEY, delegateKeyPublicHex: DELEGATE_KEY });
  });

  it("WRONG SIGNER: Mallory signs her OWN real certificate, but it can never verify as Bob's -- REJECTED", async () => {
    // Mallory produces a real, validly-self-signed certificate (her own key, her own delegate).
    const malloryCert = await signMediaGrantSigningKeyDelegation(MALLORY_AUTHORITY, DELEGATE_KEY, 0, 1_700_000_000);
    expect(malloryCert).not.toBeNull();
    // A verifier expecting Bob's real pubkey must reject it -- Mallory cannot
    // forge Bob's signature no matter what she writes into the content.
    const result = await verifyMediaGrantSigningKeyDelegationEvent(malloryCert, {
      expectedSellerPubkeyHex: BOB_PUBKEY,
      expectedDelegateKeyPublicHex: DELEGATE_KEY,
    });
    expect(result).toEqual({ outcome: "seller-mismatch" });
  });

  it("Mallory cannot rewrite Bob's genuine certificate's pubkey field to claim it as her own (breaks the signature)", async () => {
    const bobCert = await signMediaGrantSigningKeyDelegation(BOB_AUTHORITY, DELEGATE_KEY, 0, 1_700_000_000);
    expect(bobCert).not.toBeNull();
    const forged = { ...(bobCert as NostrEvent), pubkey: MALLORY_PUBKEY };
    const result = await verifyMediaGrantSigningKeyDelegationEvent(forged, {
      expectedSellerPubkeyHex: MALLORY_PUBKEY,
      expectedDelegateKeyPublicHex: DELEGATE_KEY,
    });
    expect(result).toEqual({ outcome: "signature-invalid" });
  });

  it("DELEGATE MISMATCH: a valid Bob certificate for delegate key X does not authorize delegate key Y", async () => {
    const cert = await signMediaGrantSigningKeyDelegation(BOB_AUTHORITY, DELEGATE_KEY, 0, 1_700_000_000);
    const result = await verifyMediaGrantSigningKeyDelegationEvent(cert, {
      expectedSellerPubkeyHex: BOB_PUBKEY,
      expectedDelegateKeyPublicHex: OTHER_DELEGATE_KEY,
    });
    expect(result).toEqual({ outcome: "delegate-mismatch" });
  });

  it("TAMPERED CONTENT: mutating the content after signing invalidates the signature", async () => {
    const cert = await signMediaGrantSigningKeyDelegation(BOB_AUTHORITY, DELEGATE_KEY, 0, 1_700_000_000);
    const tampered = { ...(cert as NostrEvent), content: JSON.stringify({ formatVersion: 1, purpose: "commerce-media-access-grant-signing-key", delegateKeyPublicHex: OTHER_DELEGATE_KEY }) };
    const result = await verifyMediaGrantSigningKeyDelegationEvent(tampered, {
      expectedSellerPubkeyHex: BOB_PUBKEY,
      expectedDelegateKeyPublicHex: OTHER_DELEGATE_KEY,
    });
    expect(result).toEqual({ outcome: "signature-invalid" });
  });

  it("WRONG TAG: a real, validly-signed event of a different domain never satisfies this check", async () => {
    const otherAuthority: FedosNostrSigningAuthority = {
      ...BOB_AUTHORITY,
      async signEvent(request) {
        return BOB_AUTHORITY.signEvent({ ...request, tags: [["t", "some-other-domain"]] });
      },
    };
    const cert = await signMediaGrantSigningKeyDelegation(otherAuthority, DELEGATE_KEY, 0, 1_700_000_000);
    const result = await verifyMediaGrantSigningKeyDelegationEvent(cert, {
      expectedSellerPubkeyHex: BOB_PUBKEY,
      expectedDelegateKeyPublicHex: DELEGATE_KEY,
    });
    expect(result).toEqual({ outcome: "wrong-tag" });
  });

  it("malformed/garbage input never throws, always rejects", async () => {
    for (const candidate of [null, undefined, {}, "a string", 42, { pubkey: BOB_PUBKEY }]) {
      const result = await verifyMediaGrantSigningKeyDelegationEvent(candidate, {
        expectedSellerPubkeyHex: BOB_PUBKEY,
        expectedDelegateKeyPublicHex: DELEGATE_KEY,
      });
      expect(result.outcome).toBe("malformed");
    }
  });

  it("respects an injected verifier (fails closed when the verifier rejects)", async () => {
    const cert = await signMediaGrantSigningKeyDelegation(BOB_AUTHORITY, DELEGATE_KEY, 0, 1_700_000_000);
    const result = await verifyMediaGrantSigningKeyDelegationEvent(cert, {
      expectedSellerPubkeyHex: BOB_PUBKEY,
      expectedDelegateKeyPublicHex: DELEGATE_KEY,
      verifier: RejectAllSignatureVerifier,
    });
    expect(result).toEqual({ outcome: "signature-invalid" });
  });
});

describe("commerce_media_grant_signing_key_delegation_bridge: restart durability semantics", () => {
  it("a certificate minted before a simulated restart still verifies, and a FRESH mint afterward (same real identity, same durable delegate key) verifies identically", async () => {
    const cert = await signMediaGrantSigningKeyDelegation(BOB_AUTHORITY, DELEGATE_KEY, 0, 1_700_000_000);
    const resultBeforeRestart = await verifyMediaGrantSigningKeyDelegationEvent(cert, {
      expectedSellerPubkeyHex: BOB_PUBKEY,
      expectedDelegateKeyPublicHex: DELEGATE_KEY,
    });
    expect(resultBeforeRestart).toEqual({ outcome: "valid", sellerPubkeyHex: BOB_PUBKEY, delegateKeyPublicHex: DELEGATE_KEY });

    // Simulate "restart": mint a FRESH certificate against a FRESH authority
    // instance constructed from nothing but the same real secret key (no
    // shared in-memory state, no cached nonce) -- Schnorr/BIP-340 signatures
    // are randomized, so the raw bytes legitimately differ, but the
    // certificate must still verify to the exact SAME real identity under
    // the exact same CONTINUING delegate key.
    const freshBobAuthority = realSchnorrSigningAuthority(BOB_SECRET);
    const certAfterRestart = await signMediaGrantSigningKeyDelegation(freshBobAuthority, DELEGATE_KEY, 0, 1_700_000_100);
    const resultAfterRestart = await verifyMediaGrantSigningKeyDelegationEvent(certAfterRestart, {
      expectedSellerPubkeyHex: BOB_PUBKEY,
      expectedDelegateKeyPublicHex: DELEGATE_KEY,
    });
    expect(resultAfterRestart).toEqual({ outcome: "valid", sellerPubkeyHex: BOB_PUBKEY, delegateKeyPublicHex: DELEGATE_KEY });

    // The PRE-restart certificate must remain independently verifiable
    // AFTER the restart too -- historical certificates are never
    // invalidated by a later mint under the same continuing identity.
    const resultOfOldCertAfterRestart = await verifyMediaGrantSigningKeyDelegationEvent(cert, {
      expectedSellerPubkeyHex: BOB_PUBKEY,
      expectedDelegateKeyPublicHex: DELEGATE_KEY,
    });
    expect(resultOfOldCertAfterRestart.outcome).toBe("valid");
  });
});
