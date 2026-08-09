/**
 * FedOS Identity Transition Foundation Arc — Phase C: the strict,
 * versioned transition record.
 *
 * Mirrors `../ratchet/fedos_direct_ratchet_session_reset_record.ts`'s and
 * `../ratchet/peer_capability/fedos_ratchet_peer_capability_observation.ts`'s
 * own "exact field set, closed vocab, fails closed on anything unknown"
 * structural-validation discipline exactly.
 *
 * This record is the SIGNED-OVER BODY only — the facts a replacement
 * transition asserts. It deliberately does NOT embed raw evidence bytes
 * (signatures, proofs) inline; those are separate artifacts
 * (`fedos_identity_transition_new_key_proof.ts`,
 * `fedos_identity_transition_continuity_evidence.ts`,
 * `fedos_identity_transition_device_corroboration.ts`) that each bind to
 * one revision of this body via its `bodyHash`
 * (`fedos_identity_transition_canonical.ts`) — so a mutation to any body
 * field invalidates every attached proof without those proofs needing to
 * duplicate the body's own fields.
 *
 * HARD GUARDRAILS (Absolute Prohibitions): no Master Seed, no passphrase,
 * no private key, no raw Device private key, no root/chain/message key,
 * no filesystem path, no arbitrary executable command, no message
 * plaintext appears anywhere in this type.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";
import {
  isKnownFedosIdentityTransitionDevicePolicy,
  isKnownFedosIdentityTransitionRatchetPolicy,
  isKnownFedosIdentityTransitionReasonCategory,
  isKnownFedosIdentityTransitionType,
  type FedosIdentityTransitionDevicePolicy,
  type FedosIdentityTransitionRatchetPolicy,
  type FedosIdentityTransitionReasonCategory,
  type FedosIdentityTransitionType,
} from "../../../../conversation/identity_transition/fedos_identity_transition_vocabulary.js";
import { isWellFormedFedosIdentityTransitionId } from "../../../../conversation/identity_transition/fedos_identity_transition_id.js";
import { FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH } from "../../../../conversation/identity_transition/fedos_identity_transition_id_limits.js";

export { FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH };

/** A concrete, enforced ceiling on revision — Absolute Prohibitions: resource-limit exhaustion defense. */
export const FEDOS_IDENTITY_TRANSITION_MAX_REVISION = 1_000_000;

/** Maximum permitted clock skew for `issuedAt` being ahead of "now" (seconds) — Phase P's own "future-issued beyond skew" case. */
export const FEDOS_IDENTITY_TRANSITION_MAX_FUTURE_SKEW_SECONDS = 300;

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

export interface FedosIdentityTransitionRecordV1 {
  readonly schemaVersion: 1;
  readonly transitionId: string;
  readonly transitionType: FedosIdentityTransitionType;
  readonly oldAccountIdentity: FedosDeviceBindingAccountRef;
  readonly newAccountIdentity: FedosDeviceBindingAccountRef;
  /** Hex Nostr public key. For `authority === "nostr"` this MUST equal `oldAccountIdentity.publicIdentifier` (this repo's own current architecture: account identity IS the Nostr public key — see reconciliation report). */
  readonly oldNostrIdentity: string;
  readonly newNostrIdentity: string;
  readonly reasonCategory: FedosIdentityTransitionReasonCategory;
  /** Integer Unix seconds — matches `src/nostr/event.ts`'s own `created_at` convention. */
  readonly issuedAt: number;
  readonly expiresAt: number;
  /** `0` for a fresh transition; a competing/superseding transition for the SAME identity pair increments this. */
  readonly revision: number;
  /** `null` iff `revision === 0`. Forms an acyclic predecessor chain validated by Phase E/J. */
  readonly previousTransitionId: string | null;
  readonly devicePolicy: FedosIdentityTransitionDevicePolicy;
  readonly ratchetPolicy: FedosIdentityTransitionRatchetPolicy;
  readonly capabilityVersion: 1;
}

export interface FedosIdentityTransitionRecordCreateInput {
  readonly transitionId: string;
  readonly transitionType: FedosIdentityTransitionType;
  readonly oldAccountIdentity: FedosDeviceBindingAccountRef;
  readonly newAccountIdentity: FedosDeviceBindingAccountRef;
  readonly oldNostrIdentity: string;
  readonly newNostrIdentity: string;
  readonly reasonCategory: FedosIdentityTransitionReasonCategory;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly revision: number;
  readonly previousTransitionId: string | null;
}

