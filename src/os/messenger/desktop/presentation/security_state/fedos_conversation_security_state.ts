/**
 * FedOS Verified Secure Session UI mega-arc (Coordinator) — the central,
 * pure, per-conversation security-state evaluator.
 *
 * Frozen semantics — see
 * `docs/reviews/fedos-verified-secure-session-ui-current-readiness/06_IMPLEMENTATION_PLAN.md`
 * for the full Coordinator decision record this file implements verbatim.
 *
 * NO GLOBAL "VERIFIED" BOOLEAN. FedOS has no safety number, no peer-
 * verification ceremony, and no cryptographic identity-verification flow
 * (re-confirmed live, this arc, by independent read-only investigation of
 * the current codebase). A single collapsed "Secure"/"Verified" claim
 * would therefore always be dishonest. This module instead reports SIX
 * INDEPENDENT axes, each with its own closed, honest state — mirrors
 * `fedosSafetyCenterBuildSummary()`'s own "No hidden weighting, no single
 * numeric score ... each section keeps its OWN independent state"
 * discipline (`../safety_center/fedos_safety_center_summary.ts`), and the
 * historical "Verified Secure Session UI" precedent's own header (found on
 * `feature/fedos-verified-secure-session-ui` @ `d2f06f48`, never merged to
 * this lineage — see `02_HISTORICAL_7_AXIS_MAPPING.md`): "'Verified' is
 * reserved for a recorded human attestation and is never inferred from
 * device trust state. An axis that cannot be determined reports `unknown`,
 * never `protected`."
 *
 * PURE: no I/O, no clock read (`now` is an explicit input), no secret
 * material anywhere in input or output. `facts` is an explicit,
 * already-resolved object — this function performs no lookups of its own;
 * a separate, thin adapter layer (Electron main process) gathers `facts`
 * by calling already-real domain/Shell functions, cited per-axis below.
 *
 * HARD GUARDRAILS (mirrors the historical precedent's own, re-affirmed):
 *   - No raw device public key, no session counter, no signature, no
 *     master seed, no private key of any kind ever appears in the output.
 *   - Every `reasonCode` is a closed-vocabulary string, never free-form
 *     prose assembled from untrusted input.
 *   - `UNKNOWN` never silently becomes `GOOD` — every branch below is
 *     exhaustive over the real, cited closed vocabularies; there is no
 *     "default to good" fallthrough anywhere in this file.
 */

export type FedosSecurityAxisState = "good" | "attention" | "unknown" | "unavailable" | "not-applicable";

export interface FedosSecurityAxisResult {
  readonly state: FedosSecurityAxisState;
  /** Closed-vocabulary reason code, specific to the axis — never free-form prose. */
  readonly reasonCode: string;
  /** When this fact was last confirmed; `null` = never confirmed. */
  readonly asOf: number | null;
  readonly source: "live" | "cached" | "unavailable";
}

export interface FedosConversationSecurityState {
  readonly conversationId: string;
  readonly identityContinuity: FedosSecurityAxisResult;
  readonly encryption: FedosSecurityAxisResult;
  readonly forwardSecrecy: FedosSecurityAxisResult;
  readonly deviceKnowledge: FedosSecurityAxisResult;
  readonly evidenceIntegrity: FedosSecurityAxisResult;
  readonly metadataExposure: FedosSecurityAxisResult;
}

// ---------------------------------------------------------------------------
// Axis 1: IDENTITY_CONTINUITY
// Fact source: `FedosIdentityTransitionPeerRuntime.getConversationContinuity()`
// (`../../../conversations/identity_transition/peer_integration/fedos_identity_transition_peer_runtime.js`)
// plus, when a record exists, `inspectPeerIdentityTransitionStatus()`'s own
// `silentlyAutoAcceptedWithoutAsking` flag
// (`fedos_identity_transition_silent_acceptance_detection.js`).
// ---------------------------------------------------------------------------

export interface FedosConversationSecurityStateIdentityContinuityFacts {
  /** `false` when `getConversationContinuity()` returned `null` -- no continuity record exists for this conversation at all (new/unknown peer, or genuinely no identity change has ever occurred -- see `hasEverExchangedMessages` to distinguish those two cases honestly). */
  readonly hasRecord: boolean;
  /** Only meaningful when `hasRecord` is true. */
  readonly acceptanceState: "manual-review-required" | "accepted" | "rejected" | "conflicting" | "stale" | "superseded" | "rollback-detected" | null;
  /** Only meaningful when `hasRecord` is true. From `isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity()`'s own field. */
  readonly silentlyAutoAcceptedWithoutAsking: boolean;
  readonly recordedAt: number | null;
  /** Honest signal for the "new/unknown peer" vs "known peer, no changes" distinction -- e.g. conversation membership/message history exists. */
  readonly hasEverExchangedMessages: boolean;
}

