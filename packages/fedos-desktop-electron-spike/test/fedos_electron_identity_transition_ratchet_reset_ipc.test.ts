import { describe, expect, it, vi } from "vitest";
import {
  createFedosIdentityTransitionAssessContinuityHandler,
  createFedosIdentityTransitionAuthorizeRatchetResetHandler,
  resolveFedosIdentityTransitionAffectedPairs,
  validateFedosIdentityTransitionSelectorPayload,
  type FedosIdentityTransitionRatchetResetBoundaryLike,
  type FedosIdentityTransitionRatchetResetDeps,
  type FedosRatchetResetAccountRefLike,
} from "../src/fedos_electron_identity_transition_ratchet_reset_ipc.js";

/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent I) — the new test for the (currently dormant) two-step Ratchet
 * reset confirm flow, as required alongside reuse of
 * `test/secure_runtime_alpha_5961_6040_ratchet_reset_integration.test.ts`
 * (domain-level coverage, unchanged, still passing — see this arc's own
 * final report). This file proves the IPC-boundary sequencing: assess
 * (read-only) -> confirm content -> authorize (refuses unless the caller's
 * own prior assess step actually reported `canAuthorize`), plus the pure
 * pairs-resolution helper.
 */

const OLD_IDENTITY: FedosRatchetResetAccountRefLike = { authority: "nostr", publicIdentifier: "alice-old", identityId: null };
const OTHER_IDENTITY: FedosRatchetResetAccountRefLike = { authority: "nostr", publicIdentifier: "carol", identityId: null };
const VIEWER: FedosRatchetResetAccountRefLike = { authority: "nostr", publicIdentifier: "bob-viewer", identityId: null };

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

describe("resolveFedosIdentityTransitionAffectedPairs — pure resolution", () => {
  it("includes only conversations whose membership contains the OLD identity", () => {
    const pairs = resolveFedosIdentityTransitionAffectedPairs(OLD_IDENTITY, "alice-device-1", [
      { conversationId: "conv-with-alice", memberships: [{ participant: OLD_IDENTITY }, { participant: VIEWER }] },
      { conversationId: "conv-without-alice", memberships: [{ participant: OTHER_IDENTITY }, { participant: VIEWER }] },
    ]);
    expect(pairs).toEqual([{ conversationId: "conv-with-alice", remoteDeviceRef: "alice-device-1" }]);
  });

  it("returns an empty list when no conversation's membership contains the old identity", () => {
    expect(resolveFedosIdentityTransitionAffectedPairs(OLD_IDENTITY, "d1", [{ conversationId: "c1", memberships: [{ participant: OTHER_IDENTITY }] }])).toEqual([]);
  });

  it("every pair uses the SAME peerDeviceRef (one device, account identity changes, never a device swap)", () => {
    const pairs = resolveFedosIdentityTransitionAffectedPairs(OLD_IDENTITY, "shared-device", [
      { conversationId: "c1", memberships: [{ participant: OLD_IDENTITY }] },
      { conversationId: "c2", memberships: [{ participant: OLD_IDENTITY }] },
    ]);
    expect(pairs.every((p) => p.remoteDeviceRef === "shared-device")).toBe(true);
    expect(pairs.map((p) => p.conversationId).sort()).toEqual(["c1", "c2"]);
  });
});

describe("validateFedosIdentityTransitionSelectorPayload", () => {
  it("accepts a well-formed exact-id triple", () => {
    const result = validateFedosIdentityTransitionSelectorPayload({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "d1", transitionId: "t1" }, isBoundedString, 256);
    expect(result).toEqual({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "d1", transitionId: "t1" });
  });

  it("rejects a missing/malformed peerAccountRef, peerDeviceRef, or transitionId", () => {
    expect(validateFedosIdentityTransitionSelectorPayload({ peerDeviceRef: "d1", transitionId: "t1" }, isBoundedString, 256)).toBeNull();
    expect(validateFedosIdentityTransitionSelectorPayload({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "", transitionId: "t1" }, isBoundedString, 256)).toBeNull();
    expect(validateFedosIdentityTransitionSelectorPayload(null, isBoundedString, 256)).toBeNull();
  });
});

