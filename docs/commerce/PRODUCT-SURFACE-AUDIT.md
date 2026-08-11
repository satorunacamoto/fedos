# Product Surface Audit

**Audited commit:** `4e2825cb1e08a03509cd6b7c6e708c9b496fcf65`.

## Phase 1 update (post-audit, additive)

The Commerce Reachable Catalog + Product Surface Phase 1 arc has since shipped a real, reachable Catalog + Product Detail screen and a minimal image slice. This changes §6 and the "CURRENT vs MINIMUM" table's Title/description/price/Merchant/Primary image rows below — those sections are left unmodified as the original audited snapshot; the current facts are:

```
CUSTOMER PRODUCT UI:   IMPLEMENTED   (was: ABSENT)
PRODUCT IMAGES:        YES — minimal image support (image only; video/sample still ABSENT)
```

- The shipping renderer now has **seven** screens (Conversations, **Commerce**, Search, Archive, Devices, Safety Center, Settings), not six.
- Product Detail renders: title, description, price, merchant (resolved to a display label, not a raw pubkey), status, and media (a real image or a safe initials fallback) — see the updated §6 table below.
- Media is **not** a new field on the canonical `Product`/`AssetMetadata` domain types (§1/§2 below remain accurate and unchanged) — it is assembled at the Electron composition-root layer from a small, package-local demo dataset (`fedos_electron_beta_commerce_demo_catalog.ts`), deliberately keeping `src/os/commerce/**` untouched. A future arc may promote this into the domain layer proper (see `docs/architecture/COMMERCE-MEDIA-STORAGE.md`'s `ProductMedia` design).
- Buy action, Order, Payment, Delivery/QR/credential rows in the "MINIMUM Useful" table remain exactly ABSENT — Phase 1 is deliberately read-only discovery only.

## Commerce E2E Completion arc update (current, additive)

The "Buy action, Order, Payment, Delivery/QR/credential rows... remain exactly ABSENT" line above is now historical, not current — see `docs/commerce/FEDOS-COMMERCE-END-TO-END.md`'s "Commerce E2E Completion arc update" for the full account: a real Order/Payment/Delivery/Trust-receipt flow now exists end-to-end. This document's own subject — the `Product`/media type surface itself (§1–§6 below) — is materially unchanged by that arc EXCEPT for one addition: a real, tested Rust/WASM `CommerceMedia` AEAD/HKDF domain now exists (`resolve_commerce_media_key()`, isolated from every other crypto domain) with a real, tested `ProductMediaEncryptionPort` adapter consuming it (`WasmProductMediaEncryption`), though the default composition (`ipfs_media_store.ts`) still wires the safe `UnavailableProductMediaEncryption` fallback rather than the new adapter. Media is still not a field on the canonical `Product` domain type itself (§1/§2 below remain accurate).

---

## 1. Product/Catalog type — full field inventory

Canonical definition: `src/os/commerce/catalog/types.ts:33-52`.

```ts
export interface Product {
  readonly id: string;
  readonly kind: ProductKind;              // "pdf"|"zip"|"template"|"software"|"link"|"other"
  readonly title: string;
  readonly description?: string;
  readonly creatorPubkey: string;
  readonly priceCents: number;             // display metadata only — no charging
  readonly currency: string;
  readonly status: ProductStatus;          // "draft"|"active"|"archived"
  readonly visibility: ProductVisibility;  // "public"|"unlisted"|"private"
  readonly linkedSpaceIds: readonly string[];
  readonly linkedEventIds: readonly string[];
  readonly assetIds: readonly string[];
}
```

Companion (dead-code, zero consumers repo-wide) type:

```ts
export interface DigitalAsset {           // types.ts:58-68
  readonly id: string;
  readonly productId: string;
  readonly kind: ProductKind;
  readonly storageRef: string;            // opaque pointer, unresolved
  readonly filename?: string;
  readonly sizeBytes?: number;
  readonly checksum?: string;
}
```

`DigitalAsset` is not re-exported from `src/os/commerce/index.ts` and has zero constructors/readers anywhere in the repository — it is dead code, not a working digital-delivery model.

## 2. Media model — `AssetMetadata` (sibling type, not a `Product` field)

`src/os/commerce/catalog/asset_cache_types.ts:31-66` — a vendored, verbatim copy of a dead `_legacy_prototype/asset/types.ts` file:

```ts
export type AssetKind = "image" | "video_segment" | "audio" | "preview" | "thumbnail" | "html_fragment" | "other";
export type AssetVisibility = "public" | "unlisted" | "private" | "paid";
export interface AssetMetadata {
  readonly kind: AssetKind;
  readonly visibility: AssetVisibility;
  readonly contentType: string;   // MIME type
  readonly sizeBytes: number;
  readonly checksum?: string;
  readonly source?: string;       // opaque origin pointer, NOT a URL
  readonly tags: readonly string[];
  readonly createdAt?: number;
  readonly ttlSeconds?: number;
}
```

`Product` only links to these via `assetIds: readonly string[]` (opaque id list, no ordering, no "primary image" concept, no gallery type). Resolution happens through `catalog/asset_preview.ts` (`resolveProductAssetPreviews()`), which is metadata-only by hard design rule (bytes are "NEVER read into a ProductAsset," per its own header) and filters to public/unlisted, non-sensitive-tagged assets only.

## 3. Media classification (11 concepts)

| Concept | Classification | Evidence |
|---|---|---|
| Product image | MODEL ONLY (dead subsystem) | `AssetKind` includes `"image"`; used in `sample_products.ts:89,126,150` fixtures; no `Product` field is itself called "image" |
| Image gallery | ABSENT | No ordering/primary-image/gallery type anywhere; `grep -i gallery` = 0 hits repo-wide |
| Thumbnail | MODEL ONLY (dead subsystem) | `AssetKind = "thumbnail"`, used in fixtures (`sample_products.ts:87,148`) |
| Video | MODEL ONLY (dead subsystem, and only as a streaming "segment", not a full file) | `AssetKind = "video_segment"`; zero fixtures or consumers use it |
| Video preview | ABSENT | No poster-frame/video-preview concept; generic `"preview"` kind exists but is used for a PDF preview in fixtures, not video |
| Sample / digital attachment | DEAD CODE | `DigitalAsset` type defined, zero consumers anywhere |
| Media metadata (size/MIME/hash) | MODEL ONLY (dead subsystem) | `AssetMetadata.contentType/sizeBytes/checksum`, exercised by 12 unit tests (`test/commerce_asset_preview.test.ts`) in isolation only |
| Alt text | ABSENT | No `altText`/`alt` field anywhere; 0 hits repo-wide |
| Remote URL reference | ABSENT | `AssetMetadata.source?` is an opaque origin pointer, explicitly not a URL |
| Local file reference | ABSENT | `DigitalAsset.storageRef` is an unresolved opaque pointer; no filesystem-path concept exists |
| Nostr media reference | ABSENT | `Product.linkedEventIds` links to a Nostr event id, and a classifier reads `["product","<id>"]` tags — but nothing parses a Nostr event's own media tags (`imeta`, NIP-92/NIP-94 style) into any field; 0 hits for `imeta`/`nip-9[24]` |

No row is classified IMPLEMENTED: every non-ABSENT row is exercised only by the catalog's own unit tests, and the entire catalog subsystem carries a self-declared "inert scaffolding, not reachable from the shipped Electron app" status (`src/os/commerce/README.md:3-15`; `docs/architecture/PACKAGE-EXTRACTION-PLAN.md`: "os/commerce's inert-scaffolding status... means this has zero live-app [impact]"). No commerce/product code is imported by any of the 5 real packaging tsconfigs.

## 4. Sample fixtures (`catalog/sample_products.ts`)

Self-described (lines 1-13) as *"fixed sample products + grants + asset metadata for the read-only demo... just enough variety... to exercise the product directory, the `?product=<id>` page, and the public/unlisted asset preview filter."* This is demo/fixture data for a **dead prototype route that doesn't exist in the shipped app** — not seed data for a live catalog. Creator pubkeys are placeholder strings (`"f".repeat(64)`), not real identities. The fixture's media-shaped fields use the real, shared `AssetMetadata` type (not an ad hoc shape) — but the whole chain remains unreachable from the shipping product.

## 5. Available integrity/attachment primitives for future reuse (not currently wired to Product)

- **SHA-256 content hash, real and live** — `computeFedosConversationArchiveContentHash()` (`src/os/messenger/conversations/archive/fedos_conversation_archive_integrity.ts:40-42`), used today for Conversation Archive export/import integrity. Not invoked anywhere near `os/commerce`.
- **Signed artifact-digest proof, real and live in Trust** — `FedosTrustContractArtifactProof` (`src/os/trust/contracts/fedos_trust_contract_artifact_proof_types.ts`) signs a SHA-256 digest of an artifact. Deliberately narrow (signature validity only). Not wired to commerce.
- **Generic opaque-bytes storage, real and live in Messenger** — `FedosConversationPayloadStorage` (`src/os/messenger/conversations/payload_storage/`), a real `putPayload`/`getPayload` port with ~48 real callers. Its `mediaType` field is explicitly a **closed vocabulary of exactly one value** (`"application/octet-stream"`) — not a real MIME-type system despite the field name. Not wired to commerce, and payload ids are deliberately random (not content-hash-derived).
- Two other messenger/board layers (`src/os/core/ports/messaging_port.ts:40-46`, `src/os/messenger/board/fedos_board_post.ts:14-19,25-29`) explicitly document that a speculative `attachments` field was **removed by design** because no attachment concept exists in the real coordinator — corroborating that FedOS's live messaging/board layers have no attachment concept today beyond the low-level byte-storage primitive above.

## 6. Product page reality — inventory of what's rendered

**As of the original audit (superseded for the rows marked below — see "Phase 1 update" at the top of this document):**

| Field | Present in shipping UI? |
|---|---|
| Title | ~~ABSENT~~ **IMPLEMENTED** (Phase 1) |
| Price | ~~ABSENT~~ **IMPLEMENTED** (Phase 1) |
| Merchant | ~~ABSENT~~ **IMPLEMENTED** (Phase 1 — resolved display label) |
| Description | ~~ABSENT~~ **IMPLEMENTED** (Phase 1) |
| Images | ~~ABSENT~~ **YES — minimal image support** (Phase 1; image only, with a safe fallback when absent) |
| Video | ABSENT (unchanged — explicitly out of Phase 1 scope) |
| Inventory | ABSENT (also absent from the `Product` type itself; unchanged) |
| Terms | ABSENT (also absent from the `Product` type itself; unchanged) |
| Buy button | ABSENT (unchanged, deliberately — Phase 1 shows an explicit "Ordering not available yet" notice, never a fake working button) |
| QR | ABSENT (unchanged; QR exists only in `os/trust/qr/`, unrelated to any product page) |
| Order state | ABSENT (unchanged; no Order concept exists) |

The shipping renderer (`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html`) originally had six screens total — Conversations, Search, Archive, Devices, Safety Center, Settings, none commerce-related. **It now has seven**: Commerce (Catalog + Product Detail) was added by Phase 1, reachable from the same nav bar as Conversations.

A dead, non-Electron render function exists at `src/os/_legacy_prototype/render/product.ts` — a pure server-side HTML-string builder for a defunct Cloudflare Workers prototype, with no deploy path (`_legacy_prototype/README.md`: no wrangler config, no CI job builds it). It explicitly documents itself as having "NO destination link, NO buy/checkout/payment affordance, and NO download."

## CURRENT PRODUCT SURFACE vs MINIMUM USEFUL PRODUCT SURFACE

| Element | Current | Minimum Useful |
|---|---|---|
| Title/description/price | Modeled in `Product`, never rendered | Rendered on a detail screen |
| Merchant identity | Modeled (`creatorPubkey`), never rendered or resolved to a display name | Rendered, resolved to a friendly identity |
| Primary image | ABSENT (no field on `Product`) | At least one image, hash-checked |
| Gallery | ABSENT | Ordered list of images, hash-checked |
| Video | Only a streaming-segment concept exists in the dead sibling type | Not necessarily required for MVP |
| Inventory/stock | ABSENT | At minimum an in-stock/out-of-stock flag |
| Buy action | ABSENT (no UI, no reachable domain call) | A button that creates a real, persisted, notifiable Order |
| Order state display | ABSENT (no Order concept) | Visible pending/confirmed/fulfilled state |
| Payment status | ABSENT (no "paid" state exists) | Visible pending/paid/failed state backed by real evidence |
| Delivery proof / QR / credential | ABSENT | At minimum a receipt; QR/credential only if Trust is wired in |

**PRODUCT MEDIA: ABSENT** (in the shipped product). **MODEL ONLY** (in the dormant domain layer, itself not reachable). See [FEDOS-COMMERCE-END-TO-END.md](FEDOS-COMMERCE-END-TO-END.md) for the recommended minimal `ProductMedia` shape (observation only, not implemented).
