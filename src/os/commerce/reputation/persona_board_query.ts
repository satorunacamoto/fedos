/**
 * Reputation / Persona Epoch — REAL read-only Persona Board query (Wave B,
 * Agent R closure pass).
 *
 * `disclosure_layers.ts` defined `PersonaBoardInternalRecord` (a
 * "HYPOTHETICAL full backing record") and `projectPersonaRecordToDisclosureLayer`
 * (a real projection function with no real data source to project FROM).
 * This file is that missing data source: it builds a REAL
 * `PersonaBoardInternalRecord` from a `LocalTradeCompletionAttestationStore`
 * + `LocalPersonaEpochRegistry`, by re-verifying every stored envelope
 * itself (never trusting the store's mere presence of an entry).
 *
 * THIS IS THE RENDERER-SAFE READ-MODEL SURFACE
 * ----------------------------------------------------------------------
 * `queryPersonaBoardView` is a plain, synchronous, side-effect-free function
 * over caller-supplied domain objects — no Electron/IPC/DOM dependency of
 * any kind, safe to call from a renderer-side module once the coordinator
 * wires an IPC bridge around it (see this file's own TODO block below for
 * exactly what that wiring needs — this file does not do it, per this arc's
 * "never touch Electron composition-root/main/preload files" constraint).
 *
 * PUBLIC vs PSEUDONYMOUS_PROOF vs AUTHORIZED — enforced by `disclosure_layers.ts`,
 * not re-implemented here. This file's ONLY job is building the internal
 * record; `projectPersonaRecordToDisclosureLayer` (unchanged, imported)
 * remains the sole place that decides what each layer may see. PRIVATE
 * evidence (dispute records, real identity, payment/delivery detail) is
 * never modeled anywhere in this file's `PersonaBoardInternalRecord`
 * construction, matching `disclosure_layers.ts`'s own "there is no such
 * additional data category to unlock" guarantee — see this file's header
 * for what IS exposed.
 *
 * TODO FOR THE COORDINATOR (central Electron wiring — NOT done by this file)
 * ----------------------------------------------------------------------
 * 1. Add an IPC channel (e.g. `fedos-app:commerce-persona-board-query`)
 *    whose main-process handler holds the real, process-lifetime
 *    `LocalTradeCompletionAttestationStore` + `LocalPersonaEpochRegistry`
 *    instances (constructed once, alongside the existing
 *    `LocalOrderRepository` the Order/Delivery composition already holds)
 *    and calls `queryPersonaBoardView`/`PersonaBoardController` below,
 *    returning only the already-layer-projected `PersonaBoardView` — never
 *    the internal record — across the IPC boundary.
 * 2. Add a preload-exposed method (mirrring the existing
 *    `window.fedosApp.commerce*` surface) that invokes that channel.
 * 3. Default the disclosure layer to `"PUBLIC"` for any renderer caller
 *    that has not separately been granted PSEUDONYMOUS_PROOF/AUTHORIZED
 *    access — this file and `disclosure_layers.ts` define the layers and
 *    their field sets, but WHO gets which layer for a given viewer is an
 *    access-control decision this domain layer deliberately leaves to the
 *    coordinator (mirrors `disclosure_layers.ts`'s own Layer-3
 *    `CapabilityGrant` note in `docs/architecture/PSEUDONYMOUS-REPUTATION.md` §6).
 * 4. A leaf renderer screen/component rendering `PersonaBoardView` is not
 *    included in this pass either — `PersonaBoardController` below returns
 *    plain data only; the coordinator's existing Commerce UI screen
 *    pattern (`../order/ui/order_view_models.ts`'s pure view-model style)
 *    should be followed for any actual markup/DOM.
 */

import {
  bucketVerifiedTradeCount,
  projectPersonaRecordToDisclosureLayer,
  type PersonaBoardDisclosureLayer,
  type PersonaBoardInternalRecord,
  type PersonaBoardView,
} from "./disclosure_layers.js";
import type { TradeCompletionCategory } from "./attestation_types.js";
import { computeAttestationRef, verifyTradeCompletionAttestationEnvelope } from "./attestation_sign_verify.js";
import type { LocalTradeCompletionAttestationStore } from "./trade_completion_attestation_store.js";
import type { LocalPersonaEpochRegistry } from "./persona_epoch_registry.js";

