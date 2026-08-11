import { describe, it, expect } from "vitest";
import { StaticFedosConversationPolicyAuthority } from "../src/os/messenger/board/runtime/policy/fedos_conversation_policy_authority.js";
import { FEDOS_CONVERSATION_POLICY_PUBLIC_V1 } from "../src/os/messenger/board/runtime/policy/fedos_conversation_policy.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";

/**
 * Secure Runtime Alpha 656 ("Conversation Policy Authority") — Stage 6
 * of the Alpha 641-680 Arc.
 */
describe("Secure Runtime Alpha 656 -- Conversation Policy Authority", () => {
  it("1. resolves the fixed public V1 policy for any boardId/threadId input", async () => {
    const authority = new StaticFedosConversationPolicyAuthority();
    const boardId = toFedosBoardId("board-a")!;
    const resolution = await authority.resolvePolicy({ boardId, threadId: null });
    expect(resolution).toEqual({ outcome: "resolved", policy: FEDOS_CONVERSATION_POLICY_PUBLIC_V1 });
  });

  it("2. resolution is identical regardless of threadId being supplied", async () => {
    const authority = new StaticFedosConversationPolicyAuthority();
    const boardId = toFedosBoardId("board-a")!;
    const threadId = toFedosThreadId("thread-1")!;
    const withThread = await authority.resolvePolicy({ boardId, threadId });
    const withoutThread = await authority.resolvePolicy({ boardId, threadId: null });
    expect(withThread).toEqual(withoutThread);
  });

  it("3. resolution is identical across different boards -- no per-board persistence exists in V1", async () => {
    const authority = new StaticFedosConversationPolicyAuthority();
    const a = await authority.resolvePolicy({ boardId: toFedosBoardId("board-a")!, threadId: null });
    const b = await authority.resolvePolicy({ boardId: toFedosBoardId("board-b")!, threadId: null });
    expect(a).toEqual(b);
  });
});
