/**
 * Reputation / Persona Epoch design arc — Commerce→Trust issuance Port
 * (Gap #8, `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md`).
 *
 * DESIGN + TYPE-ONLY SCAFFOLDING, same status as `persona_epoch.ts` /
 * `attestation_types.ts` — see those files' headers and `../README.md`.
 * `NoopCommerceTrustIssuancePort` below is a REAL, testable no-op
 * implementation (this repo's established `Noop*Provider` pattern — see
 * `../creator/entitlement.ts`'s `NoopEntitlementProvider`,
 * `../marketplace/`'s `NoopMarketplaceProvider`), not a stand-in for a real
 * adapter — it is what `createCommerce()` would default to until an
 * implementing adapter exists, exactly like those two.
 *
 * WHAT THIS PORT IS FOR
 * ----------------------------------------------------------------------
 * Commerce would call this Port, post-completed-trade, to ask for a Trust
 * entitlement (and optionally its QR encoding) to be issued to the trading
 * party's `PersonaEpoch` key — the exact seam Gap #8 and Gap #13
 * (`COMMERCE-GAP-CLASSIFICATION.md` rows 8/13) describe as missing, and the
 * exact reuse `docs/commerce/FEDOS-COMMERCE-END-TO-END.md` §6 already
 * names as "AVAILABLE WITH EXISTING PRIMITIVES": issuing a
 * `FedosSubscriptionEntitlement` (whose scopes already include
 * `"signed-qr"` and `"contract-proof"`,
 * `src/os/trust/entitlement/fedos_trust_subscription_entitlement_types.ts`'s
 * `FEDOS_TRUST_SUBSCRIPTION_SCOPES`) as a purchase receipt.
 *
 * WHY THIS FILE DEFINES ITS OWN PLACEHOLDER TYPES INSTEAD OF IMPORTING
 * `src/os/trust`
 * ----------------------------------------------------------------------
 * This wave is design + type-only scaffolding — the arc brief for this
 * wave is explicit that "actual wiring (and the deliberate, documented
 * relaxation of this specific test) happens at the coordinator's
 * integration gate in a later wave." So every type below MIRRORS the real
 * Trust shape it stands in for (cited per-field) without importing it.
 *
 * PRECISE FINDING FOR THE COORDINATOR — READ BEFORE WIRING
 * ----------------------------------------------------------------------
 * `test/architecture_boundary_trust.test.ts` was read in full for this
 * design (per this wave's required reading) and, contrary to a loose
 * reading of "zero cross-imports between os/commerce and os/trust", it
 * ONLY constrains ONE direction: its `FORBIDDEN_RELATIVE_PREFIXES`
 * (lines 28-36 of that file, includes `"src/os/commerce/"`) blocks a
 * relative import INSIDE `src/os/trust` from resolving into
 * `src/os/commerce` — i.e. it stops Trust from depending on Commerce. That
 * direction is never needed for this Port (Trust must stay a
 * general-purpose capability with no knowledge of Commerce) and this
 * design does not ask the coordinator to touch that test at all.
 *
 * The direction this Port actually needs — a Commerce-side adapter
 * importing FROM `src/os/trust` (to call
 * `issueFedosSubscriptionEntitlement`/`verifyFedosSubscriptionEntitlement`
 * from `src/os/trust/entitlement/index.ts` and
 * `encodeFedosTrustEnvelopeToQrText` from `src/os/trust/qr/index.ts`) — is,
 * on direct inspection, NOT currently forbidden by any automated boundary
 * test: `test/architecture_boundary_commerce.test.ts`'s own
 * `FORBIDDEN_PREFIXES` (lines 40-47 of that file) lists
 * `conversation/board/desktop/device/nostr/messenger` only — it does not
 * mention `src/os/trust` at all. So a future adapter file under
 * `src/os/commerce/reputation/` importing `src/os/trust` would not, as
 * far as this design's reading of the current test suite shows, trip
 * EITHER architecture boundary test today.
 *
 * That is exactly why this design still recommends the coordinator make an
 * EXPLICIT, NARROW addition — not because a test will otherwise fail, but
 * because leaving this undocumented means any future file anywhere under
 * `src/os/commerce/` could import `src/os/trust` with no test ever
 * flagging it, which defeats the purpose of having a boundary test at all.
 * The recommended, minimal, contained change:
 *
 *   1. In `test/architecture_boundary_commerce.test.ts`, add a new reserved
 *      adapter directory constant analogous to the file's own existing
 *      `NOSTR_ADAPTER_DIR` pattern (see that file's lines 51-64), e.g.
 *      `const TRUST_ADAPTER_DIR = "src/os/commerce/reputation/adapters/trust/";`,
 *      and extend `FORBIDDEN_PREFIXES`'s enforcement so an import into
 *      `src/os/trust/` is allowed ONLY from a file under that one reserved
 *      directory — mirroring exactly how `isNostrAdapterFile`/
 *      `isNostrTarget` already gate the one existing Nostr exception in
 *      that same file, rather than opening `src/os/commerce` to `os/trust`
 *      wholesale.
 *   2. The ONE new adapter file that would live there (e.g.
 *      `src/os/commerce/reputation/adapters/trust/commerce_trust_issuance_adapter.ts`,
 *      not created by this wave) is the ONLY file allowed to import
 *      `src/os/trust/entitlement/index.ts` and `src/os/trust/qr/index.ts`,
 *      and would be the sole implementer of `CommerceTrustIssuancePort`
 *      below other than `NoopCommerceTrustIssuancePort`.
 *   3. `test/architecture_boundary_trust.test.ts` itself needs NO change
 *      under this plan — the finding above is that it already permits
 *      what's needed and forbids what should stay forbidden. If the
 *      coordinator's integration gate discovers a reason `os/trust` itself
 *      needs to import something Commerce-shaped (this design does not
 *      anticipate one), that would be a new, separately-justified decision,
 *      not an assumed consequence of this Port.
 */

