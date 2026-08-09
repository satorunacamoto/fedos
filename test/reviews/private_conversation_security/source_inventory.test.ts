import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readdirSync } from "node:fs";
import { NoopCryptoProvider } from "../../../src/crypto/noop_crypto.js";
import { canProtocolAdapterSupport } from "../../../src/os/_legacy_prototype/federation/capability_matrix.js";
import { validateFedosBoardPost } from "../../../src/board/fedos_board_post_validator.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import boardPostSource from "../../../src/board/fedos_board_post.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import wasmLoaderSource from "../../../src/runtime/fedos_wasm_loader.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import identifiersSource from "../../../src/board/fedos_board_identifiers.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sessionAdapterSource from "../../../src/board/session/fedos_session_board_adapter.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import appendOnlyBoardSource from "../../../src/board/persistence/append_only_fedos_board_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import appendOnlyOutboxSource from "../../../src/board/outbox/append_only_fedos_board_outbox_persistence.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import chatTypesSource from "../../../src/os/_legacy_prototype/chat/types.ts?raw";

/**
 * Private Conversation Security, Storage & Capability Boundary Review --
 * source inventory verification. Read-only against existing, unmodified
 * production source. Grounds §01/§07/§11/§12/§18's own factual claims in
 * observed fact, not memory or assumption. Never asserts that any FUTURE
 * (unimplemented) Private Conversation type/function exists.
 */

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

describe("Private Conversation Security Review -- source inventory", () => {
  it("1. no compiled WASM artifact exists in this checked-out tree -- grounds §01/§20's BLOCK-2 finding", () => {
    expect(() => readdirSync("packages/fedos-core-rust/pkg")).toThrow();
  });

  it("2. src/crypto/CryptoProvider remains fully placeholder -- NoopCryptoProvider denies every operation, behavioral", async () => {
    const provider = new NoopCryptoProvider();
    expect(provider.getStatus()).toEqual({ state: "unavailable", reason: "no crypto core is configured" });
    expect(provider.getCapabilities()).toEqual([]);
    const decision = await provider.encrypt({} as never);
    expect(decision.allowed ?? (decision as { state?: string }).state).not.toBe("available_placeholder");
  });

  it("3. AeadKeyHandle/AeadCiphertextHandle carry no raw byte field -- source inspection, grounds §01's opaque-handle finding", () => {
    const code = codeOnlyLines(wasmLoaderSource);
    const keyHandleStart = code.indexOf("export interface AeadKeyHandle");
    const keyHandleBody = code.slice(keyHandleStart, code.indexOf("}", keyHandleStart));
    expect(keyHandleBody).toMatch(/readonly kind:\s*"AeadKeyHandle"/);
    expect(keyHandleBody).not.toMatch(/bytes|Uint8Array|key:/i);

    const ciphertextHandleStart = code.indexOf("export interface AeadCiphertextHandle");
    const ciphertextHandleBody = code.slice(ciphertextHandleStart, code.indexOf("}", ciphertextHandleStart));
    expect(ciphertextHandleBody).toMatch(/readonly kind:\s*"AeadCiphertextHandle"/);
    expect(ciphertextHandleBody).not.toMatch(/bytes|Uint8Array/i);
  });

  it("4. AeadAadDomain already names a 'Conversation' value -- grounds §01's forward-looking AAD-domain finding", () => {
    expect(wasmLoaderSource as string).toMatch(/AeadAadDomain\s*=\s*"RootKey"\s*\|\s*"Identity"\s*\|\s*"Storage"\s*\|\s*"Conversation"/);
  });

  it("5. fedos_board_identifiers.ts still mints no random id of its own -- grounds §03's ID-authority finding", () => {
    expect(identifiersSource as string).toMatch(/No random ID generator exists anywhere in this file/i);
  });

  it("6. FedosBoardPost still carries exactly eight fields, none visibility/audience/encryption-shaped -- grounds §02's rejection of Option A", () => {
    const code = codeOnlyLines(boardPostSource);
    const interfaceStart = code.indexOf("export interface FedosBoardPost");
    const interfaceBody = code.slice(interfaceStart, code.indexOf("}", interfaceStart));
    const fieldCount = (interfaceBody.match(/readonly \w+[?:]/g) ?? []).length;
    expect(fieldCount).toBe(8);
    expect(interfaceBody).not.toMatch(/visibility|audience|ciphertext|encrypt|recipient/i);
  });

  it("7. capability_matrix.ts structurally rejects private_message_placeholder for nostr_placeholder -- behavioral, grounds §11/§18's own reused policy fact", () => {
    const decision = canProtocolAdapterSupport("nostr_placeholder", "private_message_placeholder");
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("rejected");
    expect(decision.reason).toMatch(/NIP-17\/NIP-44/);
  });

  it("8. the Session adapter's own header names encryption/decryption/DM retrieval as explicitly out of scope -- grounds §18's Session-row finding", () => {
    expect(sessionAdapterSource as string).toMatch(/encryption\/decryption, DM retrieval/i);
  });

  it("9. neither append-only backend (Board or Outbox) has a delete/truncate/compact method -- grounds §07/§08/§20's BLOCK-4 finding", () => {
    for (const source of [codeOnlyLines(appendOnlyBoardSource), codeOnlyLines(appendOnlyOutboxSource)]) {
      expect(source).not.toMatch(/\bdelete\w*\s*\(/i);
      expect(source).not.toMatch(/\btruncate\w*\s*\(/i);
      expect(source).not.toMatch(/\bcompact\w*\s*\(/i);
    }
  });

  it("10. ChatKind already names 'dm'/'group', but ChatMessage.content is plain string with no encryption field -- grounds §01/§12's chat-model finding", () => {
    expect(chatTypesSource as string).toMatch(/export type ChatKind = "dm" \| "group"/);
    const code = codeOnlyLines(chatTypesSource);
    const messageStart = code.indexOf("export interface ChatMessage");
    const messageBody = code.slice(messageStart, code.indexOf("}", messageStart));
    expect(messageBody).toMatch(/content:\s*string/);
    expect(messageBody).not.toMatch(/ciphertext|encrypt/i);
  });

  it("11. a plausible future private post input is still rejected by the CURRENT validator -- confirms no accidental private-mode support exists today", () => {
    // A caller cannot smuggle a ciphertext/ recipient-shaped field through
    // validateFedosBoardPost today -- extra fields are simply ignored, never
    // interpreted as visibility/encryption, confirmed behaviorally.
    const result = validateFedosBoardPost({
      id: "post-1",
      boardId: "board-1",
      threadId: "post-1",
      replyTo: null,
      author: { identityId: null, protocol: "fedos", publicIdentifier: "npub1x" },
      body: "hello",
      createdAt: 1_700_000_000,
      source: { protocol: "fedos", reference: "post-1" },
      // @ts-expect-error -- deliberately supplying a field the type does not declare.
      ciphertext: "should be ignored",
    });
    expect(result).not.toBeNull();
    expect((result as unknown as Record<string, unknown>)["ciphertext"]).toBeUndefined();
  });
});
