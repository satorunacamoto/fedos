/**
 * Secure Runtime Alpha 7721–7800 ("FedOS Archive Multi-Device Suppression
 * Propagation Arc") — Phase C/F: the versioned Device Sync wire payload
 * carrying one suppression fact to one target Device.
 *
 * Mirrors `../relay_sync/fedos_device_relay_sync_wire_payload.ts`'s own
 * shape/discipline (Alpha 3641-3720) closely, but carries the fact's own
 * fields DIRECTLY rather than one opaque encrypted blob — a suppression
 * fact is, by Phase C's own design, already small and free of secret/
 * plaintext content, so there is nothing here for a Relay to be denied
 * visibility into beyond what the fact type itself already excludes
 * (message content, ciphertext, sender/recipient display data, Archive
 * paths, Search tokens, Ratchet/session keys — see
 * `../../conversation/retention/fedos_archive_suppression_fact.ts`'s own
 * header). Optional Device-level evidence (Phase D) travels alongside
 * the fact, never inside it (the fact's own canonical bytes — what a
 * signature is computed over — deliberately exclude local/transport
 * bookkeeping fields).
 *
 * HARD GUARDRAILS:
 *   - No plaintext, no private key, no Master Seed, no Ratchet/session
 *     secret, no raw Archive path — every field here is either a public
 *     routing fact or a field already reviewed as safe by
 *     `fedos_archive_suppression_fact.ts`'s own header.
 *   - Pure, deterministic construction/parsing — no I/O, no signing
 *     (that happens one layer up, at the outer Nostr event,
 *     `fedos_archive_suppression_event.ts`).
 */

import {
  validateFedosArchiveSuppressionFact,
  type FedosArchiveSuppressionFact,
} from "../../../../conversation/retention/fedos_archive_suppression_fact.js";
import type { FedosArchiveSuppressionFactDeviceEvidenceV1 } from "../../../../conversation/retention/fedos_archive_suppression_fact_signing.js";

export const FEDOS_ARCHIVE_SUPPRESSION_SYNC_SCHEMA_VERSION = 1 as const;

const DEVICE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;
const DELIVERY_ID_PATTERN = /^[0-9a-f]{32}$/;

export interface FedosArchiveSuppressionWirePayloadV1 {
  readonly schemaVersion: 1;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly fact: FedosArchiveSuppressionFact;
  readonly deviceEvidence: FedosArchiveSuppressionFactDeviceEvidenceV1 | null;
  readonly createdAt: number;
  readonly expiresAt: number;
  /** The replay/delivery id this Arc's own dedup uses as its innermost identity layer — mirrors Device Relay Sync's own `deliveryId` role. */
  readonly deliveryId: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function isWellFormedDeviceEvidence(value: unknown): value is FedosArchiveSuppressionFactDeviceEvidenceV1 {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2) return false;
  return isNonEmptyString(record.devicePublicKeyHex) && isNonEmptyString(record.signatureHex);
}

/** Structural + field-shape validation only — does NOT verify any signature (device evidence or the outer Nostr event), does NOT check the LIVE Registry. Fails closed; never throws. */
export function isWellFormedFedosArchiveSuppressionWirePayloadV1(candidate: unknown): candidate is FedosArchiveSuppressionWirePayloadV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 8) return false;
  if (value.schemaVersion !== FEDOS_ARCHIVE_SUPPRESSION_SYNC_SCHEMA_VERSION) return false;
  if (!isNonEmptyString(value.sourceDeviceId) || !DEVICE_ID_PATTERN.test(value.sourceDeviceId)) return false;
  if (!isNonEmptyString(value.targetDeviceId) || !DEVICE_ID_PATTERN.test(value.targetDeviceId)) return false;
  if (validateFedosArchiveSuppressionFact(value.fact) === null) return false;
  if (value.deviceEvidence !== null && !isWellFormedDeviceEvidence(value.deviceEvidence)) return false;
  if (!isValidUnixSeconds(value.createdAt)) return false;
  if (!isValidUnixSeconds(value.expiresAt) || (value.expiresAt as number) <= (value.createdAt as number)) return false;
  if (!isNonEmptyString(value.deliveryId) || !DELIVERY_ID_PATTERN.test(value.deliveryId)) return false;
  return true;
}

export function isFedosArchiveSuppressionWirePayloadExpired(payload: FedosArchiveSuppressionWirePayloadV1, now: number): boolean {
  return now > payload.expiresAt;
}

export interface FedosArchiveSuppressionWirePayloadBuildInput {
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly fact: FedosArchiveSuppressionFact;
  readonly deviceEvidence: FedosArchiveSuppressionFactDeviceEvidenceV1 | null;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly deliveryId: string;
}

export function buildFedosArchiveSuppressionWirePayload(input: FedosArchiveSuppressionWirePayloadBuildInput): FedosArchiveSuppressionWirePayloadV1 {
  return Object.freeze({
    schemaVersion: FEDOS_ARCHIVE_SUPPRESSION_SYNC_SCHEMA_VERSION,
    sourceDeviceId: input.sourceDeviceId,
    targetDeviceId: input.targetDeviceId,
    fact: input.fact,
    deviceEvidence: input.deviceEvidence,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    deliveryId: input.deliveryId,
  });
}
