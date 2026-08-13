/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent I) — Priority 2B: Identity Replacement Ratchet-reset confirmation
 * wiring.
 *
 * AUDIT (grep-confirmed against the CURRENT tree): `fedos_electron_beta_main.cts`
 * never calls `identityTransitionAssessContinuity` /
 * `identityTransitionAuthorizeRatchetReset` / `identityTransitionRecordContinuity`
 * anywhere (zero matches). `fedos_electron_beta_renderer.ts`'s own
 * `decideIdentityTransition("accept", ...)` calls
 * `window.fedosApp.identityTransitionAccept(...)` and immediately re-renders
 * — the Controller's own `assessContinuity()` (step 1, read-only) /
 * `authorizeRatchetReset()` (step 2, the ONE call that actually resets a
 * Ratchet session) are both fully implemented and independently tested
 * (`FedosIdentityTransitionController`,
 * `src/os/messenger/desktop/presentation/identity_transition/fedos_identity_transition_controller.ts`,
 * plus `test/secure_runtime_alpha_5961_6040_ratchet_reset_integration.test.ts`'s
 * own domain-level coverage of `planFedosIdentityTransitionAffectedSessions()`/
 * `authorizeFedosIdentityTransitionRatchetReset()`) but NEVER REACHABLE from
 * any IPC channel — this is a genuinely dormant capability, not a bug in
 * the capability itself.
 *
 * WHAT THIS MODULE WIRES: `assess-continuity`, the read-only step that
 * builds the real, honest "N sessions will need a fresh secure session"
 * review screen (`FedosIdentityTransitionRatchetResetConfirmationContent`
 * — transitionId, acceptanceState, canAuthorize, per-session impact rows,
 * and the SAME centralized warning text
 * `fedosIdentityTransitionBuildRatchetResetConfirmationContent()` already
 * composes, e.g. "existing-ratchet-keys-will-not-move" /
 * "new-secure-session-required"). No cryptographic jargon is introduced by
 * this module — it forwards exactly the human-readable `warningText` the
 * domain layer already produces.
 *
 * A DISCLOSED, NOT-SILENTLY-WORKED-AROUND GAP: `authorizeRatchetReset()`'s
 * own signature (`FedosIdentityTransitionController.authorizeRatchetReset(
 * acceptanceState, affectedSessions: readonly FedosIdentityTransitionAffectedSession[])`)
 * needs each affected session's real `sessionId` — but
 * `FedosDesktopApplicationShell.identityTransitionAssessContinuity()` (the
 * ONLY Shell-level read this package can reach) returns the COARSER
 * `FedosIdentityTransitionSessionImpactRowV1` shape
 * (`conversationId`/`remoteDeviceRef`/`currentStatus`/`resetRecommended` —
 * no `sessionId`, no `remoteAccountRef`). The Runtime layer already HAS a
 * method that returns the real shape —
 * `FedosIdentityTransitionPeerRuntime.assessIdentityTransitionRatchetImpact()`
 * (`fedos_identity_transition_peer_runtime.ts:345`, delegates to the SAME
 * pure `planFedosIdentityTransitionAffectedSessions()` the integration test
 * above already covers) — but the Shell never wraps it the way it wraps
 * every other Runtime read (`identityTransitionAssessContinuity` wraps a
 * DIFFERENT, narrower Runtime call). Rather than fabricate a `sessionId`
 * (the resulting `resetLinkPersistence` correlation record would then be
 * incorrect — `authorizeFedosIdentityTransitionRatchetReset()`'s own test
 * shows `sessionId` is written straight into that durable link, never just
 * discarded) or silently expand this Wave's scope by editing the shared
 * root `fedos_desktop_application_shell.ts`, this module's
 * `authorizeRatchetReset` handler takes `resolveAffectedSessions` as an
 * INJECTED dependency (see `FedosIdentityTransitionRatchetResetDeps` below)
 * with no unsafe default — the Coordinator supplies it once the one-line
 * additive Shell method below exists:
 *
 *   // fedos_desktop_application_shell.ts, alongside identityTransitionAssessContinuity():
 *   identityTransitionRatchetImpact(
 *     oldAccountIdentity: FedosDeviceBindingAccountRef,
 *   ): FedosDesktopShellResult<readonly FedosIdentityTransitionAffectedSession[]> {
 *     if (this.#runtime === null) return fedosDesktopShellFailure("unavailable", "Runtime is not started");
 *     const it = this.#identityTransitionRuntime();
 *     if (it === null) return fedosDesktopShellFailure("unavailable", "identity transition Runtime is not configured");
 *     const dr = this.#runtime.conversationRuntime().directRatchet();
 *     if (dr === null) return fedosDesktopShellFailure("unavailable", "direct ratchet Runtime is not configured");
 *     return fedosDesktopShellOk(it.assessIdentityTransitionRatchetImpact(oldAccountIdentity, dr.listLiveSessions()));
 *   }
 *
 *   (`dr.listLiveSessions()` — or whatever the real Direct Ratchet Runtime's
 *   own already-existing live-session accessor is named; NOT verified
 *   against that file in this Wave, since it lives outside this package's
 *   own isolated `src/` and is the Coordinator's own read to make before
 *   landing this method — this module's own test suite proves the WIRING
 *   sequence is correct against an injected fake regardless of that name.)
 *
 * NOT WIRED IN THIS WAVE: see this package's sibling module
 * `fedos_electron_deletion_request_send_ipc.ts`'s own header for why (this
 * worktree is confirmed shared with Agent M/Agent S editing concurrently).
 * Integration notes are at the bottom of this file.
 */