function makeDeps(overrides: {
  readonly boundary?: FedosIdentityTransitionRatchetResetBoundaryLike | null;
  readonly resolveAffectedSessions?: FedosIdentityTransitionRatchetResetDeps["resolveAffectedSessions"];
}) {
  const acceptanceGateRejection = vi.fn(() => ({ outcome: "unavailable" as const, reason: "acceptance-only" }));
  const resultFromViewModelState = vi.fn((state: unknown) => {
    const s = state as { readonly status: string; readonly data?: unknown };
    return s.status === "loaded" ? { outcome: "ok" as const, value: s.data } : { outcome: "error" as const, reason: s.status };
  });
  const deps: FedosIdentityTransitionRatchetResetDeps = {
    requireBoundary: () => overrides.boundary ?? null,
    isBoundedString,
    resultFromViewModelState,
    acceptanceGateRejection,
    maxIdLength: 256,
    resolveAffectedSessions: overrides.resolveAffectedSessions ?? (async () => []),
  };
  return { deps, acceptanceGateRejection, resultFromViewModelState };
}

/** A minimal, mutable fake Boundary mirroring the real Controller's own state-machine shape closely enough to exercise the full assess -> confirm -> authorize sequence. */
function fakeBoundary(options: {
  readonly conversations: readonly { readonly conversationId: string; readonly memberships: readonly { readonly participant: FedosRatchetResetAccountRefLike }[] }[];
  readonly oldAccountIdentity: FedosRatchetResetAccountRefLike;
  readonly acceptanceState?: string;
}) {
  const membershipByConversation = new Map(options.conversations.map((c) => [c.conversationId, c.memberships]));
  let currentMembershipConversationId: string | null = null;
  let ratchetResetConfirmationState: { readonly status: string; readonly data?: unknown } = { status: "idle" };
  const authorizeRatchetReset = vi.fn(async () => undefined);
  const assessContinuity = vi.fn(async (pairs: readonly { readonly conversationId: string; readonly remoteDeviceRef: string }[]) => {
    const sessions = pairs.map((p) => ({ conversationId: p.conversationId, remoteDeviceRef: p.remoteDeviceRef, currentStatus: "active", resetRecommended: true }));
    ratchetResetConfirmationState = {
      status: "loaded",
      data: { transitionId: "t1", acceptanceState: options.acceptanceState ?? "accepted", canAuthorize: (options.acceptanceState ?? "accepted") === "accepted", sessions },
    };
  });

  const boundary: FedosIdentityTransitionRatchetResetBoundaryLike = {
    conversationList: {
      load: vi.fn(async () => undefined),
      state: { status: "loaded", data: options.conversations.map((c) => ({ conversationId: c.conversationId })) },
    },
    membership: {
      load: vi.fn(async (conversationId: string) => {
        currentMembershipConversationId = conversationId;
      }),
      get state() {
        const memberships = currentMembershipConversationId === null ? undefined : membershipByConversation.get(currentMembershipConversationId);
        return memberships === undefined ? { status: "error" as const } : { status: "loaded" as const, data: { memberships } };
      },
    },
    identityTransitions: {
      detailState: { status: "loaded", data: { oldAccountIdentity: options.oldAccountIdentity } },
      assessContinuity,
      get ratchetResetConfirmationState() {
        return ratchetResetConfirmationState;
      },
      authorizeRatchetReset,
    },
  };
  return { boundary, assessContinuity, authorizeRatchetReset };
}

describe("assess-continuity handler", () => {
  it("returns the acceptance-gate rejection when no profile is unlocked", async () => {
    const { deps, acceptanceGateRejection } = makeDeps({});
    const handler = createFedosIdentityTransitionAssessContinuityHandler(deps);
    await handler({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "d1", transitionId: "t1" });
    expect(acceptanceGateRejection).toHaveBeenCalledTimes(1);
  });

  it("requires the transition to already be open (detailState loaded) before assessing", async () => {
    const { boundary } = fakeBoundary({ conversations: [], oldAccountIdentity: OLD_IDENTITY });
    (boundary.identityTransitions as { detailState: unknown }).detailState = { status: "idle" };
    const { deps } = makeDeps({ boundary });
    const handler = createFedosIdentityTransitionAssessContinuityHandler(deps);
    const result = await handler({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "d1", transitionId: "t1" });
    expect(result).toMatchObject({ outcome: "not-found" });
  });

  it("derives pairs from every conversation containing the OLD identity, calls assessContinuity, and returns the confirmation content", async () => {
    const { boundary, assessContinuity } = fakeBoundary({
      conversations: [
        { conversationId: "c1", memberships: [{ participant: OLD_IDENTITY }, { participant: VIEWER }] },
        { conversationId: "c2", memberships: [{ participant: OTHER_IDENTITY }, { participant: VIEWER }] },
      ],
      oldAccountIdentity: OLD_IDENTITY,
    });
    const { deps } = makeDeps({ boundary });
    const handler = createFedosIdentityTransitionAssessContinuityHandler(deps);

    const result = await handler({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "alice-device-1", transitionId: "t1" });

    expect(assessContinuity).toHaveBeenCalledWith([{ conversationId: "c1", remoteDeviceRef: "alice-device-1" }]);
    expect(result).toMatchObject({ outcome: "ok", value: { canAuthorize: true, sessions: [{ conversationId: "c1", remoteDeviceRef: "alice-device-1" }] } });
  });
});

