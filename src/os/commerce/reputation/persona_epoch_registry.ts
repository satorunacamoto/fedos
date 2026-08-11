/**
 * Reputation / Persona Epoch — REAL epoch creation, local registry, and
 * signed carry-over (Wave B, Agent R closure pass).
 *
 * `persona_epoch.ts` defined the `PersonaEpoch` SHAPE and validity check;
 * `carry_over.ts` defined the `EpochCarryOverStatementPayload` SHAPE and its
 * own "bounded/explicitly linkable, never claim unlinkable" discipline. This
 * file is the REAL constructor/registry/signing layer neither of those
 * files implemented:
 *   - `createPersonaEpoch` — generates a fresh `PersonaEpochSigningKeypair`
 *     and a well-formed `PersonaEpoch` around its public key.
 *   - `LocalPersonaEpochRegistry` — an in-memory `Map`-backed store, same
 *     convention as `../order/local_order_repository.ts`.
 *   - `rolloverPersonaEpoch` — creates a NEW epoch succeeding an existing
 *     one and, OPTIONALLY, a REAL signed `EpochCarryOverStatementPayload`
 *     envelope (the predecessor epoch's own key signs it) — never silent,
 *     never default; a caller must explicitly opt in by passing
 *     `withCarryOver: true`.
 *   - `signEpochCarryOverStatement` / `verifyEpochCarryOverStatementEnvelope`
 *     — real sign/verify for that statement, using the exact same
 *     canonical-bytes-then-Schnorr-sign discipline as
 *     `attestation_sign_verify.ts`.
 *
 * LINKABILITY IS NOT SOFTENED HERE. `rolloverPersonaEpoch` calls
 * `EPOCH_CARRY_OVER_LINKABILITY_WARNING` unchanged and returns it alongside
 * any carry-over envelope produced, so a caller cannot accidentally reach
 * the carry-over path without also receiving the literal warning string to
 * surface. See `carry_over.ts`'s header for the full "why this is linkable,
 * not unlinkable" reasoning — unchanged and un-contradicted by this file.
 */

import {
  isPersonaEpochCurrentlyValid,
  isWellFormedPersonaEpochId,
  type PersonaEpoch,
} from "./persona_epoch.js";
import {
  buildEpochCarryOverStatementPayload,
  isWellFormedEpochCarryOverStatementPayload,
  EPOCH_CARRY_OVER_LINKABILITY_WARNING,
  type EpochCarryOverStatementPayload,
  type EpochCarryOverThresholdClaim,
} from "./carry_over.js";
import type { ReputationLocalSignedEnvelopeShape } from "./attestation_types.js";
import { PersonaEpochSigningKeypair, verifyPersonaEpochSignatureOverBytes } from "./persona_epoch_signing_keypair.js";
import { canonicalBytesForReputationEnvelope } from "./attestation_canonical_bytes.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, randomBytes as nobleRandomBytes } from "@noble/hashes/utils.js";

const EPOCH_CARRY_OVER_ENVELOPE_TYPE = "fedos.commerce.epoch-carry-over.v1" as const;
const REPUTATION_ENVELOPE_VERSION_1 = 1 as const;
const SIGNATURE_ALGORITHM = "schnorr-secp256k1" as const;
/** 16 bytes = 32 hex chars, matching `PERSONA_EPOCH_ID_PATTERN`'s
 * `[0-9a-f]{16,64}` minimum-length bound (`persona_epoch.ts`). */
const EPOCH_ID_BYTE_LENGTH = 16;

export type EpochCarryOverEnvelope = ReputationLocalSignedEnvelopeShape<EpochCarryOverStatementPayload>;

/** Generates a fresh, random, hex epoch id — independent of the epoch's own
 * signing key (an epoch id is a reference label, not key material). */
export function generatePersonaEpochId(randomBytesFn: (length: number) => Uint8Array = nobleRandomBytes): string {
  return bytesToHex(randomBytesFn(EPOCH_ID_BYTE_LENGTH));
}

export interface CreatePersonaEpochResult {
  readonly epoch: PersonaEpoch;
  readonly keypair: PersonaEpochSigningKeypair;
}

/**
 * Creates a fresh `PersonaEpoch` + its own independent
 * `PersonaEpochSigningKeypair` (never derived from any other key material —
 * see `persona_epoch_signing_keypair.ts`'s header). Throws `RangeError` on
 * an invalid validity window (mirrors `isWellFormedPersonaEpoch`'s own
 * `validUntil > validFrom` requirement).
 */
