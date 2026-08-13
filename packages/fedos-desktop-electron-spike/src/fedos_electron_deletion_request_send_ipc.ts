/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent I) — Priority 2A: Signed Deletion sender-side IPC wiring.
 *
 * AUDIT (grep-confirmed against the CURRENT tree, not a historical
 * description): the domain logic already exists and is correct —
 * `FedosDesktopApplicationShell.deletionRequestCreate(params)`
 * (`src/os/messenger/desktop/shell/fedos_desktop_application_shell.ts`)
 * delegates entirely to the real
 * `FedosDeletionRequestOutboundCoordinator.createDeletionRequest()`
 * (`src/os/messenger/conversations/deletion_request/fedos_deletion_request_outbound_coordinator.ts`),
 * and `FedosDeletionRequestController.createRequest(params)`
 * (`src/os/messenger/desktop/presentation/deletion_request/fedos_deletion_request_controller.ts`,
 * already exposed on the Boundary as `boundary.deletionRequests`) already
 * calls it and exposes `createState`. NEITHER `fedos_electron_beta_main.cts`
 * NOR its preload/renderer ever calls `createRequest()` — every existing
 * `fedos-app:deletion-request-*` channel is recipient-side only
 * (`deletion-request-list-received` / `-open` / `-approve` / `-reject`).
 * This module supplies the missing sender-side piece.
 *
 * WHAT THIS MODULE DOES NOT DO: it never claims "deleted everywhere" — the
 * outcome vocabulary this module returns/forwards is EXACTLY
 * `FedosDeletionRequestController.createState`'s own real outcomes
 * (`"published"` via `resultFromViewModelState`-shaped `{outcome:"ok",...}`,
 * or a specific failure reason) plus this module's own closed input-
 * validation rejections. A remote peer/relay accepting delivery of a
 * deletion request is not the same as that peer complying with it — the
 * recipient side (`fedos_deletion_request_controller.ts`'s own inbox flow)
 * remains the only place a deletion is actually acted on, and it is
 * ENTIRELY the recipient's own decision.
 *
 * RECIPIENT RESOLUTION: `FedosDeletionRequestCreateParams` needs an exact
 * `(recipientAccountRef, recipientDeviceRef)` pair, but — like
 * `identityTransitionAssessContinuity()`/`directRatchetStatus()`
 * (`fedos_desktop_application_shell.ts`'s own documented "no session-
 * listing query exists, caller names the pair" precedent) — the Membership
 * domain deliberately excludes any device reference
 * (`fedos_conversation_membership.ts`'s own header: "device list ... owned
 * by other, unrelated domains"). `resolveFedosDeletionRequestRecipient()`
 * below reproduces the SAME resolution `handleAppIdentityTransitionList()`
 * already performs in `fedos_electron_beta_main.cts` (cross-referencing the
 * conversation's own membership list against
 * `shell.peerCapabilityListObserved()`'s already-public peer/device pairs)
 * — never a new capability, never a new query, just the identical pattern
 * applied to a Direct (exactly-one-other-participant) conversation.
 *
 * ISOLATION: no Electron import, no root `src/**` import (this package's
 * own established "local structural type" discipline — mirrors
 * `fedos_electron_notification_adapter.ts`'s header). Every dependency this
 * handler needs from `fedos_electron_beta_main.cts`'s own module scope
 * (`requireBoundary`, `requireShell`, `requireViewerParticipant`,
 * `isBoundedString`, `MAX_ID_LENGTH`) is INJECTED, so this file is fully
 * unit-testable with hand-written doubles and never itself touches any
 * global/module-level state.
 *
 * NOT WIRED IN THIS WAVE: no edit to `fedos_electron_beta_main.cts`,
 * `fedos_electron_beta_preload.cts`, or `fedos_electron_beta_renderer.ts`
 * — this worktree is confirmed (via `git status`) to be shared with at
 * least Agent M (`src/os/commerce/catalog/product_media_*`) and Agent S
 * (`src/os/messenger/conversations/identity_transition/peer_integration/
 * fedos_identity_transition_silent_acceptance_detection.ts`) actively
 * editing concurrently in Wave A; all three of those files are also very
 * likely edit targets for at least one of them. See the integration notes
 * at the bottom of this file for the exact snippets the Coordinator
 * inserts in Wave B.
 */

/** Local structural mirror of `FedosConversationParticipantReference` (`src/os/messenger/conversations/membership/fedos_conversation_participant_reference.ts`) — exact closed field set, never imported directly (package isolation). */
export interface FedosDeletionRequestParticipantRefLike {
  readonly authority: string;
  readonly publicIdentifier: string;
  readonly identityId: string | null;
}

export interface FedosDeletionRequestMembershipEntryLike {
  readonly participant: FedosDeletionRequestParticipantRefLike;
}

export interface FedosDeletionRequestObservedPeerLike {
  readonly peerAccountRef: FedosDeletionRequestParticipantRefLike;
  readonly peerDeviceRef: string;
}

function sameParticipant(a: FedosDeletionRequestParticipantRefLike, b: FedosDeletionRequestParticipantRefLike): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

/**
 * Resolves the single OTHER participant of a Direct (1:1) conversation's
 * membership list to a concrete `(recipientAccountRef, recipientDeviceRef)`
 * pair, using only two ALREADY-PUBLIC facts (a conversation's membership
 * list, and the local Device Registry's own observed peer/device pairs —
 * see this file's own header). Returns `null`, never guesses or picks
 * ambiguously, when:
 *   - the conversation does not have EXACTLY one other participant (a
 *     Group conversation, or a malformed/empty membership list), or
 *   - no observed Device ref is on file yet for that participant.
 * Pure, never throws.
 */
export function resolveFedosDeletionRequestRecipient(
  viewer: FedosDeletionRequestParticipantRefLike,
  memberships: readonly FedosDeletionRequestMembershipEntryLike[],
  observedPeers: readonly FedosDeletionRequestObservedPeerLike[],
): FedosDeletionRequestObservedPeerLike | null {
  const others = memberships.filter((m) => !sameParticipant(m.participant, viewer));
  if (others.length !== 1) return null;
  const recipient = others[0]!.participant;
  const match = observedPeers.find((p) => sameParticipant(p.peerAccountRef, recipient));
  return match ?? null;
}

/** Mirrors `FEDOS_DELETION_REQUEST_MAX_LIFETIME_SECONDS` (`src/os/messenger/conversations/deletion_request/fedos_deletion_request_validation.ts`) — 14 days. Duplicated as a local literal per this package's own "never import root `src/**`" isolation discipline, not re-derived. */
export const FEDOS_DELETION_REQUEST_SEND_MAX_LIFETIME_SECONDS = 14 * 24 * 60 * 60;
/** Mirrors `FEDOS_DELETION_REQUEST_SCOPES` (`fedos_deletion_request_scope.ts`) verbatim. */
export const FEDOS_DELETION_REQUEST_SEND_SCOPES = ["local-history", "local-history-and-index"] as const;
export type FedosDeletionRequestSendScope = (typeof FEDOS_DELETION_REQUEST_SEND_SCOPES)[number];
/** Mirrors `FEDOS_DELETION_REQUEST_REASON_CODES` (`fedos_deletion_request_reason_code.ts`) verbatim. */
export const FEDOS_DELETION_REQUEST_SEND_REASON_CODES = ["sent-in-error", "content-correction", "privacy", "other"] as const;
export type FedosDeletionRequestSendReasonCode = (typeof FEDOS_DELETION_REQUEST_SEND_REASON_CODES)[number];

export interface FedosDeletionRequestSendPayload {
  readonly conversationId: string;
  readonly messageId: string;
  readonly scope: FedosDeletionRequestSendScope;
  readonly reasonCode: FedosDeletionRequestSendReasonCode | null;
  readonly expiresInSeconds: number | null;
}

/** Fails closed to `null` for anything not a genuinely well-formed request — mirrors every other `fedos-app:*` handler's own validator discipline in `fedos_electron_beta_main.cts`. Never throws. */
export function validateFedosDeletionRequestSendPayload(
  candidate: unknown,
  isBoundedString: (value: unknown, maxLength: number) => boolean,
  maxIdLength: number,
): FedosDeletionRequestSendPayload | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const c = candidate as Record<string, unknown>;
  if (!isBoundedString(c.conversationId, maxIdLength) || !isBoundedString(c.messageId, maxIdLength)) return null;
  if (typeof c.scope !== "string" || !(FEDOS_DELETION_REQUEST_SEND_SCOPES as readonly string[]).includes(c.scope)) return null;
  const reasonCode = c.reasonCode ?? null;
  if (reasonCode !== null && (typeof reasonCode !== "string" || !(FEDOS_DELETION_REQUEST_SEND_REASON_CODES as readonly string[]).includes(reasonCode))) return null;
  const expiresInSeconds = c.expiresInSeconds ?? null;
  if (expiresInSeconds !== null && (typeof expiresInSeconds !== "number" || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0 || expiresInSeconds > FEDOS_DELETION_REQUEST_SEND_MAX_LIFETIME_SECONDS)) {
    return null;
  }
  return {
    conversationId: c.conversationId as string,
    messageId: c.messageId as string,
    scope: c.scope as FedosDeletionRequestSendScope,
    reasonCode: reasonCode as FedosDeletionRequestSendReasonCode | null,
    expiresInSeconds: expiresInSeconds as number | null,
  };
}

export interface FedosDeletionRequestSendBoundaryLike {
  readonly membership: {
    load(conversationId: string): Promise<unknown>;
    readonly state: { readonly status: string; readonly data?: { readonly memberships: readonly FedosDeletionRequestMembershipEntryLike[] } };
  };
  readonly deletionRequests: {
    createRequest(params: {
      readonly requesterAccountRef: string;
      readonly recipientAccountRef: string;
      readonly recipientDeviceRef: string;
      readonly conversationId: string;
      readonly targetEnvelopeId: string;
      readonly scope: FedosDeletionRequestSendScope;
      readonly expiresInSeconds: number;
      readonly reasonCode: FedosDeletionRequestSendReasonCode | null;
    }): Promise<void>;
    readonly createState: unknown;
  };
}

export interface FedosDeletionRequestSendShellLike {
  peerCapabilityListObserved(): { readonly outcome: string; readonly value?: readonly FedosDeletionRequestObservedPeerLike[] };
}

export interface FedosDeletionRequestSendDeps {
  readonly requireBoundary: () => FedosDeletionRequestSendBoundaryLike | null;
  readonly requireShell: () => FedosDeletionRequestSendShellLike | null;
  readonly requireViewerParticipant: () => FedosDeletionRequestParticipantRefLike | null;
  readonly isBoundedString: (value: unknown, maxLength: number) => boolean;
  readonly resultFromViewModelState: (state: unknown) => unknown;
  readonly acceptanceGateRejection: () => unknown;
  readonly maxIdLength: number;
}

/**
 * Factory mirroring this file's own `handleApp*()` naming and shape
 * exactly, but with every module-level dependency injected — the
 * Coordinator wires it in Wave B as
 * `const handleAppDeletionRequestCreate = createFedosDeletionRequestSendHandler({ requireBoundary, requireShell, requireViewerParticipant, isBoundedString, resultFromViewModelState, acceptanceGateRejection, maxIdLength: MAX_ID_LENGTH });`
 * then registers it exactly like every other `fedos-app:*` mutating
 * command (see this file's own footer for the exact registration line).
 */
export function createFedosDeletionRequestSendHandler(deps: FedosDeletionRequestSendDeps) {
  return async function handleAppDeletionRequestCreate(payload: unknown): Promise<unknown> {
    const boundary = deps.requireBoundary();
    if (boundary === null) return deps.acceptanceGateRejection();
    const viewer = deps.requireViewerParticipant();
    if (viewer === null) return deps.acceptanceGateRejection();
    const validated = validateFedosDeletionRequestSendPayload(payload, deps.isBoundedString, deps.maxIdLength);
    if (validated === null) return { outcome: "invalid-input", reason: "malformed deletion-request-create request" };

    const shell = deps.requireShell();
    if (shell === null) return deps.acceptanceGateRejection();

    await boundary.membership.load(validated.conversationId);
    const membershipState = boundary.membership.state;
    if (membershipState.status !== "loaded" || membershipState.data === undefined) {
      return { outcome: "not-found", reason: "conversation membership could not be loaded" };
    }
    const peersResult = shell.peerCapabilityListObserved();
    const observedPeers = peersResult.outcome === "ok" ? (peersResult.value ?? []) : [];
    const recipient = resolveFedosDeletionRequestRecipient(viewer, membershipState.data.memberships, observedPeers);
    if (recipient === null) {
      return { outcome: "recipient-device-unknown", reason: "no observed Device reference is on file for this conversation's other participant yet" };
    }

    await boundary.deletionRequests.createRequest({
      requesterAccountRef: viewer.publicIdentifier,
      recipientAccountRef: recipient.peerAccountRef.publicIdentifier,
      recipientDeviceRef: recipient.peerDeviceRef,
      conversationId: validated.conversationId,
      targetEnvelopeId: validated.messageId,
      scope: validated.scope,
      expiresInSeconds: validated.expiresInSeconds ?? FEDOS_DELETION_REQUEST_SEND_MAX_LIFETIME_SECONDS,
      reasonCode: validated.reasonCode,
    });
    return deps.resultFromViewModelState(boundary.deletionRequests.createState);
  };
}

/**
 * -----------------------------------------------------------------------
 * COORDINATOR INTEGRATION NOTES (Wave B) — deliberately not applied to the
 * shared files in this Wave-A worktree (see this file's own header).
 * -----------------------------------------------------------------------
 *
 * 1. `fedos_electron_beta_main.cts`, near the other `handleAppDeletionRequest*`
 *    functions:
 *      const handleAppDeletionRequestCreate = createFedosDeletionRequestSendHandler({
 *        requireBoundary, requireShell, requireViewerParticipant, isBoundedString,
 *        resultFromViewModelState, acceptanceGateRejection, maxIdLength: MAX_ID_LENGTH,
 *      });
 *    and in `registerIpcHandlers()`, alongside the existing
 *    `fedos-app:deletion-request-*` registrations (default guard, no
 *    `group`, no `allowConcurrentSelf` — it is a one-shot mutating send):
 *      ipcCommands.registerHandle(ipcMain, "fedos-app:deletion-request-create", (payload) => handleAppDeletionRequestCreate(payload));
 *
 * 2. `fedos_electron_beta_preload.cts`, alongside the existing
 *    `deletionRequestListReceived`/`deletionRequestOpen`/`deletionRequestApprove`/
 *    `deletionRequestReject` exposures:
 *      deletionRequestCreate: (payload: unknown) => ipcRenderer.invoke("fedos-app:deletion-request-create", payload),
 *    plus the matching `fedos_electron_beta_window.d.ts` signature.
 *
 * 3. `fedos_electron_beta_renderer.ts` — a "Request deletion" button per
 *    row on the existing per-message list (wherever that list is rendered
 *    for the open Direct conversation), NEVER worded "Delete for everyone"
 *    or "Deleted everywhere" (this module's own header: remote compliance
 *    cannot be guaranteed). Suggested copy: button label "Request
 *    deletion"; on click, `await confirmInPage("Request deletion?", "This
 *    asks the other person to remove their local copy. They may decline,
 *    and copies outside FedOS (screenshots, backups, Relay ciphertext)
 *    cannot be affected.", "Yes, request deletion")` — REUSE the existing
 *    `confirmInPage()`/`#app-confirm-overlay` primitive this file already
 *    defines (see its own header for why: `window.confirm()` previously
 *    froze this exact renderer's JS thread) — never `window.confirm()`.
 *    On confirm, call `window.fedosApp.deletionRequestCreate({
 *    conversationId, messageId, scope: "local-history-and-index",
 *    reasonCode: null, expiresInSeconds: null })` and render the result via
 *    the same `describeOutcome()`/outcome-text convention every other
 *    action already uses (a `"recipient-device-unknown"` outcome should
 *    render as something like "This contact hasn't confirmed a device
 *    yet — try again once they have."). Disable the button for the
 *    duration of the request, mirroring `decideDeletionRequest()`'s own
 *    disable/finally pattern one screen over.
 */
