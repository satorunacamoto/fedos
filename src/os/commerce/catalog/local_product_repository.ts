/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc (Gap #6).
 *
 * `LocalProductRepository` — a deterministic, in-process/local
 * `ProductRepositoryPort` adapter. No server, no network. Follows the
 * SAME `Map`-backed, defensive-copy, deterministic convention this
 * codebase already uses for every other in-process Port adapter
 * (`InMemoryFedosConversationPayloadStorage`,
 * `src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.ts`;
 * `InMemoryProductDirectory`, `./directory.ts`, itself) rather than
 * inventing a new persistence convention:
 *
 *   - Independent instances never share state (private `#products` field,
 *     no module-level singleton).
 *   - Every read returns a fresh array/object, never an internal
 *     reference an outside caller could mutate.
 *   - Deterministic: no hidden clock, no hidden randomness (id generation
 *     is injected, defaulting to `generateFedosProductId()`).
 *
 * AUTHORITY: every mutating method re-derives the target product from
 * `#products` and checks `canEditProduct(actorPubkey, existing)`
 * (`./policy.ts`, already real and already tested) BEFORE applying any
 * change — an explicit check on every call, never a one-time gate at
 * construction, and never inferred from the caller simply knowing the
 * product id.
 */

import { canCreateProduct, canEditProduct } from "./policy.js";
import { listViewableProducts } from "./directory.js";
import { generateFedosProductId } from "./product_id.js";
import type { Product, ProductVisibility } from "./types.js";
import type {
  CreateProductInput,
  ProductRepositoryMutationResult,
  ProductRepositoryPort,
  UpdateProductInput,
} from "./product_repository_port.js";

const VALID_VISIBILITIES: readonly ProductVisibility[] = ["public", "unlisted", "private"];

/** PRIVATE — shared validation for both `create()` and `update()`'s numeric/string fields. Returns a reason string, or `null` if valid. */
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

export class LocalProductRepository implements ProductRepositoryPort {
  readonly #products = new Map<string, Product>();
  readonly #generateId: () => string;

  /**
   * `initialProducts` (Commerce E2E Completion arc, coordinator integration
   * gate) — OPTIONAL composition-time seed, mirroring `InMemoryProductDirectory`'s
   * own existing constructor-array convention (`./directory.ts`). Inserted
   * directly by `.id` — NOT routed through `create()` — so a caller can seed
   * exact, pre-existing ids/status (e.g. the Phase 1 demo catalog's
   * `"aurora-study"` etc., already `active`) without their random-id/
   * `status: "draft"`-only behavior. Composition-root use only; nothing
   * about this changes `create()`'s own behavior for a real new product.
   */
  constructor(generateId: () => string = generateFedosProductId, initialProducts: readonly Product[] = []) {
    this.#generateId = generateId;
    for (const product of initialProducts) {
      this.#products.set(product.id, product);
    }
  }

  create(actorPubkey: string, input: CreateProductInput): ProductRepositoryMutationResult {
    if (actorPubkey.length === 0) {
      return { outcome: "invalid-input", reason: "actorPubkey must not be blank" };
    }
    // Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
    // ledger row #2 P0 fix ("Unknown merchant" mis-attributed listing).
    // Checked BEFORE any other validation, mirroring
    // `order_state_machine.ts`'s "actor kind gate first" discipline. See
    // `policy.ts`'s `canCreateProduct()` for the full rationale.
    if (input.actorRole !== "customer" && input.actorRole !== "merchant") {
      return { outcome: "invalid-input", reason: "actorRole must be \"customer\" or \"merchant\"" };
    }
    const roleDecision = canCreateProduct(input.actorRole);
    if (!roleDecision.allowed) {
      return { outcome: "unauthorized-actor", reason: roleDecision.reason };
    }
    const invalidReason = findInputInvalidReason(input);
    if (invalidReason !== null) {
      return { outcome: "invalid-input", reason: invalidReason };
    }

    let id = this.#generateId();
    // Astronomically unlikely with a 128-bit id, but never silently overwrite an existing record.
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
    this.#products.set(id, product);
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
    this.#products.set(productId, updated);
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
    this.#products.set(productId, updated);
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
