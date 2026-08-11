/**
 * Stage 19 — adapter from the promotion boundary to the EXISTING Cloudflare ad
 * system (edge-rec-middleware / recommendation-rewriter).
 *
 * This is ONLY a translation/transport seam. It maps a Stage 18 `PromotionRequest`
 * into the edge-rec request body, posts it through an INJECTED fetch client, and
 * maps the response back into a `PromotionDecision`. It implements no ad logic:
 * no ranking, auction, CTR, A/B testing, click tracking, or billing, and it does
 * not call Stripe / Telegram / HTMLRewriter. The actual selection lives in the
 * existing system behind the injected client — it is not duplicated here.
 *
 * Privacy: the viewer pubkey is NOT sent by default. A caller may opt in to send
 * an opaque/hashed id (`hashViewerPubkey`) or, only with explicit consent, the
 * raw pubkey (`sendViewerPubkey`). All failures (rejection, non-200, malformed
 * body, timeout) resolve to a `provider_error` decision rather than throwing.
 */

import { canShowPromotion, filterPromotionContext } from "./policy.js";
import type { PromotionProvider, RecommendationProvider } from "./adapter.js";
import type {
  Placement,
  PromotionCandidate,
  PromotionDecision,
  PromotionReason,
  PromotionRequest,
} from "./types.js";

/** Minimal request init handed to the injected client (Worker-compatible). */
export interface EdgeRecRequestInit {
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

/** Minimal response contract the adapter relies on (a subset of `Response`). */
export interface EdgeRecHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

/**
 * Injected fetch client. Deliberately NOT the global `fetch`: callers pass a thin
 * wrapper (real Worker fetch, or a fake in tests) so this module never reaches
 * the network on its own.
 */
export type EdgeRecFetchLike = (
  url: string,
  init: EdgeRecRequestInit,
) => Promise<EdgeRecHttpResponse>;

/** Controls how (if at all) the viewer pubkey leaves the platform. */
export interface EdgeRecViewerOptions {
  /** Send the RAW viewer pubkey. Off by default; explicit opt-in only. */
  readonly sendViewerPubkey?: boolean;
  /** Transform the viewer pubkey into an opaque id before sending it. */
  readonly hashViewerPubkey?: (pubkey: string) => string;
}

export interface EdgeRecAdapterOptions extends EdgeRecViewerOptions {
  /** Injected HTTP client. Required — there is no global-fetch fallback. */
  readonly fetch: EdgeRecFetchLike;
  /** edge-rec-middleware endpoint URL. */
  readonly endpoint: string;
  /** Abort the request after this many ms (resolves provider_error). Default 2000. */
  readonly timeoutMs?: number;
  /** Optional bearer token sent as an Authorization header. */
  readonly apiKey?: string;
  /** Diagnostics hook for transport failures (never throws into the caller). */
  readonly onError?: (message: string) => void;
}

/** The context block sent to edge-rec (only fields relevant to the placement). */
export interface EdgeRecRequestContext {
  readonly surface: string;
  readonly spaceId?: string;
  readonly threadId?: string;
  readonly chatId?: string;
  readonly productId?: string;
  readonly tags: readonly string[];
  readonly locale?: string;
}

/** The request body posted to edge-rec-middleware. */
export interface EdgeRecRequestBody {
  readonly placement: string;
  readonly context: EdgeRecRequestContext;
  readonly limit: number;
  /** Opaque/hashed or (opt-in) raw viewer id. Omitted entirely by default. */
  readonly viewer?: string;
}

/** Loose shape of one candidate as returned by edge-rec. */
export interface EdgeRecResponse {
  readonly candidates: readonly unknown[];
}

const DEFAULT_TIMEOUT_MS = 2000;

/** Resolves the viewer field per the privacy options (opaque preferred). */
function resolveViewer(
  pubkey: string | undefined,
  options: EdgeRecViewerOptions,
): string | undefined {
  if (pubkey === undefined || pubkey.length === 0) return undefined;
  if (options.hashViewerPubkey) return options.hashViewerPubkey(pubkey);
  if (options.sendViewerPubkey) return pubkey;
  return undefined;
}

/**
 * Pure request mapper. Re-applies `filterPromotionContext` so the body only ever
 * carries ids relevant to the placement, then attaches the viewer per the
 * privacy options (omitted by default). Does not mutate the input request.
 */
export function mapPromotionRequestToEdgeRec(
  req: PromotionRequest,
  options: EdgeRecViewerOptions = {},
): EdgeRecRequestBody {
  const filtered = filterPromotionContext(req);
  const context: EdgeRecRequestContext = {
    surface: filtered.placement.context,
    ...(filtered.spaceId !== undefined ? { spaceId: filtered.spaceId } : {}),
    ...(filtered.threadId !== undefined ? { threadId: filtered.threadId } : {}),
    ...(filtered.chatId !== undefined ? { chatId: filtered.chatId } : {}),
    ...(filtered.productId !== undefined ? { productId: filtered.productId } : {}),
    tags: filtered.tags,
    ...(filtered.locale !== undefined ? { locale: filtered.locale } : {}),
  };
  const viewer = resolveViewer(filtered.viewerPubkey, options);
  return {
    placement: filtered.placement.type,
    context,
    limit: filtered.limit,
    ...(viewer !== undefined ? { viewer } : {}),
  };
}

/** Keeps only string-valued metadata entries and stamps `provider="edge-rec"`. */
function sanitizeMetadata(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw !== null && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string") out[key] = value;
    }
  }
  out.provider = "edge-rec";
  return out;
}

