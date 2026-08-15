/**
 * FedOS Conversation Forward Secrecy Route Selection — Phase 1 acceptance.
 *
 * Behavioural throughout: every test drives the real selection function with
 * real session/registry records. Nothing here asserts on source text.
 *
 * The point of the suite is that EVERY way forward secrecy can fail is named
 * and reachable. A silent legacy send is exactly what this module exists to
 * make impossible, so "no forward secrecy" must always come back with a
 * specific, asserted reason.
 */

import { describe, expect, it } from "vitest";

import {
  describeFedosForwardSecrecyRoute,
  selectFedosDirectConversationForwardSecrecyRoute,
  type FedosForwardSecrecyUnavailableReason,
} from "../src/os/messenger/conversations/ratchet/fedos_direct_conversation_forward_secrecy_route.js";
import type { FedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import type { FedosDeviceBindingAccountRef, FedosDeviceBindingV1 } from "../src/os/messenger/device/fedos_device_binding.js";
import type { FedosDeviceRegistryPersistence } from "../src/os/messenger/device/persistence/fedos_device_registry_persistence.js";
import type { FedosDirectRatchetSessionPersistence } from "../src/os/messenger/conversations/ratchet/persistence/fedos_direct_ratchet_session_persistence.js";
import type { FedosDirectRatchetSessionRecordV1 } from "../src/os/messenger/conversations/ratchet/fedos_direct_ratchet_session_record.js";

const CONVERSATION = "conv-alpha" as FedosConversationId;
const OTHER_CONVERSATION = "conv-beta" as FedosConversationId;
const LOCAL_ACCOUNT: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "local-account-pub", identityId: null };
const REMOTE_ACCOUNT: FedosDeviceBindingAccountRef = { authority: "nostr", publicIdentifier: "remote-account-pub", identityId: null };
const LOCAL_DEVICE = "local-device-1";
const REMOTE_DEVICE = "remote-device-1";

function sessionRecord(overrides: {
  readonly conversationId?: FedosConversationId;
  readonly localDeviceRef?: string;
  readonly localAccountRef?: FedosDeviceBindingAccountRef;
  readonly remoteDeviceRef?: string;
  readonly generation?: number;
  /** Defaults to `"active"` -- the ONLY lifecycle state `FedosDirectRatchetStateRuntime.readiness()`/`updateCounters()` will actually let this Runtime send through (see `fedos_direct_ratchet_session_lifecycle.ts`). Override to a non-`"active"` state to prove such a session is correctly EXCLUDED as a forward-secrecy candidate (bounded truthfulness hardening, Direct Ratchet identity-space audit). */
  readonly lifecycleState?: string;
}): FedosDirectRatchetSessionRecordV1 {
  return {
    binding: {
      localAccountRef: overrides.localAccountRef ?? LOCAL_ACCOUNT,
      localDeviceRef: overrides.localDeviceRef ?? LOCAL_DEVICE,
      remoteAccountRef: REMOTE_ACCOUNT,
      remoteDeviceRef: overrides.remoteDeviceRef ?? REMOTE_DEVICE,
      conversationId: overrides.conversationId ?? CONVERSATION,
      generation: overrides.generation ?? 0,
    },
    lifecycleState: overrides.lifecycleState ?? "active",
  } as unknown as FedosDirectRatchetSessionRecordV1;
}

function sessions(records: readonly FedosDirectRatchetSessionRecordV1[]): FedosDirectRatchetSessionPersistence {
  return {
    putSession: () => "written",
    getSession: () => null,
    listSessions: () => records,
  } as unknown as FedosDirectRatchetSessionPersistence;
}

function binding(trustState: "trusted" | "pending" | "revoked", deviceId = REMOTE_DEVICE): FedosDeviceBindingV1 {
  return { deviceId, accountRef: REMOTE_ACCOUNT, trustState } as unknown as FedosDeviceBindingV1;
}

function registry(bindings: readonly FedosDeviceBindingV1[]): FedosDeviceRegistryPersistence {
  return {
    putEvent: () => "written",
    getBinding: (deviceId: string) => bindings.find((b) => b.deviceId === deviceId) ?? null,
    listBindings: () => bindings,
    listBindingsForAccount: () => bindings,
  } as unknown as FedosDeviceRegistryPersistence;
}

