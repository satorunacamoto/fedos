/**
 * Secure Runtime Alpha 2921–3000 ("Device Trust and Multi-Device Runtime
 * Integration") — Device Binding V1.
 *
 * This is the REAL, durable-capable Device Binding record the
 * `docs/reviews/multi_device_device_trust_v1` review (commit `4672244`,
 * Review 05/06/20) named as the next Arc: account identity + independent
 * device keys (Option B), additive underneath the existing account/
 * participant identity, never a replacement of it.
 *
 * This is a SEPARATE type from `../sync/fedos_sync_device_binding.ts`
 * (Alpha 2421–2500, unmodified) — that file's `deviceRef`/`accountRef`
 * are opaque, unauthenticated labels with no schema version and no
 * persistence of their own, by its own explicit design ("a binding
 * never implies real device attestation"). This file is this Arc's own
 * additive, versioned, authority-gated record; `./persisted_fedos_device_trust_authority.ts`
 * is the one bridge between the two (Phase F/G of this Arc), never a
 * merge of the two types.
 *
 * `devicePublicKeyRef` is an OPAQUE, non-secret reference only — never
 * raw key bytes. It is `null` whenever this binding's `trustState` is
 * `"unavailable"` (Phase E's fail-closed adapter never records a key
 * reference it cannot itself verify), and MAY be populated once a real
 * account-to-device signature-verification boundary exists (Phase E's
 * named, not-yet-implemented next step).
 *
 * HARD GUARDRAILS:
 *   - No private key, no Master Seed, no passphrase field of any kind.
 *   - `deviceId` is a stable, non-secret identifier — never a credential.
 *   - Every function here is a pure, synchronous, never-throwing
 *     transition or predicate — no I/O.
 *   - `"revoked"` is TERMINAL: no function in this file can transition a
 *     `"revoked"` binding to any other state.
 */

export type FedosDeviceTrustState = "pending" | "trusted" | "revoked" | "unavailable";

/** The four, and only four, states a Device Binding may occupy. */
export const FEDOS_DEVICE_TRUST_STATES: readonly FedosDeviceTrustState[] = [
  "pending",
  "trusted",
  "revoked",
  "unavailable",
];

/** Mirrors `FedosConversationParticipantReference`'s own `{authority, publicIdentifier, identityId}` shape — the account this device binding is additive beneath. */
export interface FedosDeviceBindingAccountRef {
  readonly authority: string;
  readonly publicIdentifier: string;
  readonly identityId: string | null;
}

export interface FedosDeviceBindingV1 {
  readonly schemaVersion: 1;
  readonly deviceId: string;
  readonly accountRef: FedosDeviceBindingAccountRef;
  /** OPAQUE reference only — never raw key bytes. `null` whenever `trustState === "unavailable"`. */
  readonly devicePublicKeyRef: string | null;
  /** Optional, local, non-sensitive display label (e.g. "desktop", "laptop") — never a credential. */
  readonly label: string | null;
  readonly createdAt: number;
  readonly trustState: FedosDeviceTrustState;
  /** Reserved for a future additive `scope`/capability field (review 05/07/20's own named upgrade path) — always `1` in this Arc. */
  readonly capabilityVersion: 1;
  readonly revokedAt: number | null;
}

export interface FedosDeviceBindingCreateInput {
  readonly deviceId: string;
  readonly accountRef: FedosDeviceBindingAccountRef;
  readonly devicePublicKeyRef: string | null;
  readonly label: string | null;
  readonly createdAt: number;
}

/** Producer 1 of 2 — a binding whose registration authority VERIFIED the request. Never callable with `devicePublicKeyRef: null` by convention of a real authority, but this file does not itself enforce that (the Authority's own job, `./fedos_device_registration_authority.ts`). */
export function createPendingFedosDeviceBinding(input: FedosDeviceBindingCreateInput): FedosDeviceBindingV1 {
  return Object.freeze({
    schemaVersion: 1,
    deviceId: input.deviceId,
    accountRef: input.accountRef,
    devicePublicKeyRef: input.devicePublicKeyRef,
    label: input.label,
    createdAt: input.createdAt,
    trustState: "pending",
    capabilityVersion: 1,
    revokedAt: null,
  });
}

/** Producer 2 of 2 — a binding whose registration authority could NOT verify the request (the Phase E blocker). `devicePublicKeyRef` is always forced to `null` here, regardless of what the caller supplied — this Arc never fakes a production Device key. */
export function createUnavailableFedosDeviceBinding(input: FedosDeviceBindingCreateInput): FedosDeviceBindingV1 {
  return Object.freeze({
    schemaVersion: 1,
    deviceId: input.deviceId,
    accountRef: input.accountRef,
    devicePublicKeyRef: null,
    label: input.label,
    createdAt: input.createdAt,
    trustState: "unavailable",
    capabilityVersion: 1,
    revokedAt: null,
  });
}

/** The closed transition table this file enforces. `"revoked"` has no outgoing edge. */
const ALLOWED_TRANSITIONS: ReadonlyMap<FedosDeviceTrustState, ReadonlySet<FedosDeviceTrustState>> = new Map([
  ["pending", new Set<FedosDeviceTrustState>(["trusted", "revoked"])],
  ["trusted", new Set<FedosDeviceTrustState>(["revoked"])],
  ["unavailable", new Set<FedosDeviceTrustState>(["revoked"])],
  ["revoked", new Set<FedosDeviceTrustState>()],
]);

export function isFedosDeviceTrustTransitionAllowed(from: FedosDeviceTrustState, to: FedosDeviceTrustState): boolean {
  return ALLOWED_TRANSITIONS.get(from)?.has(to) ?? false;
}

/**
 * `"pending"` -> `"trusted"` ONLY. Returns `null` (never throws) for any
 * other current state — including `"trusted"` itself (not idempotent at
 * this layer; a caller wanting idempotent-confirm reporting does so one
 * layer up, `./fedos_device_registration_authority.ts`'s own consumer).
 */
export function trustFedosDeviceBinding(binding: FedosDeviceBindingV1, at: number): FedosDeviceBindingV1 | null {
  if (!isFedosDeviceTrustTransitionAllowed(binding.trustState, "trusted")) return null;
  return Object.freeze({ ...binding, trustState: "trusted" as const });
}

/** `"pending" | "trusted" | "unavailable"` -> `"revoked"`. Returns `null` for an already-`"revoked"` binding — revocation is not re-appliable, matching this file's own terminal-state guarantee. */
export function revokeFedosDeviceBinding(binding: FedosDeviceBindingV1, at: number): FedosDeviceBindingV1 | null {
  if (!isFedosDeviceTrustTransitionAllowed(binding.trustState, "revoked")) return null;
  return Object.freeze({ ...binding, trustState: "revoked" as const, revokedAt: at });
}

export function isFedosDeviceBindingTrusted(binding: FedosDeviceBindingV1): boolean {
  return binding.trustState === "trusted";
}

export function isFedosDeviceBindingRevoked(binding: FedosDeviceBindingV1): boolean {
  return binding.trustState === "revoked";
}

export function fedosDeviceBindingAccountRefsEqual(a: FedosDeviceBindingAccountRef, b: FedosDeviceBindingAccountRef): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}
