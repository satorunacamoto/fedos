/**
 * Stage 49 — EdgeRec real provider invocation boundary (disabled by default).
 *
 * Stage 38 let `createRuntime(env)` SELECT an `EdgeRecPromotionProvider`, and
 * Stage 41 added a PREVIEW renderer driven ONLY by the in-memory
 * `MockPromotionProvider`. This file adds the missing middle step: a single,
 * narrow seam through which an already-selected `PromotionProvider` (real
 * EdgeRec or otherwise) may ACTUALLY be invoked for a preview — but only when
 * the caller passes BOTH an explicit `allowRealProvider: true` AND
 * `mode: "provider_preview"`. Any other combination returns a `disabled` (or
 * `mock_preview`) result WITHOUT calling the provider at all.
 *
 * This is deliberately NOT ad serving: it implements no ranking, auction,
 * CTR/A-B testing, click tracking, impression tracking, or billing, and calls
 * no Stripe/Telegram/HTMLRewriter. A successful invocation returns the
 * provider's raw `PromotionDecision` for PREVIEW rendering only — callers must
 * use the existing `renderPromotionDecisionPreview` (Stage 41), which never
 * renders a `destination` link or an image. This module issues no `fetch` of
 * its own; any network I/O happens only inside the injected `provider`, and
 * only when this function actually decides to call it.
 *
 * NOT WIRED into the runtime or the Worker in this stage — see the README.
 */

import type { PromotionProvider } from "./adapter.js";
import type { PromotionDecision, PromotionRequest } from "./types.js";

/**
 * Which path a caller is asking for. `"disabled"` and `"mock_preview"` never
 * cause this function to call `provider.getPromotions` — `"mock_preview"` is
 * a label only; the existing Stage 41 `renderMockPromotionPreview` path
 * (driving `MockPromotionProvider` directly) remains the way to render a mock
 * preview and is unaffected by this file. Only `"provider_preview"`, combined
 * with `allowRealProvider: true`, invokes the provider.
 */
export type PromotionInvocationMode = "disabled" | "mock_preview" | "provider_preview";

/** Options gating whether/how `invokePromotionProviderPreview` may call the provider. */
export interface PromotionInvocationOptions {
  /**
   * Hard gate. Must be explicitly `true` for the provider to ever be called.
   * There is no default that enables it — omitting it is the same as `false`.
   */
  readonly allowRealProvider: boolean;
  readonly mode: PromotionInvocationMode;
  /** Unix ms this invocation is evaluated at. Defaults to `Date.now()`. */
  readonly now?: number;
  /** Diagnostics hook for a provider error (never throws into the caller). */
  readonly onError?: (message: string) => void;
}

/** Coarse outcome of an invocation attempt. No content is exposed beyond the decision itself. */
export type PromotionInvocationState =
  | "disabled" // allowRealProvider was false, or mode was "disabled" — provider not called
  | "mock_preview" // mode was "mock_preview" — provider not called by THIS function
  | "provider_preview" // the provider was called and returned a decision
  | "provider_error"; // the provider was called and threw/rejected

/**
 * The result of an invocation attempt. `decision` is present ONLY when
 * `state === "provider_preview"`, and is the provider's own `PromotionDecision`
 * — a preview-rendering input, never itself a rendered/served ad. `reason` is
 * a short, non-sensitive, human-readable explanation.
 */
export interface PromotionInvocationDecision {
  readonly state: PromotionInvocationState;
  readonly reason: string;
  readonly decision?: PromotionDecision;
  /** Unix ms this decision was produced (echoes `options.now` or `Date.now()`). */
  readonly invokedAt: number;
}

/**
 * The ONLY seam through which an already-selected `PromotionProvider` may be
 * invoked for a preview. Calls `provider.getPromotions(request)` ONLY when
 * `options.allowRealProvider === true` AND `options.mode === "provider_preview"`
 * — every other combination returns a `disabled`/`mock_preview` result and
 * never touches `provider`. A thrown/rejected call from `provider` is caught
 * and reported as `provider_error` (never re-thrown); `onError`, if supplied,
 * receives a diagnostic message. Never mutates `request` or `options`. Does
 * no ranking/auction/selection itself — the provider's own decision passes
 * through untouched, for preview rendering only.
 */
export async function invokePromotionProviderPreview(
  provider: PromotionProvider,
  request: PromotionRequest,
  options: PromotionInvocationOptions,
): Promise<PromotionInvocationDecision> {
  const invokedAt = options.now ?? Date.now();

  if (!options.allowRealProvider) {
    return {
      state: "disabled",
      reason: "allowRealProvider is false — the provider was not called",
      invokedAt,
    };
  }

  if (options.mode === "disabled") {
    return {
      state: "disabled",
      reason: 'mode is "disabled" — the provider was not called',
      invokedAt,
    };
  }

  if (options.mode === "mock_preview") {
    return {
      state: "mock_preview",
      reason:
        'mode is "mock_preview" — use the Stage 41 renderMockPromotionPreview path instead; the provider was not called here',
      invokedAt,
    };
  }

  // mode === "provider_preview" && allowRealProvider === true.
  try {
    const decision = await provider.getPromotions(request);
    return {
      state: "provider_preview",
      reason: "the provider returned a decision (preview only — nothing served/tracked)",
      decision,
      invokedAt,
    };
  } catch (err) {
    options.onError?.(`promotion provider invocation failed: ${String(err)}`);
    return {
      state: "provider_error",
      reason: "the provider threw/rejected — no candidates are shown",
      invokedAt,
    };
  }
}
