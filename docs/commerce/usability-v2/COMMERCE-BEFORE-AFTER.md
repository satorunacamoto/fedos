# FedOS Commerce — Before / After (Real Two-Party Commerce + UX P0/P1 Closure arc)

**Before:** `arc/fedos-commerce-usability-tabletop-v1` @ `6d86fa8ccc1a478cc0f31df02e69e439ca98b085` (frozen, read-only baseline).
**After:** `arc/fedos-commerce-real-two-party-ux-closure` (this arc), fully merged (Agents N/S/U/D + two-process E2E + fresh Buyer/Seller usability tabletop rerun).

## The headline change

v1's core finding was that the buyer's stated task — find and buy a *real* second seller's *real* listing — was **structurally impossible**: no networked catalog discovery existed at all, full stop. That is no longer true. `commerce_e2e_two_process_real_electron.test.ts` (merged, real evidence in `docs/commerce/evidence/commerce_e2e_two_process/`) proves, with two genuinely independent Electron processes (separate PIDs, separate profile directories, separate real local Personas, zero same-process shortcuts), that:

- Bob's process can create and publish a real product to a real local relay.
- Alice's *separate* process independently discovers it via real relay query + real signature verification + a real read model.
- Alice can submit a real Order against that discovered product (this specific gap was found live by the E2E agent and fixed by the coordinator mid-arc — see commit `f5df38fa`).
- Bob's *separate* process independently discovers and accepts that order.
- Alice pays locally; Bob's process is shown, live, to correctly and deliberately **not** see the payment as a remote claim — this is confirmed to be an intentional security boundary (`PrivateOrderSyncStatus`'s closed type excludes `paid`/`delivered`; `order_state_machine.ts`'s actor-kind allowlist only accepts `payment_evidence`/`delivery_evidence` from a process's own locally-verified evidence, never a remote peer's claim), not a bug.

This is real, independently-proven two-party commerce for product discovery, ordering, and acceptance. It is **not yet** real two-party commerce for the full payment→delivery→receipt chain — that specific propagation mechanism does not exist yet, by deliberate design, and closing it is real, security-sensitive follow-up work, not a quick patch (see "What remains" below).

## Click/step comparison (arc §61)

Measured by the fresh, uncoached tabletop agents against the single-process "Acting as" methodology (matching v1's own methodology exactly; the two-process technical proof is measured separately above, not by step-count).

| Path | v1 | AFTER | Notes |
|---|---|---|---|
| Buyer launch → find a real 2nd-party listing | **N/A — task impossible** | **Still not reachable via the ordinary flow** (no default Relay configured) | See UX-P0 row 1 in the AFTER friction ledger — same symptom, different (fixable-by-configuration) cause. |
| Buyer launch → order submitted (after playing seller first to have something to buy) | not measured (task failed earlier) | ~37 total actions (~17 pure-buyer once past the seller setup) | New measurement; not comparable to a v1 number since v1 never reached this far. |
| Buyer order submitted → paid → received → complete | not measured | included in the ~37 above; buyer reported this stretch as "honestly not bad... clear labels, one primary action per screen" | Real, positive, specific improvement. |
| Seller launch → create product | not separately measured in v1 (mechanically "under 2 minutes, 4 fields") | ~12 required steps (+3 wasted on a broken image-attach retry) | Comparable in spirit; the v1 finding about the Unknown-merchant P0 lurking in this same flow is now closed. |
| Seller launch → listing published → order fulfilled + reputation confirmed | not measured | ~38 required steps (+5 wasted recovering from 2 real bugs) | New measurement. |

## Buyer / Seller zero-instruction verdict (arc §77)

- **Buyer zero-instruction: NO WITH FRICTION.** Completed the full order lifecycle to a verified signed receipt entirely uncoached — but only after independently discovering that the normal flow can't find a real seller and choosing, on the task brief's own explicit permission, to create that seller's listing herself. An ordinary user without that permission would stop at friction #1.
- **Seller zero-instruction: NO WITH FRICTION.** Completed the full seller lifecycle (publish → accept → fulfill → complete → receipt → reputation) uncoached, but hit two real, reproducible bugs (broken image attach, stale post-identity-switch view) that required backtracking to work around.

## UX-P0 / UX-P1 closure (arc §72)

```
BEFORE UX-P0: 5
AFTER  UX-P0: 1   (root cause changed: was "structurally impossible," now "real mechanism exists but default config doesn't surface it")

BEFORE UX-P1: 10
AFTER  UX-P1: 5   (2 confirmed-fixed-and-not-recurring; 3 new real findings from exercising previously-untested real error/identity paths; 1 unresolved discrepancy — see below)
```

**No UX-P0 is required to be zero for "final success" per the arc brief — but the brief does require reporting honestly if it isn't, and it isn't.** Row 1 (buyer discoverability) remains P0 because an ordinary first-time user still cannot complete the stated task without out-of-band configuration knowledge, even though the underlying blocker changed from "impossible" to "not defaulted on."

## The one unresolved discrepancy — reported, not resolved

The Buyer tabletop found a signed receipt did **not** survive a real dev-mode app restart. The coordinator independently, live, twice verified the *opposite* result via `commerce_e2e_packaged_binary_restart_real_electron.test.ts` against the real installed NSIS binary (byte-identical receipt artifact digest across a genuine restart). Both pieces of evidence are real and were independently produced; static source reading of `DurableReceiptStore`/`commerceDurableFilePath()` shows no code-level reason dev-mode and packaged-mode should differ (both resolve through the same `dataDir()` used by every other durable store, which persisted correctly in both tests). This is reported as an **open question for follow-up investigation** — possibly a dev-mode-launch-specific defect, possibly a test-methodology difference in exactly how the two restarts were performed — rather than resolved in favor of either observation without further evidence.

## What remains (not attempted or not closed by this arc, stated plainly)

- **Payment/delivery-evidence cross-process propagation** — the single largest remaining gap for genuine two-party commerce completion. Confirmed, live, as a deliberate security boundary, not an oversight. Closing it safely (without letting a remote peer's mere claim drive a local PAID/delivered transition) is real design work for a dedicated future arc.
- **Default-on discoverability** — making a first-time user reachable by a real relay without manual Settings configuration.
- **Seller display name** — no field exists to give a real profile a friendly store name, so any real (non-demo) seller reads as "Unknown merchant" to buyers.
- **Real digital content upload** — the entitlement/authorization system is real and correctly wired; there is still no UI path for a seller to attach the actual protected content a buyer would receive.
- **Two-process restart pass** (arc §52) — not attempted. The single-pass two-process proof plus the separately-proven packaged-binary restart proof cover the two halves; a combined two-process-AND-restart pass is real additional evidence not captured this arc, given the payment-evidence wall already caps how far a full two-process trade can proceed before restart would even be relevant.
- **Attach Image reliability, post-identity-switch stale render** — both real, reproducible P1 bugs, not yet fixed.
