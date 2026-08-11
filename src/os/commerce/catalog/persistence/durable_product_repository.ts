/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — Product/Catalog domain, DURABLE
 * `ProductRepositoryPort` adapter.
 *
 * Closes P1 "all Commerce domain state is in-memory only" for the Product
 * domain. Same NDJSON append-only log discipline as
 * `../../order/persistence/durable_order_repository.ts` (see that file's
 * header for the full precedent citation) — independent log file,
 * `node:fs` readFileSync/appendFileSync, replay-on-construction into an
 * in-memory `Map`, fail-CLOSED on any corruption.
 *
 * `Domain -> Port <- Adapter`: this file implements `ProductRepositoryPort`
 * (`../product_repository_port.js`) exactly as written — no Port change, no
 * `Product` shape change (`../types.js`) — as a SIBLING of
 * `../local_product_repository.ts`, never a replacement of it. This class
 * intentionally re-implements `LocalProductRepository`'s own
 * create/update/publish/unpublish/authority logic (there is no shared base
 * class to extend without changing either file) so every mutating method
 * durably persists its result the SAME call, never leaving the in-memory
 * `Map` ahead of the log.
 *
 * MERCHANT AUTHORITY unchanged: every mutating method still re-derives the
 * target product and calls `canEditProduct()` (`../policy.js`, already
 * real/tested) BEFORE applying any change, exactly like
 * `LocalProductRepository` — durability adds a persistence step, never a
 * shortcut around the existing authority check.
 *
 * UPSERT, NOT INSERT-ONLY (same posture as Order): `create()` persists a
 * fresh row; `update()`/`publish()`/`unpublish()` persist a revised full
 * snapshot of the SAME `id`. `id`, `kind`, and `creatorPubkey` are the
 * fields no mutating method here ever changes once a product exists — two
 * persisted records for the same `id` disagreeing on any of those is
 * corruption, never a legitimate update, and is rejected fail-closed both
 * on replay and on a fresh `save`-equivalent call.
 *
 * CONSISTENCY INVARIANT THIS FILE PRESERVES: a Product's persisted
 * `status`/`title`/`description`/`priceCents`/`currency`/`visibility`/
 * `linkedSpaceIds`/`linkedEventIds`/`assetIds`/`stock` are exactly what was
 * true at the last mutating call that durably completed. There is no
 * partial-write state — every mutating method appends ONE complete Product
 * snapshot per call.
 */

// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, appendFileSync } from "node:fs";
import { canEditProduct } from "../policy.js";
import { listViewableProducts } from "../directory.js";
import { generateFedosProductId } from "../product_id.js";
import type { Product, ProductVisibility } from "../types.js";
import type {
  CreateProductInput,
  ProductRepositoryMutationResult,
  ProductRepositoryPort,
  UpdateProductInput,
} from "../product_repository_port.js";

const PRODUCT_SCHEMA_VERSION_1 = 1 as const;
const VALID_VISIBILITIES: readonly ProductVisibility[] = ["public", "unlisted", "private"];

/** One persisted line: the entity's FULL current state, never a diff. */
interface PersistedProductRecordV1 {
  readonly schemaVersion: 1;
  readonly product: Product;
}

/** Fields no mutating method on this class ever changes once a Product exists. */
const PRODUCT_IMMUTABLE_FIELDS: readonly (keyof Product)[] = ["id", "kind", "creatorPubkey"];

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

/** PRIVATE — shared validation for both `create()` and `update()`'s numeric/string fields, mirroring `LocalProductRepository`'s own (unexported) validator. */
function findInputInvalidReason(fields: {
  readonly title?: string;
  readonly priceCents?: number;
  readonly currency?: string;
  readonly visibility?: ProductVisibility;
  readonly stock?: number;
}): string | null {
  if (fields.title !== undefined && fields.title.trim().length === 0) {
    return "title must not be blank";
  }
  if (fields.priceCents !== undefined && (!Number.isInteger(fields.priceCents) || fields.priceCents < 0)) {
    return "priceCents must be a non-negative integer";
  }
  if (fields.currency !== undefined && fields.currency.trim().length === 0) {
    return "currency must not be blank";
  }
  if (fields.visibility !== undefined && !VALID_VISIBILITIES.includes(fields.visibility)) {
    return `visibility must be one of ${VALID_VISIBILITIES.join(", ")}`;
  }
  if (fields.stock !== undefined && (!Number.isInteger(fields.stock) || fields.stock < 0)) {
    return "stock must be a non-negative integer when present";
  }
  return null;
}

