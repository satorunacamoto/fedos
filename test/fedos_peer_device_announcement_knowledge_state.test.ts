import { describe, it, expect } from "vitest";
import { computeFedosPeerDeviceKnowledgeState } from "../src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_knowledge_state.js";
import type { FedosPeerDeviceAnnouncementObservationV1 } from "../src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_observation.js";
import type { FedosPeerDeviceAnnouncementAcceptanceOutcome } from "../src/os/messenger/conversations/peer_device/fedos_peer_device_announcement_acceptance_outcome.js";

/**
 * Direct Ratchet P1 arc -- pure-function coverage for the TOFU knowledge-
 * state derivation consumed by `fedos_conversation_security_state.ts`'s
 * Axis 4 (see `fedos_conversation_security_state.test.ts`'s own
 * "TOFU knowledge-state reasonCode" describe block for the axis-level
 * assertions this feeds).
 */

const ACCOUNT_REF = { authority: "nostr" as const, publicIdentifier: "peer-pubkey-a", identityId: null };

function observation(overrides: Partial<FedosPeerDeviceAnnouncementObservationV1> & { readonly observedAt: number; readonly acceptanceOutcome: FedosPeerDeviceAnnouncementAcceptanceOutcome }): FedosPeerDeviceAnnouncementObservationV1 {
  return {
    schemaVersion: 1,
    localDeviceRef: "local-device-ref",
    peerAccountRef: ACCOUNT_REF,
    deviceId: "a".repeat(32),
    devicePublicKeyHex: "b".repeat(64),
    sourceId: `nonce-${overrides.observedAt}`,
    epoch: 0,
    evidenceLevel: "account-and-device-authenticated",
    supersedesAnnouncementId: null,
    claimedRoutes: [],
    ...overrides,
  };
}

const TRUSTED_BINDING = { trustState: "trusted" as const };

describe("computeFedosPeerDeviceKnowledgeState", () => {
  it("no Registry binding at all -- UNKNOWN, regardless of observation history", () => {
    const state = computeFedosPeerDeviceKnowledgeState([observation({ observedAt: 1, acceptanceOutcome: "accepted-new-device" })], null);
    expect(state).toBe("unknown");
  });

  it("a binding exists but zero accepted observations were ever recorded -- UNKNOWN", () => {
    const state = computeFedosPeerDeviceKnowledgeState([observation({ observedAt: 1, acceptanceOutcome: "malformed" })], TRUSTED_BINDING);
    expect(state).toBe("unknown");
  });

  it("exactly one accepted observation -- FIRST_SEEN", () => {
    const state = computeFedosPeerDeviceKnowledgeState([observation({ observedAt: 1, acceptanceOutcome: "accepted-new-device" })], TRUSTED_BINDING);
    expect(state).toBe("first-seen");
  });

  it("two accepted observations over time (real re-announcement at a higher epoch) -- CONTINUITY_ESTABLISHED", () => {
    const state = computeFedosPeerDeviceKnowledgeState(
      [
        observation({ observedAt: 1, epoch: 0, acceptanceOutcome: "accepted-new-device" }),
        observation({ observedAt: 2, epoch: 1, acceptanceOutcome: "accepted-superseding" }),
      ],
      TRUSTED_BINDING,
    );
    expect(state).toBe("continuity-established");
  });

  it("an idempotent replay (duplicate) of the same accepted announcement also counts toward continuity", () => {
    const state = computeFedosPeerDeviceKnowledgeState(
      [
        observation({ observedAt: 1, acceptanceOutcome: "accepted-new-device" }),
        observation({ observedAt: 2, acceptanceOutcome: "duplicate" }),
      ],
      TRUSTED_BINDING,
    );
    expect(state).toBe("continuity-established");
  });

  it("the MOST RECENT observation is a rejected conflicting re-key -- CONFLICTING_REJECTED, even though an earlier accepted observation exists (the prior binding still stands, but the conflict is a real fact worth surfacing)", () => {
    const state = computeFedosPeerDeviceKnowledgeState(
      [
        observation({ observedAt: 1, acceptanceOutcome: "accepted-new-device" }),
        observation({ observedAt: 2, acceptanceOutcome: "conflicting" }),
      ],
      TRUSTED_BINDING,
    );
    expect(state).toBe("conflicting-rejected");
  });

  it("the MOST RECENT observation is stale (an old/replayed epoch) -- STALE, even though an earlier accepted observation exists", () => {
    const state = computeFedosPeerDeviceKnowledgeState(
      [
        observation({ observedAt: 1, epoch: 5, acceptanceOutcome: "accepted-new-device" }),
        observation({ observedAt: 2, epoch: 1, acceptanceOutcome: "stale" }),
      ],
      TRUSTED_BINDING,
    );
    expect(state).toBe("stale");
  });

  it("noise (malformed/wrong-recipient/bad-signature) observed AFTER a real accepted one does not override the real knowledge state -- garbage is not a meaningful 'most recent' fact", () => {
    const state = computeFedosPeerDeviceKnowledgeState(
      [
        observation({ observedAt: 1, acceptanceOutcome: "accepted-new-device" }),
        observation({ observedAt: 2, acceptanceOutcome: "bad-device-signature" }),
        observation({ observedAt: 3, acceptanceOutcome: "wrong-recipient" }),
      ],
      TRUSTED_BINDING,
    );
    expect(state).toBe("first-seen");
  });

  it("a resolved conflict (a later accepted re-announcement after an earlier conflicting one) reads CONTINUITY_ESTABLISHED, not stuck on the old conflict -- the most recent meaningful fact wins", () => {
    const state = computeFedosPeerDeviceKnowledgeState(
      [
        observation({ observedAt: 1, acceptanceOutcome: "accepted-new-device" }),
        observation({ observedAt: 2, acceptanceOutcome: "conflicting" }),
        observation({ observedAt: 3, acceptanceOutcome: "accepted-superseding" }),
      ],
      TRUSTED_BINDING,
    );
    expect(state).toBe("continuity-established");
  });
});
