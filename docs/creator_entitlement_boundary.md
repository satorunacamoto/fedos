# Creator Entitlement Boundary (docs only — describes the Stage 111 type-only skeleton)

**Status: this document describes the `EntitlementProvider` seam shipped in
`src/creator/entitlement.ts` (Stage 111). It adds NO real grant issuance, NO
payment connection, and NO access-control enforcement.**

---

## 1. What this boundary answers

`EntitlementProvider` answers exactly one question — "does this subject
have access to this resource" — for a fixed set of `EntitlementKind`
labels (`digital_access_placeholder`, `membership_access_placeholder`,
`chat_access_placeholder`, `community_access_placeholder`,
`test_placeholder`). It does NOT answer "how was this access earned" —
that is a separate concern this boundary deliberately does not model.

- `status()` — a pure, synchronous read of the current status.
- `checkPlaceholder(request)` — ask whether access is allowed.
  `request.subjectRef`/`resourceRef` are OPAQUE labels only.

`NoopEntitlementProvider` — the only implementation this stage ships —
NEVER returns `allowed: true`. Every check is denied, because nothing here
verifies a real grant, membership record, or payment.

---

## 2. Why entitlement is separate from payment

A purchase and an entitlement are two different facts:

- "A payment was accepted" is `PaymentProvider`'s (`src/payment/`) concern
  (and, in this codebase's existing commerce layer,
  `paymentDecisionToGrant` in `src/payment/commerce_bridge.ts` — which
  itself only ever produces a `manual`/`promo`-sourced `PurchaseGrant`,
  never a verified `payment`-sourced one; see that file's Stage 44 docs).
- "This subject currently has access" is `EntitlementProvider`'s concern.

Collapsing these into one step would mean every future access surface (a
paywalled article, a members-only chat, a gated community) has to
re-derive "was this paid for" from payment internals. Keeping them separate
means a membership could later be granted by payment, by a promo code, by
an admin action, or by a free tier — `EntitlementProvider` only ever
answers "is it currently granted", regardless of source.

**This boundary never issues a grant.** It has no `grant()`/`issue()`
method, and `checkPlaceholder` is read-only in spirit even though nothing
is actually stored yet in this stage.

---

## 3. What is explicitly NOT implemented

- **No grant issuance.** There is no `EntitlementGrant` type and no
  function that produces one. `src/commerce/`'s `PurchaseGrant` is a
  DIFFERENT, pre-existing type this boundary does not construct, extend,
  or reference.
- **No connection to `PaymentProvider`** (`src/payment/`) or any
  `MarketplaceProvider` (`src/marketplace/`). A check never triggers or
  verifies a payment.
- **No storage.** No grant/membership record is read from or written to
  `StorageBackend` or anywhere else — there is nowhere for `allowed: true`
  to come from yet.
- **No wiring** into the Worker. The Runtime selects
  `NoopEntitlementProvider` only and never calls its methods.

---

## 4. Future connection points (not built yet)

If real entitlement checking is ever implemented behind this seam, it
would eventually need to read from (never duplicate) a grant record
produced by:

- A real `PurchaseGrant` flow (`src/commerce/`, `src/payment/`) for
  digital-product access.
- A future membership/subscription record for `membership_access_placeholder`.
- A future chat/community membership list for `chat_access_placeholder`/
  `community_access_placeholder`.

None of these connections exists today; `checkPlaceholder` always resolves
`unavailable` and never reaches any of them.

---

## 5. Conclusion

- `EntitlementProvider` is a naming/shape boundary only — no access is ever
  really checked against a real record.
- `NoopEntitlementProvider` is the only implementation, permanently
  `unavailable`, and never reports `allowed: true`.
- Payment, marketplace, and entitlement remain three separate, uncoupled
  boundaries until a future stage deliberately connects them.

---

## 6. Stage 112 update note

`docs/creator_monetization_flow.md` §5 restates and relies on this
document's central rule — "paid" and "accessible" are different facts,
and `EntitlementProvider` is the ONLY boundary allowed to answer the
access question — as the permission model for the whole future
monetization flow (listing → purchase intent → payment placeholder →
entitlement check → gated chat/content). It also fixes that an
`EntitlementDecision` must never be placed on a public Nostr/federation
event (§10 there; see also `docs/nostr_adapter_planning.md` §9). Neither
doc changes anything shipped here; `NoopEntitlementProvider` remains the
only implementation and still never returns `allowed: true`.