/** Minimal structural well-formedness check for a replayed `Product` record. Not a re-implementation of `policy.ts`'s business rules -- just enough to reject a truncated/garbled line. */
function isWellFormedProductShape(value: unknown): value is Product {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== "string" || c.id.length === 0) return false;
  if (typeof c.kind !== "string") return false;
  if (typeof c.title !== "string") return false;
  if (typeof c.creatorPubkey !== "string") return false;
  if (typeof c.priceCents !== "number" || !Number.isFinite(c.priceCents)) return false;
  if (typeof c.currency !== "string") return false;
  if (typeof c.status !== "string") return false;
  if (typeof c.visibility !== "string") return false;
  if (!Array.isArray(c.linkedSpaceIds) || !Array.isArray(c.linkedEventIds) || !Array.isArray(c.assetIds)) return false;
  if (c.stock !== undefined && (typeof c.stock !== "number" || !Number.isFinite(c.stock))) return false;
  return true;
}

function productIdentityFieldsMatch(a: Product, b: Product): boolean {
  return PRODUCT_IMMUTABLE_FIELDS.every((key) => a[key] === b[key]);
}

/**
 * PRIVATE — replays the append log into a `Map<id, Product>`. A parse
 * failure, an unrecognized `schemaVersion`, a schema-invalid record, OR an
 * irreconcilable identity-field conflict between two records sharing the
 * same `id` throws unconditionally.
 */
function replayLog(filePath: string): Map<string, Product> {
  const contents = readLogFile(filePath);
  const byId = new Map<string, Product>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (typeof parsedJson !== "object" || parsedJson === null) {
      throw new Error("DurableProductRepository: corrupt or schema-invalid record found in log file.");
    }
    const candidate = parsedJson as Record<string, unknown>;
    if (candidate.schemaVersion !== PRODUCT_SCHEMA_VERSION_1) {
      throw new Error(
        `DurableProductRepository: unsupported/unknown schemaVersion "${String(candidate.schemaVersion)}" found in log file.`,
      );
    }
    if (!isWellFormedProductShape(candidate.product)) {
      throw new Error("DurableProductRepository: corrupt or schema-invalid Product record found in log file.");
    }
    const product = candidate.product;
    const existing = byId.get(product.id);
    if (existing !== undefined && !productIdentityFieldsMatch(existing, product)) {
      throw new Error(
        `DurableProductRepository: conflicting duplicate records for product id "${product.id}" found in log file (identity fields disagree).`,
      );
    }
    byId.set(product.id, product);
  }
  return byId;
}

export class DurableProductRepository implements ProductRepositoryPort {
  readonly #filePath: string;
  #products: Map<string, Product>;
  readonly #generateId: () => string;

  /**
   * `initialProducts` (coordinator integration, Commerce Durability arc) —
   * OPTIONAL composition-time seed, mirroring `LocalProductRepository`'s
   * own `initialProducts` constructor param (e.g. the Phase 1 demo
   * catalog's fixed ids/status). Unlike the in-memory sibling, seeding
   * here must stay correct ACROSS a restart: an id already present in the
   * replayed log is left untouched (a real merchant edit — or a prior
   * run's own seed — must never be clobbered by a stale re-seed), and any
   * id NOT yet present is durably persisted the same as a real `create()`
   * call, so it survives every subsequent restart without needing to be
   * re-seeded from this same array again.
   */
  constructor(filePath: string, generateId: () => string = generateFedosProductId, initialProducts: readonly Product[] = []) {
    this.#filePath = filePath;
    this.#generateId = generateId;
    this.#products = replayLog(filePath);
    for (const product of initialProducts) {
      if (!this.#products.has(product.id)) {
        this.#persist(product);
      }
    }
  }

