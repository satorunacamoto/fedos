/**
 * Secure Runtime Alpha 5401-5480 — Phase F: the versioned sealed
 * ratchet-secret record. Modeled directly on the Sender-Key
 * sealed-persistence lineage's own precedent
 * (`arc/sender-key-secret-persistence-restart-recovery`, read-only
 * reference only, NOT merged into this branch --
 * `FedosSealedSenderKeyEpochRecordV1`: one opaque `sealedBlob` field,
 * every other field plain metadata, closed-field structural validator
 * only, real authentication happens inside the Rust boundary) and on
 * this branch's own `FedosSealedMasterSeedEnvelopeV1`
 * (`../../runtime/master_seed/fedos_sealed_master_seed_envelope.ts`,
 * Alpha 435) — an opaque, Rust-authoritative blob this file never
 * parses or reconstructs.
 *
 * HARD GUARDRAILS:
 *   - `sealedBlob` is the ONLY field that can ever carry secret-derived
 *     bytes, and it is opaque hex ciphertext (`FedosMasterSeedAuthority`
 *     Rust boundary's own `seal_direct_ratchet_secret()` output,
 *     `../../runtime/master_seed/`) -- never plaintext, never a
 *     passphrase, never a raw key.
 *   - Every OTHER field is plain, non-secret metadata: schema version,
 *     session id, secret kind, generation/counter binding, sealing
 *     suite label, creation time, and a non-authoritative
 *     `integrityContext` (a deterministic label derived from the OTHER
 *     fields, used only for a fast structural pre-check -- real
 *     authentication of `sealedBlob` happens exclusively inside
 *     `FedosMasterSeedAuthority.restoreDirectRatchetSecret()`).
 *   - No filesystem path, no Master Seed, no wrapping key, no Device
 *     private key of any kind.
 */
import type { FedosDirectRatchetSessionId, FedosDirectRatchetSuite } from "../../../../conversation/ratchet/fedos_direct_ratchet_session_id.js";

export type FedosDirectRatchetSecretKind =
  | "root-key"
  | "sending-chain-key"
  | "receiving-chain-key"
  | "local-ratchet-private-key"
  | "skipped-message-key";

export const FEDOS_DIRECT_RATCHET_SECRET_KINDS: readonly FedosDirectRatchetSecretKind[] = [
  "root-key",
  "sending-chain-key",
  "receiving-chain-key",
  "local-ratchet-private-key",
  "skipped-message-key",
];

/** Closed sealing-suite label -- mirrors `suite`'s own closed-literal discipline (`./fedos_direct_ratchet_session_id.ts`). Names the Rust-side sealing mechanism version, never algorithm parameters (those live inside the opaque `sealedBlob`, Rust-authoritative). */
export type FedosDirectRatchetSealingSuite = "direct-ratchet-sealing-v1";

export interface FedosSealedDirectRatchetSecretRecordV1 {
  readonly schemaVersion: 1;
  readonly sessionId: FedosDirectRatchetSessionId;
  readonly secretKind: FedosDirectRatchetSecretKind;
  readonly generation: number;
  /** Required only for `secretKind === "skipped-message-key"`; `null` otherwise. */
  readonly chainCounter: number | null;
  readonly sealingSuite: FedosDirectRatchetSealingSuite;
  readonly suite: FedosDirectRatchetSuite;
  /** Opaque, Rust-produced hex `nonce||ciphertext‖tag` -- see file header. */
  readonly sealedBlob: string;
  readonly createdAt: number;
  /** Non-authoritative structural pre-check label only -- see file header. */
  readonly integrityContext: string;
}

const ALL_KNOWN_FIELDS = new Set<string>([
  "schemaVersion",
  "sessionId",
  "secretKind",
  "generation",
  "chainCounter",
  "sealingSuite",
  "suite",
  "sealedBlob",
  "createdAt",
  "integrityContext",
]);

function buildIntegrityContext(input: {
  readonly sessionId: string;
  readonly secretKind: string;
  readonly generation: number;
  readonly chainCounter: number | null;
}): string {
  return [input.sessionId, input.secretKind, String(input.generation), String(input.chainCounter ?? "none")].join("|");
}