/** Local structural mirror of `FedosDeviceBindingAccountRef` — exact closed field set, never imported directly (package isolation, mirrors this package's own established discipline). */
export interface FedosRatchetResetAccountRefLike {
  readonly authority: string;
  readonly publicIdentifier: string;
  readonly identityId: string | null;
}

export interface FedosRatchetResetConversationMembershipLike {
  readonly conversationId: string;
  readonly memberships: readonly { readonly participant: FedosRatchetResetAccountRefLike }[];
}

export interface FedosRatchetResetSessionPair {
  readonly conversationId: string;
  readonly remoteDeviceRef: string;
}

function sameAccountRef(a: FedosRatchetResetAccountRefLike, b: FedosRatchetResetAccountRefLike): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

/**
 * Pure. Every conversation whose membership includes `oldAccountIdentity`
 * — the SAME identity `planFedosIdentityTransitionAffectedSessions()`
 * itself filters live sessions by (`remoteAccountRef === oldAccountIdentity`)
 * — paired with `peerDeviceRef` (the transition's own selector device: a
 * FedOS Identity Replacement is the SAME physical device's `deviceRef`
 * binding a NEW account identity, never a device swap — there is no
 * separate "old device ref" concept anywhere in this domain's own types,
 * only ever one `remoteDeviceRef`/`peerDeviceRef` per Device Binding).
 * Never throws, never guesses a conversation the membership list does not
 * actually contain `oldAccountIdentity` in.
 */
export function resolveFedosIdentityTransitionAffectedPairs(
  oldAccountIdentity: FedosRatchetResetAccountRefLike,
  peerDeviceRef: string,
  conversations: readonly FedosRatchetResetConversationMembershipLike[],
): readonly FedosRatchetResetSessionPair[] {
  return conversations
    .filter((c) => c.memberships.some((m) => sameAccountRef(m.participant, oldAccountIdentity)))
    .map((c) => ({ conversationId: c.conversationId, remoteDeviceRef: peerDeviceRef }));
}

export interface FedosIdentityTransitionSelector {
  readonly peerAccountRef: FedosRatchetResetAccountRefLike;
  readonly peerDeviceRef: string;
  readonly transitionId: string;
}

