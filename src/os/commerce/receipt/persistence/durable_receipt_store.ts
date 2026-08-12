/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc,
 * Agent D — durable, append-only, idempotent persistence for an ISSUED
 * `SignedCommerceReceiptProofEnvelope` (`../receipt_types.ts` /
 * `../commerce_trust_receipt_adapter.ts`), closing friction-ledger row #5 /
 * arc §33: "Signed receipt is not durably persisted; silently disappears
 * after a real app restart."
 *
 * WHAT WAS TRUE BEFORE THIS FILE (confirmed by direct reading of
 * `fedos_electron_beta_main.cts`'s `handleCommerceReceiptIssue()` at this
 * arc's own starting CandidateHead): the Receipt-ISSUER's signing KEY
 * became durable in the "FedOS Commerce FINAL P1 Closure" arc
 * (`../../../trust/issuer/durable_receipt_issuer_signing_key_store.ts`), so
 * a receipt issued before a restart CAN still be independently
 * re-verified after one — but the receipt ENVELOPE ITSELF was never
 * stored anywhere. Every call to `handleCommerceReceiptIssue()` minted a
 * BRAND NEW envelope (`issuedAt: Math.floor(Date.now()/1000)` — a fresh
 * timestamp every time, hence a different signature every time), so a
 * user had no way to see the SAME proof twice, and a restart genuinely
 * lost whatever the UI had shown, exactly as the friction ledger describes
 * ("button reverts to 'Issue,' no verification status shown").
 *
 * WHAT THIS FILE DOES: mirrors `../../payment/persistence/
 * durable_payment_settlement_ledger.ts`'s own NDJSON append-only-log
 * discipline (this codebase's established durable-storage pattern for
 * Commerce, per this arc's own brief instruction to "mirror
 * `DurablePaymentSettlementLedger`/similar... — don't invent a new
 * persistence mechanism"), keyed by `orderId` (there is exactly ONE
 * receipt per completed Order in this domain — `handleCommerceReceiptIssue`
 * already requires `order.status === "completed"` before issuing one).
 * `putIfAbsent()` is the concrete fix for "regenerating on every call":
 * the FIRST successful issuance for an `orderId` is durably recorded;
 * every subsequent call for the SAME `orderId` returns that SAME stored
 * envelope, never mints a second, differently-signed one.
 *
 * WHAT IS PERSISTED, AND WHY IT IS SAFE: the full signed
 * `SignedCommerceReceiptProofEnvelope` — a Trust envelope whose `payload`
 * is a `TradeReceiptProofPayload`/`DeliveryReceiptProofPayload`. Every
 * field in that payload is already either an opaque foreign-key id
 * (`orderId`/`productRef`/`buyerRef`/`sellerRef`/`paymentEvidenceRef`), a
 * Unix timestamp, or a signature/public-key-id string — see
 * `../receipt_types.ts`'s own header ("never product's title/price, never
 * exact payment metadata beyond the opaque paymentId reference"). Nothing
 * secret is ever withheld from persistence because nothing secret exists
 * in this record to withhold — the exact same reasoning
 * `durable_payment_settlement_ledger.ts`'s own header already establishes
 * for `PaymentSettlementState`.
 */

import { readFileSync, appendFileSync } from "node:fs";

const RECEIPT_RECORD_SCHEMA_VERSION_1 = 1 as const;

/** One persisted line: one issued receipt envelope for one `orderId`. */
export interface PersistedCommerceReceiptRecordV1 {
  readonly schemaVersion: 1;
  readonly orderId: string;
  /** The full signed envelope, exactly as `issueSignedTradeReceiptProof()` produced it — opaque to this file (never interpreted, only stored/replayed verbatim). */
  readonly envelope: unknown;
  readonly issuedAt: number;
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

/** Minimal structural gate — never re-verifies the envelope's own signature (that is the CALLER's job, via `verifySignedTradeReceiptProof()`, exactly like every other backend in this domain that stores-but-does-not-authorize). */
function isWellFormedRecord(value: unknown): value is PersistedCommerceReceiptRecordV1 {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (c.schemaVersion !== RECEIPT_RECORD_SCHEMA_VERSION_1) return false;
  if (typeof c.orderId !== "string" || c.orderId.length === 0) return false;
  if (typeof c.envelope !== "object" || c.envelope === null) return false;
  if (typeof c.issuedAt !== "number" || !Number.isFinite(c.issuedAt)) return false;
  return true;
}

/**
 * PRIVATE — replays the append log into a `Map<orderId, record>`. A parse
 * failure, a schema-invalid line, or two DIFFERENT records claiming the
 * same `orderId` throws unconditionally — fail-closed on corruption,
 * exactly like every sibling append-only backend in this codebase.
 */
function replayLog(filePath: string): Map<string, PersistedCommerceReceiptRecordV1> {
  const contents = readLogFile(filePath);
  const byOrderId = new Map<string, PersistedCommerceReceiptRecordV1>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsed = JSON.parse(line);
    if (!isWellFormedRecord(parsed)) {
      throw new Error("DurableReceiptStore: corrupt or schema-invalid record found in log file.");
    }
    const existing = byOrderId.get(parsed.orderId);
    if (existing !== undefined && JSON.stringify(existing.envelope) !== JSON.stringify(parsed.envelope)) {
      throw new Error(`DurableReceiptStore: conflicting duplicate records for orderId "${parsed.orderId}" found in log file.`);
    }
    byOrderId.set(parsed.orderId, parsed);
  }
  return byOrderId;
}

export type DurableReceiptStorePutResult = "inserted" | "already-present";

export class DurableReceiptStore {
  readonly #filePath: string;
  #byOrderId: Map<string, PersistedCommerceReceiptRecordV1>;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#byOrderId = replayLog(filePath);
  }

  /** The durably-stored receipt for `orderId`, if one was ever issued — `undefined` otherwise (an ordinary "not issued yet" state, never an error). */
  getByOrderId(orderId: string): PersistedCommerceReceiptRecordV1 | undefined {
    return this.#byOrderId.get(orderId);
  }

  /**
   * Idempotently records the FIRST receipt envelope ever issued for
   * `orderId`. `"already-present"` (never overwritten) if a receipt for
   * this `orderId` already exists — the caller (`handleCommerceReceiptIssue`)
   * uses this to decide whether to mint a fresh envelope at all: this
   * store is checked FIRST, and a fresh `issueSignedTradeReceiptProof()`
   * call only ever happens on the "no record yet" path, so `putIfAbsent()`
   * winning a race is a defensive backstop, not the primary mechanism.
   */
  putIfAbsent(orderId: string, envelope: unknown, issuedAt: number): DurableReceiptStorePutResult {
    if (this.#byOrderId.has(orderId)) return "already-present";
    const record: PersistedCommerceReceiptRecordV1 = { schemaVersion: RECEIPT_RECORD_SCHEMA_VERSION_1, orderId, envelope, issuedAt };
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    this.#byOrderId.set(orderId, record);
    return "inserted";
  }
}