/** Verification-state summary a caller can show alongside a Persona Board
 * view — distinct from the disclosure-layer field set itself
 * (`disclosure_layers.ts`), this describes HOW the numbers backing the view
 * were established, per this arc's mandate ("verification state" is a
 * required minimum view field). */
export interface PersonaBoardVerificationState {
  readonly epochKnown: boolean;
  readonly epochCurrentlyValid: boolean;
  readonly totalStoredAttestations: number;
  readonly validSignatureAttestations: number;
  readonly rejectedSignatureAttestations: number;
}

export interface PersonaBoardQueryResult {
  readonly view: PersonaBoardView;
  readonly verificationState: PersonaBoardVerificationState;
}

/**
 * Builds a REAL `PersonaBoardInternalRecord` for `subjectEpochId` by
 * re-verifying every `TradeCompletionAttestationEnvelope` the store has for
 * it — an entry whose signature does not independently verify is EXCLUDED
 * from every count, never trusted merely because it is present in the
 * store (defense in depth: `LocalTradeCompletionAttestationStore.record()`
 * is only ever called with a freshly-signed envelope by
 * `reputation_issuance.ts` today, but this read path must not assume that
 * will always remain the only writer).
 */
export function buildPersonaBoardInternalRecordAndVerification(
  subjectEpochId: string,
  registry: LocalPersonaEpochRegistry,
  store: LocalTradeCompletionAttestationStore,
  asOf: number,
): { record: PersonaBoardInternalRecord; verificationState: PersonaBoardVerificationState } | undefined {
  const epoch = registry.findById(subjectEpochId);
  if (epoch === undefined) {
    return undefined;
  }

  const stored = store.findBySubjectEpochId(subjectEpochId);
  const verifiedEnvelopes = stored.filter((envelope) => verifyTradeCompletionAttestationEnvelope(envelope).status === "VALID");
  const countedTrades = verifiedEnvelopes.filter((envelope) => envelope.payload.outcome !== "not_completed");

  const categoryBreakdown: Partial<Record<TradeCompletionCategory, number>> = {};
  for (const envelope of countedTrades) {
    const category = envelope.payload.category;
    categoryBreakdown[category] = (categoryBreakdown[category] ?? 0) + 1;
  }

  const record: PersonaBoardInternalRecord = {
    epochId: epoch.epochId,
    epochKeyPublicHex: epoch.epochKeyPublicHex,
    verifiedTradeCount: countedTrades.length,
    categoryBreakdown,
    attestationRefs: countedTrades.map((envelope) => computeAttestationRef(envelope)),
    asOf,
  };

  const verificationState: PersonaBoardVerificationState = {
    epochKnown: true,
    epochCurrentlyValid: registry.isCurrentlyValid(subjectEpochId, asOf),
    totalStoredAttestations: stored.length,
    validSignatureAttestations: verifiedEnvelopes.length,
    rejectedSignatureAttestations: stored.length - verifiedEnvelopes.length,
  };

  return { record, verificationState };
}

/**
 * The read-model entry point: builds the internal record, then projects it
 * to exactly the given disclosure layer (`disclosure_layers.ts` — PUBLIC /
 * PSEUDONYMOUS_PROOF field sets are identical and coarse-bucketed;
 * AUTHORIZED gets exact figures — see that file's own header). Returns
 * `undefined` when the epoch is not known to `registry` at all (never
 * fabricates a zero-history view for an unknown epoch id).
 */
export function queryPersonaBoardView(
  subjectEpochId: string,
  layer: PersonaBoardDisclosureLayer,
  registry: LocalPersonaEpochRegistry,
  store: LocalTradeCompletionAttestationStore,
  asOf: number,
): PersonaBoardQueryResult | undefined {
  const built = buildPersonaBoardInternalRecordAndVerification(subjectEpochId, registry, store, asOf);
  if (built === undefined) return undefined;
  const view = projectPersonaRecordToDisclosureLayer(built.record, layer);
  return { view, verificationState: built.verificationState };
}

/** Re-exported for a caller that only wants the bucket label directly
 * (e.g. a summary chip) without a full view projection. */
export { bucketVerifiedTradeCount };