  #persist(product: Product): void {
    const record: PersistedProductRecordV1 = { schemaVersion: PRODUCT_SCHEMA_VERSION_1, product };
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    this.#products.set(product.id, product);
  }

  create(actorPubkey: string, input: CreateProductInput): ProductRepositoryMutationResult {
    if (actorPubkey.length === 0) {
      return { outcome: "invalid-input", reason: "actorPubkey must not be blank" };
    }
    const invalidReason = findInputInvalidReason(input);
    if (invalidReason !== null) {
      return { outcome: "invalid-input", reason: invalidReason };
    }

    let id = this.#generateId();
    while (this.#products.has(id)) {
      id = this.#generateId();
    }

    const product: Product = {
      id,
      kind: input.kind,
      title: input.title,
      description: input.description,
      creatorPubkey: actorPubkey,
      priceCents: input.priceCents,
      currency: input.currency,
      status: "draft",
      visibility: input.visibility,
      linkedSpaceIds: [...(input.linkedSpaceIds ?? [])],
      linkedEventIds: [...(input.linkedEventIds ?? [])],
      assetIds: [...(input.assetIds ?? [])],
      stock: input.stock,
    };
    this.#persist(product);
    return { outcome: "ok", product };
  }

  update(actorPubkey: string, productId: string, patch: UpdateProductInput): ProductRepositoryMutationResult {
    const existing = this.#products.get(productId);
    if (existing === undefined) return { outcome: "not-found" };

    const decision = canEditProduct(actorPubkey, existing);
    if (!decision.allowed) return { outcome: "forbidden", reason: decision.reason };

    const invalidReason = findInputInvalidReason(patch);
    if (invalidReason !== null) {
      return { outcome: "invalid-input", reason: invalidReason };
    }

    const updated: Product = {
      ...existing,
      title: patch.title ?? existing.title,
      description: patch.description !== undefined ? patch.description : existing.description,
      priceCents: patch.priceCents ?? existing.priceCents,
      currency: patch.currency ?? existing.currency,
      visibility: patch.visibility ?? existing.visibility,
      linkedSpaceIds: patch.linkedSpaceIds !== undefined ? [...patch.linkedSpaceIds] : existing.linkedSpaceIds,
      linkedEventIds: patch.linkedEventIds !== undefined ? [...patch.linkedEventIds] : existing.linkedEventIds,
      assetIds: patch.assetIds !== undefined ? [...patch.assetIds] : existing.assetIds,
      stock: patch.stock !== undefined ? patch.stock : existing.stock,
    };
    this.#persist(updated);
    return { outcome: "ok", product: updated };
  }

  publish(actorPubkey: string, productId: string): ProductRepositoryMutationResult {
    return this.#transitionStatus(actorPubkey, productId, "active");
  }

  unpublish(actorPubkey: string, productId: string): ProductRepositoryMutationResult {
    return this.#transitionStatus(actorPubkey, productId, "archived");
  }

  #transitionStatus(actorPubkey: string, productId: string, status: Product["status"]): ProductRepositoryMutationResult {
    const existing = this.#products.get(productId);
    if (existing === undefined) return { outcome: "not-found" };

    const decision = canEditProduct(actorPubkey, existing);
    if (!decision.allowed) return { outcome: "forbidden", reason: decision.reason };

    const updated: Product = { ...existing, status };
    this.#persist(updated);
    return { outcome: "ok", product: updated };
  }

  get(id: string): Product | undefined {
    return this.#products.get(id);
  }

  list(): readonly Product[] {
    return [...this.#products.values()];
  }

  listOwnedByMerchant(actorPubkey: string): readonly Product[] {
    return this.list().filter((product) => product.creatorPubkey === actorPubkey);
  }

  listPublished(): readonly Product[] {
    return listViewableProducts(this.list());
  }
}