describe("authorize-ratchet-reset handler — the two-step confirm sequence", () => {
  it("refuses (never calls authorizeRatchetReset) if assess-continuity was never called first", async () => {
    const { boundary, authorizeRatchetReset } = fakeBoundary({ conversations: [], oldAccountIdentity: OLD_IDENTITY });
    const { deps } = makeDeps({ boundary });
    const handler = createFedosIdentityTransitionAuthorizeRatchetResetHandler(deps);
    const result = await handler({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "d1", transitionId: "t1" });
    expect(result).toMatchObject({ outcome: "not-found" });
    expect(authorizeRatchetReset).not.toHaveBeenCalled();
  });

  it("refuses when the prior assess step reported canAuthorize:false (transition not yet accepted) -- the real security boundary the Controller/Runtime itself also enforces", async () => {
    const { boundary, assessContinuity, authorizeRatchetReset } = fakeBoundary({
      conversations: [{ conversationId: "c1", memberships: [{ participant: OLD_IDENTITY }] }],
      oldAccountIdentity: OLD_IDENTITY,
      acceptanceState: "corroborated",
    });
    const { deps } = makeDeps({ boundary });
    const assessHandler = createFedosIdentityTransitionAssessContinuityHandler(deps);
    await assessHandler({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "d1", transitionId: "t1" });
    expect(assessContinuity).toHaveBeenCalled();

    const authorizeHandler = createFedosIdentityTransitionAuthorizeRatchetResetHandler(deps);
    const result = await authorizeHandler({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "d1", transitionId: "t1" });
    expect(result).toMatchObject({ outcome: "conflict" });
    expect(authorizeRatchetReset).not.toHaveBeenCalled();
  });

  it("the FULL real sequence: assess (canAuthorize:true) then authorize actually dispatches authorizeRatchetReset with sessions resolved via the injected resolver", async () => {
    const { boundary, authorizeRatchetReset } = fakeBoundary({
      conversations: [{ conversationId: "c1", memberships: [{ participant: OLD_IDENTITY }] }],
      oldAccountIdentity: OLD_IDENTITY,
      acceptanceState: "accepted",
    });
    const resolveAffectedSessions = vi.fn(async (oldAccountIdentity: FedosRatchetResetAccountRefLike, pairs: readonly { readonly conversationId: string; readonly remoteDeviceRef: string }[]) =>
      pairs.map((p, i) => ({ sessionId: `session-${i}`, conversationId: p.conversationId, remoteAccountRef: oldAccountIdentity, remoteDeviceRef: p.remoteDeviceRef })),
    );
    const { deps } = makeDeps({ boundary, resolveAffectedSessions });

    const assessHandler = createFedosIdentityTransitionAssessContinuityHandler(deps);
    const assessResult = await assessHandler({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "d1", transitionId: "t1" });
    expect(assessResult).toMatchObject({ outcome: "ok", value: { canAuthorize: true } });

    const authorizeHandler = createFedosIdentityTransitionAuthorizeRatchetResetHandler(deps);
    const authorizeResult = await authorizeHandler({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "d1", transitionId: "t1" });

    expect(resolveAffectedSessions).toHaveBeenCalledWith(OLD_IDENTITY, [{ conversationId: "c1", remoteDeviceRef: "d1" }]);
    expect(authorizeRatchetReset).toHaveBeenCalledWith("accepted", [{ sessionId: "session-0", conversationId: "c1", remoteAccountRef: OLD_IDENTITY, remoteDeviceRef: "d1" }]);
    expect(authorizeResult).toEqual({ outcome: "ok" });
  });

  it("returns the acceptance-gate rejection when no profile is unlocked", async () => {
    const { deps, acceptanceGateRejection } = makeDeps({});
    const handler = createFedosIdentityTransitionAuthorizeRatchetResetHandler(deps);
    await handler({ peerAccountRef: OLD_IDENTITY, peerDeviceRef: "d1", transitionId: "t1" });
    expect(acceptanceGateRejection).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed payload before touching the boundary at all", async () => {
    const { boundary } = fakeBoundary({ conversations: [], oldAccountIdentity: OLD_IDENTITY });
    const { deps } = makeDeps({ boundary });
    const handler = createFedosIdentityTransitionAuthorizeRatchetResetHandler(deps);
    const result = await handler({ peerAccountRef: OLD_IDENTITY });
    expect(result).toEqual({ outcome: "invalid-input", reason: "malformed identity-transition-authorize-ratchet-reset request" });
  });
});