/** Fails closed to `null` — mirrors `handleAppIdentityTransitionOpen()`'s own exact validation in `fedos_electron_beta_main.cts` (Security Finding 3's exact-id discipline: never a "currently selected" implicit target). */
export function validateFedosIdentityTransitionSelectorPayload(
  candidate: unknown,
  isBoundedString: (value: unknown, maxLength: number) => boolean,
  maxIdLength: number,
): FedosIdentityTransitionSelector | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const c = candidate as Record<string, unknown>;
  const peerAccountRef = c.peerAccountRef;
  if (typeof peerAccountRef !== "object" || peerAccountRef === null) return null;
  const p = peerAccountRef as Record<string, unknown>;
  if (typeof p.authority !== "string" || typeof p.publicIdentifier !== "string") return null;
  if (!isBoundedString(c.peerDeviceRef, maxIdLength) || !isBoundedString(c.transitionId, maxIdLength)) return null;
  const identityId = p.identityId;
  if (identityId !== null && typeof identityId !== "string") return null;
  return {
    peerAccountRef: { authority: p.authority, publicIdentifier: p.publicIdentifier, identityId: (identityId as string | null) ?? null },
    peerDeviceRef: c.peerDeviceRef as string,
    transitionId: c.transitionId as string,
  };
}

export interface FedosIdentityTransitionRatchetResetBoundaryLike {
  readonly conversationList: {
    load(): Promise<unknown>;
    readonly state: { readonly status: string; readonly data?: readonly { readonly conversationId: string }[] };
  };
  readonly membership: {
    load(conversationId: string): Promise<unknown>;
    readonly state: { readonly status: string; readonly data?: { readonly memberships: readonly { readonly participant: FedosRatchetResetAccountRefLike }[] } };
  };
  readonly identityTransitions: {
    readonly detailState: { readonly status: string; readonly data?: { readonly oldAccountIdentity: FedosRatchetResetAccountRefLike } };
    assessContinuity(pairs: readonly FedosRatchetResetSessionPair[]): Promise<void>;
    readonly ratchetResetConfirmationState: unknown;
    authorizeRatchetReset(
      acceptanceState: string,
      affectedSessions: readonly { readonly sessionId: string; readonly conversationId: string; readonly remoteAccountRef: FedosRatchetResetAccountRefLike; readonly remoteDeviceRef: string }[],
    ): Promise<void>;
  };
}

export interface FedosIdentityTransitionRatchetResetDeps {
  readonly requireBoundary: () => FedosIdentityTransitionRatchetResetBoundaryLike | null;
  readonly isBoundedString: (value: unknown, maxLength: number) => boolean;
  readonly resultFromViewModelState: (state: unknown) => unknown;
  readonly acceptanceGateRejection: () => unknown;
  readonly maxIdLength: number;
  /**
   * Resolves the REAL `FedosIdentityTransitionAffectedSession[]` (with a
   * genuine `sessionId`) for the given old identity + candidate pairs. See
   * this file's own header for exactly why this cannot be built from
   * anything the Shell exposes today, and the one additive Shell method
   * that supplies it correctly. There is deliberately no unsafe default
   * (e.g. a synthesized `sessionId`) — a Coordinator that has not yet
   * landed that Shell method should NOT wire `authorize-ratchet-reset` at
   * all rather than wire it against fabricated correlation data.
   */
  readonly resolveAffectedSessions: (
    oldAccountIdentity: FedosRatchetResetAccountRefLike,
    pairs: readonly FedosRatchetResetSessionPair[],
  ) => Promise<readonly { readonly sessionId: string; readonly conversationId: string; readonly remoteAccountRef: FedosRatchetResetAccountRefLike; readonly remoteDeviceRef: string }[]>;
}

/**
 * Step 1 — read-only. Builds pairs from the ALREADY-OPEN transition's own
 * `oldAccountIdentity` (from `detailState`, populated by the existing
 * `openTransition()`/`handleAppIdentityTransitionOpen()` flow, which the
 * renderer already calls before Accept is ever clickable) cross-referenced
 * against every conversation's membership, then calls `assessContinuity()`
 * and returns the SAME `ratchetResetConfirmationState` content a
 * confirmation screen renders directly — no new fields, no re-derivation.
 */
