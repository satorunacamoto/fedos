/**
 * Stage 50/51 — read-only Runtime provider/cache status page.
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
 *
 * Stage 51 groups the ten components into fixed CATEGORIES (cache, storage,
 * provider, bridge, security) for easier diagnostics ahead of any future
 * real-connection phase. `RuntimeStatusView.components` (the flat Stage 50
 * list) is UNCHANGED for backward compatibility; `.sections` is new and
 * derives from the same components, grouped and in a fixed category order.
 *
 * Stage 54 adds an opt-in JSON export of the SAME view
 * (`serializeRuntimeStatusView` / `renderRuntimeStatusJson`), disabled by
 * default and gated behind an explicit `?format=json` query param in the
 * Worker (see `worker.ts`'s `isRuntimeStatusJsonRequested`). The serializer
 * NEVER `JSON.stringify`s the raw view or `AppRuntime` — it reconstructs a
 * plain object field-by-field from an explicit allowlist (`mode`, `name`,
 * `label`, `category`), so the JSON can never carry more than the HTML page
 * already shows: no endpoint, API key, env value, secret, viewer/actor
 * pubkey, method, or function ever appears in it.
 */

import type { AppRuntime, RuntimeMode } from "../runtime/types.js";
import { escapeHtml } from "./html.js";

/** Which concern a boundary belongs to. Display grouping only — no behavior. */
export type RuntimeComponentCategory = "cache" | "storage" | "provider" | "bridge" | "security";

/** One boundary's coarse type label. Never a secret, URL, or pubkey. */
export interface RuntimeComponentStatus {
  /** The `AppRuntime` field name, e.g. "eventCache". */
  readonly name: string;
  /** A coarse type label: the implementation's `constructor.name`, or a safe fallback. */
  readonly label: string;
  readonly category: RuntimeComponentCategory;
}

/** One category's components, in the fixed per-category order below. */
export interface RuntimeComponentSection {
  readonly category: RuntimeComponentCategory;
  readonly components: readonly RuntimeComponentStatus[];
}

/** The full read-only status view. */
export interface RuntimeStatusView {
  readonly mode: RuntimeMode;
  /** Flat list, in the original Stage 50 order. Kept for backward compatibility. */
  readonly components: readonly RuntimeComponentStatus[];
  /** The same components grouped by category, in `CATEGORY_ORDER`. */
  readonly sections: readonly RuntimeComponentSection[];
}

/** Fixed order the components are listed in (and their category). */
const COMPONENT_FIELDS: readonly { name: keyof AppRuntime; category: RuntimeComponentCategory }[] = [
  { name: "eventCache", category: "cache" },
  { name: "assetCache", category: "cache" },
  { name: "spaceDirectory", category: "storage" },
  { name: "metadataIndex", category: "storage" },
  { name: "signatureVerifier", category: "security" },
  { name: "promotionProvider", category: "provider" },
  { name: "recommendationProvider", category: "provider" },
  { name: "paymentProvider", category: "provider" },
  { name: "relayPublisher", category: "bridge" },
  { name: "notificationBridge", category: "bridge" },
];

