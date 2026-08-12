/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — Reputation domain, DURABLE trade-completion
 * attestation store.
 *
 * Closes P1 "all Commerce domain state is in-memory only" for the
 * duplicate-issuance-prevention half of the Reputation domain (see
 * `./durable_persona_epoch_registry.ts` for the epoch half). Same NDJSON
 * append-only log discipline as
 * `../../order/persistence/durable_order_repository.ts` (see that file's
 * header for the full precedent citation).
 *
 * `../trade_completion_attestation_store.ts` defines
 * `LocalTradeCompletionAttestationStore` as a concrete class, not a Port
 * interface — `DurableTradeCompletionAttestationStore` is a DROP-IN,
 * method-signature-identical sibling
 * (`hasAttestedOrder`/`record`/`findByOrder`/`findBySubjectEpochId`/`list`),
 * reusing `../attestation_types.ts`'s existing, already-tested
 * `isWellFormedTradeCompletionAttestationPayload` allowlisted-keys checker
 * for the payload rather than re-deriving it.
 *
 * WHY THIS FILE IS THE ARC'S DUPLICATE-REPLAY GUARANTEE: this store's
 * entire purpose is preventing "the SAME completed trade re-issues a
 * second attestation" (`../trade_completion_attestation_store.ts`'s own
 * header). That guarantee is WORTHLESS if it resets on every process
 * restart — an in-memory-only `#byDedupeKey` means an attacker (or an
 * honest but naive retry) need only wait for a restart to attest the same
 * trade again. This adapter closes exactly that gap: replaying the log at
 * construction hydrates `#byDedupeKey` BEFORE any caller can invoke
 * `hasAttestedOrder()`/`record()`, so a `(orderId, attestorRealPubkey)`
 * pair that was durably recorded before a crash/restart is already known
 * to be attested the moment the fresh instance exists.
 *
 * INSERT-ONLY, NOT UPSERT (same posture as the Persona Epoch registry): a
 * recorded attestation is never revised — `record()` throws outright (both
 * here and in the original in-memory store) if the same dedupe key is
 * already present. Two persisted records sharing the same
 * `(orderId, attestorRealPubkey)` dedupe key with DIFFERENT envelope
 * content can therefore never be produced by honest use of this store; on
 * replay, that exact situation throws unconditionally as corruption.
 */

import { readFileSync, appendFileSync } from "node:fs";
import { isWellFormedTradeCompletionAttestationPayload } from "../attestation_types.js";
import type { TradeCompletionAttestationEnvelope } from "../attestation_sign_verify.js";

const ATTESTATION_SCHEMA_VERSION_1 = 1 as const;

interface StoredAttestation {
  readonly orderId: string;
  readonly attestorRealPubkey: string;
  readonly envelope: TradeCompletionAttestationEnvelope;
}

/** One persisted line: the entity's FULL (and, per this domain, only ever) state. */
interface PersistedTradeCompletionAttestationRecordV1 {
  readonly schemaVersion: 1;
  readonly orderId: string;
  readonly attestorRealPubkey: string;
  readonly envelope: TradeCompletionAttestationEnvelope;
}

function dedupeKey(orderId: string, attestorRealPubkey: string): string {
  return `${orderId} ${attestorRealPubkey}`;
}

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

/** Structural well-formedness for a replayed envelope: the fixed envelope-shape fields (`ReputationLocalSignedEnvelopeShape`, `../attestation_types.ts`), plus the payload validated via that file's own allowlisted-keys checker. */
function isWellFormedEnvelopeShape(value: unknown): value is TradeCompletionAttestationEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.version !== "number") return false;
  if (typeof c.type !== "string") return false;
  if (typeof c.issuer !== "string") return false;
  if (typeof c.issuedAt !== "number" || !Number.isFinite(c.issuedAt)) return false;
  if (typeof c.signatureAlgorithm !== "string") return false;
  if (typeof c.keyId !== "string") return false;
  if (typeof c.signature !== "string") return false;
  if (c.subject !== undefined && typeof c.subject !== "string") return false;
  if (c.audience !== undefined && typeof c.audience !== "string") return false;
  if (c.expiresAt !== undefined && typeof c.expiresAt !== "number") return false;
  if (c.nonce !== undefined && typeof c.nonce !== "string") return false;
  return isWellFormedTradeCompletionAttestationPayload(c.payload);
}

function storedAttestationsEqual(a: StoredAttestation, b: StoredAttestation): boolean {
  return (
    a.orderId === b.orderId &&
    a.attestorRealPubkey === b.attestorRealPubkey &&
    JSON.stringify(a.envelope) === JSON.stringify(b.envelope)
  );
}

interface ReplayedAttestationLog {
  readonly byDedupeKey: Map<string, StoredAttestation>;
  readonly all: readonly StoredAttestation[];
}