import type { ReputationLocalSignedEnvelopeShape } from "./attestation_types.js";

/** Mirrors `FedosTrustSubscriptionScope`
 * (`src/os/trust/entitlement/fedos_trust_subscription_entitlement_types.ts`'s
 * `FEDOS_TRUST_SUBSCRIPTION_SCOPES`), narrowed to the two scopes
 * `FEDOS-COMMERCE-END-TO-END.md` §6 already identifies as relevant to a
 * purchase receipt, plus the base `"credential"` scope a minimal receipt
 * might also want. Deliberately NOT the full real union — a placeholder
 * mirror only needs to name what THIS design actually requests. */
export type CommerceTrustIssuanceScopePlaceholder = "signed-qr" | "contract-proof" | "credential";

/** What Commerce would ask Trust for, post-completed-trade. */
export interface CommerceTrustIssuanceRequest {
  /** Mirrors `PersonaEpoch.epochKeyPublicHex` (`persona_epoch.ts`) — the
   * party receiving the entitlement/receipt. */
  readonly subjectPersonaEpochKeyPublicHex: string;
  /** Mirrors `TradeCompletionAttestationPayload.tradeRefDigestHex`
   * (`attestation_types.ts`) — the same one-way digest, never a raw order
   * id, carried through so an issued entitlement can (if an implementation
   * chooses) be bound to the specific trade it was earned by without ever
   * naming that trade's real id. */
  readonly tradeRefDigestHex: string;
  readonly requestedScopes: readonly CommerceTrustIssuanceScopePlaceholder[];
  /** Unix seconds. Mirrors `FedosSubscriptionEntitlement.validFrom`. */
  readonly validFrom: number;
  /** Unix seconds. Mirrors `FedosSubscriptionEntitlement.validUntil`. */
  readonly validUntil: number;
}

/** Mirrors `FedosSubscriptionEntitlement`
 * (`src/os/trust/entitlement/fedos_trust_subscription_entitlement_types.ts`)
 * field-for-field. */
export interface CommerceTrustIssuanceEntitlementPlaceholder {
  readonly subjectPublicKeyHex: string;
  readonly issuerKeyId: string;
  readonly planId: string;
  readonly scopes: readonly string[];
  readonly validFrom: number;
  readonly validUntil: number;
  readonly serial: string;
  readonly formatVersion: number;
}

/** The signed-envelope-shaped issuance result, reusing the same local
 * mirror `attestation_types.ts` defines rather than a second, slightly
 * different one. */
