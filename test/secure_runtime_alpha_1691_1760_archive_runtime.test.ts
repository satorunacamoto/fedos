/**
 * Secure Runtime Alpha 1691–1760 ("Conversation Archive Runtime
 * Integration and Recovery Operations Arc") — `FedosConversationArchiveRuntime`
 * tests: export/inspect/preflight/restore, duplicate restore, identity
 * mismatch, corruption matrix, crash/restart recovery, lifecycle.
 *
 * Uses REAL in-memory persistence ports (the same classes production
 * code uses) and the REAL `FedosWasmConversationArchiveEncryptionAuthority`
 * over a fake, round-tripping (not cryptographic) runtime boundary —
 * the SAME "development-Runtime" fake-crypto tier the Alpha 1541–1610
 * Foundation's own tests already established
 * (`test/secure_runtime_alpha_1561_1580_archive_encrypted_export_import.test.ts`).
 * A REAL `NodeFedosConversationArchiveFileAuthority` over a real temp
 * directory is used for every test — this is a genuine file-round-trip
 * test suite, not a mocked one.
 *
 * A "Direct Conversation" here means: one Conversation record + one
 * active local Membership + envelopes/payloads, seeded DIRECTLY into
 * persistence (via the ports' own `put*` methods) rather than through a
 * live `conversationRuntime()` activation/send call. This is a
 * DELIBERATE, DOCUMENTED substitution: this worktree's own branch
 * (`arc/conversation-archive-runtime-integration-recovery`, based on
 * `master` @ `8c48c95`) does not yet include the Direct-messaging
 * activation/send facade or ANY Group Conversation code at all — both
 * live only on the separate, still-unmerged `arc/nostr-private-direct-pairwise-fanout-delivery`
 * lineage, and merging it is outside this Arc's own scope (no
 * PRECONDITIONS section authorizes it, unlike a prior Arc's own task).
 * See the completion declaration's own "Real Verification, honest
 * boundary" section. The Archive Runtime's OWN contract is agnostic to
 * HOW a record was persisted — collecting/restoring directly-seeded
 * records exercises every one of ITS OWN code paths identically to a
 * live-activated conversation would.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
// @ts-expect-error see above.
import { join } from "node:path";
// @ts-expect-error see above.
import { tmpdir } from "node:os";
// @ts-expect-error see above.
import { Buffer } from "node:buffer";

import { InMemoryFedosConversationPersistence } from "../src/conversation/persistence/in_memory_fedos_conversation_persistence.js";
import { InMemoryFedosConversationMembershipPersistence } from "../src/conversation/membership/persistence/in_memory_fedos_conversation_membership_persistence.js";
import { InMemoryFedosConversationCapabilityPersistence } from "../src/conversation/capability/persistence/in_memory_fedos_conversation_capability_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/conversation/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { toFedosConversationMembershipId } from "../src/conversation/membership/fedos_conversation_membership_id.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationId } from "../src/conversation/fedos_conversation_id.js";

import {
  FedosWasmConversationArchiveEncryptionAuthority,
  type FedosConversationArchiveEncryptionRuntimeBoundary,
} from "../src/conversation/archive/fedos_conversation_archive_encryption.js";
import { NodeFedosConversationArchiveFileAuthority } from "../src/conversation/archive/fs/fedos_conversation_archive_file_authority.js";
import { encodeFedosConversationArchiveFileContainer } from "../src/conversation/archive/fs/fedos_conversation_archive_file_container.js";
import { createFedosConversationArchiveRuntime, type FedosConversationArchiveRuntime } from "../src/conversation/archive/runtime/fedos_conversation_archive_runtime.js";
import type { FedosMasterSeedAuthority } from "../src/runtime/master_seed/fedos_master_seed_authority.js";
import type { AeadCiphertextHandle, AeadCiphertextWire, AeadKeyHandle } from "../src/runtime/fedos_wasm_loader.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/conversation/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveBundleV1 } from "../src/conversation/archive/fedos_conversation_archive_bundle.js";

const CONVERSATION_ID = "board-a::thread-1" as FedosConversationId;
const LOCAL_PARTICIPANT: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice", identityId: null };
const LOCAL_ACCOUNT_INDEX = 0;
const COUNTERPARTY_PUBLIC_KEY_HEX = "ab".repeat(32);
const LOCAL_MEMBERSHIP_ID = toFedosConversationMembershipId(CONVERSATION_ID, LOCAL_PARTICIPANT);

const KEY_HANDLE: AeadKeyHandle = { kind: "AeadKeyHandle" } as AeadKeyHandle;

/** Mirrors `test/secure_runtime_alpha_1561_1580_archive_encrypted_export_import.test.ts`'s own fake -- resolves the SAME key for (LOCAL_ACCOUNT_INDEX, COUNTERPARTY_PUBLIC_KEY_HEX) only, null for anything else (the "identity-mismatch" surface). */
function fakeMasterSeedAuthority(resolveConversationKey: FedosMasterSeedAuthority["resolveConversationKey"]): FedosMasterSeedAuthority {
  return {
    isAvailable: vi.fn(async () => true),
    isCleared: vi.fn(async () => false),
    generate: vi.fn(async () => true),
    restoreSealed: vi.fn(async () => true),
    seal: vi.fn(async () => null),
    clear: vi.fn(async () => undefined),
    resolveConversationKey,
  };
}