export function createPersonaEpoch(
  validFrom: number,
  validUntil: number,
  predecessorEpochId?: string,
): CreatePersonaEpochResult {
  if (!Number.isInteger(validFrom) || validFrom < 0) {
    throw new RangeError("persona epoch registry: validFrom must be a non-negative integer");
  }
  if (!Number.isInteger(validUntil) || validUntil <= validFrom) {
    throw new RangeError("persona epoch registry: validUntil must be an integer strictly greater than validFrom");
  }
  if (predecessorEpochId !== undefined && !isWellFormedPersonaEpochId(predecessorEpochId)) {
    throw new RangeError("persona epoch registry: predecessorEpochId is not well-formed");
  }
  const keypair = PersonaEpochSigningKeypair.generate();
  const epoch: PersonaEpoch = {
    epochId: generatePersonaEpochId(),
    epochKeyPublicHex: keypair.publicKeyHex,
    validFrom,
    validUntil,
    ...(predecessorEpochId !== undefined ? { predecessorEpochId } : {}),
  };
  return { epoch, keypair };
}

/**
 * In-memory, process-local `PersonaEpoch` registry. Mirrors
 * `../order/local_order_repository.ts`'s `Map`-backed convention: no
 * persistence, no live-reference leaks, independent instances share no
 * state. Deliberately does NOT store any real-world-identity binding for an
 * epoch — that binding (which real Order counterparty a given epoch
 * belongs to) is out of scope for this domain-layer registry by design (see
 * `reputation_issuance.ts`'s header on where that trust boundary actually
 * lives); this registry only ever answers "does this epoch id exist, and is
 * it currently valid."
 */
export class LocalPersonaEpochRegistry {
  readonly #epochs = new Map<string, PersonaEpoch>();

  register(epoch: PersonaEpoch): void {
    this.#epochs.set(epoch.epochId, epoch);
  }

  findById(epochId: string): PersonaEpoch | undefined {
    return this.#epochs.get(epochId);
  }

