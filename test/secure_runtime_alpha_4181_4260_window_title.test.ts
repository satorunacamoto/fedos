/**
 * Secure Runtime Alpha 4181-4260 — Phase B: Window Title Generation —
 * pure unit tests over literal `FedosConversationDetailView` fixtures. No
 * Shell/Runtime of any kind.
 */
import { describe, it, expect } from "vitest";
import { fedosConversationTitle, fedosDesktopConversationWindowTitle } from "../src/desktop/navigation/fedos_desktop_conversation_window_title.js";
import { fedosNavigationEmpty, fedosNavigationOpen, fedosNavigationOpenFailed, fedosNavigationOpening } from "../src/desktop/navigation/fedos_desktop_conversation_navigation_state.js";
import type { FedosConversationDetailView } from "../src/desktop/shell/fedos_desktop_shell_view_models.js";
import type { FedosConversationParticipantReference } from "../src/conversation/membership/fedos_conversation_participant_reference.js";
import type { FedosConversationMembership } from "../src/conversation/membership/fedos_conversation_membership.js";

const ALICE: FedosConversationParticipantReference = { authority: "fedos", publicIdentifier: "alice-local", identityId: null };
const BOB: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "bob-pubkey", identityId: null };
const CAROL: FedosConversationParticipantReference = { authority: "nostr", publicIdentifier: "carol-pubkey", identityId: null };

function membership(participant: FedosConversationParticipantReference, state: FedosConversationMembership["state"] = "active"): FedosConversationMembership {
  return { id: `m-${participant.publicIdentifier}` as never, conversationId: "c1" as never, participant, role: "member", state, joinedAt: 1, endedAt: null };
}

function detail(mode: "direct" | "private-group", memberships: readonly FedosConversationMembership[]): FedosConversationDetailView {
  return {
    conversationId: "c1" as never,
    mode,
    lifecycleState: "active" as never,
    activationStatus: "activation-ready",
    participantCount: memberships.filter((m) => m.state === "active").length,
    createdAt: 1,
    constructionStatus: null,
    creator: ALICE,
    readiness: { axes: [], overall: "activation-ready" },
    memberships,
  };
}

describe("Alpha 4181-4260 -- Window Title: Direct conversation", () => {
  it("uses the OTHER active participant's publicIdentifier, never the viewer's own", () => {
    const d = detail("direct", [membership(ALICE), membership(BOB)]);
    expect(fedosConversationTitle(d, ALICE)).toBe("bob-pubkey");
    expect(fedosConversationTitle(d, BOB)).toBe("alice-local");
  });

  it("ignores a non-active (left/revoked) counterparty", () => {
    const d = detail("direct", [membership(ALICE), membership(BOB, "left")]);
    expect(fedosConversationTitle(d, ALICE)).toBeNull();
  });
});

describe("Alpha 4181-4260 -- Window Title: Group conversation", () => {
  it("uses an active participant count, correctly pluralized", () => {
    const three = detail("private-group", [membership(ALICE), membership(BOB), membership(CAROL)]);
    expect(fedosConversationTitle(three, ALICE)).toBe("Group (3 members)");
    const one = detail("private-group", [membership(ALICE)]);
    expect(fedosConversationTitle(one, ALICE)).toBe("Group (1 member)");
  });
});

describe("Alpha 4181-4260 -- Window Title: full window title by navigation state", () => {
  const d = detail("direct", [membership(ALICE), membership(BOB)]);

  it("empty/opening/open-failed never need a detail view", () => {
    expect(fedosDesktopConversationWindowTitle(fedosNavigationEmpty(), null, ALICE)).toBe("FedOS");
    expect(fedosDesktopConversationWindowTitle(fedosNavigationOpening("c1"), null, ALICE)).toBe("Opening… — FedOS");
    expect(fedosDesktopConversationWindowTitle(fedosNavigationOpenFailed("c1", "not-found", "unknown"), null, ALICE)).toBe("Unavailable — FedOS");
  });

  it("open with a loaded detail composes the conversation title", () => {
    expect(fedosDesktopConversationWindowTitle(fedosNavigationOpen("c1"), d, ALICE)).toBe("bob-pubkey — FedOS");
  });

  it("open without a detail (should not normally happen) falls back to the app title alone", () => {
    expect(fedosDesktopConversationWindowTitle(fedosNavigationOpen("c1"), null, ALICE)).toBe("FedOS");
  });
});
