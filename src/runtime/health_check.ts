/**
 * Stage 58 — Runtime external health check boundary (disabled by default).
 *
 * A future operational-diagnostics seam: "is this selected provider/endpoint
 * actually reachable?" — as opposed to Stage 50/51's `runtime_status.ts`,
 * which only reports WHICH implementation was selected, never whether it
 * works. This file ships ONLY the boundary shape: a `HealthCheckProvider`
 * interface, a `NoopHealthCheckProvider` and `DisabledHealthCheckProvider`
 * (both safe, permanently-inert defaults), and a pure `canRunHealthCheck`
 * policy helper.
 *
 * NOT IMPLEMENTED, ON PURPOSE: no real probe, ping, or `fetch` of any kind to
 * any endpoint. No provider/cache/bridge method (`getPromotions`,
 * `requestPayment`, `notify`, `publish`, `assetCache.get/put/has/delete/clear`,
 * etc.) is ever called by this file. `check()` always resolves without
 * touching the network, regardless of what `target` describes.
 *
 * SCOPE GUARDRAILS: `HealthCheckTarget.endpointRef` is an OPAQUE display
 * label only — never a real, dereferenceable endpoint URL, and never an API
 * key or token (there is no field for either, by design; see
 * `HealthCheckTarget`/`HealthCheckDecision` below). `HealthCheckDecision`
 * never echoes `endpointRef` back — even a caller-supplied value that looks
 * sensitive never appears in the result. This file is NOT wired into the
 * runtime or the Worker: `createRuntime`/`worker.ts` construct nothing here
 * and call nothing here. A real external health-check implementation is
 * explicitly deferred to a future, separate, explicit-opt-in Stage — see the
 * README for the ground rules that stage must follow.
 */

/** Coarse category of thing a health check target represents. Display/grouping only. */
export type HealthCheckTargetKind =
  | "promotion_provider"
  | "recommendation_provider"
  | "payment_provider"
  | "notification_bridge"
  | "asset_cache"
  | "event_cache"
  | "other";

/**
 * What a future health check would be asked about. `endpointRef`, when
 * present, is an OPAQUE label (e.g. `"edge-rec (configured)"`) — never a real
 * URL to dereference, and never a credential. There is deliberately no field
 * for an API key, token, or header of any kind.
 */
export interface HealthCheckTarget {
  readonly kind: HealthCheckTargetKind;
  /** Human-readable label for display only. */
  readonly label: string;
  /** OPAQUE reference only. Never a real endpoint URL, API key, or token. */
  readonly endpointRef?: string;
}

/**
 * Coarse outcome of a health check attempt. No content beyond this label is
 * exposed — no response body, no latency number tied to a real probe (none is
 * ever made), no header.
 */
export type HealthCheckStatus =
  | "disabled" // health checking itself is off (the default, incl. `NoopHealthCheckProvider`)
  | "unavailable" // reserved: a future backend that IS enabled but cannot be reached
  | "skipped" // opted in, but no real check implementation exists yet for this target
  | "healthy_placeholder" // PLACEHOLDER — reserved for a future real check's "ok" result
  | "unhealthy_placeholder" // PLACEHOLDER — reserved for a future real check's "not ok" result
  | "error"; // a check attempt could not be served; recorded as status, never thrown

/**
 * The result of a health check attempt / status read. `targetLabel` echoes
 * `target.label` ONLY — never `target.endpointRef` (see the module doc
 * comment). `checkedAt`, when present, is exactly whatever caller-supplied
 * `now` was passed in; this module never calls `Date.now()` itself, so a
 * caller that supplies no `now` gets no `checkedAt` at all (never a silently
 * guessed timestamp).
 */
export interface HealthCheckDecision {
  readonly status: HealthCheckStatus;
  /** Non-sensitive explanation. Never echoes an endpoint, key, or token. */
  readonly reason: string;
  readonly targetLabel?: string;
  /** Unix ms, present ONLY when the caller supplied `options.now` explicitly. */
  readonly checkedAt?: number;
}

/** Coarse, non-sensitive read of whether a health-check backend is present/ready. */
export interface HealthCheckProviderStatus {
  readonly available: boolean;
  readonly reason: string;
}

