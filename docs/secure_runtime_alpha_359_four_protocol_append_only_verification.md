# Secure Runtime Alpha 359 — Real Verification (Four Protocols, Restart, Hydrate)

**Status: this Stage verifies existing, unmodified behavior end to
end — no production code change.** Stage 9 of the Alpha 351–360
Append-only Durable Board Backend Arc.

## 1. Requirement

Register fixtures from Nostr, ActivityPub, AT Protocol, and Session —
the same four real, unmodified Board Adapters Alpha 309/339 already
exercised. Persist. Restart (construct a FRESH
`AppendOnlyFedosBoardPersistence` pointed at the SAME file path — a
new object, simulating a new process). Hydrate. Verify identical feed,
identical thread grouping, identical source references, deterministic
ordering, and duplicate handling.

## 2. What "restart" means here

A genuinely NEW `AppendOnlyFedosBoardPersistence` instance,
constructed with the same file path, holding NO reference to the
instance that wrote the data. Since Alpha 353's own constructor
performs no I/O and Alpha 355's own read path holds no cached state,
the "restart" is not a special code path at all — it is simply
"construct a new instance and call `listPosts()`," exactly as any real
process restart would do. This is the STRONGEST form of restart
verification available without an actual separate OS process — the
two instances share NOTHING but the file on disk.

## 3. Verified properties

- **Identical feed:** `FedosBoardFeed.listRecentPosts()` (Alpha 308)
  over a `FedosBoardService` hydrated from the POST-restart instance
  returns the SAME posts, in the SAME newest-first order, as a
  `FedosBoardService` built directly (pre-restart) from the same
  fixtures.
- **Identical thread grouping:** `listThreadPosts()` groups a
  cross-protocol reply (Nostr root + AT Protocol reply, mirroring
  Alpha 309 §5/Alpha 339 §2's own fixture) identically before and
  after restart.
- **Identical source references:** each post's own `source.protocol`/
  `source.reference` (the provenance Alpha 253 defines) survives the
  JSON Lines round-trip through `AppendOnlyFedosBoardPersistence`
  byte-for-byte, verified against each adapter's own known-good fixture
  result (mirroring Alpha 309 §15's own "no adapter is modified"
  regression check).
- **Deterministic ordering:** two SEPARATE restart-and-hydrate cycles
  against the identical file produce the IDENTICAL `listBoardPosts()`
  ordering — hydration's own Alpha 318 sort-by-`id` pass, combined
  with this backend's own call-order-preserving append log, makes this
  true without this Stage adding any ordering logic of its own.
- **Duplicate handling:** re-registering an already-persisted post
  (calling `putPost()` a second time with an unmodified record, either
  before OR after a restart) returns `"already-present"`, writes
  nothing, and the post count is unaffected — verified across the
  restart boundary specifically, not merely within one instance's
  lifetime.

## 4. Why this matters more than Alpha 356's own per-outcome checks

Alpha 356 verified `putPost()`'s own four return tokens in isolation.
This Stage verifies the FULL pipeline a real Board actually depends
on — four real protocol adapters, real persisted bytes on a real
filesystem, a real restart, and real hydration — end to end, with
NOTHING mocked. This is the same "real fixtures through all four real
Board Adapters" discipline Alpha 309 and Alpha 339 already established
for the in-memory backend and the Desktop Host respectively, now
extended to the first real durable backend.

## 5. Conclusion

The append-only backend correctly persists, survives a genuine
restart, and re-hydrates into a `FedosBoardService` indistinguishable
in observable behavior from one built directly from the same fixtures
— proven with real posts from all four supported protocols, not
merely a single-protocol smoke test.

## 6. See also

- `docs/secure_runtime_alpha_358_hydration_review.md`
- `docs/secure_runtime_alpha_309_four_protocol_board_integration.md`
- `docs/secure_runtime_alpha_339_desktop_host_integration_verification.md`
