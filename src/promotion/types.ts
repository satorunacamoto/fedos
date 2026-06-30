/**
 * Stage 18 — promotion INTEGRATION BOUNDARY (types only).
 *
 * This layer lets a Space / Thread / Chat / Product surface ask an EXISTING
 * Cloudflare ad/recommendation system (edge-rec-middleware / recommendation-
 * rewriter) "please place a promotion here". It models only the request/response
 * shapes and the placement vocabulary — it is NOT an ad engine.
 *
 * Explicitly OUT OF SCOPE for this stage (and this whole module): ad selection,
 * ranking, auctions, CTR/A-B testing, click tracking, billing, Stripe, Telegram,
 * HTMLRewriter, fetch/HTTP, Worker wiring, and any D1/KV. A `PromotionDecision`
 * is whatever an injected provider returns; the only provider implemented here
 * is an in-memory mock that returns fixed candidates. Nothing here serves a real
 * ad or measures anything.
 */

/** The concrete slot a promotion can occupy across the product's surfaces. */
export type PlacementType =
  | "thread_header"
  | "thread_inline"
  | "thread_footer"
  | "space_header"
  | "space_sidebar"
  | "space_footer"
  | "chat_header"
  | "chat_inline"
  | "chat_footer"
  | "product_sidebar"
  | "search_result";

/** The surface family a placement belongs to (derived from its `PlacementType`). */
export type PlacementContext = "thread" | "space" | "chat" | "product" | "search";

/** A resolved placement: its slot, surface family, and a display label. */
export interface Placement {
  readonly type: PlacementType;
  readonly context: PlacementContext;
  readonly label: string;
}

/**
 * A request handed to a promotion provider. It carries WHERE (placement) and
 * just enough context for the external system to target — never any selection
 * logic. Ids irrelevant to the placement's context are dropped by
 * `filterPromotionContext`.
 */
export interface PromotionRequest {
  readonly placement: Placement;
  readonly viewerPubkey?: string;
  readonly spaceId?: string;
  readonly threadId?: string;
  readonly chatId?: string;
  readonly productId?: string;
  /** Targeting hints (topic/kind tags). Deduped, never trusted as commands. */
  readonly tags: readonly string[];
  readonly locale?: string;
  /** Max number of candidates the surface can show. >= 0. */
  readonly limit: number;
}

/**
 * One promotion the external system offers. This layer never decides which to
 * show; it only carries the shape so a provider can return candidates and a
 * renderer can label a slot. `destination` is an opaque target the boundary
 * neither opens nor tracks.
 */
export interface PromotionCandidate {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  /** Opaque click target (URL/ref); not opened, fetched, or measured here. */
  readonly destination: string;
  readonly image?: string;
  readonly sponsor: string;
  /** Higher is more important (provider-defined; not interpreted here). */
  readonly priority: number;
  /** Relative weight (provider-defined; not interpreted here). */
  readonly weight: number;
  /** Free-form provider metadata, passed through untouched. */
  readonly metadata: Readonly<Record<string, string>>;
}

/** Why a provider returned the candidates it did. */
export type PromotionReason =
  | "ok"
  | "no_candidates"
  | "limit_zero"
  | "viewer_opted_out"
  | "placement_disabled"
  | "context_filtered"
  | "provider_error";

/** A provider's answer for one request: the chosen candidates plus a reason. */
export interface PromotionDecision {
  readonly selected: readonly PromotionCandidate[];
  readonly reason: PromotionReason;
  readonly placement: Placement;
}
