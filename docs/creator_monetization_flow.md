# Creator Monetization Flow (research/design docs only — no implementation)

**Status: docs only. This document adds NO code, NO new provider, NO new
API, and NO change to `src/`, `packages/`, or `Cargo.toml`.** It fixes how
the boundaries already shipped — `MarketplaceProvider` (Stage 111),
`PaymentProvider` (Stage 44), `EntitlementProvider` (Stage 111),
`ChatProvider` (Stage 111), `StorageBackend` (Stage 107), and
`FederationProvider` (Stage 110) — are EXPECTED to eventually connect so a
creator can list something, get paid, and unlock access for a buyer. It
is a flow sketch, not a specification: nothing here is scheduled, and no
step is implemented by this document.

---

## 1. Purpose

Design the revenue path that lets a creator sustain themselves on FedOS:
list something for sale or support, receive payment, and have that
translate into real access (a digital download, a membership tier, a
gated chat, gated content) — without any single boundary having to know
how the others work internally. This document fixes the SHAPE of that
path before any of it is built.

---

## 2. Role of each existing boundary in this flow

| Boundary | Role in monetization | Must NOT do |
| --- | --- | --- |
| `MarketplaceProvider` (`src/marketplace/`) | Names WHAT is offered (a listing) and receives a purchase intent | Charge money, grant access, know payment internals |
| `PaymentProvider` (`src/payment/`) | Evaluates whether a payment request is policy-clean | Grant access, know what the buyer receives |
| `EntitlementProvider` (`src/creator/entitlement.ts`) | Answers "does this subject have access now" | Issue a payment, know why access was earned |
| `ChatProvider` (`src/chat/`) | Would gate a DM/chat surface behind an entitlement check | Know payment/listing details, encrypt/decrypt |
| `StorageBackend` (`src/storage/`) | Would eventually hold purchased bytes | Decide who may retrieve them (that's entitlement's job) |
| `FederationProvider` (`src/federation/`) | Would announce PUBLIC listing metadata to Nostr/Bluesky/Threads | Carry gated content or payment/entitlement state |

Each boundary keeps doing exactly what its own docs already say — this
document does not expand any of their scopes; it only names the sequence
they would eventually be called in.

---

## 3. The basic flow (sketch, not implemented)

1. **Listing** — a creator describes a `MarketplaceListingDescriptor`
   (`MarketplaceProvider.listPlaceholder`/a future `createListing`-shaped
   call). Public metadata only; no price/payment/checkout field exists on
   the type today (see `docs/marketplace_boundary.md` §3).
2. **Purchase intent** — a buyer calls something `MarketplaceProvider`
   shaped like `purchasePlaceholder`, referencing a listing by its opaque
   `listingRef`. No money moves at this step, by design (Stage 111).
3. **Payment placeholder** — a purchase intent WOULD eventually be handed
   to `PaymentProvider.requestPayment` (already shipped, Stage 44) to
   evaluate a `PaymentDecision`. This document does not change that
   boundary; it only names it as the next link in the chain.
4. **Entitlement check** — an `accepted_placeholder`/eventually-real
   payment decision WOULD eventually cause an entitlement record to be
   written somewhere (not designed yet — see §4), which
   `EntitlementProvider.checkPlaceholder` would then read back for
   "does this buyer have access now".
5. **Gated chat / gated content** — a future real `ChatProvider`/content
   route would call `EntitlementProvider` FIRST, and only then allow the
   send/fetch/render to proceed. The gate is entitlement, never a payment
   check re-run at the content layer.
6. **Federation announcement** — PUBLIC metadata about the listing (title,
   creator, category — never price/payment/entitlement state) MAY
   eventually be announced via `FederationProvider.publishPlaceholder` so
   the listing is visible on Nostr/Bluesky/Threads, same as any other
   social post (see `docs/nostr_adapter_planning.md` §5).

---

## 4. What is NOT implemented yet (by this document or any prior stage)

- **Checkout.** No session, no redirect, no cart of any kind.
- **Invoice.** No Lightning invoice, no Stripe PaymentIntent.
- **Settlement.** No confirmation that money actually moved.
- **`PurchaseGrant` issuance.** `src/commerce/`'s existing type is not
  constructed by any Stage 111 boundary; how/when a monetization flow
  would eventually produce one is unresolved.
- **Download unlock.** No signed URL, no asset-cache grant tied to a
  purchase.
- **Paid chat unlock.** No real gating logic exists in `ChatProvider` yet.
- **DM delivery.** No message is ever sent by any boundary in this stage.

---

## 5. The permission model: paid vs. accessible are different facts

This is the single most important invariant for any future monetization
work (see `docs/creator_entitlement_boundary.md` §2 for the original
statement):

