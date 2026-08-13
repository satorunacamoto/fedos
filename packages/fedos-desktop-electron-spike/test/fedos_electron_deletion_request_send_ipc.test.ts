import { describe, expect, it, vi } from "vitest";
import {
  createFedosDeletionRequestSendHandler,
  resolveFedosDeletionRequestRecipient,
  validateFedosDeletionRequestSendPayload,
  FEDOS_DELETION_REQUEST_SEND_MAX_LIFETIME_SECONDS,
  type FedosDeletionRequestSendBoundaryLike,
  type FedosDeletionRequestSendShellLike,
  type FedosDeletionRequestParticipantRefLike,
} from "../src/fedos_electron_deletion_request_send_ipc.js";

/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent I) — IPC-contract test for the new (not-yet-wired) sender-side
 * Signed Deletion handler, plus unit coverage of its own pure recipient
 * resolution. The domain layer itself (`createDeletionRequest()` and
 * below) already has its own coverage elsewhere in this repo and is
 * intentionally NOT re-tested here — this file proves the IPC-boundary
 * contract only: validation, gating, recipient resolution, and the exact
 * shape of what gets forwarded to `boundary.deletionRequests.createRequest()`.
 */

const VIEWER: FedosDeletionRequestParticipantRefLike = { authority: "nostr", publicIdentifier: "viewer-pub", identityId: null };
const RECIPIENT: FedosDeletionRequestParticipantRefLike = { authority: "nostr", publicIdentifier: "recipient-pub", identityId: null };
const OTHER: FedosDeletionRequestParticipantRefLike = { authority: "nostr", publicIdentifier: "third-party-pub", identityId: null };

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

describe("resolveFedosDeletionRequestRecipient — pure resolution", () => {
  it("resolves the single other participant when a matching observed Device ref exists", () => {
    const result = resolveFedosDeletionRequestRecipient(
      VIEWER,
      [{ participant: VIEWER }, { participant: RECIPIENT }],
      [{ peerAccountRef: RECIPIENT, peerDeviceRef: "device-1" }],
    );
    expect(result).toEqual({ peerAccountRef: RECIPIENT, peerDeviceRef: "device-1" });
  });

  it("returns null for a Group conversation (more than one other participant) -- never guesses ambiguously", () => {
    const result = resolveFedosDeletionRequestRecipient(
      VIEWER,
      [{ participant: VIEWER }, { participant: RECIPIENT }, { participant: OTHER }],
      [
        { peerAccountRef: RECIPIENT, peerDeviceRef: "device-1" },
        { peerAccountRef: OTHER, peerDeviceRef: "device-2" },
      ],
    );
    expect(result).toBeNull();
  });

  it("returns null when the viewer is the only participant on file (malformed/empty membership)", () => {
    expect(resolveFedosDeletionRequestRecipient(VIEWER, [{ participant: VIEWER }], [])).toBeNull();
  });

  it("returns null when no observed Device ref matches the resolved recipient -- never falls back to a guess", () => {
    const result = resolveFedosDeletionRequestRecipient(VIEWER, [{ participant: VIEWER }, { participant: RECIPIENT }], [{ peerAccountRef: OTHER, peerDeviceRef: "device-9" }]);
    expect(result).toBeNull();
  });
});

