# Seller-Side Completion-Sync Invariant Gap — Coordinator Finding (LIVE, first reproduction)

**Status: DOCUMENTED, DEFERRED (not fixed in this arc). Discovered as a
by-product of closing `PROTECTED-MEDIA-BYTE-DURABILITY-GAP.md` — that fix is
what let a real two-process E2E finally REACH this code path for the first
time; STEP 7 (the byte-durability arc's own core proof) always failed first
in every prior run, so nobody had ever seen STEP 8/9 execute against real
production code before.**

## Summary

Two distinct, already-known-in-principle gaps (both named in
`src/os/commerce/media_grant/media_access_grant_release_channel_policy.ts`'s
own header, under "CONFIRMED REMAINING GAP" / "A DEEPER, NOT-YET-FIXED gap
remains") are now LIVE-reproduced, for the first time, by a real two-process
E2E: `packages/fedos-desktop-electron-spike/test/commerce_digital_delivery_positive_packaged_binary_real_electron.test.ts`
(new this arc) and its dev-mode sibling
`commerce_digital_delivery_positive_real_electron.test.ts` (pre-existing,
now reaching further than ever before). Both fail identically at STEP
8/STEP 9, on both the packaged and dev builds — confirming this is a real
product-code gap, not an environment/timing artifact (verified: doubling
the relevant UI-script wait windows from 800ms/1500ms to 2500ms produced
byte-for-byte identical failures).

## Finding 1 (STEP 8): the seller's inbound-order-sync gate re-checks the
## WRONG evidence for a non-buyer receiver

`applyInboundPrivateOrderSyncNonFatal()`
(`packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts:3874-3879`)
re-runs `evaluateDigitalContentDeliveryInvariantForOrderCompletion()` on
EVERY process that receives an inbound `"completed"` private-order-sync
event — including the SELLER, when the buyer publishes their own genuine
completion. Its `hasReleasedContent` callback is:

```ts
hasReleasedContent: (mediaId) => commerceMediaReleaseContentCacheState().hasRelease(result.order.id, mediaId, result.order.buyerPubkey),
```

`commerceMediaReleaseContentCacheState()` is `DurableMediaReleaseContentCache`
— the BUYER's own durable record of content THEY decrypted and verified
(`src/os/commerce/media_grant/persistence/durable_media_release_content_cache.ts`).
This is the exact same callback used at the OTHER call site
(`fedos_electron_beta_main.cts:7203`, the buyer's own LOCAL "Complete order"
click) — correct there, because the evaluating process genuinely IS the
buyer who would hold that cache entry.

On the SELLER's own process, this callback is evaluated against the
SELLER's OWN local `DurableMediaReleaseContentCache` — which the seller has
no reason to ever have an entry in (a seller does not receive/decrypt a
release for their own product; only a buyer does). The check therefore
fails closed with `"digital-content-not-delivered"` for every genuine sale,
live-reproduced this arc:

```
fedos-beta: inbound private-order-sync "completed" for order <id> rejected
-- digital content delivery invariant not satisfied
(digital-content-not-delivered); transition dropped, not saved, eligible
for retry
```

**No false positive occurs** (the header's own stated goal — "a counterparty
publishing that sync status could force this process's local Order to
completed... fully bypassing this invariant" — is still honored; nothing
here lets a lying counterparty force a false completion). The actual defect
is the opposite: a TRUE completion is rejected, because the evidence
predicate is role-blind. Live-observed effect: the seller's own process
mirrors the buyer's real, genuine completion as `"delivered"`, never
`"completed"`, and reports `"No reputation history on record for this
seller yet."` even after a real, fully successful sale.

## Finding 2 (STEP 9): buyer-process restart re-triggers the already-documented `productMediaKnowledge: "unsynced"` vacuity, even for the buyer's own already-successfully-received content

After a full restart, Alice's own process (the SAME process that already
proved real bytes crossed process in STEP 7) reports
`"availability-unknown"` when re-clicking "Open Purchased Content" on her
own now-`"completed"` order — despite the content being genuinely,
durably cached (`DurableMediaReleaseContentCache`, proven durable and
unrelated to this arc's own fix).

Root cause, traced to
`fedos_electron_beta_main.cts:7759-7771`'s own already-existing comment
block: `resolveProductMediaForCompletionInvariant(order.productId,
order.sellerPubkey)` returns `productMediaKnowledge: "unsynced"` with an
EMPTY `protectedMedia` list on Alice's process for Bob's product (Alice is
not this product's seller, so her own `ProductMedia` view of it is
whatever Agent M's cross-process declaration sync has managed to merge in
by this point — evidently incomplete at the moment of this specific
restart+immediate-re-click sequence) — which this handler maps to
`"availability-unknown"` rather than attempting to serve the
already-cached content. This is the EXACT gap
`media_access_grant_release_channel_policy.ts`'s own header already names
("Nothing in this codebase today synchronizes ProductMedia metadata... the
reachability doc's own drafted-but-unwired `MediaManifestReferenceEventDraft`
is the closest existing scaffold for that future fix") — this arc adds
nothing new to that analysis, only the first LIVE reproduction of it
actually blocking a real restart-then-reopen flow.

## Why this is NOT fixed in this arc

Both findings sit squarely inside the `media_access_grant_release_channel_policy.ts`/
`resolveProductMediaForCompletionInvariant()` truthful-completion machinery
— a DIFFERENT, security/trust-sensitive subsystem from the protected-media
BYTE durability this arc's own mandate specifically scoped (`DurableIpfsTransport`/
`DurableIpfsMediaStoreIndex`, see `PROTECTED-MEDIA-BYTE-DURABILITY-GAP.md`'s
own closure record). Correctly fixing Finding 1 requires a real design
decision this document does not make unilaterally: what evidence SHOULD a
non-buyer receiver of an inbound completion-sync event check (a durable
"I sent a real release response" record on the seller's own side does not
appear to exist yet as a queryable predicate), or should the invariant
re-check simply be skipped for a receiver who is not itself the order's
buyer (trusting the buyer's own already-signature-verified sync event to
the same degree every other inbound sync claim already is)? Either choice
touches the SAME reputation/completion-truthfulness guarantee this
subsystem's own extensive header comments treat with unusual care — not a
call to make hastily under a differently-scoped arc's own time budget.
Finding 2 is already explicitly named as future work ("Agent M['s]... still
in progress") in the codebase's own comments; this document adds only live
confirmation it remains open.

## Live evidence

- `docs/commerce/evidence/commerce_e2e_digital_delivery_positive_packaged_evidence.md`
  (this arc's new packaged-binary suite, STEP 1-7 all PASS including the
  core byte-durability proof; STEP 8/9 fail exactly as described above).
- `docs/commerce/evidence/commerce_e2e_digital_delivery_positive_evidence.md`
  (the pre-existing dev-mode sibling suite, re-run this arc for the first
  time it has ever reached STEP 8/9 — identical failure shape, confirming
  this is not packaged-binary-specific).

## Recommendation for a future pass

1. Decide, explicitly, what a non-buyer receiver of an inbound completion
   sync should check (or that it should trust the sync, gated only by the
   sender-identity check `applyInboundPrivateOrderSyncPayload()` already
   performs) — Finding 1.
2. Complete Agent M's cross-process `ProductMedia`/`MediaManifestReferenceEventDraft`
   sync so a buyer's own restarted process reliably has enough
   `productMediaKnowledge` to serve its own already-cached content without
   a spurious `"unsynced"` denial — Finding 2.
3. Re-run both two-process suites (`commerce_digital_delivery_positive_real_electron.test.ts`
   and `commerce_digital_delivery_positive_packaged_binary_real_electron.test.ts`)
   as the acceptance gate for either fix — both are now real, live,
   reproducible regression tests for exactly this boundary.