export function createFedosIdentityTransitionAssessContinuityHandler(deps: FedosIdentityTransitionRatchetResetDeps) {
  return async function handleAppIdentityTransitionAssessContinuity(payload: unknown): Promise<unknown> {
    const boundary = deps.requireBoundary();
    if (boundary === null) return deps.acceptanceGateRejection();
    const selector = validateFedosIdentityTransitionSelectorPayload(payload, deps.isBoundedString, deps.maxIdLength);
    if (selector === null) return { outcome: "invalid-input", reason: "malformed identity-transition-assess-continuity request" };

    const detail = boundary.identityTransitions.detailState;
    if (detail.status !== "loaded" || detail.data === undefined) {
      return { outcome: "not-found", reason: "open the transition (identity-transition-open) before assessing continuity" };
    }
    const oldAccountIdentity = detail.data.oldAccountIdentity;

    await boundary.conversationList.load();
    const listState = boundary.conversationList.state;
    const conversationIds = listState.status === "loaded" ? (listState.data ?? []).map((c) => c.conversationId) : [];

    const conversations: FedosRatchetResetConversationMembershipLike[] = [];
    for (const conversationId of conversationIds) {
      await boundary.membership.load(conversationId);
      const membershipState = boundary.membership.state;
      if (membershipState.status === "loaded" && membershipState.data !== undefined) {
        conversations.push({ conversationId, memberships: membershipState.data.memberships });
      }
    }

    const pairs = resolveFedosIdentityTransitionAffectedPairs(oldAccountIdentity, selector.peerDeviceRef, conversations);
    await boundary.identityTransitions.assessContinuity(pairs);
    return deps.resultFromViewModelState(boundary.identityTransitions.ratchetResetConfirmationState);
  };
}

/**
 * Step 2 — the ONE call that mutates Ratchet state. Requires the SAME
 * confirmation content `assess-continuity` just returned to already show
 * `canAuthorize: true` (i.e. `acceptanceState === "accepted"` — enforced
 * again, independently, by the Controller/Runtime itself; this handler
 * never second-guesses or re-implements that check, only refuses to even
 * attempt the call when the caller's own payload disagrees with itself).
 */
export function createFedosIdentityTransitionAuthorizeRatchetResetHandler(deps: FedosIdentityTransitionRatchetResetDeps) {
  return async function handleAppIdentityTransitionAuthorizeRatchetReset(payload: unknown): Promise<unknown> {
    const boundary = deps.requireBoundary();
    if (boundary === null) return deps.acceptanceGateRejection();
    const selector = validateFedosIdentityTransitionSelectorPayload(payload, deps.isBoundedString, deps.maxIdLength);
    if (selector === null) return { outcome: "invalid-input", reason: "malformed identity-transition-authorize-ratchet-reset request" };

    const detail = boundary.identityTransitions.detailState;
    if (detail.status !== "loaded" || detail.data === undefined) {
      return { outcome: "not-found", reason: "open the transition before authorizing a Ratchet reset" };
    }
    const oldAccountIdentity = detail.data.oldAccountIdentity;

    const confirmation = boundary.identityTransitions.ratchetResetConfirmationState as { readonly status: string; readonly data?: { readonly canAuthorize: boolean; readonly acceptanceState: string; readonly sessions: readonly FedosRatchetResetSessionPair[] } };
    if (confirmation.status !== "loaded" || confirmation.data === undefined) {
      return { outcome: "not-found", reason: "call identity-transition-assess-continuity first" };
    }
    if (!confirmation.data.canAuthorize) {
      return { outcome: "conflict", reason: "this transition is not accepted yet -- accept it before authorizing a Ratchet reset" };
    }

    const pairs = confirmation.data.sessions.map((s) => ({ conversationId: s.conversationId, remoteDeviceRef: s.remoteDeviceRef }));
    const affectedSessions = await deps.resolveAffectedSessions(oldAccountIdentity, pairs);
    await boundary.identityTransitions.authorizeRatchetReset(confirmation.data.acceptanceState, affectedSessions);
    return { outcome: "ok" as const };
  };
}

