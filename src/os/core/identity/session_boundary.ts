/**
 * Stage 129 — Session boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "a session-lifecycle EVENT was requested" —
 * mirrors `../community/moderation.ts`'s "requested action maps 1:1 to a
 * reported label" model, applied to session lifecycle instead of content
 * visibility. NO real session is ever started, ended, refreshed, stored,
 * or authenticated by anything in this file — `reviewSessionRequest` only
 * REPORTS the label a requested lifecycle event maps to.
 *
 * HARD GUARDRAILS (see `docs/device_identity_boundary.md`):
 *   - NO password, recovery phrase, mnemonic, seed, backup, export,
 *     import, sync, or authentication field of any kind.
 *   - `reviewSessionRequest` evaluates a decision ONLY — it never creates,
 *     stores, or invalidates any real session, and never contacts
 *     `StorageBackend`, `IdentityProviderBoundary`, or `PasskeyBoundary`.
 *   - This boundary makes NO authentication guarantee. Do not describe an
 *     `active_placeholder` decision as "logged in", "authenticated", or
 *     "signed in".
 */

/** What session-lifecycle EVENT is being requested — a label of intent only. */
export type SessionRequestedAction = "start_placeholder" | "end_placeholder" | "refresh_placeholder";

/**
 * The reported session-lifecycle label a requested action maps to — never
 * a claim that a real session exists anywhere.
 *   - `active_placeholder`: reported in response to `start_placeholder`.
 *   - `ended_placeholder`: reported in response to `end_placeholder`.
 *   - `refreshed_placeholder`: reported in response to `refresh_placeholder`.
 *   - `rejected`: the request itself failed policy review — no lifecycle
 *     label was reached.
 */
export type SessionLifecycleState =
  | "active_placeholder"
  | "ended_placeholder"
  | "refreshed_placeholder"
  | "rejected";

/**
 * A non-sensitive description of one session-lifecycle request. Carries NO
 * password/recovery-phrase/mnemonic/seed/backup/export/import/sync/
 * authentication field of any kind — only opaque labels, a requested
 * action, and metadata strings.
 */
export interface SessionRequestDescriptor {
  /** OPAQUE label a real route would resolve to its own session-record id. */
  readonly idRef?: string;
  /** OPAQUE label to the device (e.g. `DeviceRegistrationDescriptor.deviceRef`). */
  readonly deviceRef?: string;
  /** OPAQUE label (e.g. a display name) — never a credential used for auth. */
  readonly actorRef?: string;
  readonly action: SessionRequestedAction;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewSessionRequest`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** The result of reviewing a session-lifecycle request. No real session/credential data is exposed. */
export interface SessionRequestReview {
  readonly decision: SessionLifecycleState;
  readonly reason: string;
}

/** Every session-requested-action value (for mapping/documentation helpers). */
export const SESSION_REQUESTED_ACTIONS: readonly SessionRequestedAction[] = [
  "start_placeholder",
  "end_placeholder",
  "refresh_placeholder",
];

const ACTION_TO_STATE: Readonly<Record<SessionRequestedAction, SessionLifecycleState>> = {
  start_placeholder: "active_placeholder",
  end_placeholder: "ended_placeholder",
  refresh_placeholder: "refreshed_placeholder",
};

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Mirrors `./device_registration.ts`'s identity/device-specific prohibited
 * family.
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "secret",
  "key",
  "seed",
  "token",
  "password",
  "recovery",
  "phrase",
  "mnemonic",
  "backup",
  "export",
  "import",
  "sync",
  "auth",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive/credential content. */
export function isSensitiveSessionValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveSessionValue(value)) return true;
  }
  return false;
}

/**
 * Decide the lifecycle label a session request maps to. Rejects (never
 * throws) when `metadata` contains a sensitive key/value — in that case
 * `decision` is `rejected`. Otherwise maps the requested action 1:1 to its
 * lifecycle label. Never mutates `request`, never creates/stores/
 * invalidates any real session, never contacts `StorageBackend`,
 * `IdentityProviderBoundary`, or `PasskeyBoundary`.
 */
export function reviewSessionRequest(request: SessionRequestDescriptor): SessionRequestReview {
  if (hasSensitiveMetadata(request.metadata)) {
    return {
      decision: "rejected",
      reason: "session request metadata contains a sensitive key or value",
    };
  }
  return {
    decision: ACTION_TO_STATE[request.action],
    reason: `requested action "${request.action}" maps to a reported lifecycle label only (no real session created/stored/invalidated)`,
  };
}