/**
 * PRIVATE — replays the append log into the dedupe-keyed map PLUS the
 * append-order list `findByOrder`/`findBySubjectEpochId`/`list` read from.
 * A parse failure, an unrecognized `schemaVersion`, a schema-invalid
 * record, OR an irreconcilable duplicate dedupe key throws unconditionally
 * — this is the replay-time half of the arc's "restart must not allow the
 * same completed trade to re-issue a second attestation" requirement.
 */
function replayLog(filePath: string): ReplayedAttestationLog {
  const contents = readLogFile(filePath);
  const byDedupeKey = new Map<string, StoredAttestation>();
  const all: StoredAttestation[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (typeof parsedJson !== "object" || parsedJson === null) {
      throw new Error("DurableTradeCompletionAttestationStore: corrupt or schema-invalid record found in log file.");
    }
    const candidate = parsedJson as Record<string, unknown>;
    if (candidate.schemaVersion !== ATTESTATION_SCHEMA_VERSION_1) {
      throw new Error(
        `DurableTradeCompletionAttestationStore: unsupported/unknown schemaVersion "${String(candidate.schemaVersion)}" found in log file.`,
      );
    }
    if (typeof candidate.orderId !== "string" || candidate.orderId.length === 0) {
      throw new Error("DurableTradeCompletionAttestationStore: corrupt or schema-invalid record found in log file (orderId).");
    }
    if (typeof candidate.attestorRealPubkey !== "string" || candidate.attestorRealPubkey.length === 0) {
      throw new Error(
        "DurableTradeCompletionAttestationStore: corrupt or schema-invalid record found in log file (attestorRealPubkey).",
      );
    }
    if (!isWellFormedEnvelopeShape(candidate.envelope)) {
      throw new Error("DurableTradeCompletionAttestationStore: corrupt or schema-invalid envelope found in log file.");
    }
    const stored: StoredAttestation = {
      orderId: candidate.orderId,
      attestorRealPubkey: candidate.attestorRealPubkey,
      envelope: candidate.envelope,
    };
    const key = dedupeKey(stored.orderId, stored.attestorRealPubkey);
    const existing = byDedupeKey.get(key);
    if (existing !== undefined) {
      if (!storedAttestationsEqual(existing, stored)) {
        throw new Error(
          `DurableTradeCompletionAttestationStore: conflicting duplicate records for order "${stored.orderId}" / attestor "${stored.attestorRealPubkey}" found in log file.`,
        );
      }
      continue;
    }
    byDedupeKey.set(key, stored);
    all.push(stored);
  }
  return { byDedupeKey, all };
}

export class DurableTradeCompletionAttestationStore {
  readonly #filePath: string;
  #byDedupeKey: Map<string, StoredAttestation>;
  #all: StoredAttestation[];

  constructor(filePath: string) {
    this.#filePath = filePath;
    const replayed = replayLog(filePath);
    this.#byDedupeKey = replayed.byDedupeKey;
    this.#all = [...replayed.all];
  }

  /** True iff `attestorRealPubkey` has already recorded an attestation for `orderId` -- survives restart via the constructor's own replay. */
  hasAttestedOrder(orderId: string, attestorRealPubkey: string): boolean {
    return this.#byDedupeKey.has(dedupeKey(orderId, attestorRealPubkey));
  }

  /** Same contract as `LocalTradeCompletionAttestationStore.record()`: throws `RangeError` if `hasAttestedOrder` would already be `true`. */
  record(orderId: string, attestorRealPubkey: string, envelope: TradeCompletionAttestationEnvelope): void {
    const key = dedupeKey(orderId, attestorRealPubkey);
    if (this.#byDedupeKey.has(key)) {
      throw new RangeError(
        `DurableTradeCompletionAttestationStore: an attestation for order "${orderId}" by this attestor already exists`,
      );
    }
    const stored: StoredAttestation = { orderId, attestorRealPubkey, envelope };
    const record: PersistedTradeCompletionAttestationRecordV1 = {
      schemaVersion: ATTESTATION_SCHEMA_VERSION_1,
      orderId,
      attestorRealPubkey,
      envelope,
    };
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    this.#byDedupeKey.set(key, stored);
    this.#all.push(stored);
  }

  findByOrder(orderId: string): readonly TradeCompletionAttestationEnvelope[] {
    return this.#all.filter((entry) => entry.orderId === orderId).map((entry) => entry.envelope);
  }

  findBySubjectEpochId(subjectEpochId: string): readonly TradeCompletionAttestationEnvelope[] {
    return this.#all
      .filter((entry) => entry.envelope.payload.subjectEpochId === subjectEpochId)
      .map((entry) => entry.envelope);
  }

  list(): readonly TradeCompletionAttestationEnvelope[] {
    return this.#all.map((entry) => entry.envelope);
  }
}
