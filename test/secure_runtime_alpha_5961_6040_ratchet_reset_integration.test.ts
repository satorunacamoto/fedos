import { describe, expect, it } from "vitest";
import {
  planFedosIdentityTransitionAffectedSessions,
  authorizeFedosIdentityTransitionRatchetReset,
} from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_authorization.js";
import { InMemoryFedosIdentityTransitionRatchetResetLinkPersistence } from "../src/os/messenger/conversations/identity_transition/peer_integration/fedos_identity_transition_ratchet_reset_link.js";
import type { FedosDirectRatchetSessionRecordV1 } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_record.js";
import type { FedosDeviceBindingAccountRef } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";

const OLD_ACCOUNT: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "a".repeat(64), identityId: null };
const OTHER_ACCOUNT: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "c".repeat(64), identityId: null };
const LOCAL_ACCOUNT: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "b".repeat(64), identityId: null };

function session(overrides: Partial<FedosDirectRatchetSessionRecordV1["binding"]> & { lifecycleState?: FedosDirectRatchetSessionRecordV1["lifecycleState"] } = {}): FedosDirectRatchetSessionRecordV1 {
  return {
    schemaVersion: 1,
    revision: 0,
    binding: {
      sessionId: "session-1" as any,
      localAccountRef: LOCAL_ACCOUNT,
      localDeviceRef: "bob-device-1",
      remoteAccountRef: OLD_ACCOUNT,
      remoteDeviceRef: "alice-old-desktop",
      conversationId: "conversation-1" as unknown as FedosConversationId,
      suite: "fedos-direct-ratchet-v1" as any,
      generation: 0,
      ...overrides,
    },
    lifecycleState: overrides.lifecycleState ?? "active",
    counters: { sendCounter: 0, receiveCounter: 0 } as any,
    createdAt: 0,
    lastActivityAt: 0,
    skippedKeyReferences: [],
    sealedSecretRecordIds: [],
  };
}

describe("Phase I — planFedosIdentityTransitionAffectedSessions (pure, read-only)", () => {
  it("identifies a live session whose remote party is the old identity", () => {
    const sessions = [session()];
    const affected = planFedosIdentityTransitionAffectedSessions(OLD_ACCOUNT, sessions);
    expect(affected).toHaveLength(1);
    expect(affected[0]?.remoteAccountRef).toEqual(OLD_ACCOUNT);
  });

  it("ignores a session whose remote party is a DIFFERENT account", () => {
    const sessions = [session({ remoteAccountRef: OTHER_ACCOUNT })];
    expect(planFedosIdentityTransitionAffectedSessions(OLD_ACCOUNT, sessions)).toHaveLength(0);
  });

  it("ignores a session already reset-required/revoked/expired/corrupt/unavailable", () => {
    for (const lifecycleState of ["reset-required", "revoked", "expired", "corrupt", "unavailable"] as const) {
      const sessions = [session({ lifecycleState })];
      expect(planFedosIdentityTransitionAffectedSessions(OLD_ACCOUNT, sessions)).toHaveLength(0);
    }
  });

  it("still includes initialized/suspended sessions (not just active)", () => {
    for (const lifecycleState of ["initialized", "active", "suspended"] as const) {
      const sessions = [session({ lifecycleState })];
      expect(planFedosIdentityTransitionAffectedSessions(OLD_ACCOUNT, sessions)).toHaveLength(1);
    }
  });
});

describe("Phase J — authorizeFedosIdentityTransitionRatchetReset", () => {
  it("refuses outright unless acceptanceState is exactly 'accepted'", async () => {
    const result = await authorizeFedosIdentityTransitionRatchetReset({
      transitionId: "fedos-identity-transition-" + "0".repeat(32),
      acceptanceState: "corroborated",
      affectedSessions: [],
      outboundIntegration: { establishSession: async () => ({ outcome: "initiated", sessionId: "s" as any, queue: {} as any }) },
      resetLinkPersistence: new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence(),
      now: () => 1_000,
    });
    expect(result.outcome).toBe("not-accepted");
  });

  it("dispatches a real establishSession() call with reason 'identity-transition' for each affected session, and records a durable correlation link", async () => {
    const affected = planFedosIdentityTransitionAffectedSessions(OLD_ACCOUNT, [session()]);
    const calls: unknown[] = [];
    const linkPersistence = new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence();
    const result = await authorizeFedosIdentityTransitionRatchetReset({
      transitionId: "fedos-identity-transition-" + "1".repeat(32),
      acceptanceState: "accepted",
      affectedSessions: affected,
      outboundIntegration: {
        establishSession: async (conversationId, remoteDeviceRef, options) => {
          calls.push({ conversationId, remoteDeviceRef, options });
          return { outcome: "initiated", sessionId: "new-session-1" as any, queue: {} as any };
        },
      },
      resetLinkPersistence: linkPersistence,
      now: () => 5_000,
    });
    expect(result.outcome).toBe("applied");
    if (result.outcome !== "applied") throw new Error("unreachable");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.outcome).toBe("reset-dispatched");
    expect(calls).toHaveLength(1);
    expect((calls[0] as any).options.reason).toBe("identity-transition");

    const links = linkPersistence.listLinksForTransition("fedos-identity-transition-" + "1".repeat(32));
    expect(links).toHaveLength(1);
    expect(links[0]?.sessionId).toBe("new-session-1");
  });

  it("records 'reset-not-applicable' (not an error) when establishSession refuses (e.g. already-active without a real generation bump)", async () => {
    const affected = planFedosIdentityTransitionAffectedSessions(OLD_ACCOUNT, [session()]);
    const result = await authorizeFedosIdentityTransitionRatchetReset({
      transitionId: "fedos-identity-transition-" + "2".repeat(32),
      acceptanceState: "accepted",
      affectedSessions: affected,
      outboundIntegration: { establishSession: async () => ({ outcome: "local-device-revoked" }) },
      resetLinkPersistence: new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence(),
      now: () => 1_000,
    });
    expect(result.outcome).toBe("applied");
    if (result.outcome !== "applied") throw new Error("unreachable");
    expect(result.results[0]?.outcome).toBe("reset-not-applicable");
  });

  it("never invents a second reset message type — every dispatched reset goes through the SAME establishSession() the caller supplies", async () => {
    const affected = planFedosIdentityTransitionAffectedSessions(OLD_ACCOUNT, [session(), session({ remoteDeviceRef: "alice-old-tablet", sessionId: "session-2" as any })]);
    let callCount = 0;
    await authorizeFedosIdentityTransitionRatchetReset({
      transitionId: "fedos-identity-transition-" + "3".repeat(32),
      acceptanceState: "accepted",
      affectedSessions: affected,
      outboundIntegration: {
        establishSession: async () => {
          callCount += 1;
          return { outcome: "initiated", sessionId: `session-${callCount}` as any, queue: {} as any };
        },
      },
      resetLinkPersistence: new InMemoryFedosIdentityTransitionRatchetResetLinkPersistence(),
      now: () => 1_000,
    });
    expect(callCount).toBe(2);
  });
});
