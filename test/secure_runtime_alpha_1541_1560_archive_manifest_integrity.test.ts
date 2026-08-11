import { describe, it, expect } from "vitest";
// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle.js";
import {
  serializeFedosConversationArchiveBundleToBytes,
  deserializeFedosConversationArchiveBundleFromBytes,
} from "../src/os/messenger/conversations/archive/fedos_conversation_archive_bundle_codec.js";
import { computeFedosConversationArchiveContentHash, fedosConversationArchiveContentHashesAreEqual } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_integrity.js";
import { buildFedosConversationArchiveManifest, deserializeFedosConversationArchiveManifest } from "../src/os/messenger/conversations/archive/fedos_conversation_archive_manifest_codec.js";
import {
  encodeFedosConversationArchiveHeader,
  fedosConversationArchiveHeaderBytesAreEqual,
  splitFedosConversationArchiveHeader,
} from "../src/os/messenger/conversations/archive/fedos_conversation_archive_header.js";

const CONVERSATION_ID = "board-a::thread-1";

function makeBundle(overrides: Partial<FedosConversationArchiveBundleV1> = {}): FedosConversationArchiveBundleV1 {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId: CONVERSATION_ID,
    exportedAt: 1_700_000_500,
    conversation: {
      schemaVersion: 1,
      id: CONVERSATION_ID,
      mode: "public",
      boardId: "board-a",
      rootThreadId: "thread-1",
      rootPostId: "thread-1",
      policyReference: "public-v1",
      createdAt: 1_700_000_000,
    },
    memberships: [
      {
        schemaVersion: 1,
        id: `${CONVERSATION_ID}::fedos::alice`,
        conversationId: CONVERSATION_ID,
        participantAuthority: "fedos",
        participantPublicIdentifier: "alice",
        participantIdentityId: null,
        role: "owner",
        state: "active",
        joinedAt: 1_700_000_000,
        endedAt: null,
      },
      {
        schemaVersion: 1,
        id: `${CONVERSATION_ID}::fedos::bob`,
        conversationId: CONVERSATION_ID,
        participantAuthority: "fedos",
        participantPublicIdentifier: "bob",
        participantIdentityId: null,
        role: "member",
        state: "active",
        joinedAt: 1_700_000_050,
        endedAt: null,
      },
    ],
    capabilityEvents: [
      {
        schemaVersion: 1,
        eventType: "issued",
        capabilityId: "cap-1",
        conversationId: CONVERSATION_ID,
        action: "join-conversation",
        issuerAuthority: "fedos",
        issuerPublicIdentifier: "alice",
        issuerIdentityId: null,
        intendedRecipientAuthority: null,
        intendedRecipientPublicIdentifier: null,
        intendedRecipientIdentityId: null,
        maxUses: 1,
        expiresAt: null,
        issuedAt: 1_700_000_000,
        bearerVerifier: "deadbeef",
      },
      {
        schemaVersion: 1,
        eventType: "redeemed",
        capabilityId: "cap-1",
        redeemerAuthority: "fedos",
        redeemerPublicIdentifier: "bob",
        redeemerIdentityId: null,
        redeemedAt: 1_700_000_050,
      },
    ],
    envelopes: [
      {
        schemaVersion: 1,
        id: "envelope-1",
        conversationId: CONVERSATION_ID,
        senderMembershipId: `${CONVERSATION_ID}::fedos::alice`,
        payloadId: "payload-1",
        encryptionSuite: "ChaCha20Poly1305",
        keyEpoch: 0,
        createdAt: 1_700_000_010,
        replyToEnvelopeId: null,
      },
    ],
    payloads: [
      {
        schemaVersion: 1,
        id: "payload-1",
        conversationId: CONVERSATION_ID,
        mediaType: "application/octet-stream",
        byteLength: 5,
        createdAt: 1_700_000_010,
        bytesBase64: Buffer.from([1, 2, 3, 4, 5]).toString("base64"),
      },
    ],
    ...overrides,
  };
}

describe("Secure Runtime Alpha 1541-1560 -- Archive Bundle Codec", () => {
  it("1. round-trips a well-formed bundle", () => {
    const bundle = makeBundle();
    const bytes = serializeFedosConversationArchiveBundleToBytes(bundle);
    const decoded = deserializeFedosConversationArchiveBundleFromBytes(bytes);
    expect(decoded).not.toBeNull();
    expect(decoded?.conversationId).toBe(CONVERSATION_ID);
    expect(decoded?.memberships.length).toBe(2);
    expect(decoded?.capabilityEvents.length).toBe(2);
    expect(decoded?.envelopes.length).toBe(1);
    expect(decoded?.payloads.length).toBe(1);
  });

  it("2. array order does not affect the serialized/hashed bytes -- sorted canonically", () => {
    const forward = makeBundle();
    const reversed = makeBundle({
      memberships: [...forward.memberships].reverse(),
      capabilityEvents: [...forward.capabilityEvents].reverse(),
      envelopes: [...forward.envelopes].reverse(),
      payloads: [...forward.payloads].reverse(),
    });
    expect(serializeFedosConversationArchiveBundleToBytes(forward)).toEqual(serializeFedosConversationArchiveBundleToBytes(reversed));
  });

  it("3. rejects malformed JSON bytes", () => {
    expect(deserializeFedosConversationArchiveBundleFromBytes(new TextEncoder().encode("not json"))).toBeNull();
  });

  it("4. rejects a mismatched schemaVersion", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ ...JSON.parse(new TextDecoder().decode(serializeFedosConversationArchiveBundleToBytes(makeBundle()))), schemaVersion: 2 }));
    expect(deserializeFedosConversationArchiveBundleFromBytes(bytes)).toBeNull();
  });

  it("5. rejects an unknown top-level field", () => {
    const raw = JSON.parse(new TextDecoder().decode(serializeFedosConversationArchiveBundleToBytes(makeBundle())));
    raw.extra = "nope";
    expect(deserializeFedosConversationArchiveBundleFromBytes(new TextEncoder().encode(JSON.stringify(raw)))).toBeNull();
  });

  it("6. rejects a non-array capabilityEvents field", () => {
    const raw = JSON.parse(new TextDecoder().decode(serializeFedosConversationArchiveBundleToBytes(makeBundle())));
    raw.capabilityEvents = "not-an-array";
    expect(deserializeFedosConversationArchiveBundleFromBytes(new TextEncoder().encode(JSON.stringify(raw)))).toBeNull();
  });
});