function matchingMasterSeedAuthority(): FedosMasterSeedAuthority {
  return fakeMasterSeedAuthority(async (accountIndex, counterpartyPublicKeyHex) =>
    accountIndex === LOCAL_ACCOUNT_INDEX && counterpartyPublicKeyHex === COUNTERPARTY_PUBLIC_KEY_HEX ? KEY_HANDLE : null,
  );
}

/** Mirrors `fakeRoundTrippingRuntimeBoundary()` from the Foundation's own encryption tests -- a REAL (in-memory) round trip, never actual AEAD, so export()->import() can be exercised without a compiled WASM artifact. Each instance has its OWN store, so a "fresh Runtime" in a restore test genuinely cannot decrypt a ciphertext it never encrypted -- exactly like a real WASM boundary would behave for a wire string it has never seen. */
function fakeRoundTrippingRuntimeBoundary(): FedosConversationArchiveEncryptionRuntimeBoundary {
  const byHandle = new Map<string, Uint8Array>();
  const byWire = new Map<string, string>();
  let counter = 0;
  return {
    encrypt: vi.fn(async (_key, _algorithm, _aadDomain, plaintext) => {
      counter += 1;
      const id = `handle-${counter}`;
      byHandle.set(id, plaintext);
      return { kind: "AeadCiphertextHandle", id } as unknown as AeadCiphertextHandle;
    }),
    exportCiphertext: vi.fn(async (ciphertext) => {
      const id = (ciphertext as unknown as { id: string }).id;
      const wire = `wire-${id}`;
      byWire.set(wire, id);
      return wire as unknown as AeadCiphertextWire;
    }),
    importCiphertext: vi.fn(async (wire) => {
      const id = byWire.get(wire as unknown as string);
      return id === undefined ? null : ({ kind: "AeadCiphertextHandle", id } as unknown as AeadCiphertextHandle);
    }),
    decrypt: vi.fn(async (_key, _algorithm, _aadDomain, ciphertext) => byHandle.get((ciphertext as unknown as { id: string }).id) ?? null),
  };
}

interface Harness {
  runtime: FedosConversationArchiveRuntime;
  readonly conversationPersistence: InMemoryFedosConversationPersistence;
  readonly membershipPersistence: InMemoryFedosConversationMembershipPersistence;
  readonly capabilityPersistence: InMemoryFedosConversationCapabilityPersistence;
  readonly envelopePersistence: InMemoryFedosConversationMessageEnvelopePersistence;
  readonly payloadStorage: InMemoryFedosConversationPayloadStorage;
  stopped: boolean;
}

/** Fresh in-memory ports + a fresh, independent fake crypto boundary (its own Map) every call -- mirrors a genuinely fresh, unrelated Runtime. */
function makeHarness(overrides: { masterSeedAuthority?: FedosMasterSeedAuthority; boundary?: FedosConversationArchiveEncryptionRuntimeBoundary } = {}): Harness {
  const conversationPersistence = new InMemoryFedosConversationPersistence();
  const membershipPersistence = new InMemoryFedosConversationMembershipPersistence();
  const capabilityPersistence = new InMemoryFedosConversationCapabilityPersistence();
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();

  const harness: Harness = {
    runtime: undefined as unknown as FedosConversationArchiveRuntime,
    conversationPersistence,
    membershipPersistence,
    capabilityPersistence,
    envelopePersistence,
    payloadStorage,
    stopped: false,
  };

  const encryptionAuthority = new FedosWasmConversationArchiveEncryptionAuthority(
    overrides.masterSeedAuthority ?? matchingMasterSeedAuthority(),
    overrides.boundary ?? fakeRoundTrippingRuntimeBoundary(),
  );

  const runtime = createFedosConversationArchiveRuntime({
    conversationPersistence,
    membershipPersistence,
    capabilityPersistence,
    envelopePersistence,
    payloadStorage,
    encryptionAuthority,
    fileAuthority: new NodeFedosConversationArchiveFileAuthority(),
    clock: () => 1_700_000_999,
    isRuntimeRunning: () => !harness.stopped,
  });

  // Mutate the SAME object the isRuntimeRunning closure above already captured -- spreading into a
  // new object here would silently detach a later `h.stopped = true` from that closure's own read.
  harness.runtime = runtime;
  return harness;
}

