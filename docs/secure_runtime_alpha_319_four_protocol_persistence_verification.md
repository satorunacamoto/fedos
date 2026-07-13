# Secure Runtime Alpha 319 — Four-Protocol Board Persistence Verification

**Status: this Stage VERIFIES. It adds NO new production file — it is
backed by real, executed integration tests
(`test/secure_runtime_alpha_319_four_protocol_persistence_verification.test.ts`)
that build fixtures through all FOUR real, unmodified Board Adapters,
register through `FedosBoardService`, serialize, persist, and rehydrate
into a FRESH service.** Stage 9 of the Alpha 311–320 Canonical Board
Persistence Boundary Arc.

## 1. Why now

Alpha 313–318 built the record shape, codec, port, in-memory backend,
persisted repository adapter, and hydration in isolation, exercised
mostly with hand-built fixtures. This Stage confirms the WHOLE
persistence stack survives a genuine end-to-end round trip starting from
real adapter output — the same rigor Alpha 309 (prior Arc) already
applied to the in-memory Repository/Index/Feed stack, extended one layer
deeper.

## 2. Method

```
Adapter (Nostr / ActivityPub / AT Protocol / Session)
        |
FedosBoardPost
        |
FedosBoardService.registerPost()          (in-memory, Alpha 307)
        |
serializeFedosBoardPost()                  (Alpha 314)
        |
InMemoryFedosBoardPersistence.putPost()    (Alpha 316)
        |
[ fresh process boundary simulated: a NEW service is built from ONLY
  the persistence instance above, discarding the original in-memory
  service entirely ]
        |
hydrateFedosBoardService()                 (Alpha 318)
        |
Board feed and thread retrieval            (Alpha 308, unmodified)
```

## 3. Verified, per this Arc's own required checklist

- **All posts survive round trip** — every one of the four adapters'
  own fixtures, present in the ORIGINAL service, is also present
  (`findPost` succeeds) in the HYDRATED service.
- **Canonical post equality** — the hydrated `FedosBoardPost` is
  `fedosBoardPostsAreStructurallyEqual` (Alpha 302 §5) to the original,
  for all four protocols.
- **Provenance preserved** — `source.protocol`/`source.reference`
  survive the round trip unchanged, for all four protocols.
- **Author identifier preserved** — `author.publicIdentifier` survives
  the round trip unchanged, for all four protocols.
- **Thread/reply relationships preserved** — a Nostr reply and an AT
  Protocol reply (the two protocols whose fixtures can express a real
  reply without inventing semantics, matching Alpha 309 §5's own
  precedent) still resolve to the correct `threadId` after hydration,
  and `listThreadPosts` groups root+reply identically before and after.
- **Feed ordering preserved by rebuild** — `FedosBoardFeed.listRecentPosts`
  against the HYDRATED service returns posts in the SAME `createdAt`
  DESC/`id` ASC order (Alpha 308) as against the ORIGINAL service,
  confirming index/feed rebuild is faithful, not merely "some order."
- **No feed/index data persisted** — confirmed structurally: the
  persisted `FedosPersistedBoardPostRecordV1` records contain no rank,
  no order field, no thread-child list (Alpha 313 §4); the feed order
  above is RECOMPUTED from `createdAt`/`id` after hydration, never
  read back from storage.
- **Duplicate writes idempotent** — persisting the same fixture's own
  record a second time returns `"already-present"` from
  `InMemoryFedosBoardPersistence.putPost` (Alpha 316), for all four
  protocols.
- **ID conflict rejected** — a hand-built record sharing one fixture's
  own `id` but different content is rejected as `"conflict"` by
  `InMemoryFedosBoardPersistence.putPost`, and the ORIGINAL record is
  confirmed unchanged afterward.
- **Source conflict still detected after hydration** — once hydrated
  into a fresh `FedosBoardService`, registering a NEW post that reuses
  an already-hydrated post's own `source` is STILL rejected as
  `"source-conflict"` — confirming the rebuilt Source Index (Alpha 304)
  is genuinely populated, not merely empty-but-passing.
- **Corrupt record handling follows the adopted policy** — a
  persistence instance containing one genuinely malformed record (e.g. a
  `schemaVersion` of `2`, planted directly via `putPost` with a
  type-cast) causes `hydrateFedosBoardService` to return
  `"rejected-corrupt-record"` with `service: null` — confirmed by an
  ACTUAL call, not merely asserted.
- **Unknown schema rejected** — the same fixture above (`schemaVersion:
  2`) confirms `deserializeFedosBoardPost` itself already returns `null`
  for it directly, independent of hydration.
- **One backend instance does not affect another** — two independently
  constructed `InMemoryFedosBoardPersistence` instances, each holding a
  DIFFERENT subset of the four fixtures, hydrate into two INDEPENDENT
  services with no cross-contamination.
- **All four adapters remain unchanged** — confirmed by `git diff --stat`
  showing zero changes to any of the four adapter files (verification
  step, not this Stage's own test) and, within this Stage's own test, by
  reproducing each adapter's own known-good fixture result unchanged.
- **`p2p/` untouched** — confirmed: no import of, or reference to,
  anything under `p2p/` anywhere in `src/board/persistence/` or this
  Stage's own test file.
- **No ontology projection occurs** — trivially true; no such capability
  exists anywhere in this Arc's own code.

## 4. See also

- `docs/secure_runtime_alpha_317_persisted_board_repository.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
- `docs/secure_runtime_alpha_309_four_protocol_board_integration.md`
