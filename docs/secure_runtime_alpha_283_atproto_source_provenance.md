# Secure Runtime Alpha 283 — AT Protocol Source Provenance

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedAtprotoPostToBoardPostInput` at Alpha 287.** Stage 3 of the
Alpha 281–290 AT Protocol Canonical Board Adapter Arc.

## 1. Why now

`FedosBoardSourceReference` (Alpha 253) already reserves `"atproto"` as
one of its five closed protocol values. This Stage fixes what
`reference` holds, given AT Protocol's own two-identifier model (URI for
identity, CID for content version) — a question neither Nostr (one id
only) nor ActivityPub (one Object URI only, Alpha 273) needed to answer.

## 2. The four options and the adopted one

- **Option A — AT URI only.** Identifies the record slot but discards
  the ability to name a specific observed content version anywhere.
- **Option B — CID only.** Rejected: a CID identifies BYTES, not a
  stable logical record — the same logical post gets a NEW CID every
  time it is updated (Alpha 288), so keying provenance on CID alone
  would make the "same post, different content-version" case look like
  two entirely unrelated source objects.
- **Option C — AT URI as `source.reference`, CID retained separately in
  the normalized input.** **Adopted**, exactly this Arc's own preferred
  candidate.
- **Option D — AT URI + CID concatenated into one opaque string.**
  Rejected: `FedosBoardSourceReference.reference` is meant to be an
  opaque but SINGLE, coherent reference (Alpha 253); concatenating two
  independently-meaningful identifiers into one string would make
  neither independently recoverable without inventing a new parsing
  convention this Arc's own instruction does not ask for, and contradicts
  Alpha 283's own explicit reasoning below.

## 3. The mapping

```
"atproto"   ->  FedosBoardSourceReference.protocol   (fixed constant)
post.uri    ->  FedosBoardSourceReference.reference   (verbatim)
```

`post.cid` (`FedosValidatedAtprotoPost.cid`, Alpha 282) is READ by the
adapter (to confirm it is present and non-empty — Alpha 287 §4) but
**never copied onto `FedosBoardSourceReference` or anywhere else on
`FedosBoardPost`.** CID does not leak into generic metadata — confirmed
structurally: `FedosBoardSourceReference` has exactly two fields
(`protocol`, `reference`, Alpha 253 §4, unmodified), and neither this
Stage nor Alpha 287 adds a third.

## 4. Reason (verbatim from this Arc's own instruction)

- **AT URI identifies the logical repository record** — the stable slot
  an author's repository names, independent of its current content.
- **CID identifies a particular content version** — changes every time
  the record at that URI is updated.
- **Future `Update` handling must not confuse record identity and
  content version.** Keying `FedosBoardSourceReference` on the URI alone
  keeps "which logical post is this" and "which version of it was this
  particular `FedosBoardPost` built from" as two SEPARATE questions —
  the second question is exactly what a future revision-observation
  model (Alpha 288) would answer, using the retained `cid`, without ever
  needing to touch `FedosBoardSourceReference`'s own shape.

## 5. What is deliberately excluded, confirmed absent by construction

`FedosValidatedAtprotoPost` (Alpha 282) has exactly seven fields — none
of the following exists ON THE TYPE, so none can leak into
`FedosBoardSourceReference` even by accident:

- **No PDS endpoint.**
- **No Relay/App View endpoint.**
- **No access token.**
- **No DID document.**
- **No repository proof.**
- **No inferred identity from hostname** — `authorDid` is a plain,
  opaque string; nothing parses a PDS hostname out of it or out of
  `uri`.
- **No board semantics parsed from collection or rkey shape** — nothing
  in this Arc splits `uri` into its `did`/`collection`/`rkey` segments
  at all; it is treated as one opaque string throughout.

## 6. Duplicate-import identity — reused, not reinvented

Per this Arc's own instruction: "same protocol + same AT URI = same
logical source object candidate. CID changes may represent a later
record version. Do not implement revision/deduplication yet." This is
EXACTLY the identity rule `fedosBoardSourceKey`
(`src/board/fedos_board_source.ts`, Alpha 253) already implements and
this Arc reuses UNMODIFIED — no new function is written, the identical
reuse Alpha 273 §5 already established for ActivityPub:

```
fedosBoardSourceKey({ protocol: "atproto", reference: uri })
  === fedosBoardSourceKey({ protocol: "atproto", reference: uri })
```

for any two calls with the same `uri`, REGARDLESS of `cid` — two
`FedosValidatedAtprotoPost` values sharing a `uri` but differing `cid`
key to the SAME source identity, exactly matching "CID changes may
represent a later record version" rather than a different logical post.
No deduplication or revision-reconciliation logic is implemented by this
Arc.

## 7. See also

- `docs/secure_runtime_alpha_282_normalized_atproto_post_model.md`
- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_273_activitypub_source_provenance.md`
- `docs/secure_runtime_alpha_288_atproto_mutation_boundary.md`