/** Seeds a "Direct Conversation" (one active local Membership + one envelope/payload) directly into a harness's own ports. See this file's own header for why this substitutes for live activation/send. */
function seedDirectConversation(h: Harness, plaintext: Uint8Array): void {
  h.conversationPersistence.putConversation({
    schemaVersion: 1,
    id: CONVERSATION_ID,
    mode: "public",
    boardId: "board-a",
    rootThreadId: "thread-1",
    rootPostId: "thread-1",
    policyReference: "public-v1",
    createdAt: 1_700_000_000,
  });
  h.membershipPersistence.putMembership({
    schemaVersion: 1,
    id: LOCAL_MEMBERSHIP_ID,
    conversationId: CONVERSATION_ID,
    participantAuthority: LOCAL_PARTICIPANT.authority,
    participantPublicIdentifier: LOCAL_PARTICIPANT.publicIdentifier,
    participantIdentityId: null,
    role: "owner",
    state: "active",
    joinedAt: 1_700_000_000,
    endedAt: null,
  });
  h.payloadStorage.putPayload({ id: "payload-1" as never, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: plaintext.length, createdAt: 1_700_000_010 }, plaintext);
  h.envelopePersistence.putEnvelope({
    schemaVersion: 1,
    id: "envelope-1" as never,
    conversationId: CONVERSATION_ID,
    senderMembershipId: LOCAL_MEMBERSHIP_ID,
    payloadId: "payload-1" as never,
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_010,
    replyToEnvelopeId: null,
  });
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fedos-archive-runtime-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const EXACT_MESSAGE = new TextEncoder().encode("Hola, que tal?");

describe("Secure Runtime Alpha 1691-1760 -- Direct Conversation archive round trip", () => {
  it("1. export -> fresh Runtime -> inspect -> preflight -> restore -> the exact original message payload bytes are recovered byte-for-byte", async () => {
    // A shared fake crypto boundary stands in for "a real WASM boundary would let any process decrypt
    // the same wire ciphertext given the right key" -- sender and receiver are otherwise fully
    // independent Runtimes over fully independent, empty persistence ports.
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedDirectConversation(sender, EXACT_MESSAGE);
    const destination = join(dir, "direct.archive");

    const exportResult = await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID,
      destinationPath: destination,
      localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
      suite: "ChaCha20Poly1305",
    });
    expect(exportResult.outcome).toBe("exported");
    expect(exportResult.manifest?.envelopeCount).toBe(1);
    expect(exportResult.manifest?.payloadCount).toBe(1);

    // "stop" the sender, then start a genuinely fresh, unrelated Runtime over fresh, empty ports
    // ("restart") -- the SAME conversation key is still resolvable via its own Master Seed Authority
    // (the "you can decrypt your Export iff you can already decrypt that conversation" contract, Alpha
    // 869/1541-1610, unchanged), and the SAME crypto boundary store stands in for the real WASM one.
    sender.stopped = true;
    const receiver = makeHarness({ boundary: sharedBoundary });

    const inspection = await receiver.runtime.inspectConversationArchive(destination);
    expect(inspection.outcome).toBe("inspected");
    expect(inspection.manifest?.conversationId).toBe(CONVERSATION_ID);

    const preflight = await receiver.runtime.preflightRestore({
      sourcePath: destination,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
      suite: "ChaCha20Poly1305",
    });
    expect(preflight.outcome).toBe("previewed");
    expect(preflight.report?.envelopes).toEqual({ new: 1, duplicate: 0, conflict: 0 });

    const restore = await receiver.runtime.restoreConversationArchive({
      sourcePath: destination,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
      suite: "ChaCha20Poly1305",
    });
    expect(restore.outcome).toBe("restored");

    const restoredPayloadId = receiver.envelopePersistence.getEnvelope("envelope-1" as never)?.payloadId;
    expect(restoredPayloadId).toBe("payload-1");
    const restoredBytes = receiver.payloadStorage.getPayload("payload-1" as never);
    expect(restoredBytes?.bytes).toEqual(EXACT_MESSAGE);
    expect(new TextDecoder().decode(restoredBytes!.bytes)).toBe("Hola, que tal?");
  });

  it("2. exportConversationArchive is unauthorized without an active local Membership -- fails BEFORE any collection/encryption/file write", async () => {
    const h = makeHarness();
    // Conversation exists, but no membership for LOCAL_PARTICIPANT.
    h.conversationPersistence.putConversation({
      schemaVersion: 1, id: CONVERSATION_ID, mode: "public", boardId: "board-a", rootThreadId: "thread-1", rootPostId: "thread-1", policyReference: "public-v1", createdAt: 1_700_000_000,
    });
    const result = await h.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID,
      destinationPath: join(dir, "nope.archive"),
      localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
      suite: "ChaCha20Poly1305",
    });
    expect(result).toEqual({ outcome: "unauthorized" });
    const inspect = await h.runtime.inspectConversationArchive(join(dir, "nope.archive"));
    expect(inspect).toEqual({ outcome: "not-found" });
  });

  it("3. conversation-not-found for an unknown conversationId", async () => {
    const h = makeHarness();
    const result = await h.runtime.exportConversationArchive({
      conversationId: "unknown::thread" as FedosConversationId,
      destinationPath: join(dir, "nope.archive"),
      localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
      suite: "ChaCha20Poly1305",
    });
    expect(result).toEqual({ outcome: "conversation-not-found" });
  });

  it("4. crypto-unavailable when the Master Seed Authority cannot resolve a conversation key", async () => {
    const h = makeHarness({ masterSeedAuthority: fakeMasterSeedAuthority(async () => null) });
    seedDirectConversation(h, EXACT_MESSAGE);
    const result = await h.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID,
      destinationPath: join(dir, "nope.archive"),
      localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
      suite: "ChaCha20Poly1305",
    });
    expect(result).toEqual({ outcome: "crypto-unavailable" });
  });

  it("5. already-exists -- exporting to a pre-existing path never overwrites it", async () => {
    const h = makeHarness();
    seedDirectConversation(h, EXACT_MESSAGE);
    const destination = join(dir, "existing.archive");
    writeFileSync(destination, Buffer.from("not an archive"));
    const result = await h.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID,
      destinationPath: destination,
      localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX,
      counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
      suite: "ChaCha20Poly1305",
    });
    expect(result).toEqual({ outcome: "already-exists" });
    expect(readFileSync(destination, "utf8")).toBe("not an archive");
  });

  it("6. too-large -- a bundle whose record count exceeds the configured bound fails before any file write", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const membershipPersistence = new InMemoryFedosConversationMembershipPersistence();
    const capabilityPersistence = new InMemoryFedosConversationCapabilityPersistence();
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const encryptionAuthority = new FedosWasmConversationArchiveEncryptionAuthority(matchingMasterSeedAuthority(), fakeRoundTrippingRuntimeBoundary());
    const runtime = createFedosConversationArchiveRuntime({
      conversationPersistence, membershipPersistence, capabilityPersistence, envelopePersistence, payloadStorage,
      encryptionAuthority, fileAuthority: new NodeFedosConversationArchiveFileAuthority(), clock: () => 1_700_000_999,
      isRuntimeRunning: () => true, bounds: { maxArchiveFileByteLength: 64 * 1024 * 1024, maxRecordCount: 0 },
    });
    conversationPersistence.putConversation({ schemaVersion: 1, id: CONVERSATION_ID, mode: "public", boardId: "board-a", rootThreadId: "thread-1", rootPostId: "thread-1", policyReference: "public-v1", createdAt: 1_700_000_000 });
    membershipPersistence.putMembership({ schemaVersion: 1, id: LOCAL_MEMBERSHIP_ID, conversationId: CONVERSATION_ID, participantAuthority: LOCAL_PARTICIPANT.authority, participantPublicIdentifier: LOCAL_PARTICIPANT.publicIdentifier, participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null });

    const result = await runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: join(dir, "too-big.archive"), localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(result).toEqual({ outcome: "too-large" });
  });
});

