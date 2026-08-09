import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, existsSync, appendFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
// @ts-expect-error `node:buffer` has no type declarations without `@types/node` in this project's tsconfig.
import { Buffer } from "node:buffer";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import appendOnlyImplementationSource from "../src/os/messenger/conversations/payload_storage/append_only_fedos_conversation_payload_storage.ts?raw";
import {
  serializeFedosConversationPayload,
  deserializeFedosConversationPayload,
} from "../src/conversation/payload_storage/fedos_conversation_payload_codec.js";
import type { FedosConversationPayloadDescriptor } from "../src/conversation/payload_storage/fedos_conversation_payload_descriptor.js";

const DESCRIPTOR: FedosConversationPayloadDescriptor = {
  id: "payload-1" as any,
  conversationId: "board-a::thread-1" as any,
  mediaType: "application/octet-stream",
  byteLength: 3,
  createdAt: 1_700_000_000,
};
const BYTES = new Uint8Array([1, 2, 3]);

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 806 ("Payload Codec V1") / Alpha 808
 * ("Append-Only Payload Storage Decision") / Alpha 809 ("Append-Only
 * Implementation") -- Stages 16/18/19 of the Alpha 791-820 Conversation
 * Retention & Private Payload Storage Boundary Foundation Arc.
 */
describe("Secure Runtime Alpha 809 -- Payload Codec + Append-Only Storage", () => {
  it("1. codec round-trip: serialize then deserialize reproduces identical descriptor + bytes", () => {
    const persisted = serializeFedosConversationPayload({ descriptor: DESCRIPTOR, bytes: BYTES });
    expect(persisted.bytesBase64).toBe(Buffer.from(BYTES).toString("base64"));
    const roundTripped = deserializeFedosConversationPayload(persisted);
    expect(roundTripped?.descriptor).toEqual(DESCRIPTOR);
    expect(roundTripped?.bytes).toEqual(BYTES);
  });

  it("2. codec rejects invalid base64 shape", () => {
    const persisted = serializeFedosConversationPayload({ descriptor: DESCRIPTOR, bytes: BYTES });
    expect(deserializeFedosConversationPayload({ ...persisted, bytesBase64: "not base64!!" })).toBeNull();
  });

  it("3. codec cross-checks byteLength against the actual decoded byte count", () => {
    const persisted = serializeFedosConversationPayload({ descriptor: DESCRIPTOR, bytes: BYTES });
    expect(deserializeFedosConversationPayload({ ...persisted, byteLength: 999 })).toBeNull();
  });

  it("4. codec rejects an unknown top-level field and never throws", () => {
    const persisted = serializeFedosConversationPayload({ descriptor: DESCRIPTOR, bytes: BYTES });
    expect(deserializeFedosConversationPayload({ ...persisted, extra: "nope" })).toBeNull();
    expect(() => deserializeFedosConversationPayload("garbage")).not.toThrow();
    expect(() => deserializeFedosConversationPayload(null)).not.toThrow();
  });

  it("5. base64 never appears as the Application API -- FedosConversationPayload carries a real Uint8Array", () => {
    const persisted = serializeFedosConversationPayload({ descriptor: DESCRIPTOR, bytes: BYTES });
    const roundTripped = deserializeFedosConversationPayload(persisted)!;
    expect(roundTripped.bytes).toBeInstanceOf(Uint8Array);
    expect(typeof (roundTripped as any).bytesBase64).toBe("undefined");
  });

  it("6. constructing the append-only backend does not create the file -- no constructor I/O", () => {
    dir = mkdtempSync(join(tmpdir(), "a809-"));
    const filePath = join(dir, "payload.ndjson");
    new AppendOnlyFedosConversationPayloadStorage(filePath, 1_000_000);
    expect(existsSync(filePath)).toBe(false);
  });

  it("7. putPayload/getPayload round-trip through a real durable file", () => {
    dir = mkdtempSync(join(tmpdir(), "a809-"));
    const filePath = join(dir, "payload.ndjson");
    const storage = new AppendOnlyFedosConversationPayloadStorage(filePath, 1_000_000);
    expect(storage.putPayload(DESCRIPTOR, BYTES)).toBe("inserted");

    const fresh = new AppendOnlyFedosConversationPayloadStorage(filePath, 1_000_000);
    expect(fresh.getPayload(DESCRIPTOR.id)?.bytes).toEqual(BYTES);
  });

  it("8. idempotent duplicate write returns already-present; conflicting write is rejected", () => {
    dir = mkdtempSync(join(tmpdir(), "a809-"));
    const filePath = join(dir, "payload.ndjson");
    const storage = new AppendOnlyFedosConversationPayloadStorage(filePath, 1_000_000);
    storage.putPayload(DESCRIPTOR, BYTES);
    expect(storage.putPayload({ ...DESCRIPTOR }, new Uint8Array(BYTES))).toBe("already-present");
    expect(storage.putPayload(DESCRIPTOR, new Uint8Array([9, 9, 9]))).toBe("conflict");
  });

  it("9. maximum payload size is explicit and enforced -- oversized writes fail, never silently truncated", () => {
    dir = mkdtempSync(join(tmpdir(), "a809-"));
    const filePath = join(dir, "payload.ndjson");
    const storage = new AppendOnlyFedosConversationPayloadStorage(filePath, 2);
    expect(storage.putPayload(DESCRIPTOR, BYTES)).toBe("failed");
    expect(existsSync(filePath)).toBe(false);
  });

  it("10. a malformed trailing line fails closed -- throws, never silently repaired", () => {
    dir = mkdtempSync(join(tmpdir(), "a809-"));
    const filePath = join(dir, "payload.ndjson");
    const persisted = serializeFedosConversationPayload({ descriptor: DESCRIPTOR, bytes: BYTES });
    appendFileSync(filePath, JSON.stringify(persisted) + "\n{not valid json", "utf8");
    const storage = new AppendOnlyFedosConversationPayloadStorage(filePath, 1_000_000);
    expect(() => storage.getPayload(DESCRIPTOR.id)).toThrow();
  });

  it("11. a corrupt record (invalid base64 stored on disk) fails closed on read, never returns partial/corrupt bytes", () => {
    dir = mkdtempSync(join(tmpdir(), "a809-"));
    const filePath = join(dir, "payload.ndjson");
    const persisted = serializeFedosConversationPayload({ descriptor: DESCRIPTOR, bytes: BYTES });
    appendFileSync(filePath, JSON.stringify({ ...persisted, bytesBase64: "not base64!!" }) + "\n", "utf8");
    const storage = new AppendOnlyFedosConversationPayloadStorage(filePath, 1_000_000);
    expect(() => storage.getPayload(DESCRIPTOR.id)).toThrow();
  });

  it("12. no external dependency -- only node:fs/node:buffer, zero-dependency V1", () => {
    const code = (appendOnlyImplementationSource as string)
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*") && !line.trim().startsWith("/*"))
      .join("\n");
    expect(code).not.toMatch(/from ["'](?!\.\/|\.\.\/|node:)/);
  });
});
