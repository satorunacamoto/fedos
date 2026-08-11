/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — Payment domain, DURABLE settlement ledger.
 *
 * Closes P1 "all Commerce domain state is in-memory only" for the Payment
 * domain. Same NDJSON append-only log discipline as
 * `../../order/persistence/durable_order_repository.ts` (see that file's
 * header for the full precedent citation).
 *
 * `../state_machine.ts` defines `PaymentSettlementLedger` as a concrete
 * class, not a Port interface — there is nothing named `*RepositoryPort`
 * to `implements` here. `DurablePaymentSettlementLedger` is instead a
 * DROP-IN, method-signature-identical sibling of `PaymentSettlementLedger`
 * (`bind`/`get`/`apply`), built on top of the SAME pure, exported
 * transition functions (`createPendingSettlement`,
 * `applySettlementEvidence`) rather than re-deriving the state machine's
 * rules — `state_machine.ts` itself is never modified.
 *
 * WHAT IS PERSISTED, AND WHY IT IS SAFE: this durably records
 * `PaymentSettlementState` — the AUTHORITATIVE settlement record
 * (`paymentId`, `orderId`, `productId`, `status`, `createdAt`, `updatedAt`,
 * `history`) — never a raw `PaymentEvidence`/provider callback payload and
 * never a provider secret/API key. `PaymentSettlementState` (as defined in
 * `../state_machine.ts`) carries NO credential material of any kind; every
 * field is either an opaque id, a closed-vocabulary status string, a Unix
 * timestamp, or an audit-trail transition record built from the same
 * closed vocabulary. Nothing is withheld from persistence because nothing
 * secret exists in this record to withhold.
 *
 * UPSERT, NOT INSERT-ONLY for the transition history (mirrors Order):
 * `bind()` persists the initial `pending` snapshot; each accepted `apply()`
 * persists a fresh, FULL settlement snapshot for the SAME `paymentId`.
 * `paymentId`, `orderId`, `productId`, and `createdAt` are fixed for the
 * life of a settlement record (`applySettlementEvidence` never rebinds a
 * payment to a different order/product, and `ALLOWED_TRANSITIONS` in
 * `state_machine.ts` makes every terminal state a dead end) — two
 * persisted records for the same `paymentId` disagreeing on any of those
 * is corruption, never a legitimate transition.
 *
 * CONSISTENCY INVARIANT THIS FILE PRESERVES: a settlement's persisted
 * `status` is exactly what the last durably-completed `apply()`/`bind()`
 * call produced. A crash between computing a new `SettlementApplyResult`
 * and this adapter's `appendFileSync` call means the settlement replays
 * back to its PREVIOUS state, never a half-applied one — `apply()` always
 * appends ONE complete `PaymentSettlementState` snapshot, never a partial
 * field update, and the in-memory map is only advanced after the append
 * call returns.
 */

import { readFileSync, appendFileSync } from "node:fs";
import {
  applySettlementEvidence,
  createPendingSettlement,
  type PaymentSettlementState,
  type SettlementApplyResult,
  type SettlementStatus,
  type SettlementTransitionRecord,
} from "../state_machine.js";
import type { PaymentEvidence } from "../types.js";

const PAYMENT_SETTLEMENT_SCHEMA_VERSION_1 = 1 as const;

/** One persisted line: the entity's FULL current state, never a diff. */
interface PersistedPaymentSettlementRecordV1 {
  readonly schemaVersion: 1;
  readonly state: PaymentSettlementState;
}

/** Fields fixed for the lifetime of a settlement record -- `applySettlementEvidence` never changes any of these. */
const PAYMENT_SETTLEMENT_IMMUTABLE_FIELDS: readonly (keyof PaymentSettlementState)[] = [
  "paymentId",
  "orderId",
  "productId",
  "createdAt",
];

const SETTLEMENT_STATUSES: readonly SettlementStatus[] = ["pending", "paid", "failed", "expired", "refunded", "disputed"];

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

function isWellFormedTransitionRecord(value: unknown): value is SettlementTransitionRecord {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.from !== "string" || !SETTLEMENT_STATUSES.includes(c.from as SettlementStatus)) return false;
  if (typeof c.to !== "string" || !SETTLEMENT_STATUSES.includes(c.to as SettlementStatus)) return false;
  if (typeof c.at !== "number" || !Number.isFinite(c.at)) return false;
  if (typeof c.evidenceObservedAt !== "number" || !Number.isFinite(c.evidenceObservedAt)) return false;
  if (typeof c.reason !== "string") return false;
  return true;
}