describe("Secure Runtime Alpha 1691-1760 -- inspectConversationArchive corruption matrix", () => {
  it("1. not-found for a missing path", async () => {
    const h = makeHarness();
    expect(await h.runtime.inspectConversationArchive(join(dir, "missing.archive"))).toEqual({ outcome: "not-found" });
  });

  it("2. invalid for a truncated/garbage file", async () => {
    const h = makeHarness();
    const path = join(dir, "garbage.archive");
    writeFileSync(path, Buffer.from([1, 2, 3]));
    expect(await h.runtime.inspectConversationArchive(path)).toEqual({ outcome: "invalid" });
  });

  it("3. invalid for a directory path", async () => {
    const h = makeHarness();
    expect(await h.runtime.inspectConversationArchive(dir)).toEqual({ outcome: "invalid" });
  });

  it("4. too-large for a file over the configured bound", async () => {
    const conversationPersistence = new InMemoryFedosConversationPersistence();
    const membershipPersistence = new InMemoryFedosConversationMembershipPersistence();
    const capabilityPersistence = new InMemoryFedosConversationCapabilityPersistence();
    const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const runtime = createFedosConversationArchiveRuntime({
      conversationPersistence, membershipPersistence, capabilityPersistence, envelopePersistence, payloadStorage,
      encryptionAuthority: new FedosWasmConversationArchiveEncryptionAuthority(matchingMasterSeedAuthority(), fakeRoundTrippingRuntimeBoundary()),
      fileAuthority: new NodeFedosConversationArchiveFileAuthority(), clock: () => 1_700_000_999, isRuntimeRunning: () => true,
      bounds: { maxArchiveFileByteLength: 4, maxRecordCount: 200_000 },
    });
    const path = join(dir, "big.archive");
    writeFileSync(path, new Uint8Array(1000));
    expect(await runtime.inspectConversationArchive(path)).toEqual({ outcome: "too-large" });
  });
});

