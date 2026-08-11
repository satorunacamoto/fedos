# Commerce Implementation Roadmap

Status: living document, updated by each Commerce arc. This revision folds in the
**Decentralized Media / Nostr Trade Reputation / Serverless Mode Architecture Validation Arc**
(design-only; see `docs/architecture/COMMERCE-DECENTRALIZED-DATA-PLANE.md` and siblings).

Audited baseline: `db53a64282484c8884417ee5d060030646efb730` (FedOS Commerce E2E audit).

## 1. Reconciliation with the existing E2E audit's 6 flow stages

The E2E audit (`docs/commerce/FEDOS-COMMERCE-END-TO-END.md`) and swimlane (`docs/architecture/COMMERCE-E2E-SWIMLANE.md`) describe the flow as six stages. This arc's decentralized/serverless design does **not** implement any of them — it only determines how a *future* implementation of each stage could optionally use Nostr/IPFS/Tor without violating existing boundaries. Per-stage impact:

| Stage | Audited current state | What this design arc changes |
|---|---|---|
| **Phase 1 — Catalog** | `listViewableProducts()` real, unit-tested, zero UI/IPC reachability. | No change to the type or logic. Adds an *optional* future path: a `ProductPublication`/`ProductUpdate` Nostr event could make catalog entries discoverable across devices without a central server — but Phase 1 implementation (see §2 below) does **not** require this; local-only catalog is still the correct Phase 1 scope. |
| **Phase 2 — Merchant listing (create/manage)** | Absent — no merchant UI exists at all. | Unaffected by this design directly; if/when a merchant-listing UI is built, publishing a listing via `ProductPublication` becomes an available *option* (network profile `nostr` or `tor_nostr_ipfs`), never a requirement — `local` profile merchant listing (device-only) remains fully valid. |
| **Phase 3 — Order** | `Order` type does not exist anywhere in the repo. | This design still does not define an `Order` type. `COMMERCE-PRIVACY-DATA-CLASSIFICATION.md`'s "Order" section is a field-classification exercise for when that type is eventually designed — it constrains *where each field may travel*, not *what the type looks like*. |
| **Phase 4 — Payment** | No `"paid"` state; `PlaceholderPaymentProvider.ingestCallback()` is dormant and unauthenticated. | Unaffected. This design explicitly reiterates (in the privacy classification doc) that the settlement callback must remain unreachable until authenticated — it does not touch payment logic. |
| **Phase 5 — Delivery** | `DigitalAsset` is dead code; no delivery mechanism exists. | `COMMERCE-MEDIA-STORAGE.md`'s `MediaStorePort`/manifest design is the closest thing to a delivery-proof primitive (an `integrityHash`-bound signed manifest could ground a future delivery-proof attestation) — but no delivery mechanism is implemented here. |
| **Phase 6 — Trust/QR** | Trust primitives real (`CapabilityGrant`, QR envelope, subscription entitlement) but zero-imported by Commerce; boundary-enforced. | This design's Layer-3 "AUTHORIZED" disclosure (`PSEUDONYMOUS-REPUTATION.md` §6) is the first design-level sketch of *how* a future Commerce↔Trust wiring could work (composition-root-mediated `CapabilityGrant` check, never a direct cross-import) — it does not perform the wiring. |

**Net effect: this arc changes zero implementation facts about any of the six stages.** It only adds an optional, currently-unimplemented data-plane layer that a future implementation of any stage may adopt.

## 2. Recommended implementation order

Unchanged from, and consistent with, the E2E audit's own recommendation (`FEDOS-COMMERCE-END-TO-END.md`, "Recommended Next Implementation Arc") plus this arc's additions layered on top:

1. **Commerce Reachable Catalog + Product Surface Phase 1** (read-only catalog + product detail, `local` network profile only, zero Nostr/IPFS/Tor) — the audit's own recommended next arc; closed `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md` gaps #1–#2 (P0). **DONE — landed immediately after this design arc.** See `docs/architecture/COMMERCE-E2E-SWIMLANE.md`'s "Phase 1 update" and `docs/commerce/evidence/` for the real packaged-app verification.
2. **Merchant listing UI** (create/manage products, still `local` profile) — depends on #1's catalog rendering path existing.
3. **Minimal media (image only, `LocalMediaStore` adapter only, no IPFS yet)** — depends on #1's catalog rendering path; can land alongside or shortly after #1.
4. **Order type + lifecycle** (still no network requirement) — depends on #1/#2.
5. **Trust↔Commerce wiring (Layer 3 capability-gated evidence, still local-only)** — depends on #4's Order existing (evidence needs something to be evidence *of*), and on the Layer-3 design in `PSEUDONYMOUS-REPUTATION.md` §6.
6. **Real payment rail** (e.g. BTCPay) with authenticated callbacks — depends on #4; independently gated on fixing `PlaceholderPaymentProvider.ingestCallback()`'s authentication gap.
7. **Nostr event plane opt-in** (`ProductPublication`, `MediaManifestReference`) — first point where the `nostr` network profile becomes real; requires extending the signing authority's event-kind allow-list (`COMMERCE-DECENTRALIZED-DATA-PLANE.md` §5, open decision #1).
8. **IPFS media adapter (`IpfsMediaStore`) + encrypt-before-IPFS** — depends on #3 (media model must exist first) and #7 (manifest needs a publish path); requires a new IPFS client dependency (not yet added to `package.json`).
9. **Pseudonymous reputation (attestations, Persona pages, epoch rotation)** — depends on #6 (need real trade completion to attest to) and #7 (attestations publish over Nostr); this is deliberately last because it is the highest-complexity, highest-privacy-risk layer and depends on every stage below it being real.
10. **Tor transport profile** — can, in principle, land independently at any point after #7/#8 exist (it's a transport concern, not a data-model dependency), but has no value until there is Nostr/IPFS traffic worth routing over it — practically last.

## 3. Non-goals restated

This roadmap update does not commit to timelines, does not allocate engineering resources, and does not treat any numbered item above as started. Each numbered item is a separate future arc requiring its own scoping, boundary review, and acceptance criteria — exactly as item #1 (Commerce Reachable Catalog Phase 1) receives in its own arc immediately following this one.
