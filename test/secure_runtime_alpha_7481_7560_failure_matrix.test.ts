/**
 * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention Parity
 * and Metadata Deletion Semantics Arc) — Phase J: the 22-scenario failure
 * matrix named by this Arc's own mission. Uses the SAME in-memory
 * `FedosConversationArchiveRuntime` harness convention already established
 * by `test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts` (a real
 * fake-crypto round-tripping boundary over real in-memory persistence
 * ports — no compiled WASM artifact required, unlike Phase I's own real
 * vertical slice, which already separately covers the SAME retention-
 * parity contract end-to-end with real crypto).
 */
import { describe, it, expect, vi } from "vitest";
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
import { InMemoryFedosPayloadRetentionPersistence } from "../src/conversation/retention/in_memory_fedos_payload_retention_persistence.js";
import { FedosPayloadRetentionAuthority } from "../src/conversation/retention/fedos_payload_retention_authority.js";
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

const CONVERSATION_ID = "board-a::thread-failure-matrix" as FedosConversationId;
const LOCAL_PARTICIPANT: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice", identityId: null };
const LOCAL_ACCOUNT_INDEX = 0;
const COUNTERPARTY_PUBLIC_KEY_HEX = "cd".repeat(32);
const LOCAL_MEMBERSHIP_ID = toFedosConversationMembershipId(CONVERSATION_ID, LOCAL_PARTICIPANT);
const KEEP_PAYLOAD_ID = "payload-keep" as never;
const DELETE_PAYLOAD_ID = "payload-delete" as never;
const KEEP_MESSAGE = new TextEncoder().encode("failure-matrix-keep");
const DELETE_MESSAGE = new TextEncoder().encode("failure-matrix-delete");

const KEY_HANDLE: AeadKeyHandle = { kind: "AeadKeyHandle" } as AeadKeyHandle;

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

/** Mirrors `test/secure_runtime_alpha_1691_1760_archive_runtime.test.ts`'s own identical fake exactly. */
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
  readonly retentionAuthority?: FedosPayloadRetentionAuthority;
  stopped: boolean;
}

function makeHarness(overrides: {
  masterSeedAuthority?: FedosMasterSeedAuthority;
  boundary?: FedosConversationArchiveEncryptionRuntimeBoundary;
  retentionAuthority?: FedosPayloadRetentionAuthority | "none";
  payloadStorage?: InMemoryFedosConversationPayloadStorage;
} = {}): Harness {
  const conversationPersistence = new InMemoryFedosConversationPersistence();
  const membershipPersistence = new InMemoryFedosConversationMembershipPersistence();
  const capabilityPersistence = new InMemoryFedosConversationCapabilityPersistence();
  const envelopePersistence = new InMemoryFedosConversationMessageEnvelopePersistence();
  const payloadStorage = overrides.payloadStorage ?? new InMemoryFedosConversationPayloadStorage();

  const retentionAuthority =
    overrides.retentionAuthority === "none"
      ? undefined
      : overrides.retentionAuthority ?? new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage });

  const harness: Harness = {
    runtime: undefined as unknown as FedosConversationArchiveRuntime,
    conversationPersistence,
    membershipPersistence,
    capabilityPersistence,
    envelopePersistence,
    payloadStorage,
    retentionAuthority,
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
    clock: () => 1_700_100_000,
    isRuntimeRunning: () => !harness.stopped,
    retentionAuthority,
  });

  harness.runtime = runtime;
  return harness;
}

