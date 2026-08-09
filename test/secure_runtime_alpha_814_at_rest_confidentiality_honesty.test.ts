import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { AppendOnlyFedosConversationPayloadStorage } from "../src/conversation/payload_storage/append_only_fedos_conversation_payload_storage.js";
import type { FedosConversationPayloadDescriptor } from "../src/conversation/payload_storage/fedos_conversation_payload_descriptor.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import codecSource from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_codec.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageSource from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import inMemorySource from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import appendOnlySource from "../src/os/messenger/conversations/payload_storage/append_only_fedos_conversation_payload_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import retentionAuthoritySource from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wireSource from "../src/os/messenger/conversations/payload_storage/fedos_persisted_conversation_payload_v1.ts?raw";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

const DESCRIPTOR: FedosConversationPayloadDescriptor = {
  id: "payload-1" as any,
  conversationId: "board-a::thread-1" as any,
  mediaType: "application/octet-stream",
  byteLength: 11,
  createdAt: 1_700_000_000,
};

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

/**
 * Secure Runtime Alpha 814 ("At-Rest Confidentiality Honesty") -- Stage
 * 24 of the Alpha 791-820 Conversation Retention & Private Payload
 * Storage Boundary Foundation Arc.
 *
 * This is not primarily a doc-existence test -- it verifies, by REAL
 * BEHAVIOR, that this Arc performs NO silent encryption of any kind:
 * bytes supplied in plaintext are written to disk recoverably (opaque
 * does not equal encrypted), and Conversation linkage/timing are
 * visible in the descriptor fields (never hidden by this boundary).
 */
describe("Secure Runtime Alpha 814 -- At-Rest Confidentiality Honesty", () => {
  it("1. plaintext bytes supplied by the caller are recoverable byte-for-byte -- confirms NO silent encryption occurs anywhere in this Arc", () => {
    dir = mkdtempSync(join(tmpdir(), "a814-"));
    const filePath = join(dir, "payload.ndjson");
    const storage = new AppendOnlyFedosConversationPayloadStorage(filePath, 1_000_000);
    const plaintext = new TextEncoder().encode("hello world");
    storage.putPayload({ ...DESCRIPTOR, byteLength: plaintext.length }, plaintext);

    const fresh = new AppendOnlyFedosConversationPayloadStorage(filePath, 1_000_000);
    const readBack = fresh.getPayload(DESCRIPTOR.id);
    expect(new TextDecoder().decode(readBack!.bytes)).toBe("hello world");
  });

  it("2. descriptor metadata (conversationId, createdAt, byteLength) is visible in plain form on disk -- 'opaque' never claims metadata confidentiality", () => {
    dir = mkdtempSync(join(tmpdir(), "a814-"));
    const filePath = join(dir, "payload.ndjson");
    const storage = new AppendOnlyFedosConversationPayloadStorage(filePath, 1_000_000);
    const plaintext = new TextEncoder().encode("hello world");
    storage.putPayload({ ...DESCRIPTOR, byteLength: plaintext.length }, plaintext);

    const raw = readFileSync(filePath, "utf8") as string;
    expect(raw).toContain(DESCRIPTOR.conversationId);
    expect(raw).toContain(String(DESCRIPTOR.createdAt));
  });

  it("3. no encryption/decryption/cipher function exists anywhere in the payload_storage or retention modules -- structural, in actual code (not prose explaining the absence)", () => {
    for (const source of [codecSource, storageSource, inMemorySource, appendOnlySource, retentionAuthoritySource]) {
      expect(codeOnlyLines(source)).not.toMatch(/\bencrypt\(|\bdecrypt\(|AeadKey|CryptoProvider|chacha20|aes256gcm/i);
    }
  });

  it("4. no key/nonce/AAD field exists on the payload wire record -- only Alpha 806's own base64 byte encoding, nothing cryptographic", () => {
    const code = codeOnlyLines(wireSource);
    expect(code).not.toMatch(/\bkey\b|\bnonce\b|\baad\b|algorithm|cipher/i);
    expect(code).toMatch(/bytesBase64/);
  });
});