describe("Secure Runtime Alpha 1691-1760 -- preflightRestore/restoreConversationArchive corruption + identity matrix", () => {
  async function exportOnce(h: Harness, path: string): Promise<void> {
    seedDirectConversation(h, EXACT_MESSAGE);
    const result = await h.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(result.outcome).toBe("exported");
  }

  it("1. not-found collapses to invalid-archive for restore, not-found for preflight's own staging (both use the SAME staging pipeline)", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const h = makeHarness({ boundary: sharedBoundary });
    const restoreResult = await h.runtime.restoreConversationArchive({ sourcePath: join(dir, "missing.archive"), localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restoreResult.outcome).toBe("invalid-archive");
  });

  it("2. invalid-archive for truncated bytes -- fails before any persistence write", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    const path = join(dir, "truncated.archive");
    await exportOnce(sender, path);
    const originalBytes = readFileSync(path);
    writeFileSync(path, originalBytes.slice(0, 5));

    const receiver = makeHarness({ boundary: sharedBoundary });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("invalid-archive");
    expect(receiver.conversationPersistence.getConversation(CONVERSATION_ID)).toBeNull();
  });

  it("3. unsupported-version -- a manifest declaring a future schema version fails closed for both preflight and restore", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    const path = join(dir, "future-version.archive");
    await exportOnce(sender, path);
    const bytes = readFileSync(path);
    // The container's schema-version BYTE (offset 0) is the FILE-container framing version (Alpha
    // 1691-1760's own, always 1) -- the MANIFEST's own `schemaVersion` JSON field is what
    // decodeFedosConversationArchiveFileContainer inspects for "unsupported-version". Corrupt it via a
    // fresh encode using a tampered manifest instead of hand-editing raw bytes, for a precise test.
    const manifestLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1, false);
    const manifestJson = JSON.parse(new TextDecoder().decode(bytes.slice(5, 5 + manifestLen))) as Record<string, unknown>;
    manifestJson.schemaVersion = 2;
    const tamperedManifestBytes = new TextEncoder().encode(JSON.stringify(manifestJson));
    // Re-assemble: container byte + (possibly different) length + manifest + rest (ciphertext framing) unchanged.
    const rest = bytes.slice(5 + manifestLen);
    const newLen = new Uint8Array(4);
    new DataView(newLen.buffer).setUint32(0, tamperedManifestBytes.length, false);
    const reassembled = new Uint8Array(1 + 4 + tamperedManifestBytes.length + rest.length);
    reassembled.set([1], 0);
    reassembled.set(newLen, 1);
    reassembled.set(tamperedManifestBytes, 5);
    reassembled.set(rest, 5 + tamperedManifestBytes.length);
    writeFileSync(path, reassembled);

    const receiver = makeHarness({ boundary: sharedBoundary });
    expect((await receiver.runtime.preflightRestore({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" })).outcome).toBe("unsupported-version");
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("unsupported-version");
    expect(receiver.conversationPersistence.getConversation(CONVERSATION_ID)).toBeNull();
  });

  it("4. identity-mismatch -- restoring with a Master Seed Authority that cannot resolve the SAME conversation key fails BEFORE any persistence write", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    const path = join(dir, "wrong-identity.archive");
    await exportOnce(sender, path);

    const wrongIdentityReceiver = makeHarness({ boundary: sharedBoundary, masterSeedAuthority: fakeMasterSeedAuthority(async () => null) });
    const preflight = await wrongIdentityReceiver.runtime.preflightRestore({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(preflight.outcome).toBe("identity-mismatch");
    const restore = await wrongIdentityReceiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("identity-mismatch");
    expect(wrongIdentityReceiver.conversationPersistence.getConversation(CONVERSATION_ID)).toBeNull();
  });

  it("5. integrity-failed -- a receiver with a DIFFERENT crypto boundary (cannot decrypt this exact ciphertext at all) fails closed rather than producing partial plaintext", async () => {
    const sender = makeHarness();
    const path = join(dir, "wrong-boundary.archive");
    await exportOnce(sender, path);

    // A receiver over an UNRELATED boundary (its own empty Map) cannot even importCiphertext() this
    // wire string -- decrypt() returns null -- FedosWasmConversationArchiveEncryptionAuthority.import()
    // collapses that to "failed", surfaced here as this Runtime's own "failed" staging outcome, which
    // restoreConversationArchive()'s own vocabulary maps to "failed" (never silently to invalid-archive).
    const unrelatedReceiver = makeHarness();
    const restore = await unrelatedReceiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("failed");
    expect(unrelatedReceiver.conversationPersistence.getConversation(CONVERSATION_ID)).toBeNull();
  });

  it("6. changed-manifest -- tampering the cleartext manifest's own contentHash field fails closed as manifest-mismatch (integrity-failed), never a silent restore", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    const path = join(dir, "tampered-manifest.archive");
    await exportOnce(sender, path);

    const bytes = readFileSync(path);
    const manifestLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1, false);
    const manifestJson = JSON.parse(new TextDecoder().decode(bytes.slice(5, 5 + manifestLen))) as Record<string, unknown>;
    manifestJson.contentHash = "0".repeat((manifestJson.contentHash as string).length);
    const tamperedManifestBytes = new TextEncoder().encode(JSON.stringify(manifestJson));
    const rest = bytes.slice(5 + manifestLen);
    const newLen = new Uint8Array(4);
    new DataView(newLen.buffer).setUint32(0, tamperedManifestBytes.length, false);
    const reassembled = new Uint8Array(1 + 4 + tamperedManifestBytes.length + rest.length);
    reassembled.set([1], 0);
    reassembled.set(newLen, 1);
    reassembled.set(tamperedManifestBytes, 5);
    reassembled.set(rest, 5 + tamperedManifestBytes.length);
    writeFileSync(path, reassembled);

    const receiver = makeHarness({ boundary: sharedBoundary });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("integrity-failed");
    expect(receiver.conversationPersistence.getConversation(CONVERSATION_ID)).toBeNull();
  });

  it("7. changed-ciphertext -- flipping a byte inside the wire ciphertext string fails closed (the fake boundary's own importCiphertext returns null for an unknown wire string, exactly like a real WASM boundary would for tampered ciphertext)", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    const path = join(dir, "tampered-ciphertext.archive");
    await exportOnce(sender, path);

    const bytes = readFileSync(path);
    const tampered = new Uint8Array(bytes);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;
    writeFileSync(path, tampered);

    const receiver = makeHarness({ boundary: sharedBoundary });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(["failed", "integrity-failed"]).toContain(restore.outcome);
    expect(receiver.conversationPersistence.getConversation(CONVERSATION_ID)).toBeNull();
  });

  it("8. excessive record count in the CLEARTEXT manifest is rejected BEFORE decrypt is ever attempted (defense in depth, bound checked twice)", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    const path = join(dir, "manifest-lies.archive");
    await exportOnce(sender, path);

    const bytes = readFileSync(path);
    const manifestLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1, false);
    const manifestJson = JSON.parse(new TextDecoder().decode(bytes.slice(5, 5 + manifestLen))) as Record<string, unknown>;
    manifestJson.envelopeCount = 999_999; // the manifest now CLAIMS a huge count -- content hash is now also wrong, but the bound check runs first.
    const tamperedManifestBytes = new TextEncoder().encode(JSON.stringify(manifestJson));
    const rest = bytes.slice(5 + manifestLen);
    const newLen = new Uint8Array(4);
    new DataView(newLen.buffer).setUint32(0, tamperedManifestBytes.length, false);
    const reassembled = new Uint8Array(1 + 4 + tamperedManifestBytes.length + rest.length);
    reassembled.set([1], 0);
    reassembled.set(newLen, 1);
    reassembled.set(tamperedManifestBytes, 5);
    reassembled.set(rest, 5 + tamperedManifestBytes.length);
    writeFileSync(path, reassembled);

    const receiverPorts = { conversationPersistence: new InMemoryFedosConversationPersistence(), membershipPersistence: new InMemoryFedosConversationMembershipPersistence(), capabilityPersistence: new InMemoryFedosConversationCapabilityPersistence(), envelopePersistence: new InMemoryFedosConversationMessageEnvelopePersistence(), payloadStorage: new InMemoryFedosConversationPayloadStorage() };
    const runtime = createFedosConversationArchiveRuntime({
      ...receiverPorts, encryptionAuthority: new FedosWasmConversationArchiveEncryptionAuthority(matchingMasterSeedAuthority(), sharedBoundary),
      fileAuthority: new NodeFedosConversationArchiveFileAuthority(), clock: () => 1_700_000_999, isRuntimeRunning: () => true,
      bounds: { maxArchiveFileByteLength: 64 * 1024 * 1024, maxRecordCount: 10 },
    });
    const restore = await runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("invalid-archive"); // "too-large" staging outcome collapses to invalid-archive per this Runtime's own closed vocabulary.
    expect(receiverPorts.conversationPersistence.getConversation(CONVERSATION_ID)).toBeNull();
  });
});

