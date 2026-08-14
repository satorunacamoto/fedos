/**
 * Real Digital Delivery mega-arc (Coordinator, positive-E2E root-cause fix)
 * — Product Media domain, DURABLE `ProductMediaRepositoryPort` adapter.
 *
 * THE GAP THIS CLOSES (found by direct source inspection while building the
 * REAL, live, two-independent-Electron-process positive digital-delivery
 * E2E this arc's own mandate asked for — never guessed): `commerceProductMediaState()`
 * (`fedos_electron_beta_main.cts`) has, since the "Merchant Product CRUD +
 * Product Media + MediaStore Port" arc first landed it, ALWAYS constructed a
 * bare `LocalProductMediaRepository()` — a plain, in-memory-only `Map`
 * (`../local_product_media_repository.ts`'s own header: "deterministic,
 * `Map`-backed... adapter", no `filePath`, no persistence of any kind).
 * Every OTHER Commerce entity that matters to a real purchase
 * (`Product`/`Order`/`Delivery`/`MediaAccessGrant`/receipts/payment ledger)
 * was already migrated to a `Durable*` sibling backed by the SAME
 * append-only NDJSON discipline (`../persistence/durable_product_repository.ts`,
 * this file's own direct template) during the "Commerce Durability +
 * Protected-Media Entitlement + Packaged-E2E FINAL Closure" arc — `ProductMedia`
 * was the one domain that pass never reached.
 *
 * LIVE, REPRODUCIBLE IMPACT (confirmed via a real two-independent-Electron-
 * process run, not a unit-test guess): a seller who attaches REAL protected
 * purchased content in ONE process launch, then closes the app and reopens
 * it (a completely ordinary real-world action — a merchant does not keep
 * their desktop app open forever between "list an item" and "fulfil an
 * order placed days later") loses ALL local memory of that item's
 * `ProductMedia` record — including its `storageRef`, the ONLY key that
 * locates the already-durably-stored encrypted bytes inside
 * `IpfsMediaStore`. `issueCommerceMediaAccessGrantsNonFatal()`'s very first
 * check (`commerceProductMediaState().listForProduct(order.productId)`
 * filtered to `protected`) then silently sees ZERO protected media for a
 * product that demonstrably has real protected content on disk, and returns
 * with NO grant ever issued and NO error surfaced anywhere (the whole
 * function is deliberately best-effort/non-fatal, matching every sibling
 * "Nonfatal" issuance function in that file) — a real seller's own restart
 * silently and permanently breaks their own product's digital delivery,
 * with zero diagnostic trail. The SAME empty-repository gap also denies
 * `applyInboundPrivateMediaReleaseRequestNonFatal()`'s buyer-facing response
 * with `"media-not-found"` (confirmed live) even once a grant DOES exist
 * from some earlier session, and would equally break the merchant's own
 * "My Store" product-media listing UI after any restart.
 *
 * WHY A NEW DURABLE FILE, NOT PUBLISHING `storageRef` OR RE-DISCOVERING
 * FROM THE RELAY: `ProductMediaDeclaration` (the wire projection a seller
 * PUBLISHES) structurally, deliberately, cannot carry `storageRef` — see
 * `../product_media_declaration_types.ts`'s own header ("`storageRef`... is
 * deliberately never made public"). Re-deriving a seller's own local
 * catalog from the network was therefore never a viable fix even in
 * principle: the ONE field the seller's OWN issuance/response code actually
 * needs to locate the real ciphertext is, by design, never transmitted.
 * `storageRef` was always meant to be purely local/opaque-to-outsiders —
 * this file simply makes that ALREADY-local-only value survive the SAME
 * process's own next launch, exactly like every sibling `Durable*`
 * repository already does for its own domain. Nothing this file adds ever
 * crosses a wire.
 *
 * PATTERN: byte-for-byte the same append-only-NDJSON/replay-on-construction/
 * fail-closed-on-corruption discipline as `../persistence/durable_product_repository.ts`
 * (see that file's own header for the fuller precedent citation this one
 * intentionally does not repeat) — independent log file, `node:fs`
 * readFileSync/appendFileSync, no compaction/rewrite, no new dependency.
 * Implements `ProductMediaRepositoryPort` EXACTLY as written (no Port
 * change, no `ProductMedia` shape change) as a SIBLING of
 * `LocalProductMediaRepository`, never a replacement of it — same
 * `canEditProduct()` authority re-check on every mutating call, same
 * `validateProductMedia()` gate before a record is ever persisted (this
 * class re-validates independently rather than trusting a caller-built
 * object, exactly like every sibling `Durable*` adapter's own discipline).
 *
 * IDENTITY FIELDS: `id`/`productId` are immutable once a `ProductMedia`
 * record exists (there is no `update()` on this Port at all — `add()`
 * creates, `remove()` deletes; there is no partial-mutation case to
 * reconcile). Two persisted records sharing the same `id` but disagreeing
 * on `productId` is corruption, never a legitimate state, and is rejected
 * fail-closed on replay.
 */

