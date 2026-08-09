import { describe, it, expect } from "vitest";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import implementationSource from "../src/os/messenger/conversations/fedos_conversation_id.ts?raw";
import { toFedosConversationId } from "../src/conversation/fedos_conversation_id.js";
import { toFedosBoardId } from "../src/board/fedos_board_identifiers.js";
import { toFedosThreadId } from "../src/board/fedos_board_identifiers.js";

function codeOnlyLines(source: string): string {
  return source
    .split("\n")
    .filter((line: string) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*");
    })
    .join("\n");
}

/**
 * Secure Runtime Alpha 742 ("Conversation Identity Decision") / Alpha
 * 743 ("Conversation ID Type") -- Stages 2-3 of the Alpha 741-760
 * Canonical Conversation Identity and Record Foundation Arc.
 */
describe("Secure Runtime Alpha 743 -- Conversation ID Type", () => {
  it("1. deterministic: the same (boardId, threadId) pair always produces the identical id", () => {
    const boardId = toFedosBoardId("board-a")!;
    const threadId = toFedosThreadId("thread-1")!;
    expect(toFedosConversationId(boardId, threadId)).toBe(toFedosConversationId(boardId, threadId));
  });

  it("2. two different pairs never collide", () => {
    const boardId = toFedosBoardId("board-a")!;
    const threadIdOne = toFedosThreadId("thread-1")!;
    const threadIdTwo = toFedosThreadId("thread-2")!;
    expect(toFedosConversationId(boardId, threadIdOne)).not.toBe(toFedosConversationId(boardId, threadIdTwo));

    const boardIdTwo = toFedosBoardId("board-b")!;
    expect(toFedosConversationId(boardId, threadIdOne)).not.toBe(toFedosConversationId(boardIdTwo, threadIdOne));
  });

  it("3. mirrors makeFedosBoardOutboxId's own :: separator convention", () => {
    const boardId = toFedosBoardId("board-a")!;
    const threadId = toFedosThreadId("thread-1")!;
    expect(toFedosConversationId(boardId, threadId)).toBe("board-a::thread-1");
  });

  it("4. structural: no random generation anywhere in this file", () => {
    expect(implementationSource).not.toMatch(/Math\.random|randomUUID|randomBytes/);
  });

  it("5. structural: exactly two exports -- the branded type and its one construction function", () => {
    const exportCount = (implementationSource.match(/^export /gm) ?? []).length;
    expect(exportCount).toBe(2);
    expect(implementationSource).toMatch(/export type FedosConversationId = string & \{ readonly __brand: "FedosConversationId" \}/);
    expect(implementationSource).toMatch(/export function toFedosConversationId/);
  });

  it("6. structural: no protocol-native id vocabulary (Nostr/ActivityPub/AT Protocol/Session) in actual CODE -- the header comment's own prose explaining what is excluded is expected and does not count", () => {
    expect(codeOnlyLines(implementationSource)).not.toMatch(/nostr|activitypub|atproto|session/i);
  });

  it("7. structural: no secret/key vocabulary in actual CODE", () => {
    expect(codeOnlyLines(implementationSource)).not.toMatch(/privateKey|nsec|secret|masterSeed/i);
  });

  it("8. only imports FedosBoardId/FedosThreadId -- no persistence, no network, no protocol adapter", () => {
    expect(implementationSource).toMatch(/import type \{ FedosBoardId, FedosThreadId \} from "\.\.\/board\/fedos_board_identifiers\.js"/);
    expect((implementationSource.match(/^import /gm) ?? []).length).toBe(1);
  });
});