function evaluateIdentityContinuity(facts: FedosConversationSecurityStateIdentityContinuityFacts, now: number): FedosSecurityAxisResult {
  if (!facts.hasRecord) {
    return facts.hasEverExchangedMessages
      ? { state: "good", reasonCode: "no-identity-change-observed", asOf: now, source: "cached" }
      : { state: "unknown", reasonCode: "no-history-for-this-contact", asOf: null, source: "unavailable" };
  }
  // A rejected/conflicting/rollback-detected/stale record is a FINAL state
  // (mirrors `FedosIdentityTransitionAcceptanceState`'s own terminal set) --
  // this conversation's identity claim was actively refused, never silently
  // dropped to "good".
  if (facts.acceptanceState === "rejected" || facts.acceptanceState === "conflicting" || facts.acceptanceState === "rollback-detected") {
    return { state: "attention", reasonCode: `identity-change-${facts.acceptanceState}`, asOf: facts.recordedAt, source: "cached" };
  }
  if (facts.acceptanceState === "stale") {
    return { state: "attention", reasonCode: "identity-change-stale", asOf: facts.recordedAt, source: "cached" };
  }
  if (facts.acceptanceState === "manual-review-required") {
    return { state: "attention", reasonCode: "identity-change-unresolved", asOf: facts.recordedAt, source: "cached" };
  }
  if (facts.acceptanceState === "accepted") {
    if (facts.silentlyAutoAcceptedWithoutAsking) {
      return { state: "attention", reasonCode: "identity-replacement-auto-accepted-without-asking", asOf: facts.recordedAt, source: "cached" };
    }
    return { state: "good", reasonCode: "identity-change-reviewed-and-accepted", asOf: facts.recordedAt, source: "cached" };
  }
  // superseded: the CURRENT identity is whatever superseded this record --
  // this specific record must never itself drive the axis; the adapter is
  // responsible for always resolving to the LATEST revision via
  // `getConversationContinuity()` (which already does this), so reaching
  // this branch at all would be an adapter bug -- fail honest, not silent.
  return { state: "unknown", reasonCode: "identity-continuity-state-unresolved", asOf: facts.recordedAt, source: "cached" };
}

// ---------------------------------------------------------------------------
// Axis 2: ENCRYPTION
// Fact source: `FedosDesktopApplicationShell.directRatchetStatus()` ->
// `FedosDirectRatchetSafeStatus` (`../../conversations/ratchet/fedos_direct_ratchet_conversation_runtime.js`),
// already a closed, safe, UI-facing 8-value vocabulary.
// ---------------------------------------------------------------------------

export type FedosDirectRatchetSafeStatusFact = "unsupported" | "initialization-required" | "pending" | "active" | "reset-required" | "peer-incompatible" | "revoked" | "unavailable";

export interface FedosConversationSecurityStateEncryptionFacts {
  readonly ratchetStatus: FedosDirectRatchetSafeStatusFact | null;
  readonly asOf: number | null;
}

function evaluateEncryption(facts: FedosConversationSecurityStateEncryptionFacts): FedosSecurityAxisResult {
  if (facts.ratchetStatus === null) return { state: "unavailable", reasonCode: "ratchet-status-unavailable", asOf: null, source: "unavailable" };
  switch (facts.ratchetStatus) {
    case "active":
      return { state: "good", reasonCode: "ratchet-session-active", asOf: facts.asOf, source: "live" };
    case "pending":
    case "initialization-required":
      return { state: "unknown", reasonCode: `ratchet-${facts.ratchetStatus}`, asOf: facts.asOf, source: "live" };
    case "reset-required":
    case "peer-incompatible":
    case "revoked":
      return { state: "attention", reasonCode: `ratchet-${facts.ratchetStatus}`, asOf: facts.asOf, source: "live" };
    case "unsupported":
    case "unavailable":
      return { state: "unavailable", reasonCode: `ratchet-${facts.ratchetStatus}`, asOf: facts.asOf, source: "live" };
  }
}

