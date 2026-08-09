/**
 * Stage 130 — Identity recovery policy boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "an actor requests HELP regaining access" —
 * a POLICY-REVIEW record, never a real recovery mechanism. This mirrors
 * `./passkey_boundary.ts`'s framing of a Passkey/Face ID as an "unlock
 * TRIGGER, never a key source" (Stage 36): an
 * `IdentityRecoveryRequestDescriptor` names WHAT KIND of recovery help is
 * being requested — it never carries, derives, or references a real
 * credential of any kind.
 *
 * HARD GUARDRAILS (see `docs/device_identity_boundary.md`):
 *   - NO password, recovery phrase, mnemonic, seed, backup, export,
 *     import, sync, or authentication field of any kind, anywhere in this
 *     file — this is the STRICTEST guardrail in the Identity & Device
 *     suite, given the subject matter.
 *   - `reviewIdentityRecoveryRequest` evaluates a decision ONLY — it never
 *     recovers, resets, or regenerates any credential, and never contacts
 *     `StorageBackend`, `IdentityProviderBoundary`, `PasskeyBoundary`, or
 *     the Vault (`src/vault/`).
 *   - This boundary makes NO recovery guarantee. Do not describe an
 *     `accepted_placeholder` decision as "recovered", "reset", or
 *     "restored".
 */

/** What KIND of recovery help is being requested — a label of intent only. */
export type IdentityRecoveryRequestKind =
  | "unlock_trigger_placeholder"
  | "contact_verification_placeholder"
  | "test_placeholder";

/** Coarse observable state of a recovery request review. No credential data is exposed at any state. */
export type IdentityRecoveryState = "accepted_placeholder" | "rejected";

/**
 * A non-sensitive description of one recovery request. Carries NO
 * password/recovery-phrase/mnemonic/seed/backup/export/import/sync/
 * authentication field of any kind — only opaque labels, a fixed request
 * kind, and metadata strings.
 */
export interface IdentityRecoveryRequestDescriptor {
  /** OPAQUE label a real route would resolve to its own request-record id. */
  readonly idRef?: string;
  /** OPAQUE label (e.g. a display name) — never a credential used for recovery. */
  readonly actorRef?: string;
  readonly kind: IdentityRecoveryRequestKind;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewIdentityRecoveryRequest`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * The result of reviewing a recovery request. `accepted_placeholder` means
 * the REQUEST RECORD is policy-clean — NOT that anything was recovered,
 * reset, or restored.
 */
export interface IdentityRecoveryDecision {
  readonly allowed: boolean;
  readonly state: IdentityRecoveryState;
  readonly reason: string;
}

/** Every recovery-request-kind label (for mapping/documentation helpers). */
export const IDENTITY_RECOVERY_REQUEST_KINDS: readonly IdentityRecoveryRequestKind[] = [
  "unlock_trigger_placeholder",
  "contact_verification_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Mirrors `./device_registration.ts`'s identity/device-specific prohibited
 * family — the STRICTEST list in this suite, given the subject matter.
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
export function isSensitiveIdentityRecoveryValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveIdentityRecoveryValue(value)) return true;
  }
  return false;
}

/**
 * Decide whether a recovery request record may be handed to a (future)
 * route. Rejects (never throws) when `metadata` contains a sensitive
 * key/value. A clean request is `accepted_placeholder` — a PLACEHOLDER
 * acceptance that recovers, resets, and restores nothing. Never mutates
 * `request`, never contacts `StorageBackend`, `IdentityProviderBoundary`,
 * `PasskeyBoundary`, or the Vault.
 */
export function reviewIdentityRecoveryRequest(
  request: IdentityRecoveryRequestDescriptor,
): IdentityRecoveryDecision {
  if (hasSensitiveMetadata(request.metadata)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "recovery request metadata contains a sensitive key or value",
    };
  }
  return {
    allowed: true,
    state: "accepted_placeholder",
    reason: "recovery request carries only non-sensitive, opaque labels (nothing recovered/reset/restored)",
  };
}