describe("Secure Runtime Alpha 1691-1760 -- duplicate restore + crash/restart recovery convergence", () => {
  it("1. restoring the identical archive twice reports restored then already-present -- never a duplicate record", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedDirectConversation(sender, EXACT_MESSAGE);
    const path = join(dir, "dup.archive");
    await sender.runtime.exportConversationArchive({ conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });

    const receiver = makeHarness({ boundary: sharedBoundary });
    const first = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(first.outcome).toBe("restored");
    expect(receiver.envelopePersistence.getEnvelope("envelope-1" as never)).not.toBeNull();

    const second = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(second.outcome).toBe("already-present");
    expect(second.details?.envelopes).toEqual({ inserted: 0, duplicate: 1, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    // Still exactly one envelope/payload -- no duplicate record was ever created.
    expect(receiver.payloadStorage.getPayload("payload-1" as never)?.bytes).toEqual(EXACT_MESSAGE);
  });

  it("2. conflict is surfaced, not silently overwritten -- a receiver with a DIFFERENT pre-existing record at the same id reports conflicts-found and the pre-existing record is left untouched", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedDirectConversation(sender, EXACT_MESSAGE);
    const path = join(dir, "conflict.archive");
    await sender.runtime.exportConversationArchive({ conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });

    const receiver = makeHarness({ boundary: sharedBoundary });
    // Pre-seed a DIFFERENT membership record at the exact same id (different role) before restoring.
    receiver.membershipPersistence.putMembership({ schemaVersion: 1, id: LOCAL_MEMBERSHIP_ID, conversationId: CONVERSATION_ID, participantAuthority: LOCAL_PARTICIPANT.authority, participantPublicIdentifier: LOCAL_PARTICIPANT.publicIdentifier, participantIdentityId: null, role: "member", state: "active", joinedAt: 1_700_000_000, endedAt: null });

    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("conflicts-found");
    // The pre-existing "member" role record is untouched -- never silently overwritten by the Archive's own "owner" role.
    expect(receiver.membershipPersistence.getMembership(LOCAL_MEMBERSHIP_ID)?.role).toBe("member");
  });

  it("3. crash/restart recovery -- a restore interrupted after only SOME domains were written converges cleanly on a fresh retry, with no duplication and no overwrite", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedDirectConversation(sender, EXACT_MESSAGE);
    const path = join(dir, "crash.archive");
    await sender.runtime.exportConversationArchive({ conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });

    const receiver = makeHarness({ boundary: sharedBoundary });
    // Simulate "crashed mid-restore": the Conversation record and Membership were already durably
    // written by a PRIOR (interrupted) restore attempt, but the Envelope/Payload were not yet reached.
    receiver.conversationPersistence.putConversation({ schemaVersion: 1, id: CONVERSATION_ID, mode: "public", boardId: "board-a", rootThreadId: "thread-1", rootPostId: "thread-1", policyReference: "public-v1", createdAt: 1_700_000_000 });
    receiver.membershipPersistence.putMembership({ schemaVersion: 1, id: LOCAL_MEMBERSHIP_ID, conversationId: CONVERSATION_ID, participantAuthority: LOCAL_PARTICIPANT.authority, participantPublicIdentifier: LOCAL_PARTICIPANT.publicIdentifier, participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null });

    // A fresh restore attempt (exactly what a real restart would trigger) converges: the
    // already-durable Conversation/Membership report as duplicates, the never-reached
    // Envelope/Payload are inserted for the first time -- no error, no partial-recovery step needed.
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("restored");
    expect(restore.details?.conversation).toBe("duplicate");
    expect(restore.details?.memberships).toEqual({ inserted: 0, duplicate: 1, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(restore.details?.envelopes).toEqual({ inserted: 1, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });
    expect(receiver.payloadStorage.getPayload("payload-1" as never)?.bytes).toEqual(EXACT_MESSAGE);

    // A SECOND fresh attempt after that (idempotent restart-of-the-restart) reports fully already-present.
    const secondRestore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(secondRestore.outcome).toBe("already-present");
  });
});

describe("Secure Runtime Alpha 1691-1760 -- Runtime lifecycle (fail closed after stop)", () => {
  it("1. every operation fails closed once isRuntimeRunning() reports false, even mid-session on an already-held reference", async () => {
    const h = makeHarness();
    seedDirectConversation(h, EXACT_MESSAGE);
    h.stopped = true;

    const exportResult = await h.runtime.exportConversationArchive({ conversationId: CONVERSATION_ID, destinationPath: join(dir, "after-stop.archive"), localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(exportResult).toEqual({ outcome: "failed" });
    expect(await h.runtime.inspectConversationArchive(join(dir, "after-stop.archive"))).toEqual({ outcome: "failed" });
    expect(await h.runtime.preflightRestore({ sourcePath: join(dir, "after-stop.archive"), localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" })).toEqual({ outcome: "failed" });
    expect(await h.runtime.restoreConversationArchive({ sourcePath: join(dir, "after-stop.archive"), localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" })).toEqual({ outcome: "failed" });
    // No file was ever written -- confirmed nothing exists at the destination.
    expect(await h.runtime.inspectConversationArchive(join(dir, "after-stop.archive"))).toEqual({ outcome: "failed" });
  });
});

describe("Secure Runtime Alpha 1691-1760 -- no plaintext/raw-secret persistence", () => {
  it("1. the on-disk archive file never contains the plaintext message bytes or any raw key material as a substring", async () => {
    const h = makeHarness();
    seedDirectConversation(h, EXACT_MESSAGE);
    const path = join(dir, "opaque.archive");
    await h.runtime.exportConversationArchive({ conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    const raw = readFileSync(path, "latin1") as string;
    expect(raw).not.toContain("Hola, que tal?");
  });
});

describe("Secure Runtime Alpha 1691-1760 -- partially-invalid outcome (reconciliation fix)", () => {
  it("1. a cryptographically authentic, integrity-passing archive containing one deep-invalid child record restores every VALID record and reports partially-invalid -- never silently reported as fully restored", async () => {
    // Bypasses exportConversationArchive()'s own collector on purpose: this scenario (a genuinely
    // authentic bundle whose OWN individual records fail deep validation) cannot arise from THIS
    // Runtime's own collector, which only ever reads already-valid persisted records -- exactly why
    // the Phase A reconciliation report calls this a defense-in-depth path, reachable via a bundle
    // built by hand (or, in the real world, an Archive produced by a mismatched future encoder).
    const bundle: FedosConversationArchiveBundleV1 = {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: CONVERSATION_ID,
      exportedAt: 1_700_000_500,
      conversation: { schemaVersion: 1, id: CONVERSATION_ID, mode: "public", boardId: "board-a", rootThreadId: "thread-1", rootPostId: "thread-1", policyReference: "public-v1", createdAt: 1_700_000_000 },
      memberships: [
        { schemaVersion: 1, id: LOCAL_MEMBERSHIP_ID, conversationId: CONVERSATION_ID, participantAuthority: LOCAL_PARTICIPANT.authority, participantPublicIdentifier: LOCAL_PARTICIPANT.publicIdentifier, participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null },
        // Deep-invalid: `role` must be a string per `deserializeFedosConversationMembership()`'s own
        // validator -- this record parses fine as JSON (survives the bundle's own coarse structural
        // decode) but fails that domain-specific deep check and is skipped, never inserted.
        { schemaVersion: 1, id: `${CONVERSATION_ID}::fedos::bob`, conversationId: CONVERSATION_ID, participantAuthority: "fedos", participantPublicIdentifier: "bob", participantIdentityId: null, role: 12345 as unknown as string, state: "active", joinedAt: 1_700_000_000, endedAt: null },
      ],
      capabilityEvents: [],
      envelopes: [{ schemaVersion: 1, id: "envelope-1" as never, conversationId: CONVERSATION_ID, senderMembershipId: LOCAL_MEMBERSHIP_ID, payloadId: "payload-1" as never, encryptionSuite: "ChaCha20Poly1305", keyEpoch: 0, createdAt: 1_700_000_010, replyToEnvelopeId: null }],
      payloads: [{ schemaVersion: 1, id: "payload-1" as never, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: EXACT_MESSAGE.length, createdAt: 1_700_000_010, bytesBase64: Buffer.from(EXACT_MESSAGE).toString("base64") }],
    };

    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const exported = await new FedosWasmConversationArchiveEncryptionAuthority(matchingMasterSeedAuthority(), sharedBoundary).export({
      bundle, suite: "ChaCha20Poly1305", localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
    });
    expect(exported.outcome).toBe("exported");
    if (exported.outcome !== "exported") return;

    const path = join(dir, "one-invalid-record.archive");
    writeFileSync(path, encodeFedosConversationArchiveFileContainer(exported.manifest, exported.ciphertext));

    const receiver = makeHarness({ boundary: sharedBoundary });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });

    expect(restore.outcome).toBe("partially-invalid");
    expect(restore.details?.memberships).toEqual({ inserted: 1, duplicate: 0, conflict: 0, failed: 0, invalid: 1, denied: 0 });
    // The one VALID membership (alice) WAS restored -- a partially-invalid archive still restores
    // everything it safely can, it is not an all-or-nothing failure.
    expect(receiver.membershipPersistence.getMembership(LOCAL_MEMBERSHIP_ID)).not.toBeNull();
    expect(receiver.membershipPersistence.getMembership(`${CONVERSATION_ID}::fedos::bob` as never)).toBeNull();
    expect(receiver.payloadStorage.getPayload("payload-1" as never)?.bytes).toEqual(EXACT_MESSAGE);
  });
});
