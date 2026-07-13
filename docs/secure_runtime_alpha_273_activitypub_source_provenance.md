# Secure Runtime Alpha 273 — ActivityPub Source Provenance

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedActivityPubPostToBoardPostInput` at Alpha 277.** Stage 3 of
the Alpha 271–280 ActivityPub Canonical Board Adapter Arc.

## 1. Why now

`FedosBoardSourceReference` (Alpha 253) was already fixed by the
Canonical Board Model Arc with `"activitypub"` as one of its five closed
protocol values and its own documented convention ("`activitypub`: the
ActivityPub object URI"). This Stage confirms that convention still
holds given the actual `FedosValidatedActivityPubPost` shape (Alpha 272)
and fixes the remaining provenance policy questions this Arc's own
instruction raises.

## 2. The mapping

```
"activitypub"   ->  FedosBoardSourceReference.protocol   (fixed constant)
post.objectId   ->  FedosBoardSourceReference.reference   (verbatim)
```

## 3. Object id, not Create Activity id — confirmed, inventory found no
reason otherwise

Per this Arc's own instruction: "use the ActivityPub Object id, not the
Create Activity id, as the canonical source object reference unless
inventory proves otherwise." Alpha 271's own inventory found NO existing
code of either kind (§3.6) — nothing "proves otherwise." The Object id
is adopted as instructed: it is also the ONLY id
`FedosValidatedActivityPubPost` even carries (`objectId`) — the type
itself has no separate `activityId` field (Alpha 272 §2), so there is
structurally nothing else this Stage COULD choose. This matches the
Object-id-oriented convention Alpha 253 already fixed in the prior Arc,
and matches ActivityPub's own semantics: the `Note` object has a stable
identity independent of any particular `Create` activity that announced
it (the same object could in principle be re-announced).

## 4. What is deliberately excluded, confirmed absent by construction

`FedosValidatedActivityPubPost` (Alpha 272) has exactly six fields —
none of the following exists ON THE TYPE, so none can leak into
`FedosBoardSourceReference` even by accident:

- **No inbox URL.**
- **No instance base URL, tracked separately.**
- **No HTTP Signature key id.**
- **No request path.**
- **No IP address.**
- **No transport metadata of any kind.**
- **No access token.**

`FedosBoardSourceReference` itself independently enforces "no generic
metadata bag" (Alpha 253 §4, unmodified) — even if a future Stage
widened `FedosValidatedActivityPubPost`, the source-reference construction
step would still only ever read `objectId`.

## 5. Duplicate-import identity — reused, not reinvented

Per this Arc's own instruction: "same protocol + same `objectId` = same
source object candidate. Do not implement deduplication yet." This is
EXACTLY the identity rule `fedosBoardSourceKey`
(`src/board/fedos_board_source.ts`, Alpha 253) already implements and
this Arc reuses UNMODIFIED — no new function is written:

```
fedosBoardSourceKey({ protocol: "activitypub", reference: objectId })
  === fedosBoardSourceKey({ protocol: "activitypub", reference: objectId })
```

for any two calls with the same `objectId`. No deduplication logic is
implemented by this Arc, matching the instruction exactly — the SAME
scope limit Alpha 253 §5 already applied to Nostr.

## 6. See also

- `docs/secure_runtime_alpha_272_normalized_activitypub_post_model.md`
- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_265_nostr_source_reference.md`