describe("validateFedosDeletionRequestSendPayload", () => {
  it("accepts a well-formed payload with defaults omitted", () => {
    const result = validateFedosDeletionRequestSendPayload({ conversationId: "c1", messageId: "m1", scope: "local-history" }, isBoundedString, 256);
    expect(result).toEqual({ conversationId: "c1", messageId: "m1", scope: "local-history", reasonCode: null, expiresInSeconds: null });
  });

  it("rejects an unknown scope", () => {
    expect(validateFedosDeletionRequestSendPayload({ conversationId: "c1", messageId: "m1", scope: "whole-conversation" }, isBoundedString, 256)).toBeNull();
  });

  it("rejects an unknown reasonCode", () => {
    expect(validateFedosDeletionRequestSendPayload({ conversationId: "c1", messageId: "m1", scope: "local-history", reasonCode: "because" }, isBoundedString, 256)).toBeNull();
  });

  it("rejects a non-positive or over-max expiresInSeconds", () => {
    expect(validateFedosDeletionRequestSendPayload({ conversationId: "c1", messageId: "m1", scope: "local-history", expiresInSeconds: 0 }, isBoundedString, 256)).toBeNull();
    expect(
      validateFedosDeletionRequestSendPayload(
        { conversationId: "c1", messageId: "m1", scope: "local-history", expiresInSeconds: FEDOS_DELETION_REQUEST_SEND_MAX_LIFETIME_SECONDS + 1 },
        isBoundedString,
        256,
      ),
    ).toBeNull();
  });

  it("rejects malformed conversationId/messageId", () => {
    expect(validateFedosDeletionRequestSendPayload({ conversationId: "", messageId: "m1", scope: "local-history" }, isBoundedString, 256)).toBeNull();
    expect(validateFedosDeletionRequestSendPayload(null, isBoundedString, 256)).toBeNull();
  });
});

function makeDeps(overrides: {
  readonly boundary?: FedosDeletionRequestSendBoundaryLike | null;
  readonly shell?: FedosDeletionRequestSendShellLike | null;
  readonly viewer?: FedosDeletionRequestParticipantRefLike | null;
}) {
  const acceptanceGateRejection = vi.fn(() => ({ outcome: "unavailable" as const, reason: "acceptance-only" }));
  const resultFromViewModelState = vi.fn((state: unknown) => ({ outcome: "ok" as const, value: (state as { readonly data: unknown }).data }));
  return {
    deps: {
      requireBoundary: () => overrides.boundary ?? null,
      requireShell: () => overrides.shell ?? null,
      requireViewerParticipant: () => overrides.viewer ?? null,
      isBoundedString,
      resultFromViewModelState,
      acceptanceGateRejection,
      maxIdLength: 256,
    },
    acceptanceGateRejection,
    resultFromViewModelState,
  };
}

function fakeBoundary(memberships: readonly { readonly participant: FedosDeletionRequestParticipantRefLike }[], createState: unknown = { status: "loaded", data: { requestId: "req-1" } }) {
  const createRequest = vi.fn(async () => undefined);
  return {
    boundary: {
      membership: {
        load: vi.fn(async () => undefined),
        state: { status: "loaded", data: { memberships } },
      },
      deletionRequests: {
        createRequest,
        get createState() {
          return createState;
        },
      },
    } satisfies FedosDeletionRequestSendBoundaryLike,
    createRequest,
  };
}