/** Producer — always fixes `devicePolicy`/`ratchetPolicy`/`capabilityVersion` to this Arc's only supported values, never caller-suppliable (Absolute Prohibitions: no automatic rebind/reset value exists to choose). */
export function createFedosIdentityTransitionRecordV1(input: FedosIdentityTransitionRecordCreateInput): FedosIdentityTransitionRecordV1 {
  return Object.freeze({
    schemaVersion: 1,
    transitionId: input.transitionId,
    transitionType: input.transitionType,
    oldAccountIdentity: input.oldAccountIdentity,
    newAccountIdentity: input.newAccountIdentity,
    oldNostrIdentity: input.oldNostrIdentity,
    newNostrIdentity: input.newNostrIdentity,
    reasonCategory: input.reasonCategory,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    revision: input.revision,
    previousTransitionId: input.previousTransitionId,
    devicePolicy: "rebind-required" as const,
    ratchetPolicy: "reset-required-no-rebind" as const,
    capabilityVersion: 1 as const,
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isBoundedIdentifier(value: unknown): value is string {
  return isNonEmptyString(value) && (value as string).length <= FEDOS_IDENTITY_TRANSITION_MAX_IDENTIFIER_LENGTH;
}

function isWellFormedAccountRef(candidate: unknown): candidate is FedosDeviceBindingAccountRef {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== 3 || !keys.includes("authority") || !keys.includes("publicIdentifier") || !keys.includes("identityId")) {
    return false;
  }
  const r = candidate as Record<string, unknown>;
  return (
    isBoundedIdentifier(r.authority) &&
    isBoundedIdentifier(r.publicIdentifier) &&
    (r.identityId === null || isBoundedIdentifier(r.identityId))
  );
}

function isNostrPublicKeyHex(value: unknown): value is string {
  return typeof value === "string" && NOSTR_PUBLIC_KEY_HEX_PATTERN.test(value);
}

function accountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier && a.identityId === b.identityId;
}

export function fedosIdentityTransitionAccountRefsEqual(
  a: FedosDeviceBindingAccountRef,
  b: FedosDeviceBindingAccountRef,
): boolean {
  return accountRefsEqual(a, b);
}

const ALL_KNOWN_FIELDS = new Set<string>([
  "schemaVersion",
  "transitionId",
  "transitionType",
  "oldAccountIdentity",
  "newAccountIdentity",
  "oldNostrIdentity",
  "newNostrIdentity",
  "reasonCategory",
  "issuedAt",
  "expiresAt",
  "revision",
  "previousTransitionId",
  "devicePolicy",
  "ratchetPolicy",
  "capabilityVersion",
]);

/**
 * Pure structural validation only — no clock, no crypto. Fails closed;
 * never throws. Enforces:
 *   - exact field set (unknown fields fail closed)
 *   - closed vocabularies everywhere a closed vocabulary applies
 *   - `revision === 0 <=> previousTransitionId === null`
 *   - `authority === "nostr"` mapping consistency (Absolute Prohibitions:
 *     no unsupported account/Nostr mapping silently accepted)
 *   - integer timestamps only, `expiresAt > issuedAt`
 */
export function isWellFormedFedosIdentityTransitionRecordV1(candidate: unknown): candidate is FedosIdentityTransitionRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((k) => ALL_KNOWN_FIELDS.has(k))) return false;
  const r = candidate as Record<string, unknown>;

  if (r.schemaVersion !== 1) return false;
  if (!isWellFormedFedosIdentityTransitionId(r.transitionId)) return false;
  if (!isKnownFedosIdentityTransitionType(r.transitionType)) return false;
  if (!isWellFormedAccountRef(r.oldAccountIdentity)) return false;
  if (!isWellFormedAccountRef(r.newAccountIdentity)) return false;
  if (!isNostrPublicKeyHex(r.oldNostrIdentity)) return false;
  if (!isNostrPublicKeyHex(r.newNostrIdentity)) return false;
  if (!isKnownFedosIdentityTransitionReasonCategory(r.reasonCategory)) return false;
  if (!Number.isInteger(r.issuedAt) || (r.issuedAt as number) < 0) return false;
  if (!Number.isInteger(r.expiresAt) || (r.expiresAt as number) <= (r.issuedAt as number)) return false;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 0 || (r.revision as number) > FEDOS_IDENTITY_TRANSITION_MAX_REVISION) return false;
  if (r.previousTransitionId !== null && !isWellFormedFedosIdentityTransitionId(r.previousTransitionId)) return false;
  if ((r.revision === 0) !== (r.previousTransitionId === null)) return false;
  if (r.previousTransitionId === r.transitionId) return false;
  if (!isKnownFedosIdentityTransitionDevicePolicy(r.devicePolicy)) return false;
  if (!isKnownFedosIdentityTransitionRatchetPolicy(r.ratchetPolicy)) return false;
  if (r.capabilityVersion !== 1) return false;

  const oldAccountRef = r.oldAccountIdentity as FedosDeviceBindingAccountRef;
  const newAccountRef = r.newAccountIdentity as FedosDeviceBindingAccountRef;
  if (accountRefsEqual(oldAccountRef, newAccountRef)) return false;
  // This repo's current architecture has exactly one supported account/Nostr
  // mapping: account identity IS the Nostr public key (`authority: "nostr"`,
  // reconciliation report §1). Any other authority is an unsupported mapping
  // this Arc has no evaluation path for and must fail closed on, rather than
  // silently accepting a combination nothing downstream can act on.
  if (oldAccountRef.authority !== "nostr" || oldAccountRef.publicIdentifier !== r.oldNostrIdentity) return false;
  if (newAccountRef.authority !== "nostr" || newAccountRef.publicIdentifier !== r.newNostrIdentity) return false;

  return true;
}

/** Closed outcome for the clock-dependent half of validation, kept separate from pure structural checks (Phase P: "invalid timestamp" vs "expired" vs "future-issued beyond skew" are distinct failure cases). */
export type FedosIdentityTransitionTimestampCheck = "ok" | "expired" | "future-issued-beyond-skew";

export function checkFedosIdentityTransitionTimestamps(
  record: FedosIdentityTransitionRecordV1,
  nowSeconds: number,
): FedosIdentityTransitionTimestampCheck {
  if (record.issuedAt > nowSeconds + FEDOS_IDENTITY_TRANSITION_MAX_FUTURE_SKEW_SECONDS) return "future-issued-beyond-skew";
  if (record.expiresAt <= nowSeconds) return "expired";
  return "ok";
}

export function encodeFedosIdentityTransitionRecordV1(record: FedosIdentityTransitionRecordV1): string {
  return JSON.stringify(record);
}

/** `null` (never throws) for invalid JSON or a structurally malformed record — fail closed. */
export function decodeFedosIdentityTransitionRecordV1(line: string): FedosIdentityTransitionRecordV1 | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  return isWellFormedFedosIdentityTransitionRecordV1(parsed) ? parsed : null;
}