/** Maps one raw edge-rec candidate to a `PromotionCandidate`, or null if unusable. */
function mapEdgeRecCandidate(raw: unknown): PromotionCandidate | null {
  if (raw === null || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;

  const id = c.id;
  if (typeof id !== "string" || id.length === 0) return null;

  const destination =
    typeof c.destination === "string"
      ? c.destination
      : typeof c.url === "string"
        ? c.url
        : undefined;
  if (destination === undefined) return null;

  return {
    id,
    title: typeof c.title === "string" ? c.title : "",
    ...(typeof c.description === "string" ? { description: c.description } : {}),
    destination,
    ...(typeof c.image === "string" ? { image: c.image } : {}),
    sponsor: typeof c.sponsor === "string" ? c.sponsor : "",
    priority: typeof c.priority === "number" ? c.priority : 0,
    weight: typeof c.weight === "number" ? c.weight : 1,
    metadata: sanitizeMetadata(c.metadata),
  };
}

/** True if `value` looks like an edge-rec response (has a `candidates` array). */
export function isEdgeRecResponseLike(value: unknown): value is EdgeRecResponse {
  return (
    value !== null &&
    typeof value === "object" &&
    Array.isArray((value as { candidates?: unknown }).candidates)
  );
}

/**
 * Pure response mapper. A non-conforming body yields `provider_error`; otherwise
 * each usable candidate is mapped (with `metadata.provider = "edge-rec"`) and the
 * reason is `ok`/`no_candidates`. Does not mutate the input.
 */
export function mapEdgeRecResponseToDecision(
  response: unknown,
  placement: Placement,
): PromotionDecision {
  if (!isEdgeRecResponseLike(response)) {
    return { selected: [], reason: "provider_error", placement };
  }
  const selected: PromotionCandidate[] = [];
  for (const raw of response.candidates) {
    const mapped = mapEdgeRecCandidate(raw);
    if (mapped !== null) selected.push(mapped);
  }
  const reason: PromotionReason = selected.length > 0 ? "ok" : "no_candidates";
  return { selected, reason, placement };
}

/**
 * Adapter that connects the promotion/recommendation seams to edge-rec-middleware
 * over an injected client. Implements both `PromotionProvider` and
 * `RecommendationProvider` (the recommendation-rewriter shares this transport);
 * neither path performs ad selection here.
 */
export class EdgeRecPromotionProvider
  implements PromotionProvider, RecommendationProvider
{
  readonly #fetch: EdgeRecFetchLike;
  readonly #endpoint: string;
  readonly #timeoutMs: number;
  readonly #viewerOptions: EdgeRecViewerOptions;
  readonly #apiKey: string | undefined;
  readonly #onError: ((message: string) => void) | undefined;

  constructor(options: EdgeRecAdapterOptions) {
    this.#fetch = options.fetch;
    this.#endpoint = options.endpoint;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#viewerOptions = {
      ...(options.sendViewerPubkey !== undefined
        ? { sendViewerPubkey: options.sendViewerPubkey }
        : {}),
      ...(options.hashViewerPubkey !== undefined
        ? { hashViewerPubkey: options.hashViewerPubkey }
        : {}),
    };
    this.#apiKey = options.apiKey;
    this.#onError = options.onError;
  }

  async getPromotions(request: PromotionRequest): Promise<PromotionDecision> {
    // Gate: never touch the network when the surface asked for nothing.
    if (!canShowPromotion(request)) {
      return { selected: [], reason: "limit_zero", placement: request.placement };
    }

    const body = mapPromotionRequestToEdgeRec(request, this.#viewerOptions);

    let response: EdgeRecHttpResponse;
    try {
      response = await this.#withTimeout(
        this.#fetch(this.#endpoint, {
          method: "POST",
          headers: this.#headers(),
          body: JSON.stringify(body),
        }),
      );
    } catch (err) {
      this.#onError?.(`edge-rec request failed: ${String(err)}`);
      return this.#error(request.placement);
    }

    if (!response.ok || response.status !== 200) {
      this.#onError?.(`edge-rec responded with status ${response.status}`);
      return this.#error(request.placement);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      this.#onError?.(`edge-rec body was not JSON: ${String(err)}`);
      return this.#error(request.placement);
    }

    return mapEdgeRecResponseToDecision(json, request.placement);
  }

  /** Recommendation-rewriter seam; shares the same transport and mapping. */
  getRecommendations(request: PromotionRequest): Promise<PromotionDecision> {
    return this.getPromotions(request);
  }

  #headers(): Record<string, string> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.#apiKey !== undefined) {
      headers["authorization"] = `Bearer ${this.#apiKey}`;
    }
    return headers;
  }

  #error(placement: Placement): PromotionDecision {
    return { selected: [], reason: "provider_error", placement };
  }

  async #withTimeout(promise: Promise<EdgeRecHttpResponse>): Promise<EdgeRecHttpResponse> {
    if (this.#timeoutMs <= 0) return promise;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("edge-rec request timed out")),
        this.#timeoutMs,
      );
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
