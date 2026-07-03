/**
 * Stage 109 — Nearby Discovery consent boundary (types only).
 *
 * A MINIMAL, future-facing seam for the consent gate `docs/nearby_consent_policy.md`
 * requires before any "Nearby Discovery" (physical-proximity grouping) feature can
 * read a coordinate or compute an area id. This file defines shapes ONLY — it
 * implements no consent UI, no permission-request flow, no area-id computation, and
 * no GPS/`navigator.geolocation` access.
 *
 * HARD GUARDRAILS (see `docs/nearby_area_indexing_research.md` and
 * `docs/nearby_consent_policy.md`):
 *   - NO consent can ever be `granted` by anything in this stage. Nearby Discovery
 *     has no real consent UI yet, so — per the consent policy's "explicit, informed"
 *     requirement — nothing here may claim consent was given. `allowed` is `false`
 *     and `status` is never `"granted"` for any implementation this stage ships.
 *   - Requests carry an OPAQUE, non-secret `reference` ONLY (e.g. a UI slot id) —
 *     never a coordinate, an area id, a geohash/H3/S2 cell id, or any location value.
 *   - This boundary performs NO GPS access, NO `navigator.geolocation` call, NO
 *     mobile permission request, and NO network call of any kind.
 *   - This boundary makes NO privacy/consent-compliance guarantee. It is NOT wired
 *     into the runtime, the Worker, or `StorageBackend`.
 */

/**
 * Coarse observable state of a consent provider. No coordinate, area id, or
 * location value is exposed at any state.
 */
export type NearbyConsentStatus =
  | "unavailable" // no consent provider is present (the no-op default)
  | "denied" // consent has not been granted — the ONLY reachable state this stage ships
  | "error"; // an operation could not be served; recorded as state, never thrown

/**
 * The result of a consent read/request/revoke. `allowed` is `true` only when
 * Nearby Discovery may be enabled for the caller — this stage NEVER produces
 * `allowed: true`, because no real, informed consent UI exists yet.
 */
export interface NearbyConsentDecision {
  readonly allowed: boolean;
  /** The consent state AFTER this decision. */
  readonly status: NearbyConsentStatus;
  /** Non-sensitive explanation. Never echoes a coordinate or location value. */
  readonly reason: string;
}

/**
 * FUTURE capabilities a consent provider MIGHT expose — all PLACEHOLDERS in this
 * stage. Presence of a name is a label of intent, NOT a working or safe feature.
 */
export type NearbyConsentCapability =
  | "explicit_opt_in_placeholder" // a future UI flow asking for informed, explicit consent
  | "revocation_placeholder" // a future "turn Nearby off" action
  | "area_indexing_placeholder"; // the future area-id feature this consent would gate

/**
 * How a caller ASKS for consent. `reference` is an OPAQUE, non-secret UI label
 * (e.g. `"settings_nearby_toggle"`) — NEVER a coordinate, area id, or any
 * location-derived value. The boundary derives nothing from it.
 */
export interface NearbyConsentRequest {
  readonly reference?: string;
}

/**
 * The Nearby consent seam. Implementations MUST NOT call a browser geolocation
 * API, request an OS location permission, compute an area id, or issue a
 * `fetch`. Every method is total and never throws. `allowed: true` is NEVER
 * returned by any implementation this stage ships. Constructing an
 * implementation does nothing.
 */
export interface NearbyConsentProvider {
  /** Current coarse status (pure read). */
  getStatus(): NearbyConsentDecision;
  /** The PLACEHOLDER capabilities this provider advertises (may be empty). */
  getCapabilities(): readonly NearbyConsentCapability[];
  /**
   * Ask for consent. Starts NO real consent flow, calls no permission API, and
   * NEVER grants — see the hard guardrail above. Reads only `request.reference`.
   */
  requestConsent(request: NearbyConsentRequest): Promise<NearbyConsentDecision>;
  /** Revoke consent. A safe no-op in this stage (nothing was ever granted). */
  revokeConsent(): Promise<NearbyConsentDecision>;
  /** True only if consent is currently granted. Always `false` in this stage. */
  isGranted(): boolean;
}

/** Every placeholder capability name (for mapping/documentation helpers). */
export const NEARBY_CONSENT_CAPABILITIES: readonly NearbyConsentCapability[] = [
  "explicit_opt_in_placeholder",
  "revocation_placeholder",
  "area_indexing_placeholder",
];
