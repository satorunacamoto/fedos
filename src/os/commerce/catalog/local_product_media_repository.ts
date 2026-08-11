/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc (Gap #9).
 *
 * `LocalProductMediaRepository` — deterministic, `Map`-backed
 * `ProductMediaRepositoryPort` adapter. Same convention as
 * `LocalProductRepository`/`LocalMediaStore` (this same pass): private
 * field, defensive copies via readonly record spreads, injectable id
 * generator (defaults to `generateFedosProductMediaId()`).
 *
 * Every write runs `validateProductMedia()`
 * (`./product_media_types.ts`) — including the "protected implies
 * checksumSubject: ciphertext" invariant — BEFORE the record is stored,
 * so a caller cannot bypass that rule by constructing a `ProductMedia`
 * object directly and handing it to some other path; this repository is
 * the only place records ever get created in this arc's own scope.
 */

import { canEditProduct } from "./policy.js";
import { generateFedosProductMediaId } from "./product_id.js";
import { validateProductMedia, type ProductMedia } from "./product_media_types.js";
import type { Product } from "./types.js";
import type {
  AddProductMediaInput,
  ProductMediaRepositoryMutationResult,
  ProductMediaRepositoryPort,
} from "./product_media_repository_port.js";

export class LocalProductMediaRepository implements ProductMediaRepositoryPort {
  readonly #media = new Map<string, ProductMedia>();
  readonly #generateId: () => string;

  constructor(generateId: () => string = generateFedosProductMediaId) {
    this.#generateId = generateId;
  }

  add(actorPubkey: string, product: Product, input: AddProductMediaInput): ProductMediaRepositoryMutationResult {
    const decision = canEditProduct(actorPubkey, product);
    if (!decision.allowed) return { outcome: "forbidden", reason: decision.reason };

    const validation = validateProductMedia({
      role: input.role,
      classification: input.classification,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum,
      checksumSubject: input.checksumSubject,
      storageRef: input.storageRef,
    });
    if (!validation.valid) return { outcome: "invalid-input", reason: validation.reason };

    let id = this.#generateId();
    while (this.#media.has(id)) {
      id = this.#generateId();
    }

    const media: ProductMedia = {
      id,
      productId: product.id,
      role: input.role,
      classification: input.classification,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum,
      checksumSubject: input.checksumSubject,
      altText: input.altText,
      storageRef: input.storageRef,
      nostrEventId: input.nostrEventId,
    };
    this.#media.set(id, media);
    return { outcome: "ok", media };
  }

  remove(actorPubkey: string, product: Product, mediaId: string): ProductMediaRepositoryMutationResult {
    const existing = this.#media.get(mediaId);
    if (existing === undefined || existing.productId !== product.id) return { outcome: "not-found" };

    const decision = canEditProduct(actorPubkey, product);
    if (!decision.allowed) return { outcome: "forbidden", reason: decision.reason };

    this.#media.delete(mediaId);
    return { outcome: "ok", media: existing };
  }

  get(mediaId: string): ProductMedia | undefined {
    return this.#media.get(mediaId);
  }

  listForProduct(productId: string): readonly ProductMedia[] {
    return [...this.#media.values()].filter((media) => media.productId === productId);
  }
}