- **"A payment was accepted"** is a `PaymentProvider` fact.
- **"This subject currently has access"** is an `EntitlementProvider`
  fact, and `EntitlementProvider` is the ONLY boundary allowed to answer
  the access question.

No future content/chat route should re-derive access from payment records
directly — it must always go through `EntitlementProvider`. This is what
lets access later be granted by a promo code, an admin action, or a free
tier, without every gated surface needing to know about every access
source.

---

## 6. Fee design (names only — policy, not implementation)

The following fee CONCEPTS are named so future pricing/policy docs have
fixed vocabulary — none is calculated, charged, or split by anything that
exists today:

- **Platform fee** — a cut FedOS itself would take.
- **Creator share** — what remains for the creator.
- **Developer fund** — a possible pool funding FedOS's own development.
- **Community treasury** — a possible pool a board/community controls.

All four are PLACEHOLDER policy concepts. No percentage, formula, ledger,
or payout mechanism is decided here.

---

## 7. Community self-governance (names only)

Also named for future design, not implemented:

- **Moderation** — who can hide/remove a listing or chat content.
- **Listing visibility** — who can see a listing before/after moderation.
- **Creator trust** — some notion of a creator's standing (new vs.
  established, flagged vs. clean).
- **Appeal** — a creator's recourse against a moderation action.

**No DAO, voting mechanism, or on-chain governance is implemented or
planned by this document.** These remain product/policy questions for a
future stage.

---

## 8. Relationship to Nostr (see `docs/nostr_adapter_planning.md` for detail)

- A listing **announcement** (title, category, creator handle) is a
  candidate for a future public Nostr event — same treatment as any other
  social post.
- **Gated content itself is never placed on Nostr directly.** Nostr events
  are public and undeletable in practice (see
  `docs/nostr_adapter_planning.md` §2); anything paywalled must stay
  behind `EntitlementProvider`, not behind "this Nostr event is hard to
  find".
- Only PUBLIC metadata is a federation-announcement candidate — never
  price, payment status, or entitlement state.

---

## 9. Relationship to `StorageBackend`

- Purchased bytes (a digital download) would eventually be `StorageBackend`'s
  concern, not the marketplace or payment boundary's.
- **A signed URL or a download-unlock mechanism is explicitly NOT designed
  yet** and remains forbidden until a future stage defines it alongside
  `docs/storage_metadata_policy.md`'s existing rules.

---

## 10. Security / privacy rules for any future implementation

- **Payment metadata must never be mixed into a chat or federation
  payload.** A `ChatMessageDescriptor.metadata` or a `SocialEventDescriptor.metadata`
  must never carry a price, payment id, or payment status.
- **An entitlement decision must never be placed on a public event.**
  Whether a specific buyer has access is not public information.
- **Buyer identity leak.** A public federation announcement for a listing
  must never include who purchased it — that pairing (subject ↔ listing)
  is exactly what `EntitlementProvider.checkPlaceholder`'s `subjectRef`/
  `resourceRef` exist to keep private and separate from any public event.

---

## 11. Future implementation order (design intent, not scheduled)

1. Fix a payment→entitlement linking design (how a `PaymentDecision`
   would eventually cause an entitlement record to exist) — still no
   grant type decided.
2. Fix an entitlement storage design (where a real entitlement record
   would live) — likely `StorageBackend`, subject to its metadata policy.
3. Wire a real `ChatProvider`/content-route gate that calls
   `EntitlementProvider` before allowing access.
4. Only then consider checkout/invoice/settlement for a real
   `PaymentProvider` implementation.
5. Federation announcement of PUBLIC listing metadata can be built
   independently of the above, at any point, since it never touches
   payment/entitlement state.

---

## 12. Conclusion

- This document fixes a FLOW, not a feature — every step it names already
  has a boundary that would eventually implement it, and none of those
  boundaries changed today.
- Paid and accessible remain two separate facts, gated by
  `EntitlementProvider` alone.
- Checkout, invoicing, settlement, grant issuance, download unlock, paid
  chat unlock, and DM delivery are all explicitly future work.

---

## 13. Stage 114+ update note

Two read-only preview surfaces now exist: a Marketplace listing preview
(`src/render/marketplace_preview.ts`, gated by `?marketplacePreview=1`)
showing sample listings' kind/visibility/creator label with a permanently
`disabled` "buy" button (no checkout, no price, no download — the type has
none of those fields), and a new `MarketplaceIntentDescriptor`
(`src/marketplace/intent.ts`) naming what §3's "purchase intent" step would
eventually carry (`view_listing_placeholder`/`purchase_intent_placeholder`/
`subscribe_intent_placeholder`/`tip_intent_placeholder`/
`request_access_placeholder`) — reviewed by `reviewMarketplaceIntent`
(policy-only: rejects any price/card/payment/checkout/invoice/download
metadata), still with NO connection to `PaymentProvider` or
`EntitlementProvider`. Neither addition moves the flow past step 2
("purchase intent") in §3 — payment, entitlement, and everything after
remain exactly as unimplemented as before.

