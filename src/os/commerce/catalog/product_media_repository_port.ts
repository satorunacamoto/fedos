/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc (Gap #9).
 *
 * `ProductMediaRepositoryPort` indexes `ProductMedia` RECORDS (metadata)
 * per product — deliberately separate from `MediaStorePort`
 * (`./media_store_port.ts`), which stores the raw BYTES a record's
 * `storageRef` points at. This mirrors the existing split in this
 * codebase between `FedosConversationPayloadDescriptor` (metadata) and
 * `FedosConversationPayload` (metadata + bytes) — a listing screen wants
 * records, a viewer wants bytes, and they scale differently (N records
 * per product, but a given content-addressed byte blob may be shared/
 * deduplicated across records via `MediaStorePort`'s own content-address
 * guarantee).
 *
 * MERCHANT AUTHORITY: `add()`/`remove()` take the OWNING `Product` (not
 * just a `productId`) and re-check `canEditProduct(actorPubkey, product)`
 * (`./policy.ts`) on every call — same explicit-check discipline as
 * `ProductRepositoryPort`.
 */

import type { Product } from "./types.js";
import type {
  ProductMedia,
  ProductMediaChecksumSubject,
  ProductMediaClassification,
  ProductMediaRole,
} from "./product_media_types.js";

/** Input to `add()`. `id`/`productId` are assigned by the adapter, never accepted from the caller. */
export interface AddProductMediaInput {
  readonly role: ProductMediaRole;
  readonly classification: ProductMediaClassification;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly checksumSubject: ProductMediaChecksumSubject;
  readonly altText?: string;
  readonly storageRef: string;
  readonly nostrEventId?: string;
}

export type ProductMediaRepositoryMutationResult =
  | { readonly outcome: "ok"; readonly media: ProductMedia }
  | { readonly outcome: "not-found" }
  | { readonly outcome: "forbidden"; readonly reason: string }
  | { readonly outcome: "invalid-input"; readonly reason: string };

export interface ProductMediaRepositoryPort {
  add(actorPubkey: string, product: Product, input: AddProductMediaInput): ProductMediaRepositoryMutationResult;
  remove(actorPubkey: string, product: Product, mediaId: string): ProductMediaRepositoryMutationResult;
  get(mediaId: string): ProductMedia | undefined;
  listForProduct(productId: string): readonly ProductMedia[];
}