/** Fixed order categories are grouped/rendered in. */
const CATEGORY_ORDER: readonly RuntimeComponentCategory[] = [
  "cache",
  "storage",
  "provider",
  "bridge",
  "security",
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
 * never mutates `runtime`. `sections` groups the same components by category
 * (cache/storage/provider/bridge/security), in `CATEGORY_ORDER`.
 */
export function buildRuntimeStatusView(runtime: AppRuntime): RuntimeStatusView {
  const components: RuntimeComponentStatus[] = COMPONENT_FIELDS.map(({ name, category }) => ({
    name,
    label: describeComponent(runtime[name]),
    category,
  }));
  const sections: RuntimeComponentSection[] = CATEGORY_ORDER.map((category) => ({
    category,
    components: components.filter((component) => component.category === category),
  }));
  return { mode: runtime.mode, components, sections };
}

/** Renders one component's name/label/category row. All fields are HTML-escaped. */
export function renderRuntimeComponentStatus(component: RuntimeComponentStatus): string {
  return (
    `<li class="runtime-status-component" data-component="${escapeHtml(component.name)}" ` +
    `data-category="${escapeHtml(component.category)}">` +
    `<span class="runtime-status-name">${escapeHtml(component.name)}</span>: ` +
    `<code class="runtime-status-label">${escapeHtml(component.label)}</code>` +
    `</li>`
  );
}

/** Capitalizes a category name for display (e.g. "cache" -> "Cache"). Pure. */
function displayCategoryLabel(category: string): string {
  return category.length > 0 ? category[0]!.toUpperCase() + category.slice(1) : category;
}

/**
 * Renders one category section: a heading plus its components' rows. Empty
 * sections (no component currently maps to that category) still render a
 * heading with an empty list — categories are fixed, not data-driven.
 */
export function renderRuntimeStatusSection(section: RuntimeComponentSection): string {
  const rows = section.components.map(renderRuntimeComponentStatus).join("");
  return (
    `<section class="runtime-status-section runtime-status-category-${escapeHtml(section.category)}" ` +
    `data-category="${escapeHtml(section.category)}">` +
    `<h3 class="runtime-status-section-heading">${escapeHtml(displayCategoryLabel(section.category))}</h3>` +
    `<ul class="runtime-status-components">${rows}</ul>` +
    `</section>`
  );
}

/**
 * Renders the whole read-only status page: the runtime mode plus each
 * category section (cache/storage/provider/bridge/security), in order. No
 * endpoint, API key, env value, secret, or viewer/actor pubkey ever appears
 * here — none of that is read by this module.
 */
export function renderRuntimeStatusPage(view: RuntimeStatusView): string {
  const sectionsHtml = view.sections.map(renderRuntimeStatusSection).join("");
  return (
    `<section class="runtime-status-page">` +
    `<h2>Runtime status</h2>` +
    `<p class="runtime-status-mode">mode: <code>${escapeHtml(view.mode)}</code></p>` +
    sectionsHtml +
    `<p class="runtime-status-note">Read-only type labels only — no provider/cache/bridge ` +
    `was called to build this page, and no endpoint, key, secret, or pubkey is shown.</p>` +
    `</section>`
  );
}

/** One component's plain-data shape in the JSON export — the same three safe fields as the HTML row. */
export interface RuntimeStatusJsonComponent {
  readonly name: string;
  readonly label: string;
  readonly category: RuntimeComponentCategory;
}

/** One category's components, in the JSON export. */
export interface RuntimeStatusJsonSection {
  readonly category: RuntimeComponentCategory;
  readonly components: readonly RuntimeStatusJsonComponent[];
}

/**
 * The JSON-safe shape of a `RuntimeStatusView`. Structurally identical to the
 * view (mode/components/sections), reconstructed field-by-field from an
 * explicit allowlist rather than reusing the view object directly — so it can
 * never accidentally carry more than `mode`, `name`, `label`, and `category`.
 * `generatedAt` is OMITTED by default; a caller may inject a fixed Unix-ms
 * value via `serializeRuntimeStatusView`'s second argument for reproducible
 * output, but nothing here ever calls `Date.now()` itself.
 */
export interface RuntimeStatusJson {
  readonly mode: RuntimeMode;
  readonly components: readonly RuntimeStatusJsonComponent[];
  readonly sections: readonly RuntimeStatusJsonSection[];
  readonly generatedAt?: number;
}

/**
 * Builds the JSON-safe export from an already-built `RuntimeStatusView`. Pure
 * and read-only: reads only `mode`/`name`/`label`/`category` off the view —
 * never the raw `AppRuntime`, never a method, never an endpoint/API
 * key/env value/secret/viewer-or-actor pubkey (none of those are present on
 * `RuntimeStatusView` in the first place). `generatedAt` is included ONLY
 * when the caller explicitly passes one; this function never reads the clock
 * itself. Never mutates `view`.
 */
export function serializeRuntimeStatusView(
  view: RuntimeStatusView,
  generatedAt?: number,
): RuntimeStatusJson {
  const toJsonComponent = (component: RuntimeComponentStatus): RuntimeStatusJsonComponent => ({
    name: component.name,
    label: component.label,
    category: component.category,
  });
  return {
    mode: view.mode,
    components: view.components.map(toJsonComponent),
    sections: view.sections.map((section) => ({
      category: section.category,
      components: section.components.map(toJsonComponent),
    })),
    ...(generatedAt !== undefined ? { generatedAt } : {}),
  };
}

/**
 * Renders a `RuntimeStatusView` as a JSON string (via `serializeRuntimeStatusView`,
 * with `generatedAt` omitted). Same safety guarantees as `renderRuntimeStatusPage`:
 * no provider/cache/bridge method is called, no endpoint/API key/env value/
 * secret/viewer-or-actor pubkey ever appears, and the raw `AppRuntime`/`RuntimeEnv`
 * is never serialized directly.
 */
export function renderRuntimeStatusJson(view: RuntimeStatusView): string {
  return JSON.stringify(serializeRuntimeStatusView(view));
}