  list(): readonly PersonaEpoch[] {
    return [...this.#epochs.values()];
  }

  isCurrentlyValid(epochId: string, atTimeUnixSeconds: number): boolean {
    const epoch = this.findById(epochId);
    if (epoch === undefined) return false;
    return isPersonaEpochCurrentlyValid(epoch, atTimeUnixSeconds);
  }
}

/**
 * Signs an `EpochCarryOverStatementPayload` with the PREDECESSOR epoch's own
 * key — see `carry_over.ts`'s header ("ONE-DIRECTIONAL SIGNING ONLY, ON
 * PURPOSE": the successor does not counter-sign in this minimal design).
 * Throws `RangeError` if `keypair.publicKeyHex` does not match
 * `payload.predecessorEpochKeyPublicHex` — the same "signer must match the
 * key the payload names" discipline as `attestation_sign_verify.ts`.
 */
export function signEpochCarryOverStatement(
  payload: EpochCarryOverStatementPayload,
  predecessorKeypair: PersonaEpochSigningKeypair,
  meta: { readonly issuer: string; readonly issuedAt: number },
): EpochCarryOverEnvelope {
  if (!isWellFormedEpochCarryOverStatementPayload(payload)) {
    throw new RangeError("persona epoch registry: malformed EpochCarryOverStatementPayload");
  }
  if (payload.predecessorEpochKeyPublicHex !== predecessorKeypair.publicKeyHex) {
    throw new RangeError(
      "persona epoch registry: payload.predecessorEpochKeyPublicHex must match the signing keypair",
    );
  }
  const unsigned = {
    version: REPUTATION_ENVELOPE_VERSION_1,
    type: EPOCH_CARRY_OVER_ENVELOPE_TYPE,
    issuer: meta.issuer,
    issuedAt: meta.issuedAt,
    payload,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    keyId: predecessorKeypair.publicKeyHex,
  };
  const canonicalPayload = canonicalizeEpochCarryOverStatementPayload(payload);
  const bytes = canonicalBytesForReputationEnvelope(unsigned, canonicalPayload);
  const signature = bytesToHex(predecessorKeypair.signBytes(bytes));
  return { ...unsigned, signature };
}

function canonicalizeEpochCarryOverStatementPayload(payload: EpochCarryOverStatementPayload): string {
  const thresholdLiteral =
    payload.thresholdClaim === undefined
      ? "null"
      : `{"verifiedTradeCountAtLeast":${payload.thresholdClaim.verifiedTradeCountAtLeast}}`;
  const parts: readonly string[] = [
    `"predecessorEpochId":${JSON.stringify(payload.predecessorEpochId)}`,
    `"predecessorEpochKeyPublicHex":${JSON.stringify(payload.predecessorEpochKeyPublicHex)}`,
    `"successorEpochId":${JSON.stringify(payload.successorEpochId)}`,
    `"successorEpochKeyPublicHex":${JSON.stringify(payload.successorEpochKeyPublicHex)}`,
    `"thresholdClaim":${thresholdLiteral}`,
    `"issuedAt":${payload.issuedAt}`,
    `"formatVersion":${payload.formatVersion}`,
  ];
  return `{${parts.join(",")}}`;
}

export type EpochCarryOverVerifyStatus = "VALID" | "MALFORMED_ENVELOPE" | "MALFORMED_PAYLOAD" | "WRONG_TYPE" | "KEY_ID_MISMATCH" | "SIGNATURE_INVALID";

export type EpochCarryOverVerifyResult =
  | { readonly status: "VALID"; readonly payload: EpochCarryOverStatementPayload }
  | { readonly status: Exclude<EpochCarryOverVerifyStatus, "VALID"> };

/** Verifies a signed carry-over envelope — same fixed-order discipline as
 * `attestation_sign_verify.ts`'s verify functions. Never throws. */
export function verifyEpochCarryOverStatementEnvelope(envelope: unknown): EpochCarryOverVerifyResult {
  if (typeof envelope !== "object" || envelope === null) return { status: "MALFORMED_ENVELOPE" };
  const candidate = envelope as Record<string, unknown>;
  if (candidate.version !== REPUTATION_ENVELOPE_VERSION_1) return { status: "MALFORMED_ENVELOPE" };
  if (typeof candidate.keyId !== "string" || typeof candidate.signature !== "string") {
    return { status: "MALFORMED_ENVELOPE" };
  }
  if (candidate.type !== EPOCH_CARRY_OVER_ENVELOPE_TYPE) return { status: "WRONG_TYPE" };
  if (!isWellFormedEpochCarryOverStatementPayload(candidate.payload)) return { status: "MALFORMED_PAYLOAD" };
  const payload = candidate.payload;
  if (candidate.keyId !== payload.predecessorEpochKeyPublicHex) return { status: "KEY_ID_MISMATCH" };
  const unsigned = {
    version: candidate.version as 1,
    type: candidate.type as string,
    issuer: candidate.issuer as string,
    issuedAt: candidate.issuedAt as number,
    payload,
    signatureAlgorithm: candidate.signatureAlgorithm as string,
    keyId: candidate.keyId as string,
  };
  let bytes: Uint8Array;
  try {
    bytes = canonicalBytesForReputationEnvelope(unsigned, canonicalizeEpochCarryOverStatementPayload(payload));
  } catch {
    return { status: "MALFORMED_ENVELOPE" };
  }
  const ok = verifyPersonaEpochSignatureOverBytes(candidate.keyId as string, bytes, candidate.signature as string);
  if (!ok) return { status: "SIGNATURE_INVALID" };
  return { status: "VALID", payload };
}

export interface RolloverPersonaEpochResult {
  readonly successorEpoch: PersonaEpoch;
  readonly successorKeypair: PersonaEpochSigningKeypair;
  readonly carryOverEnvelope?: EpochCarryOverEnvelope;
  /** Present iff `withCarryOver` was requested — MUST be surfaced verbatim
   * to the user before they treat the carry-over as anything but linkable
   * (see this file's header). */
  readonly linkabilityWarning?: string;
}

/**
 * Creates a successor `PersonaEpoch` to `predecessorEpoch`. When
 * `withCarryOver` is true, ALSO produces a real, signed
 * `EpochCarryOverStatementPayload` envelope (signed by
 * `predecessorKeypair`) and returns `EPOCH_CARRY_OVER_LINKABILITY_WARNING`
 * alongside it — never silently. Omitting `withCarryOver` (the default)
 * produces a successor epoch with NO claimed continuity at all, which is
 * this design's only real unlinkability mechanism (by omission — see
 * `carry_over.ts`'s header).
 */
export function rolloverPersonaEpoch(
  predecessorEpoch: PersonaEpoch,
  predecessorKeypair: PersonaEpochSigningKeypair,
  validFrom: number,
  validUntil: number,
  options: { readonly withCarryOver?: boolean; readonly thresholdClaim?: EpochCarryOverThresholdClaim; readonly now: number } = {
    now: validFrom,
  },
): RolloverPersonaEpochResult {
  if (predecessorEpoch.epochKeyPublicHex !== predecessorKeypair.publicKeyHex) {
    throw new RangeError("persona epoch registry: predecessorKeypair does not match predecessorEpoch's own key");
  }
  const { epoch: successorEpoch, keypair: successorKeypair } = createPersonaEpoch(
    validFrom,
    validUntil,
    predecessorEpoch.epochId,
  );

  if (!options.withCarryOver) {
    return { successorEpoch, successorKeypair };
  }

  const payload = buildEpochCarryOverStatementPayload(
    predecessorEpoch.epochId,
    predecessorEpoch.epochKeyPublicHex,
    successorEpoch.epochId,
    successorEpoch.epochKeyPublicHex,
    options.now,
    options.thresholdClaim,
  );
  const carryOverEnvelope = signEpochCarryOverStatement(payload, predecessorKeypair, {
    issuer: predecessorEpoch.epochKeyPublicHex,
    issuedAt: options.now,
  });
  return {
    successorEpoch,
    successorKeypair,
    carryOverEnvelope,
    linkabilityWarning: EPOCH_CARRY_OVER_LINKABILITY_WARNING,
  };
}

/** Opaque digest identifying an envelope by its own signature — same
 * convention as `attestation_sign_verify.ts`'s `computeAttestationRef`,
 * restated locally to avoid a cross-file coupling for one line of logic. */
export function computeEnvelopeRef(envelope: { readonly signature: string }): string {
  return bytesToHex(sha256(new TextEncoder().encode(envelope.signature)));
}
