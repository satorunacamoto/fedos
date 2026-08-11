/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — Reputation domain, DURABLE `PersonaEpoch`
 * registry.
 *
 * Closes P1 "all Commerce domain state is in-memory only" for the
 * Persona Epoch half of the Reputation domain (see
 * `./durable_trade_completion_attestation_store.ts` for the other half).
 * Same NDJSON append-only log discipline as
 * `../../order/persistence/durable_order_repository.ts` (see that file's
 * header for the full precedent citation).
 *
 * `../persona_epoch_registry.ts` defines `LocalPersonaEpochRegistry` as a
 * concrete class, not a Port interface — `DurablePersonaEpochRegistry` is a
 * DROP-IN, method-signature-identical sibling
 * (`register`/`findById`/`list`/`isCurrentlyValid`), reusing the existing,
 * already-tested `isWellFormedPersonaEpoch`/`isPersonaEpochCurrentlyValid`
 * checkers from `../persona_epoch.ts` rather than re-deriving them.
 * Neither `persona_epoch_registry.ts` nor `persona_epoch.ts` is modified.
 *
 * INSERT-ONLY, NOT UPSERT: unlike Order/Product/Delivery/Payment, a
 * `PersonaEpoch` is IMMUTABLE for its entire lifetime once registered — no
 * field of a `PersonaEpoch` (`epochId`, `epochKeyPublicHex`, `validFrom`,
 * `validUntil`, `predecessorEpochId`) is ever revised in place; a "new"
 * epoch is always a DIFFERENT `epochId` (see `rolloverPersonaEpoch()`).
 * This durable registry therefore follows the EXACT insert-only discipline
 * of this repo's two original append-only precedent files: `register()` on
 * a fresh `epochId` appends and records it; `register()` on an already-seen
 * `epochId` with byte-identical content is a silent idempotent no-op
 * (matches the precedents' `putEntry`-returns-"already-present" case, only
 * this Port's `register()` returns `void`, not a result discriminant);
 * `register()` (or replay) encountering the same `epochId` with DIFFERENT
 * content throws unconditionally — this is a genuine corruption/programmer-
 * error signal, since nothing in this domain ever legitimately revises an
 * already-registered epoch.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import { isPersonaEpochCurrentlyValid, isWellFormedPersonaEpoch, type PersonaEpoch } from "../persona_epoch.js";

const PERSONA_EPOCH_SCHEMA_VERSION_1 = 1 as const;

/** One persisted line: the entity's FULL (and, per this domain, only ever) state. */
interface PersistedPersonaEpochRecordV1 {
  readonly schemaVersion: 1;
  readonly epoch: PersonaEpoch;
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

function personaEpochsEqual(a: PersonaEpoch, b: PersonaEpoch): boolean {
  return (
    a.epochId === b.epochId &&
    a.epochKeyPublicHex === b.epochKeyPublicHex &&
    a.validFrom === b.validFrom &&
    a.validUntil === b.validUntil &&
    a.predecessorEpochId === b.predecessorEpochId
  );
}

/**
 * PRIVATE — replays the append log into a `Map<epochId, PersonaEpoch>`. A
 * parse failure, an unrecognized `schemaVersion`, a schema-invalid record
 * (checked via the domain's own `isWellFormedPersonaEpoch`), OR an
 * irreconcilable duplicate `epochId` throws unconditionally.
 */
function replayLog(filePath: string): Map<string, PersonaEpoch> {
  const contents = readLogFile(filePath);
  const byId = new Map<string, PersonaEpoch>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (typeof parsedJson !== "object" || parsedJson === null) {
      throw new Error("DurablePersonaEpochRegistry: corrupt or schema-invalid record found in log file.");
    }
    const candidate = parsedJson as Record<string, unknown>;
    if (candidate.schemaVersion !== PERSONA_EPOCH_SCHEMA_VERSION_1) {
      throw new Error(
        `DurablePersonaEpochRegistry: unsupported/unknown schemaVersion "${String(candidate.schemaVersion)}" found in log file.`,
      );
    }
    if (!isWellFormedPersonaEpoch(candidate.epoch)) {
      throw new Error("DurablePersonaEpochRegistry: corrupt or schema-invalid PersonaEpoch record found in log file.");
    }
    const epoch = candidate.epoch;
    const existing = byId.get(epoch.epochId);
    if (existing !== undefined && !personaEpochsEqual(existing, epoch)) {
      throw new Error(
        `DurablePersonaEpochRegistry: conflicting duplicate records for epochId "${epoch.epochId}" found in log file.`,
      );
    }
    byId.set(epoch.epochId, epoch);
  }
  return byId;
}

export class DurablePersonaEpochRegistry {
  readonly #filePath: string;
  #epochs: Map<string, PersonaEpoch>;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#epochs = replayLog(filePath);
  }

  /**
   * Registers `epoch`. Idempotent no-op if `epoch.epochId` is already
   * registered with byte-identical content; throws if it is already
   * registered with DIFFERENT content — a `PersonaEpoch` is immutable for
   * its lifetime, so a disagreeing re-registration is always a
   * programmer error or corrupted input, never a legitimate update.
   */
  register(epoch: PersonaEpoch): void {
    const existing = this.#epochs.get(epoch.epochId);
    if (existing !== undefined) {
      if (!personaEpochsEqual(existing, epoch)) {
        throw new Error(
          `DurablePersonaEpochRegistry: epochId "${epoch.epochId}" is already registered with different content -- rejected.`,
        );
      }
      return;
    }
    const record: PersistedPersonaEpochRecordV1 = { schemaVersion: PERSONA_EPOCH_SCHEMA_VERSION_1, epoch };
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
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
