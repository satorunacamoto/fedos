# Secure Runtime Alpha 368 — Large Dataset Scalability Review

**Status: this Stage verifies existing behavior at scale by real
execution — no production code change.** Stage 8 of the Alpha
361–370 Board Recovery & Host Robustness Arc.

## 1. Why now

Alpha 355 (Arc 351–360) already disclosed the O(n)-per-call cost of
"no side indexes yet" as a deliberate, accepted tradeoff, but no prior
Arc actually MEASURED or exercised the backend at a scale larger than
a handful of fixtures. This Stage does — verifying CORRECTNESS holds
at scale (this Stage's own scope), while documenting the ALREADY-KNOWN
performance shape (not re-deciding it).

## 2. What is verified

- **Correctness at 1,000 records.** Writing 1,000 distinct posts via
  `putPost()`, then reading them all back via `listPosts()`, then
  hydrating via `hydrateFedosBoardService`, produces the exact record
  count, the exact set of `id`s, and a `"hydrated"` outcome — no
  record is lost, duplicated, or reordered at this scale.
- **Determinism at scale.** Two independent replay-and-hydrate cycles
  against the SAME 1,000-record file produce byte-identical
  `listBoardPosts()` ordering — Alpha 318's own sort-by-`id` pass
  remains correct regardless of record count.
- **The existing-record check does not silently skip records at
  scale.** Every `putPost()` call for a genuinely new `id`, even the
  1,000th, still correctly returns `"inserted"` — confirming
  `getPost()`'s own full replay (Alpha 354 §4) does not degrade in
  CORRECTNESS as the log grows, only in raw speed (§3).

## 3. Documented, already-known cost shape — not re-decided

- `listPosts()`/`getPost()`: **O(n)** in total record count, per call
  — a full file read plus a full replay, EVERY time (Alpha 355 §3,
  unchanged).
- `putPost()`: **O(n)** for the existing-record check (via
  `getPost()`) PLUS O(1) for the actual append when a write occurs —
  so also O(n) overall per call.
- This means N sequential `putPost()` calls cost O(N²) in total —
  named explicitly here, not disclosed with this precision before.
  For the scale this Arc verifies (N=1,000), this is fast in absolute
  terms (well under a second in this Stage's own test); it is NOT
  verified, and NOT claimed to remain fast, at orders of magnitude
  larger N.

## 4. Why this is not treated as a defect requiring a fix in this Arc

- Alpha 322 §"NOT YET" already excludes performance/scale guarantees
  from this repository's own frozen requirement set for a first
  backend.
- Alpha 344 §8 already named this exact tradeoff as ACCEPTED for "a
  single-user local Board" — this Stage's own 1,000-record
  measurement is consistent with, not a revision of, that finding.
- A side index (the natural fix for the O(n) read cost) was already
  explicitly deferred to a LATER Arc by Alpha 355 §3 — this Stage does
  not re-open that decision, only confirms it remains sound at the
  scale actually measured.

## 5. What would need to change before this stops being sound

If a real Board's post count grows into the TENS of thousands (an
order of magnitude beyond this Stage's own N=1,000 measurement), the
O(N²) total write cost and O(N) per-read cost would become genuinely
noticeable — at that point, a side index (Alpha 355 §3's own named
future work) or a different backend entirely (SQLite, Alpha 349's own
still-standing migration destination) would be warranted. This Stage
names that threshold qualitatively; it does not pin an exact number,
since no real usage data exists yet to calibrate one.

## 6. Conclusion

Correctness holds, verified directly, at 1,000 records — no defect is
found. The already-disclosed O(n)-per-call cost is now precisely
characterized (O(N²) total write cost) rather than merely gestured at,
and the conditions under which it would need revisiting are named
explicitly, without this Stage prematurely optimizing for a scale this
repository has no evidence of needing yet.

## 7. See also

- `docs/secure_runtime_alpha_367_host_restart_verification.md`
- `docs/secure_runtime_alpha_355_append_only_reading.md`
- `docs/secure_runtime_alpha_344_append_only_backend_review.md`
- `docs/secure_runtime_alpha_322_durable_backend_requirements.md`
