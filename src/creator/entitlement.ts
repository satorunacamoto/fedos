/**
 * Stage 111 — Creator entitlement boundary (types + no-op implementation).
 *
 * A protocol-neutral seam for "does this subject have access to this
 * resource" (digital content, a membership tier, a chat, a community) —
 * decoupled from HOW that access was earned. This boundary answers the
 * access QUESTION only; it never issues the grant that would answer it
 * `true`, and it never talks to a payment rail.
 *
 * HARD GUARDRAILS (see `docs/creator_entitlement_boundary.md`):
 *   - NO grant is ever issued here. This is NOT `src/commerce/`'s
 *     `PurchaseGrant` and does not construct one — a real grant/entitlement
 *     record lives elsewhere; this boundary only ever REPORTS a decision.
 *   - NO connection to `PaymentProvider` (`src/payment/`) or any
 *     `MarketplaceProvider` (`src/marketplace/`). An entitlement check
 *     never triggers or verifies a payment.
 *   - `checkPlaceholder` evaluates a decision ONLY — it never mutates any
 *     stored access state (there is none to mutate in this stage).
 *   - This boundary makes NO access-control guarantee. Do not describe it
 *     as "verified", "unlocked", or "granted".
 */

/** What kind of access is being asked about — a label of intent only. */
export type EntitlementKind =
  | "digital_access_placeholder"
  | "membership_access_placeholder"
  | "chat_access_placeholder"
  | "community_access_placeholder"
  | "test_placeholder";

/** Coarse observable state of an entitlement check. No grant/payment data is exposed at any state. */
export type EntitlementState =
  | "unavailable" // no entitlement provider is present (the no-op default)
  | "accepted_placeholder" // passed placeholder review; access is NOT actually verified/granted
  | "rejected" // failed placeholder review
  | "error"; // an operation could not be served; recorded, never thrown

/**
 * How a caller asks whether access is allowed. `subjectRef`/`resourceRef`
 * are OPAQUE labels (e.g. a display id) — never a pubkey/DID used for
 * lookup, and never a payment/receipt reference.
 */
export interface EntitlementCheckRequest {
  readonly kind: EntitlementKind;
  readonly subjectRef?: string;
  readonly resourceRef?: string;
}

/**
 * The result of an entitlement read/check. `allowed: true` would mean
 * "access granted" — no implementation in this stage ever returns it, since
 * nothing here verifies a real grant or payment.
 */
export interface EntitlementDecision {
  readonly allowed: boolean;
  readonly state: EntitlementState;
  readonly reason?: string;
}

/**
 * The entitlement seam. Implementations MUST NOT issue a grant, connect to
 * a `PaymentProvider`/`MarketplaceProvider`, or contact `StorageBackend`.
 * Every method is total and never throws. Constructing an implementation
 * does nothing.
 */
export interface EntitlementProvider {
  /** Current coarse status (pure read). */
  status(): EntitlementDecision;
  /** Ask whether access is allowed. Grants NOTHING in this stage. */
  checkPlaceholder(request: EntitlementCheckRequest): Promise<EntitlementDecision>;
}

/** Every entitlement-kind label (for mapping/documentation helpers). */
export const ENTITLEMENT_KINDS: readonly EntitlementKind[] = [
  "digital_access_placeholder",
  "membership_access_placeholder",
  "chat_access_placeholder",
  "community_access_placeholder",
  "test_placeholder",
];

/**
 * `NoopEntitlementProvider`: an entitlement provider that does nothing. The
 * only implementation this stage ships, and the only one `createRuntime`
 * selects. It is permanently `unavailable` and NEVER reports `allowed: true`
 * — every check is denied, never a real grant lookup. Every method is total
 * and never throws.
 *
 * NOT wired into `PaymentProvider`, `MarketplaceProvider`, `StorageBackend`,
 * any `CryptoProvider`, or the Worker.
 */
export class NoopEntitlementProvider implements EntitlementProvider {
  constructor() {
    // Does nothing: no provider present, no grant store contacted.
  }

  status(): EntitlementDecision {
    return {
      allowed: false,
      state: "unavailable",
      reason: "no creator entitlement provider is configured",
    };
  }

  async checkPlaceholder(_request: EntitlementCheckRequest): Promise<EntitlementDecision> {
    // Reads nothing from the request; grants nothing; contacts no payment rail.
    return {
      allowed: false,
      state: "unavailable",
      reason: "no creator entitlement provider is configured (access not granted)",
    };
  }
}