describe("createFedosDeletionRequestSendHandler — IPC contract", () => {
  it("returns the acceptance-gate rejection when no profile is unlocked (boundary null)", async () => {
    const { deps, acceptanceGateRejection } = makeDeps({});
    const handler = createFedosDeletionRequestSendHandler(deps);
    const result = await handler({ conversationId: "c1", messageId: "m1", scope: "local-history" });
    expect(acceptanceGateRejection).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ outcome: "unavailable", reason: "acceptance-only" });
  });

  it("returns invalid-input for a malformed payload, without ever calling requireShell/membership.load", async () => {
    const { boundary } = fakeBoundary([]);
    const shell: FedosDeletionRequestSendShellLike = { peerCapabilityListObserved: vi.fn() };
    const { deps } = makeDeps({ boundary, shell, viewer: VIEWER });
    const handler = createFedosDeletionRequestSendHandler(deps);
    const result = await handler({ conversationId: "c1", messageId: "m1", scope: "not-a-real-scope" });
    expect(result).toEqual({ outcome: "invalid-input", reason: "malformed deletion-request-create request" });
    expect(boundary.membership.load).not.toHaveBeenCalled();
  });

  it("returns recipient-device-unknown when the resolver cannot find a Device ref, and never calls createRequest()", async () => {
    const { boundary, createRequest } = fakeBoundary([{ participant: VIEWER }, { participant: RECIPIENT }]);
    const shell: FedosDeletionRequestSendShellLike = { peerCapabilityListObserved: () => ({ outcome: "ok", value: [] }) };
    const { deps } = makeDeps({ boundary, shell, viewer: VIEWER });
    const handler = createFedosDeletionRequestSendHandler(deps);
    const result = await handler({ conversationId: "c1", messageId: "m1", scope: "local-history" });
    expect(result).toMatchObject({ outcome: "recipient-device-unknown" });
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("on a well-formed request with a resolvable recipient, forwards the EXACT expected params to createRequest() and returns its result", async () => {
    const { boundary, createRequest } = fakeBoundary([{ participant: VIEWER }, { participant: RECIPIENT }], { status: "loaded", data: { requestId: "req-42" } });
    const shell: FedosDeletionRequestSendShellLike = { peerCapabilityListObserved: () => ({ outcome: "ok", value: [{ peerAccountRef: RECIPIENT, peerDeviceRef: "recipient-device-1" }] }) };
    const { deps, resultFromViewModelState } = makeDeps({ boundary, shell, viewer: VIEWER });
    const handler = createFedosDeletionRequestSendHandler(deps);

    const result = await handler({ conversationId: "conv-1", messageId: "msg-1", scope: "local-history-and-index", reasonCode: "sent-in-error", expiresInSeconds: 3600 });

    expect(createRequest).toHaveBeenCalledWith({
      requesterAccountRef: "viewer-pub",
      recipientAccountRef: "recipient-pub",
      recipientDeviceRef: "recipient-device-1",
      conversationId: "conv-1",
      targetEnvelopeId: "msg-1",
      scope: "local-history-and-index",
      expiresInSeconds: 3600,
      reasonCode: "sent-in-error",
    });
    expect(resultFromViewModelState).toHaveBeenCalledWith({ status: "loaded", data: { requestId: "req-42" } });
    expect(result).toEqual({ outcome: "ok", value: { requestId: "req-42" } });
  });

  it("defaults expiresInSeconds to the max lifetime when omitted, and reasonCode to null", async () => {
    const { boundary, createRequest } = fakeBoundary([{ participant: VIEWER }, { participant: RECIPIENT }]);
    const shell: FedosDeletionRequestSendShellLike = { peerCapabilityListObserved: () => ({ outcome: "ok", value: [{ peerAccountRef: RECIPIENT, peerDeviceRef: "d1" }] }) };
    const { deps } = makeDeps({ boundary, shell, viewer: VIEWER });
    const handler = createFedosDeletionRequestSendHandler(deps);

    await handler({ conversationId: "conv-1", messageId: "msg-1", scope: "local-history" });

    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({ expiresInSeconds: FEDOS_DELETION_REQUEST_SEND_MAX_LIFETIME_SECONDS, reasonCode: null }),
    );
  });

  it("returns not-found when membership fails to load", async () => {
    const shell: FedosDeletionRequestSendShellLike = { peerCapabilityListObserved: () => ({ outcome: "ok", value: [] }) };
    const boundary: FedosDeletionRequestSendBoundaryLike = {
      membership: { load: vi.fn(async () => undefined), state: { status: "error" } },
      deletionRequests: { createRequest: vi.fn(async () => undefined), createState: null },
    };
    const { deps } = makeDeps({ boundary, shell, viewer: VIEWER });
    const handler = createFedosDeletionRequestSendHandler(deps);
    const result = await handler({ conversationId: "conv-1", messageId: "msg-1", scope: "local-history" });
    expect(result).toMatchObject({ outcome: "not-found" });
  });
});