function select(opts: {
  readonly ratchetConfigured?: boolean;
  readonly records?: readonly FedosDirectRatchetSessionRecordV1[];
  readonly bindings?: readonly FedosDeviceBindingV1[];
  readonly conversationId?: FedosConversationId;
}) {
  return selectFedosDirectConversationForwardSecrecyRoute({
    conversationId: opts.conversationId ?? CONVERSATION,
    localAccountRef: LOCAL_ACCOUNT,
    localDeviceRef: LOCAL_DEVICE,
    ratchetConfigured: opts.ratchetConfigured ?? true,
    sessionPersistence: sessions(opts.records ?? []),
    deviceRegistry: registry(opts.bindings ?? [binding("trusted")]),
  });
}

/** Every reason the closed vocabulary declares must be produced by a real scenario below. */
const EXERCISED: FedosForwardSecrecyUnavailableReason[] = [];
function legacyReason(route: ReturnType<typeof select>): FedosForwardSecrecyUnavailableReason {
  expect(route.route).toBe("legacy");
  if (route.route !== "legacy") throw new Error("unreachable");
  EXERCISED.push(route.reason);
  return route.reason;
}

describe("FedOS Conversation Forward Secrecy route selection", () => {
  describe("the forward-secret route is taken only when it genuinely can be", () => {
    it("1. a trusted, established session for THIS conversation selects the Ratchet route", () => {
      const route = select({ records: [sessionRecord({})] });
      expect(route.route).toBe("ratchet");
      if (route.route !== "ratchet") return;
      expect(route.remoteDeviceRef).toBe(REMOTE_DEVICE);
      expect(route.remoteAccountRef).toEqual(REMOTE_ACCOUNT);
      expect(describeFedosForwardSecrecyRoute(route)).toEqual({ forwardSecrecy: true, reason: null });
    });

    it("2. the HIGHEST generation wins, so a session reset supersedes the superseded one", () => {
      const route = select({
        records: [sessionRecord({ generation: 0 }), sessionRecord({ generation: 3 }), sessionRecord({ generation: 1 })],
      });
      expect(route.route).toBe("ratchet");
      if (route.route !== "ratchet") return;
      expect(route.generation).toBe(3);
    });
  });

  describe("every way forward secrecy fails is named, never silent", () => {
    it("3. ratchet-not-configured -- the ORDINARY packaged default, where the Ratchet route is not wired at all", () => {
      expect(legacyReason(select({ ratchetConfigured: false, records: [sessionRecord({})] }))).toBe("ratchet-not-configured");
    });

    it("4. no-session-for-conversation -- the dominant REAL case: no cross-account peer-Device discovery exists to bootstrap a session", () => {
      expect(legacyReason(select({ records: [] }))).toBe("no-session-for-conversation");
    });

    it("5. a session belonging to a DIFFERENT conversation never leaks into this one", () => {
      expect(legacyReason(select({ records: [sessionRecord({ conversationId: OTHER_CONVERSATION })] }))).toBe(
        "no-session-for-conversation",
      );
    });

    it("6. a session belonging to a different LOCAL Device is not usable by this Device", () => {
      expect(legacyReason(select({ records: [sessionRecord({ localDeviceRef: "some-other-local-device" })] }))).toBe(
        "no-session-for-conversation",
      );
    });

    it("7. a session belonging to a different LOCAL ACCOUNT is not usable either", () => {
      const foreign = sessionRecord({ localAccountRef: { authority: "nostr", publicIdentifier: "someone-else", identityId: null } });
      expect(legacyReason(select({ records: [foreign] }))).toBe("no-session-for-conversation");
    });

    it("8. remote-device-unknown -- the session survives but the Device binding is absent from the local registry", () => {
      expect(legacyReason(select({ records: [sessionRecord({})], bindings: [] }))).toBe("remote-device-unknown");
    });

    it("9. remote-device-revoked -- revocation takes effect on the NEXT send, not at the next restart", () => {
      expect(legacyReason(select({ records: [sessionRecord({})], bindings: [binding("revoked")] }))).toBe(
        "remote-device-revoked",
      );
    });

    it("10. remote-device-not-trusted -- a merely pending binding never silently carries a real message", () => {
      expect(legacyReason(select({ records: [sessionRecord({})], bindings: [binding("pending")] }))).toBe(
        "remote-device-not-trusted",
      );
    });

    it("11. ambiguous-remote-device -- two distinct peer Devices at the same generation fail CLOSED rather than guess", () => {
      const route = select({
        records: [
          sessionRecord({ generation: 2, remoteDeviceRef: "remote-device-A" }),
          sessionRecord({ generation: 2, remoteDeviceRef: "remote-device-B" }),
        ],
        bindings: [binding("trusted", "remote-device-A"), binding("trusted", "remote-device-B")],
      });
      expect(legacyReason(route)).toBe("ambiguous-remote-device");
    });

    it("12. ambiguity at a SUPERSEDED generation does not block a unique current one", () => {
      const route = select({
        records: [
          sessionRecord({ generation: 1, remoteDeviceRef: "remote-device-A" }),
          sessionRecord({ generation: 1, remoteDeviceRef: "remote-device-B" }),
          sessionRecord({ generation: 5, remoteDeviceRef: REMOTE_DEVICE }),
        ],
      });
      expect(route.route).toBe("ratchet");
      if (route.route !== "ratchet") return;
      expect(route.remoteDeviceRef).toBe(REMOTE_DEVICE);
    });

    // Bounded truthfulness hardening (Direct Ratchet identity-space audit) --
    // a session record that exists but is not in the ONE lifecycle state this
    // Runtime will actually send through (`"active"` -- see
    // `fedos_direct_ratchet_session_lifecycle.ts` and
    // `FedosDirectRatchetStateRuntime.readiness()`/`updateCounters()`) must
    // never be reported as conferring forward secrecy, even though the
    // underlying remote Device binding itself is still trusted. Before this
    // fix, `selectFedosDirectConversationForwardSecrecyRoute()` never
    // inspected `lifecycleState` at all.
    it("17. revoked -- a REVOKED session record never counts, even with a still-trusted Device binding", () => {
      expect(legacyReason(select({ records: [sessionRecord({ lifecycleState: "revoked" })] }))).toBe(
        "no-session-for-conversation",
      );
    });

    it("18. reset-required -- a session flagged for reset never counts either", () => {
      expect(legacyReason(select({ records: [sessionRecord({ lifecycleState: "reset-required" })] }))).toBe(
        "no-session-for-conversation",
      );
    });

    it("19. corrupt/expired -- neither counts; a genuinely usable HIGHER generation still wins over them", () => {
      const route = select({
        records: [
          sessionRecord({ generation: 4, lifecycleState: "corrupt" }),
          sessionRecord({ generation: 3, lifecycleState: "expired" }),
          sessionRecord({ generation: 1, lifecycleState: "active" }),
        ],
      });
      expect(route.route).toBe("ratchet");
      if (route.route !== "ratchet") return;
      expect(route.generation).toBe(1);
    });

    it("20. initialized -- a receiver-role session that has not yet completed its first live DH step also never counts (this module has no access to the live cryptographic isReadyToSend() check; 'initialized' is conservatively treated the same as 'not usable', never optimistically as 'usable')", () => {
      expect(legacyReason(select({ records: [sessionRecord({ lifecycleState: "initialized" })] }))).toBe(
        "no-session-for-conversation",
      );
    });
  });

  describe("the honesty guarantees this module exists to provide", () => {
    it("13. a legacy decision ALWAYS carries a specific reason -- 'no forward secrecy' is never a bare boolean", () => {
      const route = select({ records: [] });
      const described = describeFedosForwardSecrecyRoute(route);
      expect(described.forwardSecrecy).toBe(false);
      expect(described.reason).not.toBeNull();
      expect(typeof described.reason).toBe("string");
    });

    it("14. the description carries no Device id, account id, or key material -- safe to log and to surface in the UI", () => {
      const ratchet = select({ records: [sessionRecord({})] });
      const serialized = JSON.stringify(describeFedosForwardSecrecyRoute(ratchet));
      expect(serialized).not.toContain(REMOTE_DEVICE);
      expect(serialized).not.toContain(LOCAL_DEVICE);
      expect(serialized).not.toContain(REMOTE_ACCOUNT.publicIdentifier);
      expect(serialized).not.toContain(LOCAL_ACCOUNT.publicIdentifier);
    });

    it("15. selection is PURE -- repeated calls on identical inputs give an identical answer and mutate nothing", () => {
      const records = [sessionRecord({ generation: 2 })];
      const first = select({ records });
      const second = select({ records });
      expect(second).toEqual(first);
      expect(records).toHaveLength(1);
      expect(records[0]!.binding.generation).toBe(2);
    });

    it("16. every reason in the closed vocabulary was genuinely exercised by the tests above -- none is aspirational", () => {
      const declared: FedosForwardSecrecyUnavailableReason[] = [
        "ratchet-not-configured",
        "no-session-for-conversation",
        "remote-device-unknown",
        "remote-device-revoked",
        "remote-device-not-trusted",
        "ambiguous-remote-device",
      ];
      for (const reason of declared) {
        expect(EXERCISED, `reason "${reason}" is declared but never produced by a real scenario`).toContain(reason);
      }
    });
  });
});