/** Minimal structural well-formedness check for a replayed `PaymentSettlementState`. Never re-derives `state_machine.ts`'s transition rules -- just enough to reject a truncated/garbled line. */
function isWellFormedSettlementShape(value: unknown): value is PaymentSettlementState {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.paymentId !== "string" || c.paymentId.length === 0) return false;
  if (typeof c.orderId !== "string") return false;
  if (typeof c.productId !== "string") return false;
  if (typeof c.status !== "string" || !SETTLEMENT_STATUSES.includes(c.status as SettlementStatus)) return false;
  if (typeof c.createdAt !== "number" || !Number.isFinite(c.createdAt)) return false;
  if (typeof c.updatedAt !== "number" || !Number.isFinite(c.updatedAt)) return false;
  if (!Array.isArray(c.history) || !c.history.every(isWellFormedTransitionRecord)) return false;
  return true;
}

function settlementIdentityFieldsMatch(a: PaymentSettlementState, b: PaymentSettlementState): boolean {
  return PAYMENT_SETTLEMENT_IMMUTABLE_FIELDS.every((key) => a[key] === b[key]);
}

/**
 * PRIVATE — replays the append log into a `Map<paymentId, PaymentSettlementState>`.
 * A parse failure, an unrecognized `schemaVersion`, a schema-invalid
 * record, OR an irreconcilable identity-field conflict between two records
 * sharing the same `paymentId` throws unconditionally.
 */
function replayLog(filePath: string): Map<string, PaymentSettlementState> {
  const contents = readLogFile(filePath);
  const byPaymentId = new Map<string, PaymentSettlementState>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (typeof parsedJson !== "object" || parsedJson === null) {
      throw new Error("DurablePaymentSettlementLedger: corrupt or schema-invalid record found in log file.");
    }
    const candidate = parsedJson as Record<string, unknown>;
    if (candidate.schemaVersion !== PAYMENT_SETTLEMENT_SCHEMA_VERSION_1) {
      throw new Error(
        `DurablePaymentSettlementLedger: unsupported/unknown schemaVersion "${String(candidate.schemaVersion)}" found in log file.`,
      );
    }
    if (!isWellFormedSettlementShape(candidate.state)) {
      throw new Error("DurablePaymentSettlementLedger: corrupt or schema-invalid settlement record found in log file.");
    }
    const state = candidate.state;
    const existing = byPaymentId.get(state.paymentId);
    if (existing !== undefined && !settlementIdentityFieldsMatch(existing, state)) {
      throw new Error(
        `DurablePaymentSettlementLedger: conflicting duplicate records for paymentId "${state.paymentId}" found in log file (identity fields disagree).`,
      );
    }
    byPaymentId.set(state.paymentId, state);
  }
  return byPaymentId;
}

export class DurablePaymentSettlementLedger {
  readonly #filePath: string;
  #states: Map<string, PaymentSettlementState>;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#states = replayLog(filePath);
  }

  #persist(state: PaymentSettlementState): void {
    const record: PersistedPaymentSettlementRecordV1 = { schemaVersion: PAYMENT_SETTLEMENT_SCHEMA_VERSION_1, state };
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    this.#states.set(state.paymentId, state);
  }

  /** Same contract as `PaymentSettlementLedger.bind()`: throws on a duplicate `paymentId` -- including one only known via a durably-replayed record from a prior process. */
  bind(paymentId: string, orderId: string, productId: string, createdAt?: number): PaymentSettlementState {
    if (this.#states.has(paymentId)) {
      throw new Error(`DurablePaymentSettlementLedger: paymentId "${paymentId}" is already bound`);
    }
    const state = createPendingSettlement(paymentId, orderId, productId, createdAt);
    this.#persist(state);
    return state;
  }

  get(paymentId: string): PaymentSettlementState | undefined {
    return this.#states.get(paymentId);
  }

  /** Same contract as `PaymentSettlementLedger.apply()`. Only a `"transitioned"` outcome is durably persisted -- a `"no_op"`/`"rejected"` result never touches the log, mirroring the in-memory ledger's own behavior exactly. */
  apply(evidence: PaymentEvidence, expectedOrderId: string): SettlementApplyResult {
    const existing = this.#states.get(evidence.paymentId);
    if (existing === undefined) {
      return {
        state: createPendingSettlement(evidence.paymentId, expectedOrderId, evidence.productId),
        outcome: "rejected",
        reason: `evidence for unknown/unbound paymentId "${evidence.paymentId}" -- was never registered via bind()`,
      };
    }
    const result = applySettlementEvidence(existing, evidence, expectedOrderId);
    if (result.outcome === "transitioned") {
      this.#persist(result.state);
    }
    return result;
  }
}