// ---------------------------------------------------------------------------
// Axis 3: FORWARD_SECRECY
// Fact source: `selectFedosDirectConversationForwardSecrecyRoute()` /
// `describeFedosForwardSecrecyRoute()`
// (`../../conversations/ratchet/fedos_direct_conversation_forward_secrecy_route.js`)
// -- deliberately SEPARATE from Axis 2 (the single most important
// anti-overclaim decision in this whole design, preserved verbatim from
// the historical precedent, independently re-confirmed still true this
// arc: "an active Ratchet session does NOT mean messages use it").
// ---------------------------------------------------------------------------

export type FedosForwardSecrecyUnavailableReasonFact =
  | "ratchet-not-configured"
  | "no-session-for-conversation"
  | "remote-device-unknown"
  | "remote-device-revoked"
  | "remote-device-not-trusted"
  | "ambiguous-remote-device";

export interface FedosConversationSecurityStateForwardSecrecyFacts {
  readonly forwardSecrecy: boolean | null;
  readonly reason: FedosForwardSecrecyUnavailableReasonFact | null;
  readonly asOf: number | null;
}

function evaluateForwardSecrecy(facts: FedosConversationSecurityStateForwardSecrecyFacts): FedosSecurityAxisResult {
  if (facts.forwardSecrecy === null) return { state: "unavailable", reasonCode: "forward-secrecy-route-unavailable", asOf: null, source: "unavailable" };
  if (facts.forwardSecrecy) return { state: "good", reasonCode: "messages-routed-through-ratchet", asOf: facts.asOf, source: "live" };
  const reason = facts.reason ?? "ratchet-not-configured";
  // Every negative reason is a real, reachable condition (never a generic
  // "unavailable") -- surfaced as ATTENTION, since the honest, disciplined,
  // shipped copy for this exact case was historically "Your messages have
  // NO forward secrecy" (capital NO preserved), never silently downgraded
  // to UNKNOWN or NOT_APPLICABLE.
  return { state: "attention", reasonCode: `no-forward-secrecy-${reason}`, asOf: facts.asOf, source: "live" };
}

// ---------------------------------------------------------------------------
// Axis 4: DEVICE_KNOWLEDGE
// FedOS Peer Device Discovery Arc — REDESIGNED fact source. Previously
// consumed `Shell.peerCapabilityListObserved()`'s own capability-
// compatibility signal (a real, honest, but narrower fact: "do we speak a
// compatible ratchet suite/route", never "is this device cryptographically
// trusted as belonging to this account"). Now consumes
// `Shell.peerDeviceAnnouncementListObserved()`'s own LIVE Device Registry
// trust-state lookup (`FedosDeviceTrustState`,
// `../../../device/fedos_device_binding.js` — the SAME real, already-safe,
// already-shipped vocabulary used everywhere else in this codebase for
// Device trust) per peer device this conversation's counterparty account
// has been cryptographically observed announcing. This is a strictly
// STRONGER, more honest fact than the prior capability-only signal: `GOOD`
// here now means a real, dual-context-verified (account signature, per
// `06_PROTOCOL_CONTRACT_FREEZE.md` §3), durably-registered `"trusted"`
// binding exists — never merged with ENCRYPTION/FORWARD_SECRECY (mandate
// §24's own explicit prohibition; a trusted device binding does not by
// itself mean a ratchet session is active or in use).
// ---------------------------------------------------------------------------

export type FedosDeviceTrustStateFact = "pending" | "trusted" | "revoked" | "unavailable" | "unknown";

export interface FedosConversationSecurityStateDeviceKnowledgeFacts {
  /** Live Registry trust states of every peer device this conversation's counterparty account has actually been cryptographically observed announcing. Empty = never observed any. */
  readonly observedPeerDeviceTrustStates: readonly FedosDeviceTrustStateFact[];
  readonly asOf: number | null;
}

function evaluateDeviceKnowledge(facts: FedosConversationSecurityStateDeviceKnowledgeFacts): FedosSecurityAxisResult {
  if (facts.observedPeerDeviceTrustStates.length === 0) {
    return { state: "unknown", reasonCode: "no-device-observed", asOf: null, source: "unavailable" };
  }
  // Most-degraded-first, mirrors the historical precedent's own "device" axis reasoning exactly.
  if (facts.observedPeerDeviceTrustStates.includes("revoked")) {
    return { state: "attention", reasonCode: "observed-device-revoked", asOf: facts.asOf, source: "live" };
  }
  if (facts.observedPeerDeviceTrustStates.includes("unavailable")) {
    return { state: "attention", reasonCode: "observed-device-registration-unavailable", asOf: facts.asOf, source: "live" };
  }
  if (facts.observedPeerDeviceTrustStates.some((s) => s === "pending" || s === "unknown")) {
    return { state: "unknown", reasonCode: "observed-device-not-yet-trusted", asOf: facts.asOf, source: "live" };
  }
  return { state: "good", reasonCode: "observed-devices-trusted", asOf: facts.asOf, source: "live" };
}