/**
 * -----------------------------------------------------------------------
 * COORDINATOR INTEGRATION NOTES (Wave B) — deliberately not applied to the
 * shared files in this Wave-A worktree (see this file's own header, and
 * `fedos_electron_deletion_request_send_ipc.ts`'s header for why).
 * -----------------------------------------------------------------------
 *
 * 1. Land the one additive `identityTransitionRatchetImpact()` Shell method
 *    quoted in this file's own header (after confirming the Direct Ratchet
 *    Runtime's real live-session accessor name).
 *
 * 2. `fedos_electron_beta_main.cts`:
 *      const handleAppIdentityTransitionAssessContinuity = createFedosIdentityTransitionAssessContinuityHandler({ ...deps });
 *      const handleAppIdentityTransitionAuthorizeRatchetReset = createFedosIdentityTransitionAuthorizeRatchetResetHandler({
 *        ...deps,
 *        resolveAffectedSessions: async (oldAccountIdentity, pairs) => {
 *          const shell = requireShell();
 *          if (shell === null) return [];
 *          const result = shell.identityTransitionRatchetImpact(oldAccountIdentity);
 *          if (result.outcome !== "ok") return [];
 *          const wanted = new Set(pairs.map((p) => `${p.conversationId}:${p.remoteDeviceRef}`));
 *          return result.value.filter((s) => wanted.has(`${s.conversationId}:${s.remoteDeviceRef}`));
 *        },
 *      });
 *    then in `registerIpcHandlers()` (default guard, no `group`; the SECOND
 *    one is a one-shot mutation so leave `allowConcurrentSelf` unset on
 *    both):
 *      ipcCommands.registerHandle(ipcMain, "fedos-app:identity-transition-assess-continuity", (payload) => handleAppIdentityTransitionAssessContinuity(payload));
 *      ipcCommands.registerHandle(ipcMain, "fedos-app:identity-transition-authorize-ratchet-reset", (payload) => handleAppIdentityTransitionAuthorizeRatchetReset(payload));
 *
 * 3. `fedos_electron_beta_preload.cts` / `fedos_electron_beta_window.d.ts`:
 *      identityTransitionAssessContinuity: (peerAccountRef, peerDeviceRef, transitionId) => ipcRenderer.invoke("fedos-app:identity-transition-assess-continuity", { peerAccountRef, peerDeviceRef, transitionId }),
 *      identityTransitionAuthorizeRatchetReset: (peerAccountRef, peerDeviceRef, transitionId) => ipcRenderer.invoke("fedos-app:identity-transition-authorize-ratchet-reset", { peerAccountRef, peerDeviceRef, transitionId }),
 *
 * 4. `fedos_electron_beta_renderer.ts`'s `decideIdentityTransition()` —
 *    replace the current `if (decision === "accept") { ...call
 *    identityTransitionAccept()... }` tail with a two-step sequence AFTER
 *    that same call succeeds:
 *      a. `await window.fedosApp.identityTransitionAssessContinuity(target.peerAccountRef, target.peerDeviceRef, target.transitionId)`.
 *      b. If `canAuthorize` and `sessions.length > 0`, show a SECOND
 *         `confirmInPage()` screen (REUSE the existing primitive — never
 *         `window.confirm()`) whose body is built from the response's own
 *         `warningText` (already human-readable, e.g. "A new secure
 *         session will be started automatically...") plus a plain count
 *         ("N conversation(s) will start a new secure session"). No
 *         cryptographic jargon beyond what the existing `warningText`
 *         already uses.
 *      c. On confirm, `await window.fedosApp.identityTransitionAuthorizeRatchetReset(target.peerAccountRef, target.peerDeviceRef, target.transitionId)`.
 *      d. If `sessions.length === 0` (nothing live needs a reset), skip
 *         step (b)/(c) entirely and finish exactly as today — never show
 *         an empty confirmation screen for nothing.
 *    Disable the decision buttons for the WHOLE sequence (a)-(c), mirroring
 *    the existing `decisionButtons` disable/finally pattern this function
 *    already uses.
 */
