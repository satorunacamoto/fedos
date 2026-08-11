/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc (Gap #9).
 *
 * Safe renderer SEAM for `ProductMedia` — a pure function the
 * coordinator's UI layer can call to decide how (or whether) to render
 * one `ProductMedia` record, without that UI layer needing to
 * re-implement the safety/authority checks itself.
 *
 * SCOPE, per this arc's own instruction ("a bounded `<video>`-safe
 * metadata shape is enough... implement the model + a safe renderer seam
 * ... explicitly say PARTIAL"):
 *
 *   - IMAGE roles (`primary`/`gallery`/`thumbnail`/`video_preview`):
 *     REAL, render-ready — `buildProductMediaPlaybackDescriptor()`
 *     returns a validated, safe-to-use `renderableDataUri` (or `null`
 *     with a safe-fallback posture), mirroring Phase 1's own
 *     img-with-onerror-fallback UX exactly (`safeToRender: false` is the
 *     UI's cue to render the SAME initials-placeholder fallback Phase 1
 *     already uses, per that renderer's own comment header — this file
 *     does not build a DOM element itself, only the decision).
 *   - VIDEO role: **PARTIAL.** This function returns real metadata
 *     (`contentType`/`sizeBytes`/safety flags) and `kind: "video"`, but
 *     `renderableDataUri` is ALWAYS `null` and `safeToRender` is ALWAYS
 *     `false` for this kind — no `<video>` element/player is wired here
 *     or anywhere in this arc. A future integration pass can use
 *     `storageRefIsSafe`/`available` to decide whether it's safe to wire
 *     an actual player against `media.storageRef`.
 *   - SAMPLE role: **PARTIAL.** Returns `downloadAllowed` — computed
 *     from REUSED, already-tested policy (`canAccessAsset()`,
 *     `./policy.ts` — creator or valid non-revoked `PurchaseGrant` only,
 *     the exact same gate `DigitalAsset`-adjacent access already uses in
 *     this codebase) AND the safe-reference check — but no actual
 *     open/download action is implemented; that requires a real
 *     `MediaStorePort`-backed byte-fetch + a Host-level "open/save file"
 *     capability neither of which exists in `os/commerce`'s own
 *     boundary (Electron/IPC wiring is reserved for the coordinator).
 */

import { canAccessAsset } from "./policy.js";
import { isSafeCommerceImageReference, isSafeCommerceOpaqueMediaRef } from "./safe_media_reference.js";
import type { Product, PurchaseGrant } from "./types.js";
import type { ProductMedia } from "./product_media_types.js";

export type ProductMediaPlaybackKind = "image" | "video" | "sample";

export interface ProductMediaPlaybackDescriptor {
  readonly mediaId: string;
  readonly kind: ProductMediaPlaybackKind;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly altText: string;
  /** `true` iff `media.storageRef` itself passed `isSafeCommerceOpaqueMediaRef()` — `storageRef` is always an opaque key, regardless of role. */
  readonly storageRefIsSafe: boolean;
  /** `true` iff the media bytes are currently resolvable (mirrors the caller's own `MediaStorePort.exists()`/`get()` result) — `false` covers both "missing" and "offline/unavailable". */
  readonly available: boolean;
  /** `true` only for the IMAGE kind, when bytes are available, the storage reference is safe, AND the caller-supplied `resolvedImageDataUri` itself independently passes the same safe-reference check. `false` for VIDEO/SAMPLE — see this file's own PARTIAL notes above. */
  readonly safeToRender: boolean;
  /** Non-`null` only when `safeToRender` is `true`. */
  readonly renderableDataUri: string | null;
  /** `true` only for the SAMPLE kind, when the acting actor holds creator/grant authority (`canAccessAsset()`) AND the storage reference is safe AND bytes are available. Always `false` for IMAGE/VIDEO. */
  readonly downloadAllowed: boolean;
  /** Human-readable reason for `downloadAllowed`'s value (mirrors `AccessDecision.reason`) — `"n/a"` for non-SAMPLE kinds. */
  readonly downloadAccessReason: string;
}

function playbackKindForRole(role: ProductMedia["role"]): ProductMediaPlaybackKind {
  if (role === "video") return "video";
  if (role === "sample") return "sample";
  return "image"; // primary | gallery | thumbnail | video_preview
}

export interface BuildProductMediaPlaybackDescriptorInput {
  readonly media: ProductMedia;
  readonly product: Product;
  readonly actorPubkey: string;
  readonly grants: readonly PurchaseGrant[];
  /** `true` iff the caller already confirmed the underlying `MediaStorePort` entry exists (e.g. `mediaStore.exists(media.storageRef)`). */
  readonly bytesAvailable: boolean;
  /**
   * For the IMAGE kind ONLY: a caller-resolved `data:` URI already
   * decoded from the `MediaStorePort` bytes (this function does no byte
   * resolution itself — that is a Host/IPC concern). `null`/omitted for
   * VIDEO/SAMPLE, or when the caller has not resolved the bytes.
   */
  readonly resolvedImageDataUri?: string | null;
}

/** Builds the render/authority decision for one `ProductMedia` record. Pure — never mutates any input, never throws. */
export function buildProductMediaPlaybackDescriptor(
  input: BuildProductMediaPlaybackDescriptorInput,
): ProductMediaPlaybackDescriptor {
  const { media, product, actorPubkey, grants, bytesAvailable } = input;
  const kind = playbackKindForRole(media.role);
  // `storageRef` is ALWAYS an opaque MediaStorePort key, for every role
  // (see `./product_media_types.ts`'s own header) — never a role-specific
  // shape, so this check is uniform regardless of `kind`.
  const storageRefIsSafe = isSafeCommerceOpaqueMediaRef(media.storageRef);

  let safeToRender = false;
  let renderableDataUri: string | null = null;
  if (kind === "image") {
    const candidate = input.resolvedImageDataUri ?? null;
    if (
      bytesAvailable &&
      storageRefIsSafe &&
      candidate !== null &&
      isSafeCommerceImageReference(candidate)
    ) {
      safeToRender = true;
      renderableDataUri = candidate;
    }
  }

  let downloadAllowed = false;
  let downloadAccessReason = "n/a";
  if (kind === "sample") {
    const decision = canAccessAsset(actorPubkey, product, grants);
    downloadAccessReason = decision.reason;
    downloadAllowed = decision.allowed && storageRefIsSafe && bytesAvailable;
  }

  return {
    mediaId: media.id,
    kind,
    contentType: media.contentType,
    sizeBytes: media.sizeBytes,
    altText: media.altText ?? "",
    storageRefIsSafe,
    available: bytesAvailable,
    safeToRender,
    renderableDataUri,
    downloadAllowed,
    downloadAccessReason,
  };
}