// ---------------------------------------------------------------------------
// Axis 5: EVIDENCE_INTEGRITY
// Fact source: rejection reasons from `FedosDirectRatchetSessionResetAuthority.evaluate()`
// (`../../conversations/ratchet/fedos_direct_ratchet_session_reset_authentication.js`)
// and `evaluateFedosIdentityTransitionEvidence()`'s own `structurallyValid`/
// rejection outcomes -- genuinely NEW relative to the historical 7-axis
// model (added because false-green scenarios 14/15 -- replay, malformed
// evidence -- have no other axis to report through; see `07_TEST_MATRIX.md`
// Part 2, scenarios 14-15).
// ---------------------------------------------------------------------------

export interface FedosConversationSecurityStateEvidenceIntegrityFacts {
  /** `null` = no recent rejected/invalid security evidence observed for this conversation. */
  readonly lastRejectionReasonCode: string | null;
  readonly asOf: number | null;
}

function evaluateEvidenceIntegrity(facts: FedosConversationSecurityStateEvidenceIntegrityFacts): FedosSecurityAxisResult {
  if (facts.lastRejectionReasonCode === null) {
    return { state: "good", reasonCode: "no-rejected-security-evidence", asOf: facts.asOf, source: facts.asOf === null ? "unavailable" : "live" };
  }
  return { state: "attention", reasonCode: `evidence-rejected-${facts.lastRejectionReasonCode}`, asOf: facts.asOf, source: "live" };
}

// ---------------------------------------------------------------------------
// Axis 6: METADATA_EXPOSURE
// Permanent standing disclosure -- FedOS provides no metadata protection
// beyond ordinary NIP-17 regardless of relay connectivity. Needs no live
// relay-count data to be honest (preserved verbatim from the historical
// precedent's own `unknown` reading for "can't read relay status" --
// mapped here to the same permanent `not-protected`/ATTENTION reading
// either way, since both cases share the identical user-facing truth:
// relays can see this conversation is happening).
// ---------------------------------------------------------------------------

export interface FedosConversationSecurityStateMetadataExposureFacts {
  readonly connectedRelayCount: number | null;
}

function evaluateMetadataExposure(facts: FedosConversationSecurityStateMetadataExposureFacts): FedosSecurityAxisResult {
  return {
    state: "attention",
    reasonCode: facts.connectedRelayCount === null || facts.connectedRelayCount === 0 ? "no-relay-connected-metadata-still-exposed-when-connected" : "relay-connected-metadata-exposed",
    asOf: null,
    source: "unavailable",
  };
}

// ---------------------------------------------------------------------------
// Top-level evaluator
// ---------------------------------------------------------------------------

export interface FedosConversationSecurityStateFacts {
  readonly conversationId: string;
  readonly now: number;
  readonly identityContinuity: FedosConversationSecurityStateIdentityContinuityFacts;
  readonly encryption: FedosConversationSecurityStateEncryptionFacts;
  readonly forwardSecrecy: FedosConversationSecurityStateForwardSecrecyFacts;
  readonly deviceKnowledge: FedosConversationSecurityStateDeviceKnowledgeFacts;
  readonly evidenceIntegrity: FedosConversationSecurityStateEvidenceIntegrityFacts;
  readonly metadataExposure: FedosConversationSecurityStateMetadataExposureFacts;
}

export function deriveConversationSecurityState(facts: FedosConversationSecurityStateFacts): FedosConversationSecurityState {
  return Object.freeze({
    conversationId: facts.conversationId,
    identityContinuity: evaluateIdentityContinuity(facts.identityContinuity, facts.now),
    encryption: evaluateEncryption(facts.encryption),
    forwardSecrecy: evaluateForwardSecrecy(facts.forwardSecrecy),
    deviceKnowledge: evaluateDeviceKnowledge(facts.deviceKnowledge),
    evidenceIntegrity: evaluateEvidenceIntegrity(facts.evidenceIntegrity),
    metadataExposure: evaluateMetadataExposure(facts.metadataExposure),
  });
}
