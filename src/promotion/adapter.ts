/**
 * Stage 18 — provider boundary to the EXISTING ad/recommendation system.
 *
 * `PromotionProvider` and `RecommendationProvider` are the seams the real
 * Cloudflare systems (edge-rec-middleware / recommendation-rewriter) will
 * implement in a later stage. This file ships ONLY an in-memory mock that
 * returns fixed candidates — it performs no fetch/HTTP, touches no Cloudflare
 * resource, opens no socket, and calls no Stripe/Telegram/HTMLRewriter. It does
 * not rank, auction, track clicks, or measure anything.
 */

import type {
  PromotionCandidate,
  PromotionDecision,
  PromotionReason,
  PromotionRequest,
} from "./types.js";

/**
 * The ad/promotion seam. A real implementation forwards the request to the
 * existing ad system and adapts its response into a `PromotionDecision`.
 */
export interface PromotionProvider {
  getPromotions(request: PromotionRequest): Promise<PromotionDecision>;
}

/**
 * The recommendation seam (recommendation-rewriter). Kept separate from the ad
 * provider so the two existing systems can be wired independently later.
 */
export interface RecommendationProvider {
  getRecommendations(request: PromotionRequest): Promise<PromotionDecision>;
}

/** Two inert sample candidates used when no candidates are configured. */
const DEFAULT_MOCK_CANDIDATES: readonly PromotionCandidate[] = [
  {
    id: "mock-promo-1",
    title: "Sample promotion",
    description: "A fixed mock candidate — not a real advertisement.",
    destination: "https://example.com/mock-1",
    sponsor: "example",
    priority: 10,
    weight: 1,
    metadata: { mock: "true" },
  },
  {
    id: "mock-promo-2",
    title: "Another sample promotion",
    destination: "https://example.com/mock-2",
    sponsor: "example",
    priority: 5,
    weight: 1,
    metadata: { mock: "true" },
  },
];

export interface MockPromotionProviderOptions {
  /** Fixed candidates to draw from. Defaults to two inert samples. */
  readonly candidates?: readonly PromotionCandidate[];
}

/**
 * In-memory `PromotionProvider` for tests and prototypes. Returns the first
 * `request.limit` configured candidates (in given order) with NO network I/O and
 * NO selection logic. A request asking for zero slots yields an empty decision.
 */
export class MockPromotionProvider implements PromotionProvider {
  readonly #candidates: readonly PromotionCandidate[];

  constructor(options: MockPromotionProviderOptions = {}) {
    this.#candidates = options.candidates ?? DEFAULT_MOCK_CANDIDATES;
  }

  getPromotions(request: PromotionRequest): Promise<PromotionDecision> {
    if (request.limit <= 0) {
      return Promise.resolve({
        selected: [],
        reason: "limit_zero",
        placement: request.placement,
      });
    }
    const selected = this.#candidates.slice(0, request.limit);
    const reason: PromotionReason = selected.length > 0 ? "ok" : "no_candidates";
    return Promise.resolve({ selected, reason, placement: request.placement });
  }
}

/**
 * In-memory `RecommendationProvider` for tests and prototypes. Mirrors
 * `MockPromotionProvider` over the recommendation seam; same fixed-candidate
 * behaviour, NO network. Useful as a safe default when no real
 * recommendation-rewriter endpoint is configured.
 */
export class MockRecommendationProvider implements RecommendationProvider {
  readonly #inner: MockPromotionProvider;

  constructor(options: MockPromotionProviderOptions = {}) {
    this.#inner = new MockPromotionProvider(options);
  }

  getRecommendations(request: PromotionRequest): Promise<PromotionDecision> {
    return this.#inner.getPromotions(request);
  }
}
