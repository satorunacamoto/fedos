# Product Media — Placeholder Example — CONCEPTUAL — NOT CURRENT PRODUCT UI

FedOS has no product-image rendering path today (see [../PRODUCT-SURFACE-AUDIT.md](../PRODUCT-SURFACE-AUDIT.md)). This file shows where product media *would* appear on the conceptual [product-detail](product-detail.md) mockup, using a repository-generated synthetic SVG placeholder — no copyrighted or external stock asset is used.

## Placeholder image (synthetic, generated inline, no external asset)

<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200" role="img" aria-label="Placeholder product image">
  <rect width="320" height="200" fill="#e8e8ec"/>
  <rect x="1" y="1" width="318" height="198" fill="none" stroke="#9a9aa6" stroke-width="2" stroke-dasharray="6 4"/>
  <circle cx="90" cy="80" r="24" fill="#c3c3cd"/>
  <polygon points="30,160 120,95 170,140 220,100 300,170 30,170" fill="#b3b3bf"/>
  <text x="160" y="190" font-family="sans-serif" font-size="12" fill="#5a5a66" text-anchor="middle">PLACEHOLDER — no real image data</text>
</svg>

## What this placeholder represents in code terms

| Concept | Would map to | Status |
|---|---|---|
| Image bytes | Not present anywhere — `AssetMetadata`/`asset_preview.ts` are explicitly metadata-only, bytes are never read into a `ProductAsset` | ABSENT (deliberately, by the code's own design rule) |
| MIME type | `AssetMetadata.contentType` (e.g. `"image/svg+xml"`) | MODEL ONLY |
| Content hash | `AssetMetadata.checksum?` — no verified computation path found; `computeFedosConversationArchiveContentHash()` (SHA-256, Messenger domain) is a real, reusable primitive if this were wired up | AVAILABLE PRIMITIVE, not wired |
| Alt text | No field exists on any type | ABSENT |

## Video / demo storyboard

No demo video exists and none is proposed here — per the audit brief, only a storyboard/specification is warranted, and only if useful. Given product media is entirely unbuilt (see gap classification), a storyboard would describe screens that don't exist yet; it is deferred to whichever future arc actually implements product media (see [../FEDOS-COMMERCE-END-TO-END.md](../FEDOS-COMMERCE-END-TO-END.md) §Recommended Next Arc).