describe("Secure Runtime Alpha 1541-1560 -- Archive Integrity", () => {
  it("1. contentHash is deterministic and independent of array order", () => {
    const forward = makeBundle();
    const reversed = makeBundle({ memberships: [...forward.memberships].reverse() });
    expect(fedosConversationArchiveContentHashesAreEqual(computeFedosConversationArchiveContentHash(forward), computeFedosConversationArchiveContentHash(reversed))).toBe(true);
  });

  it("2. contentHash changes when content changes", () => {
    const a = makeBundle();
    const b = makeBundle({ exportedAt: a.exportedAt + 1 });
    expect(fedosConversationArchiveContentHashesAreEqual(computeFedosConversationArchiveContentHash(a), computeFedosConversationArchiveContentHash(b))).toBe(false);
  });

  it("3. contentHash is a lowercase hex SHA-256 digest (64 chars)", () => {
    const hash = computeFedosConversationArchiveContentHash(makeBundle());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("Secure Runtime Alpha 1541-1560 -- Archive Manifest", () => {
  it("1. buildFedosConversationArchiveManifest derives counts and hash from the bundle", () => {
    const bundle = makeBundle();
    const manifest = buildFedosConversationArchiveManifest(bundle);
    expect(manifest.schemaVersion).toBe(FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION);
    expect(manifest.conversationId).toBe(CONVERSATION_ID);
    expect(manifest.membershipCount).toBe(2);
    expect(manifest.capabilityEventCount).toBe(2);
    expect(manifest.envelopeCount).toBe(1);
    expect(manifest.payloadCount).toBe(1);
    expect(manifest.contentHash).toBe(computeFedosConversationArchiveContentHash(bundle));
  });

  it("2. round-trips through the codec", () => {
    const manifest = buildFedosConversationArchiveManifest(makeBundle());
    expect(deserializeFedosConversationArchiveManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest);
  });

  it("3. fails closed on a mismatched schemaVersion", () => {
    const manifest = buildFedosConversationArchiveManifest(makeBundle());
    expect(deserializeFedosConversationArchiveManifest({ ...manifest, schemaVersion: 2 })).toBeNull();
  });

  it("4. fails closed on a negative count", () => {
    const manifest = buildFedosConversationArchiveManifest(makeBundle());
    expect(deserializeFedosConversationArchiveManifest({ ...manifest, membershipCount: -1 })).toBeNull();
  });

  it("5. fails closed on an unknown field", () => {
    const manifest = buildFedosConversationArchiveManifest(makeBundle());
    expect(deserializeFedosConversationArchiveManifest({ ...manifest, extra: "nope" })).toBeNull();
  });

  it("6. fails closed on a non-object", () => {
    expect(deserializeFedosConversationArchiveManifest(null)).toBeNull();
    expect(deserializeFedosConversationArchiveManifest("string")).toBeNull();
  });
});

describe("Secure Runtime Alpha 1541-1560 -- Archive Header", () => {
  it("1. round-trips the header/bundle split", () => {
    const header = encodeFedosConversationArchiveHeader({ conversationId: CONVERSATION_ID, exportedAt: 1_700_000_500 });
    const bundleBytes = new TextEncoder().encode("bundle-bytes-here");
    const sealed = new Uint8Array([...header, ...bundleBytes]);
    const split = splitFedosConversationArchiveHeader(sealed);
    expect(split).not.toBeNull();
    expect(fedosConversationArchiveHeaderBytesAreEqual(split!.header, header)).toBe(true);
    expect(new TextDecoder().decode(split!.bundleBytes)).toBe("bundle-bytes-here");
  });

  it("2. is deterministic -- identical fields produce byte-identical headers", () => {
    const a = encodeFedosConversationArchiveHeader({ conversationId: CONVERSATION_ID, exportedAt: 1_700_000_500 });
    const b = encodeFedosConversationArchiveHeader({ conversationId: CONVERSATION_ID, exportedAt: 1_700_000_500 });
    expect(fedosConversationArchiveHeaderBytesAreEqual(a, b)).toBe(true);
  });

  it("3. detects a mismatched conversationId", () => {
    const a = encodeFedosConversationArchiveHeader({ conversationId: CONVERSATION_ID, exportedAt: 1_700_000_500 });
    const b = encodeFedosConversationArchiveHeader({ conversationId: "board-a::thread-2", exportedAt: 1_700_000_500 });
    expect(fedosConversationArchiveHeaderBytesAreEqual(a, b)).toBe(false);
  });

  it("4. fails closed on too-short input", () => {
    expect(splitFedosConversationArchiveHeader(new Uint8Array([0x01, 0x00]))).toBeNull();
  });
});
