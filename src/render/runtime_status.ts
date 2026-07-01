/**
 * Stage 50 — read-only Runtime provider/cache status page.
 *
 * Shows WHICH implementation `createRuntime` selected for each boundary (mode,
 * event cache, asset cache, space directory, metadata index, signature
 * verifier, promotion/recommendation providers, relay publisher, notification
 * bridge, payment provider) — a coarse TYPE LABEL only, e.g. "InMemoryEventCache"
 * or "EdgeRecPromotionProvider". It NEVER calls a provider/cache method
 * (`getPromotions`, `getRecommendations`, `requestPayment`, `notify`,
 * `publish`, `assetCache.get/put/has/delete/clear`, `eventCache.get/put`,
 * directory/index lookups) and issues no `fetch`. It NEVER renders an
 * endpoint URL, API key, env value, secret, or a viewer/actor pubkey — those
 * are never read from `RuntimeEnv` here in the first place, only the already-
 * constructed `AppRuntime` object's component shapes are inspected. Every
 * displayed string is HTML-escaped.
 */

import type { AppRuntime, RuntimeMode } from "../runtime/types.js";
import { escapeHtml } from "./html.js";

/** One boundary's coarse type label. Never a secret, URL, or pubkey. */
export interface RuntimeComponentStatus {
  /** The `AppRuntime` field name, e.g. "eventCache". */
  readonly name: string;
  /** A coarse type label: the implementation's `constructor.name`, or a safe fallback. */
  readonly label: string;
}

/** The full read-only status view. */
export interface RuntimeStatusView {
  readonly mode: RuntimeMode;
  readonly components: readonly RuntimeComponentStatus[];
}

/** Fixed order the components are listed in. */
const COMPONENT_FIELDS: readonly (keyof AppRuntime)[] = [
  "eventCache",
  "assetCache",
  "spaceDirectory",
  "metadataIndex",
  "signatureVerifier",
  "promotionProvider",
  "recommendationProvider",
  "relayPublisher",
  "notificationBridge",
  "paymentProvider",
];

/**
 * A coarse type label for a component: its `constructor.name` when that names
 * a real class (not the generic `"Object"` a plain object literal reports),
 * else a safe, generic fallback. This NEVER calls any method on `value` — it
 * only reads `.constructor.name`, a property read, not an invocation.
 */
function describeComponent(value: unknown): string {
  if (value !== null && typeof value === "object") {
    const ctorName = (value as { constructor?: { name?: string } }).constructor?.name;
    if (typeof ctorName === "string" && ctorName.length > 0 && ctorName !== "Object") {
      return ctorName;
    }
  }
  return "(unnamed implementation)";
}

/**
 * Builds the status view from an already-constructed `AppRuntime`. Pure and
 * read-only: it only reads `runtime.mode` and each component's
 * `constructor.name` — it never calls a provider/cache/bridge method and
 * never mutates `runtime`.
 */
export function buildRuntimeStatusView(runtime: AppRuntime): RuntimeStatusView {
  const components: RuntimeComponentStatus[] = COMPONENT_FIELDS.map((name) => ({
    name,
    label: describeComponent(runtime[name]),
  }));
  return { mode: runtime.mode, components };
}

/** Renders one component's name/label row. Both are HTML-escaped. */
export function renderRuntimeComponentStatus(component: RuntimeComponentStatus): string {
  return (
    `<li class="runtime-status-component" data-component="${escapeHtml(component.name)}">` +
    `<span class="runtime-status-name">${escapeHtml(component.name)}</span>: ` +
    `<code class="runtime-status-label">${escapeHtml(component.label)}</code>` +
    `</li>`
  );
}

/**
 * Renders the whole read-only status page: the runtime mode plus a list of
 * component type labels. No endpoint, API key, env value, secret, or viewer/
 * actor pubkey ever appears here — none of that is read by this module.
 */
export function renderRuntimeStatusPage(view: RuntimeStatusView): string {
  const rows = view.components.map(renderRuntimeComponentStatus).join("");
  return (
    `<section class="runtime-status-page">` +
    `<h2>Runtime status</h2>` +
    `<p class="runtime-status-mode">mode: <code>${escapeHtml(view.mode)}</code></p>` +
    `<ul class="runtime-status-components">${rows}</ul>` +
    `<p class="runtime-status-note">Read-only type labels only — no provider/cache/bridge ` +
    `was called to build this page, and no endpoint, key, secret, or pubkey is shown.</p>` +
    `</section>`
  );
}
