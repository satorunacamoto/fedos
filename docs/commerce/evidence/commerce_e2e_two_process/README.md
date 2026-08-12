# Commerce Two-Process E2E — Visual Evidence

Screenshots of TWO SEPARATE, real, dev-launched FedOS Desktop Beta Electron processes (Bob and Alice, each with their own `--user-data-dir`, own real local Persona created via the real Create-profile flow, own OS PID), captured by `packages/fedos-desktop-electron-spike/test/commerce_e2e_two_process_real_electron.test.ts` during its live run. Communication between the two processes happens ONLY through a real local loopback WebSocket relay (`ws://127.0.0.1:<port>`) the test itself starts — never a same-process shortcut, never a fixture/demo-actor identity for either party's own transaction role.

Full narrative evidence (PIDs, hashes, exact read values, the confirmed blocker's rejection text) is in `../commerce_e2e_two_process_evidence.md`, written progressively by the same test run.

- `bob-01-ready.png` — Bob's process, freshly created real Persona, `ready` screen.
- `bob-02-product-draft.png` — Bob's My Store screen after creating a real draft product ("FedOS Two-Process E2E Proof Item") as his own real local identity (never a demo actor).
- `bob-03-product-preview.png` — the same draft previewed exactly as a buyer would see it (Agent S's Preview feature), still on Bob's own process.
- `bob-04-product-published.png` — the product after a real Publish click, showing `— active` locally; this Publish is Bob's only real Nostr event, sent to the real local relay.
- `alice-01-ready.png` — Alice's SEPARATE process (own PID, own data dir, own real Persona), freshly created, `ready` screen.
- `alice-02-catalog.png` — Alice's real Shop catalog AFTER a real relay discovery query — shows `1/1 Relay connected` and her own real "Acting as" identity selected. Bob's real published listing appears in the (scrolled-off-bottom-of-frame) list, confirmed by the test's own text read of `#commerce-catalog-list`.
- `alice-03-detail.png` — Product Detail for Bob's listing, rendered on Alice's process from the real discovered+signature-verified Nostr envelope (title, price, status all real).
- `alice-04-order-create-attempt.png` — the same Product Detail screen immediately after Alice's real Order-create attempt — the CONFIRMED, live-reproduced blocker this suite documents: `handleCommerceOrderCreate()` never falls back to the Nostr-discovered-products read model, so the attempt is rejected with `"no such published product"` even though the exact same product's detail view (this screenshot) rendered correctly one step earlier.

No image attach (Agent D's media work) was exercised — file-input elements cannot be driven through the existing `ui-script` harness's `fill`/`click` primitives (no native OS file-picker automation exists in this repo), and it was not load-bearing for this suite's core mandate.