/** Seeds one active local Membership plus a "keep" and a "to-delete" Envelope/Payload pair. */
function seedTwoMessages(h: Harness): void {
  h.conversationPersistence.putConversation({
    schemaVersion: 1, id: CONVERSATION_ID, mode: "public", boardId: "board-a", rootThreadId: "thread-failure-matrix", rootPostId: "thread-failure-matrix", policyReference: "public-v1", createdAt: 1_700_000_000,
  });
  h.membershipPersistence.putMembership({
    schemaVersion: 1, id: LOCAL_MEMBERSHIP_ID, conversationId: CONVERSATION_ID, participantAuthority: LOCAL_PARTICIPANT.authority,
    participantPublicIdentifier: LOCAL_PARTICIPANT.publicIdentifier, participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null,
  });
  h.payloadStorage.putPayload({ id: KEEP_PAYLOAD_ID, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: KEEP_MESSAGE.length, createdAt: 1_700_000_010 }, KEEP_MESSAGE);
  h.envelopePersistence.putEnvelope({
    schemaVersion: 1, id: "envelope-keep" as never, conversationId: CONVERSATION_ID, senderMembershipId: LOCAL_MEMBERSHIP_ID,
    payloadId: KEEP_PAYLOAD_ID, encryptionSuite: "ChaCha20Poly1305", keyEpoch: 0, createdAt: 1_700_000_010, replyToEnvelopeId: null,
  });
  h.payloadStorage.putPayload({ id: DELETE_PAYLOAD_ID, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: DELETE_MESSAGE.length, createdAt: 1_700_000_020 }, DELETE_MESSAGE);
  h.envelopePersistence.putEnvelope({
    schemaVersion: 1, id: "envelope-delete" as never, conversationId: CONVERSATION_ID, senderMembershipId: LOCAL_MEMBERSHIP_ID,
    payloadId: DELETE_PAYLOAD_ID, encryptionSuite: "ChaCha20Poly1305", keyEpoch: 0, createdAt: 1_700_000_020, replyToEnvelopeId: null,
  });
}

let dir: string;
function freshDir(): string {
  dir = mkdtempSync(join(tmpdir(), "fedos-7481-failure-matrix-"));
  return dir;
}

