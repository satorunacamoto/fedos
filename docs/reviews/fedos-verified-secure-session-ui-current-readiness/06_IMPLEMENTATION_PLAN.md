# Verified Secure Session UI — Coordinator Semantic Freeze + Implementation Plan

Synthesizes Agent H (`02_HISTORICAL_7_AXIS_MAPPING.md`), Agent C
(`01_CURRENT_SECURITY_STATE_MAP.md`), Agent U (`03_CURRENT_UI_SURFACES.md`),
Agent R (`07_TEST_MATRIX.md`). This document is the frozen contract; once
written, the axis model/evaluator signature below do not change without a
new Coordinator decision.

## 1. Global Verified boolean: **NO**

Both Agent H (historical design's own header: "'Verified' is reserved for a
recorded human attestation and is never inferred from device trust state")
and Agent C ("FedOS computes NO safety number anywhere — still true")
independently confirm no verification ceremony exists. A single boolean
cannot be honestly computed. Per mandate §8: "If the current architecture
cannot justify one global Verified boolean: do not create one." None is
created. Multiple independent per-axis results only.

## 2. Final axis set (6, not forced to 7)

| Axis | Question | Primary current fact source |
|---|---|---|
| `IDENTITY_CONTINUITY` | Is the peer's identity the one we've always known; if changed, was it reviewed truthfully? | `evaluateFedosIdentityTransitionEvidence()`, `isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity()` (`src/os/messenger/conversations/identity_transition/...`) |
| `ENCRYPTION` | Is a Ratchet session genuinely established/active for this conversation+peer-device right now? | `FedosDesktopApplicationShell.directRatchetStatus()` → `FedosDirectRatchetSafeStatus` (8-value closed vocabulary, already real, already Shell-exposed) |
| `FORWARD_SECRECY` | Will THIS conversation's next message actually be routed through the Ratchet (not merely "a session exists somewhere")? | `selectFedosDirectConversationForwardSecrecyRoute()` / `describeFedosForwardSecrecyRoute()` (`fedos_direct_conversation_forward_secrecy_route.ts`, pure, already built, currently unconsumed by any UI) |
| `DEVICE_KNOWLEDGE` | Do we have current, trusted knowledge of the specific peer Device(s) this conversation has actually observed? | `FedosDeviceBindingV1.trustState` + `Shell.peerCapabilityListObserved()` (real "devices we've directly observed a capability advertisement from" — bounded, honest, NOT a full peer-device directory) |
| `EVIDENCE_INTEGRITY` | Is the most recent relevant security evidence (transition/reset/corroboration) structurally valid, non-stale, non-replayed? | `FedosDirectRatchetSessionResetAuthority.evaluate()` rejection reasons, `evaluateFedosIdentityTransitionEvidence()`'s `structurallyValid`/`historyOutcome` |
| `METADATA_EXPOSURE` | Can relays see that this conversation is happening, regardless of encryption? | Permanent standing disclosure — `not-protected` always, per Agent H §2.7; needs no live relay-count data to be honest |

**Why 6, not the historical 7 or the mandate's own 7-item hypothesis:**
`archive` (retention) and `deletion` (Signed Deletion) are deliberately
**excluded** from this panel — both already have real, dedicated, proven UI
surfaces (Safety Center). Folding them into a NEW "is this conversation's
crypto trustworthy" panel would blur exactly the "specific factual claims,
never collapsed" principle this whole feature exists to serve, and would
duplicate UI Agent U confirmed already works. `MEMBERSHIP` (mandate's own
hypothesis #6) is deferred: for the dominant case (`direct`, exactly 2
parties, code-enforced) it never varies; for `private-group` it is real
(Agent C Item 9) but is a secondary case — noted as a candidate 7th axis
for a future incremental pass per Agent H's own "Next" roadmap note, not
built this arc. `EVIDENCE_INTEGRITY` is genuinely NEW (not in the
historical 7) — added because mandate §27 scenarios 14/15 (replay,
malformed evidence) have no axis to report through otherwise; Agent R's
Part 2 design already grounds it in real current rejection-reason
vocabularies.

## 3. Per-axis states

`GOOD | ATTENTION | UNKNOWN | UNAVAILABLE | NOT_APPLICABLE` (mandate §10).
`UNKNOWN` never becomes `GOOD` silently — every mapping below is closed and
exhaustive over the real, existing closed vocabularies cited, so there is
no "default to GOOD" branch anywhere.

`GOOD` copy is factual, never one of the mandate §7 forbidden words. E.g.
`IDENTITY_CONTINUITY: GOOD` renders as "same identity as when this contact
was first added — no unexplained change observed," never "Identity
verified."

## 4. Evaluator contract

```ts
// src/os/messenger/desktop/presentation/security_state/fedos_conversation_security_state.ts
export type FedosSecurityAxisState = "good" | "attention" | "unknown" | "unavailable" | "not-applicable";

export interface FedosSecurityAxisResult {
  readonly state: FedosSecurityAxisState;
  readonly reasonCode: string;   // closed vocabulary per axis, never free-form prose
  readonly asOf: number | null;  // when this fact was last confirmed; null = never
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

export function deriveConversationSecurityState(facts: FedosConversationSecurityStateFacts): FedosConversationSecurityState;
```

Pure, synchronous, no I/O, no clock read (caller supplies `now`), renderer-
safe output (no keys, no device public key refs, no raw counters — mirrors
the historical module's own hard guardrails, re-affirmed). `facts` is an
explicit, already-resolved input object (mirrors `fedosSafetyCenterBuildSummary()`'s
own "No hidden weighting ... each section keeps its OWN independent state"
precedent, Agent R's own recommendation) — the evaluator itself does no
lookups; a separate, thin main-process adapter layer gathers `facts` by
calling already-real Shell/domain functions cited in §2's table.

## 5. Device Trust Visibility: **PARTIAL — protocol prerequisite**

"My Devices" (local account): COMPLETE, real UI+backend already shipped
(Agent U §4). "Peer's devices" as a full directory: genuinely blocked —
no cross-account peer-Device discovery/binding protocol exists anywhere
(Agent C Item 7, independently re-confirmed). Per mandate §19, this arc
does NOT design that protocol.

What IS real and will be surfaced: `Shell.peerCapabilityListObserved()` —
devices we have directly, cryptographically observed a capability
advertisement from (bounded, honest — never "all of Bob's devices," only
"devices we've actually heard from"). This backs the `DEVICE_KNOWLEDGE`
axis and a compact "observed devices" list in the Security Details panel,
explicitly labeled as observed-only, never a directory.

## 6. New Shell method (one, narrow, zero new domain logic)

`FedosDesktopApplicationShell.conversationForwardSecrecyRoute(conversationId,
remoteDeviceRef)` — wraps the already-built, already-tested pure
`selectFedosDirectConversationForwardSecrecyRoute()` +
`describeFedosForwardSecrecyRoute()`, mirroring `directRatchetStatus()`'s
own existing "narrow wrapper, no new business logic" pattern exactly
(same file, same class, adjacent placement). This is display/wiring, not
new protocol design.

## 7. UI plan (Agent U's Candidate A+B combination)

- Candidate A: compact indicator inserted after `#chat-meta` in
  `app-screen-chat`, populated in `openConversation()`, reusing the
  established glyph+status-badge convention (never color alone).
  `aria-label`-qualified trigger button opens the Security Details panel.
- Candidate B: Security Details panel structured as a new list+detail
  sub-section, mirroring the Identity Replacement/Signed Deletion pattern
  in `app-screen-safety` exactly (zero new interaction pattern) OR a modal
  cloned from `#app-confirm-overlay`'s proven ARIA-dialog CSS — Coordinator
  picks the Safety-Center-style panel for V1 (lower risk, reuses more).
- Each axis renders: name, status glyph+text, one-sentence factual
  explanation (from §2/§3), and (only where already-real) an action —
  "Review identity change" (existing flow), "Review devices" (existing
  Device screen). No new destructive action.

## 8. Explicitly deferred (per mandate, not this arc)

Tor, session-generation ratchet, decoy Persona, cross-account peer-Device
discovery protocol, per-message route indicator (Agent C Item 11 — needs a
new persisted field, out of scope), `archive`/`deletion` axes,
`MEMBERSHIP` axis.
