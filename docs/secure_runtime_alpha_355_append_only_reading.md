# Secure Runtime Alpha 355 — Implement Reading

**Status: this Stage implements code.** Stage 5 of the Alpha 351–360
Append-only Durable Board Backend Arc. Fixes `getPost()`/`listPosts()`
on `AppendOnlyFedosBoardPersistence`.

## 1. Required behavior

`getPost()`/`listPosts()` must rebuild state by REPLAYING the append
log. **No side indexes yet.**

## 2. Implementation

```ts
getPost(id: string): FedosPersistedBoardPostRecordV1 | null {
  return this.listPosts().find((record) => record.id === id) ?? null;
}

listPosts(): readonly FedosPersistedBoardPostRecordV1[] {
  return replayLog(this.#filePath);
}
```

`replayLog()` (private, module-scoped) reads the file's full contents,
splits on `\n`, skips blank lines, `JSON.parse`s every remaining line,
and deduplicates by `id` (Alpha 356 covers the dedup/conflict
decision in full).

## 3. "No side indexes yet" — a deliberate scope decision, not an oversight

This class holds **NO** field of any kind beyond the caller-supplied
`#filePath` — no `Map`, no cached array, no "last replayed at"
timestamp. EVERY call to `getPost()`/`listPosts()` re-reads and
re-parses the ENTIRE file from disk, from scratch, every time. This is
a genuine, deliberate simplicity choice for this FIRST backend
implementation, not a missed optimization:

- It makes reads and writes trivially consistent with each other — a
  read can never observe stale, cached state, because there is no
  cache to go stale.
- It keeps this Stage's entire read path in ONE small function
  (`replayLog`), with no separate "keep the index in sync with the
  file" invalidation logic to get wrong.
- Alpha 350's own recommended next Arc (Alpha 361–370, "Append-only
  Compaction & Integrity Review") is the natural, separately-reviewed
  place to introduce an in-memory index/cache, once compaction — which
  benefits from having one anyway — is being designed.
- The O(n) cost per call is an ACCEPTED tradeoff, not a hidden one —
  Alpha 344 §8 already named "adequate for a single-user local Board
  with no concurrent-writer requirement" as the standard this first
  backend is held to.

## 4. `getPost()` delegates to `listPosts()`, guaranteeing identical corruption behavior

`getPost()`'s own entire body is a `.find()` over `listPosts()`'s own
result — there is no second, independent file-reading code path for
single-record lookup. This means a corrupt log fails IDENTICALLY
whether a caller asks for one record or all of them — no possibility
of `getPost()` silently succeeding on a file `listPosts()` would
reject, or vice versa.

## 5. Conclusion

Reading is implemented as a full replay on every call, with
deliberately no in-memory index — the simplest possible correct
implementation of "rebuild state by replaying the append log,"
matching this Stage's own explicit scope, with a named, understood
performance tradeoff and a named future Arc where a side index
belongs.

## 6. See also

- `docs/secure_runtime_alpha_354_append_semantics.md`
- `docs/secure_runtime_alpha_353_append_only_persistence_implementation.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