---

## 14. Stage 115+ update note

§7's "Creator trust" name is now a shipped boundary:
`src/creator/profile.ts` defines `CreatorProfileDescriptor`
(`creatorRef?`/`displayName?`/`bioPreview?`/`category?`/`trustLabels?`/
`createdAt?`/`metadata?`, no payment/entitlement field) and six
`CreatorTrustLabel` placeholders (`unknown_`/`verified_`/
`community_trusted_`/`new_creator_`/`reported_`/`test_placeholder`),
reviewed by a pure `reviewCreatorProfile` that rejects sensitive bio/
metadata content and NEVER performs real identity verification —
`"verified_placeholder"` is documented explicitly as a FUTURE label name
only, never something any code path in this stage can produce from an
actual check. A new read-only preview
(`src/render/creator_profile_preview.ts`, gated by `?creatorPreview=1`)
shows a sample profile's display name/bio/category/trust labels
(HTML-escaped) plus the review state, ending in a permanently `disabled`
"follow" button — no profile fetch, no metadata display, no follow/
subscribe/buy/message flow. §7's "Moderation" and "Appeal" names are
likewise now partly shipped as `src/community/moderation.ts` — see
`docs/community_moderation_policy.md` for the full boundary description;
that boundary answers "what would this hide/mute/filter action visually
do", strictly separate from payment/entitlement and from this document's
own flow. Neither addition moves any step of §3 forward — payment,
checkout, entitlement issuance, and download unlock remain exactly as
unimplemented as before.

---

## 15. Stage 116+ update note

A creator "membership tier" — implied by §1's "a membership tier" and by
listings already nameable via `MarketplaceItemKind:
"membership_placeholder"` — is now a shipped, separate boundary:
`src/creator/membership.ts` defines `MembershipPlanDescriptor`
(`idRef?`/`creatorRef?`/`kind`/`visibility`/`metadata?`) and six
`MembershipPlanKind` placeholders (`free_`/`supporter_`/`premium_`/
`community_`/`private_chat_`/`test_placeholder`), reviewed by a pure
`reviewMembershipPlan` that rejects any price/card/payment/checkout/
invoice/download/entitlement metadata and imports neither `PaymentProvider`
nor `EntitlementProvider`. This is a NAMING boundary only — it names WHAT
tier a creator offers, exactly as `MarketplaceListingDescriptor` names WHAT
is listed, and does not move §3's flow past step 1 ("Listing"): no
checkout, no entitlement issuance, and no gated-chat unlock exist because
of this addition. `docs/nostr_adapter_planning.md`'s Stage 116 note covers
the same stage's Nostr publish-intent addition, which is unrelated to
membership plans beyond sharing this codebase's placeholder-vocabulary
convention.

---

## 16. Stage 117 update note — creator dashboard preview

A read-only "creator dashboard" surface — implied by §7's per-creator name
list but not previously built — now exists as
`src/render/creator_dashboard_preview.ts`
(`renderCreatorDashboardPreview`/`renderCreatorDashboardPreviewPage`, plus
static `SAMPLE_CREATOR_DASHBOARDS`), gated by an EXPLICIT
`?creatorDashboardPreview=1` flag in `src/worker.ts`
(`isCreatorDashboardPreviewEnabled`). It shows, per sample creator: a
`creatorRef`, three PLACEHOLDER counts (`listingCountPlaceholder`/
`membershipPlanCountPlaceholder`/`communityRuleCountPlaceholder` — static
numbers, never a real tally from `src/marketplace/`, `src/creator/
membership.ts`, or `src/community/moderation.ts` storage), and two fixed
label lists pulled from existing pure boundaries: a federation capability
summary (`src/federation/capability_matrix.ts`'s
`getProtocolAdapterCapabilities`, filtered to `available_placeholder`
entries) and a moderation visibility summary (fixed
`ModerationVisibilityDecision` labels). Every field is HTML-escaped, and the
page ends in three permanently `disabled` navigation buttons — no listing/
plan/rule fetch, no real purchaser count, and no monetary/settlement field
of any kind (this stage's denylist: revenue/amount/payment/checkout/
invoice/buyer/email — none appears anywhere in the new file, comments
included). This does not move §3's flow past step 1 ("Listing"): no
checkout, no entitlement issuance, and no gated-chat unlock exist because of
this addition. `docs/nostr_adapter_planning.md`'s Stage 117 note covers the
same stage's capability-matrix addition this dashboard reads labels from.