/** Options for a single `check()` call. */
export interface HealthCheckOptions {
  /**
   * Unix ms to stamp `checkedAt` with. OPTIONAL and INJECTED ONLY — this
   * module never reads the system clock itself. Omit it and `checkedAt` is
   * simply absent from the result.
   */
  readonly now?: number;
}

/**
 * The health-check seam. Implementations MUST NOT issue a `fetch`, open a
 * socket, ping anything, or call a provider/cache/bridge method. `check()`
 * never throws — it resolves to a `HealthCheckDecision` (including `"error"`).
 * Constructing an implementation does nothing.
 */
export interface HealthCheckProvider {
  /** Current coarse status (pure read). */
  getStatus(): HealthCheckProviderStatus;
  /**
   * Ask whether `target` is healthy. Probes NOTHING in this stage — every
   * implementation shipped here resolves without touching the network.
   * Never throws and never mutates `target`/`options`.
   */
  check(target: HealthCheckTarget, options?: HealthCheckOptions): Promise<HealthCheckDecision>;
}

function decide(
  target: HealthCheckTarget,
  status: HealthCheckStatus,
  reason: string,
  options: HealthCheckOptions,
): HealthCheckDecision {
  return {
    status,
    reason,
    targetLabel: target.label,
    ...(options.now !== undefined ? { checkedAt: options.now } : {}),
  };
}

/**
 * The safe, permanently-`disabled` default: no health-check backend is
 * configured and health checking itself is off. `check()` never contacts
 * anything and always resolves `"disabled"`.
 */
export class NoopHealthCheckProvider implements HealthCheckProvider {
  constructor() {
    // Does nothing: no endpoint, socket, or provider is contacted.
  }

  getStatus(): HealthCheckProviderStatus {
    return { available: false, reason: "no health check backend is configured" };
  }

  async check(
    target: HealthCheckTarget,
    options: HealthCheckOptions = {},
  ): Promise<HealthCheckDecision> {
    return decide(
      target,
      "disabled",
      "no health check backend is configured (nothing was probed)",
      options,
    );
  }
}

/**
 * The explicit "feature is off" default: distinct from `NoopHealthCheckProvider`
 * (which models "no backend exists at all") — this models "health checking is
 * a real, deliberately disabled policy". Still issues no `fetch`/probe of any
 * kind; `check()` always resolves `"disabled"`.
 */
export class DisabledHealthCheckProvider implements HealthCheckProvider {
  constructor() {
    // Does nothing: no endpoint, socket, or provider is contacted.
  }

  getStatus(): HealthCheckProviderStatus {
    return { available: false, reason: "health checks are disabled by default" };
  }

  async check(
    target: HealthCheckTarget,
    options: HealthCheckOptions = {},
  ): Promise<HealthCheckDecision> {
    return decide(
      target,
      "disabled",
      "health checks are disabled by default (opt-in required; no real check is implemented yet)",
      options,
    );
  }
}

/** Options for the pure `canRunHealthCheck` policy check. */
export interface HealthCheckPolicyOptions extends HealthCheckOptions {
  /** Explicit opt-in. Defaults to `false` — there is no default that enables checking. */
  readonly enabled?: boolean;
}

/**
 * Pure policy: decides whether a health check for `target` would even be
 * attempted, WITHOUT calling any provider or touching the network. When
 * `enabled` is not `true`, resolves `"disabled"`. When `enabled` is `true`,
 * there is still no real check implementation in this stage, so it resolves
 * `"skipped"` rather than fabricating a health result. Never mutates `target`
 * or `options`; never throws.
 */
export function canRunHealthCheck(
  target: HealthCheckTarget,
  options: HealthCheckPolicyOptions = {},
): HealthCheckDecision {
  if (!options.enabled) {
    return decide(
      target,
      "disabled",
      "health checks are disabled by default — pass { enabled: true } to opt in " +
        "(no external probe is implemented yet)",
      options,
    );
  }
  return decide(
    target,
    "skipped",
    "no real health check implementation exists yet — this target was skipped",
    options,
  );
}
