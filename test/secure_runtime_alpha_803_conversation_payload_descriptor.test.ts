import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import descriptorSource from "../src/conversation/payload_storage/fedos_conversation_payload_descriptor.ts?raw";
import {
  validateFedosConversationPayloadDescriptor,
  type FedosConversationPayloadDescriptorInput,
} from "../src/conversation/payload_storage/fedos_conversation_payload_descriptor_validator.js";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

const VALID: FedosConversationPayloadDescriptorInput = {
  id: "payload-1",
  conversationId: "board-a::thread-1",
  mediaType: "application/octet-stream",
  byteLength: 3,
  createdAt: 1_700_000_000,
};

/**
 * Secure Runtime Alpha 801 ("Private Payload Model Decision") / Alpha
 * 803 ("Payload Descriptor") -- Stages 11/13 of the Alpha 791-820
 * Conversation Retention & Private Payload Storage Boundary Foundation
 * Arc.
 */
describe("Secure Runtime Alpha 803 -- FedosConversationPayloadDescriptor", () => {
  it("1. no Private Message is defined -- structural: no 'FedosConversationMessage'/'PrivateMessage' type in this file", () => {
    expect(codeOnlyLines(descriptorSource)).not.toMatch(/FedosConversationMessage|PrivateMessage/);
  });

  it("2. mediaType is a closed vocabulary of exactly one value", () => {
    expect(descriptorSource).toMatch(/export type FedosConversationPayloadMediaType = "application\/octet-stream"/);
  });

  it("3. bytes are never labeled ciphertext in this file -- neutral 'opaque payload' term only", () => {
    expect(codeOnlyLines(descriptorSource)).not.toMatch(/ciphertext/i);
  });

  it("4. descriptor has exactly 5 fields: id, conversationId, mediaType, byteLength, createdAt", () => {
    const code = codeOnlyLines(descriptorSource);
    const interfaceStart = code.indexOf("export interface FedosConversationPayloadDescriptor");
    const interfaceBody = code.slice(interfaceStart, code.indexOf("}", interfaceStart));
    const fieldCount = (interfaceBody.match(/readonly \w+[?:]/g) ?? []).length;
    expect(fieldCount).toBe(5);
  });

  it("5. no plaintext body, algorithm, key epoch, author, membership, or invitation field", () => {
    const code = codeOnlyLines(descriptorSource);
    const interfaceStart = code.indexOf("export interface FedosConversationPayloadDescriptor");
    const interfaceBody = code.slice(interfaceStart, code.indexOf("}", interfaceStart));
    expect(interfaceBody).not.toMatch(/body|algorithm|epoch|author|member|invit|metadata/i);
  });

  it("6. validator accepts a well-formed candidate", () => {
    const descriptor = validateFedosConversationPayloadDescriptor(VALID);
    expect(descriptor).not.toBeNull();
    expect(descriptor?.byteLength).toBe(3);
  });

  it("7. validator rejects a mediaType outside the closed vocabulary", () => {
    expect(validateFedosConversationPayloadDescriptor({ ...VALID, mediaType: "text/plain" })).toBeNull();
  });

  it("8. validator rejects a negative or non-integer byteLength", () => {
    expect(validateFedosConversationPayloadDescriptor({ ...VALID, byteLength: -1 })).toBeNull();
    expect(validateFedosConversationPayloadDescriptor({ ...VALID, byteLength: 1.5 })).toBeNull();
  });

  it("9. validator rejects an unknown/extra field and a missing field", () => {
    expect(validateFedosConversationPayloadDescriptor({ ...VALID, extra: "nope" } as any)).toBeNull();
    const { mediaType: _mediaType, ...withoutMediaType } = VALID;
    expect(validateFedosConversationPayloadDescriptor(withoutMediaType as any)).toBeNull();
  });

  it("10. validator rejects an id containing path characters", () => {
    expect(validateFedosConversationPayloadDescriptor({ ...VALID, id: "../etc" })).toBeNull();
  });

  it("11. validator never throws for malformed input, and the result is frozen", () => {
    expect(() => validateFedosConversationPayloadDescriptor(null as any)).not.toThrow();
    const descriptor = validateFedosConversationPayloadDescriptor(VALID)!;
    expect(Object.isFrozen(descriptor)).toBe(true);
  });
});
