# Commerce Reachable Catalog Phase 1 — Visual Evidence

Screenshots of the **real packaged FedOS Desktop Beta Electron app** (`packages/fedos-desktop-electron-spike/dist/fedos_electron_beta_main.cjs`, launched with the real Electron binary, real WASM Master Seed artifact, an isolated throwaway test profile via `FEDOS_ELECTRON_BETA_DATA_DIR`), captured during this arc's live verification. All product/merchant data shown is the synthetic demo catalog (`fedos_electron_beta_commerce_demo_catalog.ts`) — no real customer or business data.

- `commerce_catalog.png` — the Commerce nav entry (next to Conversations) and the 3-product demo catalog list, each row showing the safe initials fallback thumbnail, title, price, and merchant.
- `product_detail_with_image.png` — Product Detail for the one demo product that ships with a real (synthetic, generated) image, rendered as an actual `<img>` from a validated `data:image/png;base64,` URI. The "Ordering not available yet" pill is visible — no working Buy control.
- `product_detail_missing_image_fallback.png` — Product Detail for a demo product with no media, rendering the safe neutral initials placeholder instead of a broken image.

Machine-specific paths and unrelated desktop content were cropped/avoided; each screenshot is the maximized application window only.

The same flow is exercised automatically (not just manually) by `packages/fedos-desktop-electron-spike/test/commerce_reachable_catalog_phase1_real_vertical_slice.test.ts`, which drives the real packaged app end-to-end via the existing `AUTOTEST_MODE=ui-script` harness.
