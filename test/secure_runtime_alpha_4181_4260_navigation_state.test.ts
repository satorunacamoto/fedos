/**
 * Secure Runtime Alpha 4181-4260 ("Desktop Conversation Window and
 * Navigation Arc") — Phase C: Navigation State — pure unit tests. No I/O,
 * no Shell/Runtime of any kind (this file's own subject has none).
 */
import { describe, it, expect } from "vitest";
import {
  fedosNavigationEmpty,
  fedosNavigationOpen,
  fedosNavigationOpenFailed,
  fedosNavigationOpening,
  fedosNavigationStateConversationId,
} from "../src/desktop/navigation/fedos_desktop_conversation_navigation_state.js";

describe("Alpha 4181-4260 -- Navigation State: closed vocabulary", () => {
  it("empty carries no conversation id", () => {
    const state = fedosNavigationEmpty();
    expect(state).toEqual({ kind: "empty" });
    expect(fedosNavigationStateConversationId(state)).toBeNull();
  });

  it("opening/open/open-failed all carry the same conversation id", () => {
    expect(fedosNavigationStateConversationId(fedosNavigationOpening("c1"))).toBe("c1");
    expect(fedosNavigationStateConversationId(fedosNavigationOpen("c1"))).toBe("c1");
    expect(fedosNavigationStateConversationId(fedosNavigationOpenFailed("c1", "not-found", "unknown conversation"))).toBe("c1");
  });

  it("open-failed preserves outcome/reason verbatim", () => {
    const state = fedosNavigationOpenFailed("c1", "unavailable", "shell is not running");
    expect(state).toEqual({ kind: "open-failed", conversationId: "c1", outcome: "unavailable", reason: "shell is not running" });
  });

  it("every constructor freezes its result", () => {
    expect(Object.isFrozen(fedosNavigationEmpty())).toBe(true);
    expect(Object.isFrozen(fedosNavigationOpening("c1"))).toBe(true);
    expect(Object.isFrozen(fedosNavigationOpen("c1"))).toBe(true);
    expect(Object.isFrozen(fedosNavigationOpenFailed("c1", "failed", "x"))).toBe(true);
  });
});
