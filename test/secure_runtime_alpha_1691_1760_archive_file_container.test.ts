/**
 * Secure Runtime Alpha 1691–1760 — Archive File Container encode/decode
 * round-trip and corruption tests.
 */
import { describe, it, expect } from "vitest";
import {
  encodeFedosConversationArchiveFileContainer,
  decodeFedosConversationArchiveFileContainer,
} from "../src/conversation/archive/fs/fedos_conversation_archive_file_container.js";
import { FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION } from "../src/conversation/archive/fedos_conversation_archive_schema_version.js";
import type { FedosConversationArchiveManifestV1 } from "../src/conversation/archive/fedos_conversation_archive_manifest.js";
import type { AeadCiphertextWire } from "../src/runtime/fedos_wasm_loader.js";

function makeManifest(overrides: Partial<FedosConversationArchiveManifestV1> = {}): FedosConversationArchiveManifestV1 {
  return {
    schemaVersion: FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION,
    conversationId: "board-a::thread-1",
    exportedAt: 1_700_000_500,
    membershipCount: 1,
    capabilityEventCount: 2,
    envelopeCount: 3,
    payloadCount: 3,
    contentHash: "deadbeef".repeat(8),
    ...overrides,
  };
}

const CIPHERTEXT = "wire-ciphertext-opaque-string" as AeadCiphertextWire;

describe("Secure Runtime Alpha 1691-1760 -- Archive File Container round trip", () => {
  it("1. decode(encode(manifest, ciphertext)) recovers the exact manifest and ciphertext", () => {
    const manifest = makeManifest();
    const bytes = encodeFedosConversationArchiveFileContainer(manifest, CIPHERTEXT);
    const decoded = decodeFedosConversationArchiveFileContainer(bytes);
    expect(decoded).toEqual({ outcome: "decoded", manifest, ciphertext: CIPHERTEXT });
  });

  it("2. round-trips an empty-string ciphertext without corrupting the length framing", () => {
    const manifest = makeManifest();
    const bytes = encodeFedosConversationArchiveFileContainer(manifest, "" as AeadCiphertextWire);
    const decoded = decodeFedosConversationArchiveFileContainer(bytes);
    expect(decoded).toEqual({ outcome: "decoded", manifest, ciphertext: "" });
  });

  it("3. round-trips a large ciphertext string (multi-KB) correctly", () => {
    const manifest = makeManifest();
    const bigCiphertext = "x".repeat(200_000) as AeadCiphertextWire;
    const bytes = encodeFedosConversationArchiveFileContainer(manifest, bigCiphertext);
    const decoded = decodeFedosConversationArchiveFileContainer(bytes);
    expect(decoded).toEqual({ outcome: "decoded", manifest, ciphertext: bigCiphertext });
  });
});

describe("Secure Runtime Alpha 1691-1760 -- Archive File Container corruption handling", () => {
  it("1. malformed -- an empty byte array", () => {
    expect(decodeFedosConversationArchiveFileContainer(new Uint8Array([]))).toEqual({ outcome: "malformed" });
  });

  it("2. malformed -- wrong container schema version byte", () => {
    const bytes = encodeFedosConversationArchiveFileContainer(makeManifest(), CIPHERTEXT);
    const tampered = new Uint8Array(bytes);
    tampered[0] = 99;
    expect(decodeFedosConversationArchiveFileContainer(tampered)).toEqual({ outcome: "malformed" });
  });

  it("3. malformed -- truncated immediately after the schema-version byte (no room for the length prefix)", () => {
    const bytes = encodeFedosConversationArchiveFileContainer(makeManifest(), CIPHERTEXT);
    expect(decodeFedosConversationArchiveFileContainer(bytes.slice(0, 3))).toEqual({ outcome: "malformed" });
  });

  it("4. malformed -- truncated mid-manifest (declared length exceeds actual remaining bytes)", () => {
    const bytes = encodeFedosConversationArchiveFileContainer(makeManifest(), CIPHERTEXT);
    expect(decodeFedosConversationArchiveFileContainer(bytes.slice(0, 20))).toEqual({ outcome: "malformed" });
  });

  it("5. malformed -- truncated mid-ciphertext (manifest intact, ciphertext length prefix present but body missing)", () => {
    const bytes = encodeFedosConversationArchiveFileContainer(makeManifest(), CIPHERTEXT);
    // Find the boundary right after the ciphertext-length prefix by re-deriving it from a known-good decode.
    const manifestBytes = new TextEncoder().encode(JSON.stringify(makeManifest()));
    const ciphertextLengthOffset = 5 + manifestBytes.length;
    const truncated = bytes.slice(0, ciphertextLengthOffset + 4 + 3);
    expect(decodeFedosConversationArchiveFileContainer(truncated)).toEqual({ outcome: "malformed" });
  });

  it("6. malformed -- manifest bytes are not valid JSON", () => {
    const bytes = encodeFedosConversationArchiveFileContainer(makeManifest(), CIPHERTEXT);
    const tampered = new Uint8Array(bytes);
    // Corrupt one byte inside the manifest JSON region (well past the 5-byte header).
    tampered[10] = "{".charCodeAt(0);
    expect(decodeFedosConversationArchiveFileContainer(tampered).outcome).toBe("malformed");
  });

  it("7. malformed -- well-formed JSON manifest missing required fields", () => {
    const manifest = makeManifest();
    const manifestBytes = new TextEncoder().encode(JSON.stringify({ schemaVersion: manifest.schemaVersion }));
    const header = new Uint8Array([1]);
    const manifestLen = new Uint8Array(4);
    new DataView(manifestLen.buffer).setUint32(0, manifestBytes.length, false);
    const ciphertextBytes = new TextEncoder().encode(CIPHERTEXT);
    const ciphertextLen = new Uint8Array(4);
    new DataView(ciphertextLen.buffer).setUint32(0, ciphertextBytes.length, false);
    const bytes = new Uint8Array(header.length + manifestLen.length + manifestBytes.length + ciphertextLen.length + ciphertextBytes.length);
    let offset = 0;
    for (const chunk of [header, manifestLen, manifestBytes, ciphertextLen, ciphertextBytes]) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    expect(decodeFedosConversationArchiveFileContainer(bytes)).toEqual({ outcome: "malformed" });
  });

  it("8. unsupported-version -- a manifest whose own schemaVersion field is a recognized number but not the one this build supports", () => {
    const manifest = { ...makeManifest(), schemaVersion: 2 } as unknown as FedosConversationArchiveManifestV1;
    const bytes = encodeFedosConversationArchiveFileContainer(manifest, CIPHERTEXT);
    expect(decodeFedosConversationArchiveFileContainer(bytes)).toEqual({ outcome: "unsupported-version" });
  });

  it("9. changed-ciphertext -- corrupting a byte inside the ciphertext region still decodes structurally (integrity is the encryption layer's job, not this framing layer's)", () => {
    const bytes = encodeFedosConversationArchiveFileContainer(makeManifest(), CIPHERTEXT);
    const tampered = new Uint8Array(bytes);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;
    const decoded = decodeFedosConversationArchiveFileContainer(tampered);
    expect(decoded.outcome).toBe("decoded");
    if (decoded.outcome === "decoded") expect(decoded.ciphertext).not.toBe(CIPHERTEXT);
  });
});