export type CommerceTrustIssuanceEnvelopePlaceholder =
  ReputationLocalSignedEnvelopeShape<CommerceTrustIssuanceEntitlementPlaceholder>;

export type CommerceTrustIssuanceOutcome = "issued" | "unavailable" | "rejected" | "error";

export interface CommerceTrustIssuanceResult {
  readonly outcome: CommerceTrustIssuanceOutcome;
  readonly reason: string;
  /** Present only when `outcome === "issued"`. */
  readonly envelope?: CommerceTrustIssuanceEnvelopePlaceholder;
  /** Present only when `outcome === "issued"` AND the caller requested QR
   * encoding. Mirrors the text shape
   * `encodeFedosTrustEnvelopeToQrText()`
   * (`src/os/trust/qr/fedos_trust_qr_text_codec.ts`) produces
   * (`"fedos:trust:v1:" + base64url(JSON)`) — this Port does not itself
   * encode anything; a real adapter would call that function. */
  readonly qrText?: string;
}

/**
 * The Port Commerce would depend on. Implementations MUST NOT be
 * constructed with, or ever come to hold, real Trust signing key material
 * themselves — an adapter implementing this interface delegates signing to
 * an operator-controlled issuer keypair exactly as
 * `src/os/trust/issuer/fedos_trust_issuer_secret_provider.ts` already
 * requires for the standalone CLI (secret loaded via a file path env var,
 * never logged, never in git).
 */
export interface CommerceTrustIssuancePort {
  requestTradeCompletionIssuance(
    request: CommerceTrustIssuanceRequest,
  ): Promise<CommerceTrustIssuanceResult>;
}

const COMMERCE_TRUST_ISSUANCE_SCOPES: readonly CommerceTrustIssuanceScopePlaceholder[] = [
  "signed-qr",
  "contract-proof",
  "credential",
];

function isWellFormedCommerceTrustIssuanceScope(value: unknown): value is CommerceTrustIssuanceScopePlaceholder {
  return (
    typeof value === "string" &&
    (COMMERCE_TRUST_ISSUANCE_SCOPES as readonly string[]).includes(value)
  );
}

const HEX_64_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Structural well-formedness check for a `CommerceTrustIssuanceRequest` —
 * real, testable logic (not just a type), matching this repo's
 * "type-only scaffolding still needs tests wherever there's real logic"
 * requirement for this wave. Fails closed to `false`; never throws.
 */
export function isWellFormedCommerceTrustIssuanceRequest(
  value: unknown,
): value is CommerceTrustIssuanceRequest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (typeof candidate.subjectPersonaEpochKeyPublicHex !== "string" || !HEX_64_PATTERN.test(candidate.subjectPersonaEpochKeyPublicHex)) {
    return false;
  }
  if (typeof candidate.tradeRefDigestHex !== "string" || !HEX_64_PATTERN.test(candidate.tradeRefDigestHex)) return false;
  if (!Array.isArray(candidate.requestedScopes) || candidate.requestedScopes.length === 0) return false;
  for (const scope of candidate.requestedScopes) {
    if (!isWellFormedCommerceTrustIssuanceScope(scope)) return false;
  }
  if (typeof candidate.validFrom !== "number" || !Number.isInteger(candidate.validFrom)) return false;
  if (typeof candidate.validUntil !== "number" || !Number.isInteger(candidate.validUntil)) return false;
  if (candidate.validUntil <= candidate.validFrom) return false;

  return true;
}

/**
 * The default, no-op implementation — mirrors `NoopEntitlementProvider`
 * (`../creator/entitlement.ts`) and `NoopMarketplaceProvider`'s own
 * discipline: NEVER issues anything, NEVER contacts `src/os/trust`, and is
 * the ONLY implementation this design wave ships. `createCommerce()`
 * (`../create_commerce.ts`, NOT modified by this wave) would default to
 * this the same way it already defaults to `NoopPaymentProvider`/
 * `NoopMarketplaceProvider` once a future wave wires this Port in at all.
 */
export class NoopCommerceTrustIssuancePort implements CommerceTrustIssuancePort {
  async requestTradeCompletionIssuance(
    _request: CommerceTrustIssuanceRequest,
  ): Promise<CommerceTrustIssuanceResult> {
    return {
      outcome: "unavailable",
      reason: "no commerce->trust issuance adapter is configured",
    };
  }
}
