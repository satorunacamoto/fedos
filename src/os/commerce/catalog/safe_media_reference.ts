/**
 * Merchant Product CRUD + Product Media + MediaStore Port arc — general
 * safe-media-reference validation for `ProductMedia` (Gap #9 posture
 * item).
 *
 * Extends the EXACT posture of `isSafeCommerceImageDataUri()`
 * (`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts`,
 * Phase 1 — NOT modified by this arc, that file is reserved for the
 * coordinator's integration pass) to the new IMAGE/VIDEO/SAMPLE roles:
 * an ALLOWLIST of exact, known-safe prefixes/shapes, never a blocklist
 * regex trying to enumerate every dangerous scheme. `javascript:`,
 * `file://`, `data:text/html`, `data:image/svg+xml` (script-execution
 * ambiguity, same reasoning as Phase 1) and every other scheme are
 * rejected simply by not being on the allowlist — no explicit
 * "is-it-dangerous" check is needed or trusted.
 *
 * TWO SHAPES OF REFERENCE, per `./product_media_types.ts`'s own design:
 *   - Renderable image roles (`primary`/`gallery`/`thumbnail`/
 *     `video_preview`) are handed to an UI as an inline `data:` URI —
 *     `isSafeCommerceImageReference()` validates that shape, mirroring
 *     Phase 1's own `isSafeCommerceImageDataUri()` exactly (allowlisted
 *     `data:image/...;base64,` prefixes only).
 *   - `video`/`sample` roles are NEVER handed to an UI as a directly
 *     renderable URL — `ProductMedia.storageRef` is an OPAQUE
 *     `MediaStorePort` key (see that Port's own header: "resolution
 *     deliberately deferred"), so the safety property that matters is
 *     "this is definitely not a scheme-bearing string that could be
 *     mistaken for a URL" — `isSafeCommerceOpaqueMediaRef()` enforces a
 *     narrow, allowlisted charset with no `:`/`/` at all, which rejects
 *     `javascript:`/`file://`/anything scheme-shaped by construction.
 */

/** Allowlisted, EXACT `data:` URI prefixes — same posture as Phase 1, widened only to the image MIME types `LocalMediaStore` fixtures actually use in this arc's own tests. Never a pattern/blocklist. */
const SAFE_IMAGE_DATA_URI_PREFIXES: readonly string[] = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/webp;base64,",
];

/** Deliberately narrow: lowercase/uppercase hex-ish id charset, matching `generateFedosProductMediaId()`/`computeCommerceMediaContentHash()`'s own output shapes. No `:`, `/`, `.`, or whitespace of any kind — a scheme-bearing string can never pass. */
const SAFE_OPAQUE_MEDIA_REF_RE = /^[A-Za-z0-9_-]{1,256}$/;

/** `true` iff `value` is an allowlisted, non-empty `data:image/...;base64,` URI. Mirrors Phase 1's `isSafeCommerceImageDataUri()` exactly, widened only in the MIME allowlist. */
export function isSafeCommerceImageReference(value: string): boolean {
  return SAFE_IMAGE_DATA_URI_PREFIXES.some((prefix) => value.startsWith(prefix) && value.length > prefix.length);
}

/** `true` iff `value` is a safe OPAQUE storage reference — no scheme, no path separator, bounded length. Used for `video`/`sample` `storageRef` values, which must never be handed to an `<img src>`/`<a href>`/`<video src>` directly. */
export function isSafeCommerceOpaqueMediaRef(value: string): boolean {
  return SAFE_OPAQUE_MEDIA_REF_RE.test(value);
}

/**
 * Role-aware dispatch: image-rendered roles go through the `data:` URI
 * allowlist; `video`/`sample` go through the opaque-ref allowlist. Used
 * by `./product_media_playback.ts`'s render seam so an unsafe value can
 * never reach a UI-facing descriptor as "safe to render."
 */
export function isSafeCommerceMediaReference(
  role: "primary" | "gallery" | "thumbnail" | "video" | "video_preview" | "sample",
  value: string,
): boolean {
  if (role === "video" || role === "sample") {
    return isSafeCommerceOpaqueMediaRef(value);
  }
  return isSafeCommerceImageReference(value);
}