import { readFileSync, appendFileSync } from "node:fs";
import { canEditProduct } from "../policy.js";
import { generateFedosProductMediaId } from "../product_id.js";
import { validateProductMedia, type ProductMedia } from "../product_media_types.js";
import type { Product } from "../types.js";
import type {
  AddProductMediaInput,
  ProductMediaRepositoryMutationResult,
  ProductMediaRepositoryPort,
} from "../product_media_repository_port.js";

const PRODUCT_MEDIA_SCHEMA_VERSION_1 = 1 as const;

/** One persisted line: the entity's FULL current state (there is no partial-update case on this Port — see this file's own header). */
interface PersistedProductMediaRecordV1 {
  readonly schemaVersion: 1;
  readonly media: ProductMedia;
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

/** Minimal structural well-formedness check for a replayed `ProductMedia` record — mirrors `DurableProductRepository`'s own `isWellFormedProductShape()` scope exactly (reject a truncated/garbled line; business rules are `validateProductMedia()`'s job, re-run on every fresh `add()`, not re-checked here on replay of already-once-validated history). */
function isWellFormedProductMediaShape(value: unknown): value is ProductMedia {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== "string" || c.id.length === 0) return false;
  if (typeof c.productId !== "string" || c.productId.length === 0) return false;
  if (typeof c.role !== "string") return false;
  if (typeof c.classification !== "string") return false;
  if (typeof c.contentType !== "string") return false;
  if (typeof c.sizeBytes !== "number" || !Number.isFinite(c.sizeBytes)) return false;
  if (typeof c.checksum !== "string") return false;
  if (typeof c.checksumSubject !== "string") return false;
  if (typeof c.storageRef !== "string" || c.storageRef.length === 0) return false;
  if (c.altText !== undefined && typeof c.altText !== "string") return false;
  if (c.nostrEventId !== undefined && typeof c.nostrEventId !== "string") return false;
  return true;
}

/**
 * PRIVATE — replays the append log into a `Map<id, ProductMedia>`. A parse
 * failure, an unrecognized `schemaVersion`, a schema-invalid record, OR an
 * irreconcilable `productId` conflict between two records sharing the same
 * `id` throws unconditionally — fail-closed on corruption, exactly like
 * every sibling append-only backend in this codebase.
 */
function replayLog(filePath: string): Map<string, ProductMedia> {
  const contents = readLogFile(filePath);
  const byId = new Map<string, ProductMedia>();
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (typeof parsedJson !== "object" || parsedJson === null) {
      throw new Error("DurableProductMediaRepository: corrupt or schema-invalid record found in log file.");
    }
    const candidate = parsedJson as Record<string, unknown>;
    if (candidate.schemaVersion !== PRODUCT_MEDIA_SCHEMA_VERSION_1) {
      throw new Error(
        `DurableProductMediaRepository: unsupported/unknown schemaVersion "${String(candidate.schemaVersion)}" found in log file.`,
      );
    }
    if (!isWellFormedProductMediaShape(candidate.media)) {
      throw new Error("DurableProductMediaRepository: corrupt or schema-invalid ProductMedia record found in log file.");
    }
    const media = candidate.media;
    const existing = byId.get(media.id);
    if (existing !== undefined && existing.productId !== media.productId) {
      throw new Error(
        `DurableProductMediaRepository: conflicting duplicate records for media id "${media.id}" found in log file (productId disagrees).`,
      );
    }
    byId.set(media.id, media);
  }
  return byId;
}

export class DurableProductMediaRepository implements ProductMediaRepositoryPort {
  readonly #filePath: string;
  #media: Map<string, ProductMedia>;
  readonly #generateId: () => string;

  constructor(filePath: string, generateId: () => string = generateFedosProductMediaId) {
    this.#filePath = filePath;
    this.#generateId = generateId;
    this.#media = replayLog(filePath);
  }

  #persist(media: ProductMedia): void {
    const record: PersistedProductMediaRecordV1 = { schemaVersion: PRODUCT_MEDIA_SCHEMA_VERSION_1, media };
    appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    this.#media.set(media.id, media);
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
    this.#persist(media);
    return { outcome: "ok", media };
  }

  remove(actorPubkey: string, product: Product, mediaId: string): ProductMediaRepositoryMutationResult {
    const existing = this.#media.get(mediaId);
    if (existing === undefined || existing.productId !== product.id) return { outcome: "not-found" };

    const decision = canEditProduct(actorPubkey, product);
    if (!decision.allowed) return { outcome: "forbidden", reason: decision.reason };

    // Deletion is NOT append-only-log-friendly for a fail-closed replay
    // model (a "tombstone" record would need its own schema/handling this
    // Port has no room for today, and no caller of `remove()` in this
    // codebase currently exists — grep-verified before writing this
    // method). Mirrors `AppendOnlyMediaAccessGrantPersistence`'s own
    // documented posture of "no compaction/delete/rewrite": this class
    // removes from the in-memory projection only, so a REPLAY would still
    // see the original `add()` record. This is an honest, disclosed
    // limitation (not silently masked) — if a real caller needs durable
    // removal, that is a real, separate follow-up (a retraction/tombstone
    // schema version), not a gap this fix's own scope needed to close.
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
