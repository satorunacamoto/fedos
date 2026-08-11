import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  toFedosConversationEnvelopeId,
  FedosSecureRandomConversationEnvelopeIdGenerator,
} from "../src/os/messenger/conversations/envelope/fedos_conversation_envelope_id.js";
import {
  validateFedosConversationMessageEnvelope,
  type FedosConversationMessageEnvelopeInput,
} from "../src/os/messenger/conversations/envelope/fedos_conversation_message_envelope_validator.js";
import {
  encodeFedosConversationEnvelopeAssociatedData,
  fedosConversationEnvelopeAssociatedDataBytesAreEqual,
} from "../src/os/messenger/conversations/envelope/fedos_conversation_envelope_associated_data.js";
import {
  serializeFedosConversationMessageEnvelope,
  deserializeFedosConversationMessageEnvelope,
} from "../src/os/messenger/conversations/envelope/persistence/fedos_conversation_message_envelope_codec.js";
import { fedosPersistedConversationMessageEnvelopesAreEqual } from "../src/os/messenger/conversations/envelope/persistence/fedos_conversation_message_envelope_persistence.js";
import { InMemoryFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/in_memory_fedos_conversation_message_envelope_persistence.js";
import { AppendOnlyFedosConversationMessageEnvelopePersistence } from "../src/os/messenger/conversations/envelope/persistence/append_only_fedos_conversation_message_envelope_persistence.js";
import type { FedosPersistedConversationMessageEnvelopeV1 } from "../src/os/messenger/conversations/envelope/persistence/fedos_persisted_conversation_message_envelope_v1.js";

const VALID_INPUT: FedosConversationMessageEnvelopeInput = {
  id: "envelope-1",
  conversationId: "board-a::thread-1",
  senderMembershipId: "board-a::thread-1::fedos::alice",
  payloadId: "payload-1",
  encryptionSuite: "ChaCha20Poly1305",
  keyEpoch: 0,
  createdAt: 1_700_000_000,
  replyToEnvelopeId: null,
};

/**
 * Secure Runtime Alpha 853 ("Envelope Identity") / 854 ("Private Message
 * Envelope V1") / 855 ("Envelope Validation") / 856 ("Associated Data
 * Contract") / 857 ("Envelope Metadata Persistence") / 858 ("Envelope
 * Codec") / 859 ("In-Memory Envelope Persistence") / 860 ("Append-Only
 * Envelope Persistence") -- Stages 3-10 of Phase A of the Alpha 851-890
 * Private Message Envelope and Encryption Authority Activation Arc.
 */
describe("Secure Runtime Alpha 853 -- FedosConversationEnvelopeId", () => {
  it("1. brands a well-formed, non-empty string", () => {
    expect(toFedosConversationEnvelopeId("abc123")).toBe("abc123");
  });

  it("2. rejects an empty or whitespace-only string", () => {
    expect(toFedosConversationEnvelopeId("")).toBeNull();
    expect(toFedosConversationEnvelopeId("   ")).toBeNull();
  });

  it("3. rejects path characters", () => {
    expect(toFedosConversationEnvelopeId("../etc/passwd")).toBeNull();
    expect(toFedosConversationEnvelopeId("a/b")).toBeNull();
    expect(toFedosConversationEnvelopeId("a\\b")).toBeNull();
  });

  it("4. the default generator produces non-empty, distinct, brandable ids", () => {
    const generator = new FedosSecureRandomConversationEnvelopeIdGenerator();
    const a = generator.generateEnvelopeId();
    const b = generator.generateEnvelopeId();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
    expect(toFedosConversationEnvelopeId(a)).not.toBeNull();
  });
});

describe("Secure Runtime Alpha 854/855 -- FedosConversationMessageEnvelope validator", () => {
  it("1. accepts a well-formed input", () => {
    const envelope = validateFedosConversationMessageEnvelope(VALID_INPUT);
    expect(envelope).not.toBeNull();
    expect(envelope?.id).toBe("envelope-1");
    expect(envelope?.replyToEnvelopeId).toBeNull();
  });

  it("2. rejects a non-object candidate", () => {
    expect(validateFedosConversationMessageEnvelope(null)).toBeNull();
    expect(validateFedosConversationMessageEnvelope("nope")).toBeNull();
  });

  it("3. rejects an unknown/extra field", () => {
    expect(validateFedosConversationMessageEnvelope({ ...VALID_INPUT, extra: "field" })).toBeNull();
  });

  it("4. rejects a missing field", () => {
    const { keyEpoch: _keyEpoch, ...missing } = VALID_INPUT;
    expect(validateFedosConversationMessageEnvelope(missing)).toBeNull();
  });

  it("5. rejects an unsupported encryptionSuite", () => {
    expect(validateFedosConversationMessageEnvelope({ ...VALID_INPUT, encryptionSuite: "xchacha20poly1305" })).toBeNull();
  });

  it("6. rejects a negative keyEpoch", () => {
    expect(validateFedosConversationMessageEnvelope({ ...VALID_INPUT, keyEpoch: -1 })).toBeNull();
  });

  it("7. rejects a non-integer keyEpoch", () => {
    expect(validateFedosConversationMessageEnvelope({ ...VALID_INPUT, keyEpoch: 1.5 })).toBeNull();
  });

  it("8. rejects createdAt outside the accepted range", () => {
    expect(validateFedosConversationMessageEnvelope({ ...VALID_INPUT, createdAt: -1 })).toBeNull();
  });

  it("9. accepts a well-formed replyToEnvelopeId", () => {
    const envelope = validateFedosConversationMessageEnvelope({ ...VALID_INPUT, replyToEnvelopeId: "envelope-0" });
    expect(envelope?.replyToEnvelopeId).toBe("envelope-0");
  });

  it("10. rejects a self-reply (replyToEnvelopeId === id)", () => {
    expect(validateFedosConversationMessageEnvelope({ ...VALID_INPUT, replyToEnvelopeId: VALID_INPUT.id })).toBeNull();
  });

  it("11. rejects a malformed replyToEnvelopeId (path characters)", () => {
    expect(validateFedosConversationMessageEnvelope({ ...VALID_INPUT, replyToEnvelopeId: "../x" })).toBeNull();
  });

  it("12. the returned record is frozen", () => {
    const envelope = validateFedosConversationMessageEnvelope(VALID_INPUT);
    expect(Object.isFrozen(envelope)).toBe(true);
  });
});

describe("Secure Runtime Alpha 856 -- associated-data header", () => {
  const envelope = validateFedosConversationMessageEnvelope(VALID_INPUT)!;

  it("1. deterministic: the same envelope fields always produce byte-identical output", () => {
    const a = encodeFedosConversationEnvelopeAssociatedData(envelope);
    const b = encodeFedosConversationEnvelopeAssociatedData(envelope);
    expect(a).toEqual(b);
  });

  it("2. differs when any bound field differs", () => {
    const base = encodeFedosConversationEnvelopeAssociatedData(envelope);
    const otherConversation = encodeFedosConversationEnvelopeAssociatedData({
      ...envelope,
      conversationId: "board-a::thread-2" as any,
    });
    const otherEpoch = encodeFedosConversationEnvelopeAssociatedData({ ...envelope, keyEpoch: 1 });
    const otherSender = encodeFedosConversationEnvelopeAssociatedData({
      ...envelope,
      senderMembershipId: "board-a::thread-1::fedos::bob" as any,
    });
    expect(fedosConversationEnvelopeAssociatedDataBytesAreEqual(base, otherConversation)).toBe(false);
    expect(fedosConversationEnvelopeAssociatedDataBytesAreEqual(base, otherEpoch)).toBe(false);
    expect(fedosConversationEnvelopeAssociatedDataBytesAreEqual(base, otherSender)).toBe(false);
  });

  it("3. handles a present replyToEnvelopeId distinctly from an absent one", () => {
    const absent = encodeFedosConversationEnvelopeAssociatedData(envelope);
    const withReply = validateFedosConversationMessageEnvelope({ ...VALID_INPUT, replyToEnvelopeId: "envelope-0" })!;
    const present = encodeFedosConversationEnvelopeAssociatedData(withReply);
    expect(fedosConversationEnvelopeAssociatedDataBytesAreEqual(absent, present)).toBe(false);
  });

  it("4. no length-prefix delimiter collision: an id containing '::' does not collide with a differently-split pair of fields", () => {
    const a = encodeFedosConversationEnvelopeAssociatedData({
      ...envelope,
      conversationId: "board-a::thread-1" as any,
      senderMembershipId: "extra::fedos::alice" as any,
    });
    const b = encodeFedosConversationEnvelopeAssociatedData({
      ...envelope,
      conversationId: "board-a::thread-1::extra" as any,
      senderMembershipId: "fedos::alice" as any,
    });
    expect(fedosConversationEnvelopeAssociatedDataBytesAreEqual(a, b)).toBe(false);
  });

  it("5. bytesAreEqual is reflexive and length-sensitive", () => {
    const bytes = encodeFedosConversationEnvelopeAssociatedData(envelope);
    expect(fedosConversationEnvelopeAssociatedDataBytesAreEqual(bytes, bytes)).toBe(true);
    expect(fedosConversationEnvelopeAssociatedDataBytesAreEqual(bytes, bytes.subarray(0, bytes.length - 1))).toBe(false);
  });

  it("6. known-answer: schema version byte is the first byte of the output", () => {
    const bytes = encodeFedosConversationEnvelopeAssociatedData(envelope);
    expect(bytes[0]).toBe(0x01);
  });
});

describe("Secure Runtime Alpha 857/858 -- persistence port equality + codec", () => {
  const envelope = validateFedosConversationMessageEnvelope(VALID_INPUT)!;
  const persisted = serializeFedosConversationMessageEnvelope(envelope);

  it("1. serialize produces schemaVersion 1 and matching fields", () => {
    expect(persisted.schemaVersion).toBe(1);
    expect(persisted.id).toBe("envelope-1");
  });

  it("2. round-trip: deserialize(serialize(e)) equals e field-for-field", () => {
    const roundTripped = deserializeFedosConversationMessageEnvelope(persisted);
    expect(roundTripped).toEqual(envelope);
  });

  it("3. rejects a non-1 schemaVersion", () => {
    expect(deserializeFedosConversationMessageEnvelope({ ...persisted, schemaVersion: 2 })).toBeNull();
  });

  it("4. rejects an unknown top-level field", () => {
    expect(deserializeFedosConversationMessageEnvelope({ ...persisted, extra: "x" })).toBeNull();
  });

  it("5. rejects a non-object candidate", () => {
    expect(deserializeFedosConversationMessageEnvelope(null)).toBeNull();
    expect(deserializeFedosConversationMessageEnvelope("nope")).toBeNull();
  });

  it("6. equality function distinguishes any differing field", () => {
    expect(fedosPersistedConversationMessageEnvelopesAreEqual(persisted, persisted)).toBe(true);
    expect(fedosPersistedConversationMessageEnvelopesAreEqual(persisted, { ...persisted, keyEpoch: 1 })).toBe(false);
  });
});

describe("Secure Runtime Alpha 859 -- in-memory envelope persistence", () => {
  const record: FedosPersistedConversationMessageEnvelopeV1 = {
    schemaVersion: 1,
    id: "envelope-1",
    conversationId: "board-a::thread-1",
    senderMembershipId: "board-a::thread-1::fedos::alice",
    payloadId: "payload-1",
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
  };

  it("1. putEnvelope inserts a new record", () => {
    const store = new InMemoryFedosConversationMessageEnvelopePersistence();
    expect(store.putEnvelope(record)).toBe("inserted");
    expect(store.getEnvelope("envelope-1")).toEqual(record);
  });

  it("2. putEnvelope is idempotent for an identical duplicate", () => {
    const store = new InMemoryFedosConversationMessageEnvelopePersistence();
    store.putEnvelope(record);
    expect(store.putEnvelope(record)).toBe("already-present");
  });

  it("3. putEnvelope reports a conflict for a different record sharing the same id", () => {
    const store = new InMemoryFedosConversationMessageEnvelopePersistence();
    store.putEnvelope(record);
    expect(store.putEnvelope({ ...record, keyEpoch: 1 })).toBe("conflict");
  });

  it("4. getEnvelope returns null for an unknown id", () => {
    const store = new InMemoryFedosConversationMessageEnvelopePersistence();
    expect(store.getEnvelope("does-not-exist")).toBeNull();
  });

  it("5. listConversationEnvelopes filters by conversationId", () => {
    const store = new InMemoryFedosConversationMessageEnvelopePersistence();
    store.putEnvelope(record);
    store.putEnvelope({ ...record, id: "envelope-2", conversationId: "board-a::thread-2" });
    expect(store.listConversationEnvelopes("board-a::thread-1" as any)).toEqual([record]);
  });
});

describe("Secure Runtime Alpha 860 -- append-only envelope persistence", () => {
  const record: FedosPersistedConversationMessageEnvelopeV1 = {
    schemaVersion: 1,
    id: "envelope-1",
    conversationId: "board-a::thread-1",
    senderMembershipId: "board-a::thread-1::fedos::alice",
    payloadId: "payload-1",
    encryptionSuite: "ChaCha20Poly1305",
    keyEpoch: 0,
    createdAt: 1_700_000_000,
    replyToEnvelopeId: null,
  };

  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("1. an empty/missing file is not corruption -- listConversationEnvelopes returns []", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-envelope-append-"));
    const store = new AppendOnlyFedosConversationMessageEnvelopePersistence(join(dir, "log.ndjson"));
    expect(store.listConversationEnvelopes("board-a::thread-1" as any)).toEqual([]);
    expect(store.getEnvelope("envelope-1")).toBeNull();
  });

  it("2. putEnvelope persists across a fresh instance over the same file (restart)", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-envelope-append-"));
    const path = join(dir, "log.ndjson");
    const first = new AppendOnlyFedosConversationMessageEnvelopePersistence(path);
    expect(first.putEnvelope(record)).toBe("inserted");

    const second = new AppendOnlyFedosConversationMessageEnvelopePersistence(path);
    expect(second.getEnvelope("envelope-1")).toEqual(record);
  });

  it("3. putEnvelope is idempotent for an identical duplicate", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-envelope-append-"));
    const store = new AppendOnlyFedosConversationMessageEnvelopePersistence(join(dir, "log.ndjson"));
    store.putEnvelope(record);
    expect(store.putEnvelope(record)).toBe("already-present");
  });

  it("4. putEnvelope reports a conflict for a different record sharing the same id", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-envelope-append-"));
    const store = new AppendOnlyFedosConversationMessageEnvelopePersistence(join(dir, "log.ndjson"));
    store.putEnvelope(record);
    expect(store.putEnvelope({ ...record, keyEpoch: 1 })).toBe("conflict");
  });

  it("5. a corrupt (non-JSON) line throws unconditionally", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-envelope-append-"));
    const path = join(dir, "log.ndjson");
    appendFileSync(path, "not-json\n", "utf8");
    const store = new AppendOnlyFedosConversationMessageEnvelopePersistence(path);
    expect(() => store.getEnvelope("envelope-1")).toThrow();
  });

  it("6. an irreconcilable duplicate (same id, different content) throws on replay", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-envelope-append-"));
    const path = join(dir, "log.ndjson");
    appendFileSync(path, JSON.stringify(record) + "\n", "utf8");
    appendFileSync(path, JSON.stringify({ ...record, keyEpoch: 1 }) + "\n", "utf8");
    const store = new AppendOnlyFedosConversationMessageEnvelopePersistence(path);
    expect(() => store.getEnvelope("envelope-1")).toThrow();
  });

  it("7. listConversationEnvelopes filters by conversationId", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-envelope-append-"));
    const store = new AppendOnlyFedosConversationMessageEnvelopePersistence(join(dir, "log.ndjson"));
    store.putEnvelope(record);
    store.putEnvelope({ ...record, id: "envelope-2", conversationId: "board-a::thread-2" });
    expect(store.listConversationEnvelopes("board-a::thread-1" as any)).toEqual([record]);
  });
});