describe("Secure Runtime Alpha 7481-7560 -- failure matrix", () => {
  it("1. missing Retention Authority (omitted entirely) -- export/restore behave byte-for-byte as before this Arc, denying nothing", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary, retentionAuthority: "none" });
    seedTwoMessages(sender);
    const path = join(d, "no-authority.archive");
    const exportResult = await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(exportResult.outcome).toBe("exported");
    expect(exportResult.manifest?.envelopeCount).toBe(2);
    expect(exportResult.manifest?.payloadCount).toBe(2);

    const receiver = makeHarness({ boundary: sharedBoundary, retentionAuthority: "none" });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("restored");
    expect(restore.details?.envelopes).toEqual({ inserted: 2, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });
  });

  it("2. a throwing/unavailable Retention Authority on EXPORT fails closed (excludes), never crashes and never silently allows", async () => {
    const d = freshDir();
    const throwingAuthority = { evaluatePayloadAccess: () => { throw new Error("retention authority unavailable"); }, evaluateRetentionDecisionOnly: () => { throw new Error("retention authority unavailable"); } };
    const sender = makeHarness({ retentionAuthority: throwingAuthority as unknown as FedosPayloadRetentionAuthority });
    seedTwoMessages(sender);
    const path = join(d, "throwing-export.archive");
    const exportResult = await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(exportResult.outcome).toBe("exported");
    // Fail-closed: BOTH records are excluded, not merely the one the mission happened to name "denied".
    expect(exportResult.manifest?.envelopeCount).toBe(0);
    expect(exportResult.manifest?.payloadCount).toBe(0);
  });

  it("3. a throwing/unavailable Retention Authority on RESTORE fails closed (denies), never crashes and never silently allows", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary, retentionAuthority: "none" });
    seedTwoMessages(sender);
    const path = join(d, "throwing-restore.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    const throwingAuthority = { evaluatePayloadAccess: () => { throw new Error("unavailable"); }, evaluateRetentionDecisionOnly: () => { throw new Error("unavailable"); } };
    const receiver = makeHarness({ boundary: sharedBoundary, retentionAuthority: throwingAuthority as unknown as FedosPayloadRetentionAuthority });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("partially-denied");
    expect(restore.details?.envelopes).toEqual({ inserted: 0, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 2 });
  });

  it("4. payload-denied, envelope-available (a real tombstone+removal decision on file) -- export excludes BOTH the Envelope and Payload it is linked to", async () => {
    const d = freshDir();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    const sender = makeHarness({ payloadStorage, retentionAuthority });
    seedTwoMessages(sender);
    expect(retentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder")).toEqual({ outcome: "tombstoned" });
    expect(retentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder")).toEqual({ outcome: "payload-removed" });

    const path = join(d, "payload-denied.archive");
    const exportResult = await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(exportResult.outcome).toBe("exported");
    expect(exportResult.manifest?.envelopeCount, "the denied Payload's OWN linked Envelope must ALSO be excluded, not just its Payload").toBe(1);
    expect(exportResult.manifest?.payloadCount).toBe(1);
  });

  it("5. restoring an Envelope whose payloadId this device's retention log has never heard of ('not-found') is permitted -- 'not-found' is a genuinely weaker, different signal than 'denied', never conflated on restore", async () => {
    const d = freshDir();
    // A hand-built bundle, mirroring a genuinely foreign/legacy Envelope whose linked Payload record is
    // absent from `bundle.payloads` entirely (e.g. a control message, or an exporter that chose to omit
    // it) -- this device's own retention log has no decision on file for it either.
    const bundle: FedosConversationArchiveBundleV1 = {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: CONVERSATION_ID,
      exportedAt: 1_700_000_500,
      conversation: { schemaVersion: 1, id: CONVERSATION_ID, mode: "public", boardId: "board-a", rootThreadId: "thread-failure-matrix", rootPostId: "thread-failure-matrix", policyReference: "public-v1", createdAt: 1_700_000_000 },
      memberships: [{ schemaVersion: 1, id: LOCAL_MEMBERSHIP_ID, conversationId: CONVERSATION_ID, participantAuthority: LOCAL_PARTICIPANT.authority, participantPublicIdentifier: LOCAL_PARTICIPANT.publicIdentifier, participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null }],
      capabilityEvents: [],
      envelopes: [{ schemaVersion: 1, id: "envelope-never-stored" as never, conversationId: CONVERSATION_ID, senderMembershipId: LOCAL_MEMBERSHIP_ID, payloadId: "payload-never-stored" as never, encryptionSuite: "ChaCha20Poly1305", keyEpoch: 0, createdAt: 1_700_000_030, replyToEnvelopeId: null }],
      payloads: [],
    };
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const exported = await new FedosWasmConversationArchiveEncryptionAuthority(matchingMasterSeedAuthority(), sharedBoundary).export({
      bundle, suite: "ChaCha20Poly1305", localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
    });
    expect(exported.outcome).toBe("exported");
    if (exported.outcome !== "exported") return;
    const path = join(d, "never-stored.archive");
    writeFileSync(path, encodeFedosConversationArchiveFileContainer(exported.manifest, exported.ciphertext));

    const receiver = makeHarness({ boundary: sharedBoundary });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome, "'not-found' permits restore, it is a weaker signal than 'denied'").toBe("restored");
    expect(receiver.envelopePersistence.getEnvelope("envelope-never-stored" as never)).not.toBeNull();
  });

  it("6. restoring a PRE-deletion Archive onto a device that already recorded the SAME deletion suppresses it (partially-denied), even though the bundle itself still carries the record", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    const sender = makeHarness({ boundary: sharedBoundary, payloadStorage, retentionAuthority });
    seedTwoMessages(sender);
    const preDeletionPath = join(d, "pre-deletion.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: preDeletionPath, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    // Deletion happens AFTER the export above -- the on-disk archive genuinely still contains the record.
    retentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");

    // A fresh device/profile whose OWN retention log already knows about this SAME real decision.
    const informedRetentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage: new InMemoryFedosConversationPayloadStorage() });
    const receiver = makeHarness({ boundary: sharedBoundary, retentionAuthority: informedRetentionAuthority });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: preDeletionPath, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("partially-denied");
    expect(restore.details?.envelopes).toEqual({ inserted: 1, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 1 });
    expect(receiver.envelopePersistence.getEnvelope("envelope-keep" as never)).not.toBeNull();
    expect(receiver.envelopePersistence.getEnvelope("envelope-delete" as never)).toBeNull();
  });

  it("7. restoring the SAME pre-deletion Archive onto a genuinely FOREIGN device (never informed) restores it fully -- the disclosed, honest limitation, never fabricated global propagation", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    const sender = makeHarness({ boundary: sharedBoundary, payloadStorage, retentionAuthority });
    seedTwoMessages(sender);
    const preDeletionPath = join(d, "pre-deletion-foreign.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: preDeletionPath, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    retentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");

    // A genuinely independent, never-informed retention log/authority -- a foreign device.
    const foreignRetentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage: new InMemoryFedosConversationPayloadStorage() });
    const receiver = makeHarness({ boundary: sharedBoundary, retentionAuthority: foreignRetentionAuthority });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: preDeletionPath, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("restored");
    expect(receiver.envelopePersistence.getEnvelope("envelope-delete" as never)).not.toBeNull();
  });

  it("8. a legacy-shaped bundle (no denial state exists anywhere) restores completely normally with a retentionAuthority configured -- the new gate never spuriously denies ordinary historical content", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary, retentionAuthority: "none" });
    seedTwoMessages(sender);
    const path = join(d, "legacy.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    const receiver = makeHarness({ boundary: sharedBoundary });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("restored");
    expect(restore.details?.envelopes).toEqual({ inserted: 2, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 0 });
  });

  it("9. unknown/future schema version still fails closed as 'unsupported-version', unaffected by this Arc's own change", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedTwoMessages(sender);
    const path = join(d, "future-version.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    const bytes = readFileSync(path);
    const manifestLen = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1, false);
    const manifestJson = JSON.parse(new TextDecoder().decode(bytes.slice(5, 5 + manifestLen))) as Record<string, unknown>;
    manifestJson.schemaVersion = 999;
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
    expect(restore.outcome).toBe("unsupported-version");
  });

  it("10. malformed/conflicting tombstone state is impossible by construction -- 'payload-removed' always wins deterministically over a 'tombstoned' decision for the same payloadId", () => {
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    payloadStorage.putPayload({ id: DELETE_PAYLOAD_ID, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: DELETE_MESSAGE.length, createdAt: 1_700_000_020 }, DELETE_MESSAGE);
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    retentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    // Both decisions genuinely exist on the log now -- `evaluateRetentionDecisionOnly()` must resolve
    // to the single, most-restrictive state, never "conflict", never "active".
    expect(retentionAuthority.evaluateRetentionDecisionOnly(DELETE_PAYLOAD_ID)).toBe("payload-removed");
  });

  it("11. duplicate restore -- restoring the SAME archive twice never re-denies inconsistently and never double-counts", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    const sender = makeHarness({ boundary: sharedBoundary, payloadStorage, retentionAuthority });
    seedTwoMessages(sender);
    retentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    const path = join(d, "duplicate-restore.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    const receiver = makeHarness({ boundary: sharedBoundary });
    const first = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(first.outcome).toBe("restored");
    const second = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(["already-present", "restored"]).toContain(second.outcome);
    expect(receiver.envelopePersistence.getEnvelope("envelope-delete" as never), "the export-side exclusion already made this permanent, a repeat restore cannot resurrect it").toBeNull();
  });

  it("12. a POST-deletion Archive restored onto a genuinely FOREIGN profile ALSO never resurfaces the deleted record -- export-side parity protects even a foreign device, unlike restore-side defense-in-depth alone", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    const sender = makeHarness({ boundary: sharedBoundary, payloadStorage, retentionAuthority });
    seedTwoMessages(sender);
    retentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    const path = join(d, "post-deletion-foreign.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    const foreignRetentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage: new InMemoryFedosConversationPayloadStorage() });
    const receiver = makeHarness({ boundary: sharedBoundary, retentionAuthority: foreignRetentionAuthority });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("restored");
    expect(receiver.envelopePersistence.getEnvelope("envelope-delete" as never)).toBeNull();
  });

  it("13. missing Conversation record -- collectFedosConversationArchiveBundle returns null with a retentionAuthority configured, exactly as it already did without one", async () => {
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    const path = join(freshDir(), "missing-conversation.archive");
    const exportResult = await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(exportResult.outcome).toBe("conversation-not-found");
  });

  it("14. missing local Membership at restore time does not interfere with retention denial being applied correctly to the Envelope/Payload restore", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    const sender = makeHarness({ boundary: sharedBoundary, payloadStorage, retentionAuthority });
    seedTwoMessages(sender);
    const path = join(d, "missing-membership.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    // Deletion recorded AFTER export, informing a fresh receiver that has NO Membership record yet either.
    retentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    const informedRetentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage: new InMemoryFedosConversationPayloadStorage() });
    const receiver = makeHarness({ boundary: sharedBoundary, retentionAuthority: informedRetentionAuthority });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("partially-denied");
    expect(receiver.membershipPersistence.getMembership(LOCAL_MEMBERSHIP_ID), "Membership restore itself is unaffected by retention gating").not.toBeNull();
    expect(receiver.envelopePersistence.getEnvelope("envelope-delete" as never)).toBeNull();
  });

  it("15. Search index unavailable/never reconciled -- Archive's own retention read is fully independent of Search, denial still applies from the retention log alone", async () => {
    const d = freshDir();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    const sender = makeHarness({ payloadStorage, retentionAuthority });
    seedTwoMessages(sender);
    // Deliberately no `FedosConversationSearchIndex` of any kind is constructed anywhere in this test.
    retentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    const path = join(d, "no-search.archive");
    const exportResult = await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(exportResult.manifest?.envelopeCount).toBe(1);
  });

  it("16. Archive crypto/encryption authority unavailable (Master Seed cannot resolve the conversation key) -- identity-mismatch fires unchanged, retention wiring never masks it", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedTwoMessages(sender);
    const path = join(d, "identity-mismatch.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    const wrongIdentityReceiver = makeHarness({ boundary: sharedBoundary, masterSeedAuthority: fakeMasterSeedAuthority(async () => null) });
    const restore = await wrongIdentityReceiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("identity-mismatch");
  });

  it("17. corrupted Archive ciphertext (a tampered wire byte) fails closed, unaffected by this Arc's own change", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const sender = makeHarness({ boundary: sharedBoundary });
    seedTwoMessages(sender);
    const path = join(d, "tampered-ciphertext.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    const bytes = readFileSync(path);
    const tampered = new Uint8Array(bytes);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;
    writeFileSync(path, tampered);
    const receiver = makeHarness({ boundary: sharedBoundary });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(["failed", "integrity-failed"]).toContain(restore.outcome);
  });

  it("18. partial restore failure -- a bundle with ONE structurally-invalid record AND ONE retention-denied record reports 'partially-invalid', never 'partially-denied' (documented priority: failed > conflict > invalid > denied)", async () => {
    const d = freshDir();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    payloadStorage.putPayload({ id: DELETE_PAYLOAD_ID, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: DELETE_MESSAGE.length, createdAt: 1_700_000_020 }, DELETE_MESSAGE);
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    retentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");

    const bundle: FedosConversationArchiveBundleV1 = {
      schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
      conversationId: CONVERSATION_ID,
      exportedAt: 1_700_000_500,
      conversation: { schemaVersion: 1, id: CONVERSATION_ID, mode: "public", boardId: "board-a", rootThreadId: "thread-failure-matrix", rootPostId: "thread-failure-matrix", policyReference: "public-v1", createdAt: 1_700_000_000 },
      memberships: [
        { schemaVersion: 1, id: LOCAL_MEMBERSHIP_ID, conversationId: CONVERSATION_ID, participantAuthority: LOCAL_PARTICIPANT.authority, participantPublicIdentifier: LOCAL_PARTICIPANT.publicIdentifier, participantIdentityId: null, role: "owner", state: "active", joinedAt: 1_700_000_000, endedAt: null },
        // Deep-invalid: `role` must be a string.
        { schemaVersion: 1, id: `${CONVERSATION_ID}::fedos::bob`, conversationId: CONVERSATION_ID, participantAuthority: "fedos", participantPublicIdentifier: "bob", participantIdentityId: null, role: 12345 as unknown as string, state: "active", joinedAt: 1_700_000_000, endedAt: null },
      ],
      capabilityEvents: [],
      envelopes: [{ schemaVersion: 1, id: "envelope-delete" as never, conversationId: CONVERSATION_ID, senderMembershipId: LOCAL_MEMBERSHIP_ID, payloadId: DELETE_PAYLOAD_ID, encryptionSuite: "ChaCha20Poly1305", keyEpoch: 0, createdAt: 1_700_000_010, replyToEnvelopeId: null }],
      payloads: [{ schemaVersion: 1, id: DELETE_PAYLOAD_ID, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: DELETE_MESSAGE.length, createdAt: 1_700_000_010, bytesBase64: Buffer.from(DELETE_MESSAGE).toString("base64") }],
    };
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const exported = await new FedosWasmConversationArchiveEncryptionAuthority(matchingMasterSeedAuthority(), sharedBoundary).export({
      bundle, suite: "ChaCha20Poly1305", localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX,
    });
    expect(exported.outcome).toBe("exported");
    if (exported.outcome !== "exported") return;
    const path = join(d, "invalid-and-denied.archive");
    writeFileSync(path, encodeFedosConversationArchiveFileContainer(exported.manifest, exported.ciphertext));

    const receiver = makeHarness({ boundary: sharedBoundary, retentionAuthority });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("partially-invalid");
    expect(restore.details?.memberships).toEqual({ inserted: 1, duplicate: 0, conflict: 0, failed: 0, invalid: 1, denied: 0 });
    expect(restore.details?.envelopes).toEqual({ inserted: 0, duplicate: 0, conflict: 0, failed: 0, invalid: 0, denied: 1 });
  });

  it("19. a stopped Runtime (isRuntimeRunning() reports false) refuses archive operations before retention logic is ever reached", async () => {
    const sender = makeHarness();
    seedTwoMessages(sender);
    sender.stopped = true;
    const exportResult = await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: join(freshDir(), "stopped.archive"), localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(exportResult.outcome).toBe("failed");
  });

  it("20. sequential exports from the SAME long-lived Runtime reflect a retention decision written in between -- no export-time caching or staleness", async () => {
    const d = freshDir();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    const h = makeHarness({ payloadStorage, retentionAuthority });
    seedTwoMessages(h);
    const before = await h.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: join(d, "before.archive"), localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(before.manifest?.envelopeCount).toBe(2);
    retentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    retentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    const after = await h.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: join(d, "after.archive"), localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(after.manifest?.envelopeCount, "the SAME Runtime, re-exporting the SAME conversation, must reflect the NEW decision -- no stale cached count").toBe(1);
  });

  it("21. restore reads the CURRENT on-disk retention log state, not a snapshot -- a decision written by a DIFFERENT Authority instance sharing the SAME durable log just before restore starts is still honored", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const senderAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    const sender = makeHarness({ boundary: sharedBoundary, payloadStorage, retentionAuthority: senderAuthority });
    seedTwoMessages(sender);
    const path = join(d, "concurrent-writer.archive");
    await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    // A SEPARATE Authority instance, sharing the SAME underlying `retentionPersistence` AND the SAME
    // underlying `payloadStorage` (simulating a different process/tab writing to the same durable
    // storage backend), records the decision.
    const otherWriterAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    otherWriterAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    otherWriterAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");

    // The receiver's OWN, yet-again-different Authority instance, over the SAME shared log, must see it immediately.
    const receiverAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage: new InMemoryFedosConversationPayloadStorage() });
    const receiver = makeHarness({ boundary: sharedBoundary, retentionAuthority: receiverAuthority });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome).toBe("partially-denied");
    expect(receiver.envelopePersistence.getEnvelope("envelope-delete" as never)).toBeNull();
  });

  it("22. Archive-carried content can never grant access the live Retention Authority denies -- the bundle's own bytes are irrelevant to the restore decision, only the restoring device's OWN authority is consulted", async () => {
    const d = freshDir();
    const sharedBoundary = fakeRoundTrippingRuntimeBoundary();
    const payloadStorage = new InMemoryFedosConversationPayloadStorage();
    const retentionPersistence = new InMemoryFedosPayloadRetentionPersistence();
    const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    const sender = makeHarness({ boundary: sharedBoundary, payloadStorage, retentionAuthority: "none" });
    seedTwoMessages(sender);
    // An export taken with NO retentionAuthority at all -- the bundle genuinely, unambiguously still
    // contains the full, un-redacted record (proves the bundle's own content is not itself the gate).
    const path = join(d, "unfiltered-bundle.archive");
    const exportResult = await sender.runtime.exportConversationArchive({
      conversationId: CONVERSATION_ID, destinationPath: path, localParticipant: LOCAL_PARTICIPANT,
      localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305",
    });
    expect(exportResult.manifest?.envelopeCount, "sanity: the bundle really does still carry both records").toBe(2);

    const informedRetentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence, payloadStorage });
    informedRetentionAuthority.tombstonePayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    informedRetentionAuthority.removeLocalPayload(DELETE_PAYLOAD_ID, null, "user_requested_placeholder");
    const receiver = makeHarness({ boundary: sharedBoundary, retentionAuthority: informedRetentionAuthority });
    const restore = await receiver.runtime.restoreConversationArchive({ sourcePath: path, localAccountIndex: LOCAL_ACCOUNT_INDEX, counterpartyPublicKeyHex: COUNTERPARTY_PUBLIC_KEY_HEX, suite: "ChaCha20Poly1305" });
    expect(restore.outcome, "the RESTORING device's own live Authority denies this -- the Archive's own unredacted content never overrides it").toBe("partially-denied");
    expect(receiver.envelopePersistence.getEnvelope("envelope-delete" as never)).toBeNull();
  });
});