export interface FedosSealedDirectRatchetSecretRecordV1CreateInput {
  readonly sessionId: FedosDirectRatchetSessionId;
  readonly secretKind: FedosDirectRatchetSecretKind;
  readonly generation: number;
  readonly chainCounter: number | null;
  readonly sealingSuite: FedosDirectRatchetSealingSuite;
  readonly suite: FedosDirectRatchetSuite;
  readonly sealedBlob: string;
  readonly createdAt: number;
}

/** Constructs a frozen, well-formed record. Returns `null` (never throws) if `chainCounter` presence disagrees with `secretKind` (required for `skipped-message-key`, forbidden otherwise), if `generation`/`chainCounter` is not a non-negative integer, or if `sealedBlob` is empty. */
export function createFedosSealedDirectRatchetSecretRecordV1(
  input: FedosSealedDirectRatchetSecretRecordV1CreateInput,
): FedosSealedDirectRatchetSecretRecordV1 | null {
  const chainCounterRequired = input.secretKind === "skipped-message-key";
  if (chainCounterRequired && (input.chainCounter === null || !Number.isInteger(input.chainCounter) || input.chainCounter < 0)) {
    return null;
  }
  if (!chainCounterRequired && input.chainCounter !== null) return null;
  if (!Number.isInteger(input.generation) || input.generation < 0) return null;
  if (typeof input.sealedBlob !== "string" || input.sealedBlob.length === 0) return null;

  return Object.freeze({
    schemaVersion: 1 as const,
    sessionId: input.sessionId,
    secretKind: input.secretKind,
    generation: input.generation,
    chainCounter: input.chainCounter,
    sealingSuite: input.sealingSuite,
    suite: input.suite,
    sealedBlob: input.sealedBlob,
    createdAt: input.createdAt,
    integrityContext: buildIntegrityContext(input),
  });
}

/**
 * The stable, deterministic lookup key for a sealed record -- used as
 * `sealedRecordId` by `FedosDirectRatchetSkippedKeyReference`
 * (`./fedos_direct_ratchet_skipped_key_index.ts`) and by
 * `FedosDirectRatchetSessionRecordV1.sealedSecretRecordIds`
 * (`./fedos_direct_ratchet_session_record.ts`). Identical in shape to
 * `integrityContext` (both are pure functions of the same binding
 * tuple) but kept as a separately-named function since the two serve
 * different callers -- this one is a primary/foreign key, the other a
 * pre-check label a persistence backend never needs to look anything
 * up by.
 */
export function fedosSealedDirectRatchetSecretRecordKey(input: {
  readonly sessionId: string;
  readonly secretKind: string;
  readonly generation: number;
  readonly chainCounter: number | null;
}): string {
  return buildIntegrityContext(input);
}

/** Strict structural validation: exact closed field set (no unknown field), no missing field, no malformed value. Never throws. Does NOT authenticate `sealedBlob` -- that is exclusively `FedosMasterSeedAuthority.restoreDirectRatchetSecret()`'s job. */
export function isWellFormedFedosSealedDirectRatchetSecretRecordV1(
  candidate: unknown,
): candidate is FedosSealedDirectRatchetSecretRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const keys = Object.keys(candidate);
  if (keys.length !== ALL_KNOWN_FIELDS.size || !keys.every((key) => ALL_KNOWN_FIELDS.has(key))) return false;

  const r = candidate as Record<string, unknown>;
  if (r.schemaVersion !== 1) return false;
  if (typeof r.sessionId !== "string" || r.sessionId.length === 0) return false;
  if (!FEDOS_DIRECT_RATCHET_SECRET_KINDS.includes(r.secretKind as FedosDirectRatchetSecretKind)) return false;
  if (!Number.isInteger(r.generation) || (r.generation as number) < 0) return false;
  const chainCounterRequired = r.secretKind === "skipped-message-key";
  if (chainCounterRequired) {
    if (!Number.isInteger(r.chainCounter) || (r.chainCounter as number) < 0) return false;
  } else if (r.chainCounter !== null) {
    return false;
  }
  if (r.sealingSuite !== "direct-ratchet-sealing-v1") return false;
  if (typeof r.suite !== "string" || r.suite.length === 0) return false;
  if (typeof r.sealedBlob !== "string" || r.sealedBlob.length === 0) return false;
  if (typeof r.createdAt !== "number" || !Number.isFinite(r.createdAt)) return false;
  if (typeof r.integrityContext !== "string") return false;
  return true;
}
