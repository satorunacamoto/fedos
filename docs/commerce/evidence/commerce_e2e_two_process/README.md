# Commerce Two-Process E2E — Visual Evidence

Screenshots of TWO SEPARATE, real, dev-launched FedOS Desktop Beta Electron processes (Bob and Alice, each with their own `--user-data-dir`, own real local Persona created via the real Create-profile flow, own OS PID), captured by `packages/fedos-desktop-electron-spike/test/commerce_e2e_two_process_real_electron.test.ts` during its live run. Communication between the two processes happens ONLY through a real local loopback WebSocket relay (`ws://127.0.0.1:<port>`) the test itself starts — never a same-process shortcut, never a fixture/demo-actor identity for either party's own transaction role.

Full narrative evidence (PIDs, hashes, exact read values, every finding's exact rejection/status text) is in `../commerce_e2e_two_process_evidence.md`, written progressively by the same test run.

This run includes the Coordinator's fix (commit `f5df38fa`) for a real, live-reproduced integration gap this suite's own first run found (`handleCommerceOrderCreate()` couldn't reach a Nostr-discovered product) — screenshots below reflect the flow AFTER that fix, re-verified live.

- `bob-01-ready.png` — Bob's process, freshly created real Persona, `ready` screen.
- `bob-02-product-draft.png` — Bob's My Store screen after creating a real draft product ("FedOS Two-Process E2E Proof Item") as his own real local identity (never a demo actor).
- `bob-03-product-preview.png` — the same draft previewed exactly as a buyer would see it (Agent S's Preview feature), still on Bob's own process.
- `bob-04-product-published.png` — the product after a real Publish click, showing `— active` locally; this Publish is Bob's only real Nostr event, sent to the real local relay.
- `alice-01-ready.png` — Alice's SEPARATE process (own PID, own data dir, own real Persona), freshly created, `ready` screen.
- `alice-02-catalog.png` — Alice's real Shop catalog AFTER a real relay discovery query — shows `1/1 Relay connected` and her own real "Acting as" identity selected. Bob's real published listing appears in the (scrolled-off-bottom-of-frame) list, confirmed by the test's own text read of `#commerce-catalog-list`.
- `alice-03-detail.png` — Product Detail for Bob's listing, rendered on Alice's process from the real discovered+signature-verified Nostr envelope (title, price, status all real).
- `alice-04-order-submitted.png` — Alice's real Order, now `submitted` — the order-create IPC call that used to be rejected (see the evidence doc's own STEP 4 history) now succeeds against the Coordinator's fix, and a real private-order-sync event was sent to Bob's real pubkey.
- `bob-05-incoming-orders.png` — Bob's THIRD, brand-new process's "My Store" incoming-orders list, showing Alice's real Order — independently discovered purely from the real relay's replayed private-order-sync event, zero same-process shortcut. This is the arc's own make-or-break fact.
- `bob-06-accepted.png` — the same Order after Bob's real Accept click (also sends a real sync event back to Alice).
- `alice-05-myorders-accepted.png` — Alice's process, independently discovering Bob's real "accepted" transition via a fresh bounded refresh.
- `alice-06-paid.png` — Alice's process after a real TEST/LOCAL "Pay Now" + "Simulate Payment" — never real money, entirely local to her own process.
- `bob-07-still-accepted-after-alice-paid.png` — Bob's FOURTH, brand-new process, after re-running the real bounded discovery refresh AFTER Alice's real payment: status is still `accepted`, never `paid` — the UI's own honest copy ("waiting on the buyer to pay... reopen later to see whether payment has arrived") confirms this is the real, correctly-designed limit, not a stale cache. This is the deliberate payment-evidence propagation wall (see the evidence doc and this arc's final report for why it's correct, not a bug).
- `bob-08-fulfill-rejected.png` — the same process, after clicking the real (CSS-hidden-for-this-status) Fulfill control anyway to capture the real IPC handler's own rejection text — never to force it to succeed.

No image attach (Agent D's media work) was exercised — file-input elements cannot be driven through the existing `ui-script` harness's `fill`/`click` primitives (no native OS file-picker automation exists in this repo), and it was not load-bearing for this suite's core mandate.
