# Secure Runtime Alpha 402 — Canonical Host Write Authority Decision

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 2 of the Alpha 401–410 Desktop Host Canonical Write
Boundary Closure Arc. This Stage issues the Arc's own shape Decision,
implemented by Alpha 403/404.

## 1. Why now

Alpha 401 confirmed the exact bypass (`board()?.registerPost()`), zero
production caller depends on it, `board()`'s own read capabilities are
genuinely needed, and honestly closing the bypass requires a real
wrapper object rather than a type-level narrowing alone. This Stage
decides exactly which of the five named options to adopt.

## 2. Candidates compared

- **Option A — keep `board()` unchanged, document `submitPost()` as
  preferred.** Rejected, per this Arc's own instruction: documentation
  alone does not close a reachable runtime bypass. Alpha 390/400 both
  already tried the documentation-only approach for the ORIGINAL
  write gap, and it demonstrably did not prevent the gap from
  persisting into this Arc — a second documentation-only pass would
  repeat the same non-fix.
- **Option B — return `FedosBoardService` from `board()`, but wrap or
  proxy `registerPost()`.** Rejected. "Wrap or proxy `registerPost()`"
  means EITHER (a) `registerPost()` remains present but throws/no-ops
  when called through `board()` — this requires `FedosBoardService`
  itself to grow AWARENESS of which caller is invoking it (Host vs. a
  direct test construction), a genuinely new, previously-nonexistent
  runtime distinction with no clean implementation this repository's
  own established patterns support — or (b) a `Proxy`-wrapped
  `FedosBoardService` that intercepts `registerPost()` calls
  specifically, which is exactly the "runtime proxy complexity" this
  Arc's own instruction names as a rejection reason for Option B. Both
  sub-options either create genuine runtime complexity with no
  precedent in this repository, or produce "false type safety" (the
  OTHER named rejection reason) — a `Proxy` still structurally reports
  `registerPost` as present via `Object.keys`/`in`, so even a
  proxy-based closure fails Alpha 401 §11's own "actual public object
  surface" test unless the proxy ALSO hides the property entirely,
  which pushes the implementation right back toward Option C's own
  simpler wrapper-object shape anyway, with none of the added
  `Proxy`-specific complexity or performance cost.
- **Option C — replace `board()` with a read-only Board interface.**
  Adopted (§3 below).
- **Option D — keep `board()` for compatibility, add `readBoard()`,
  formally deprecate `board()`.** Considered as this Arc's own named
  fallback if Option C could not be implemented "without dishonest
  compatibility claims." Alpha 401 §4/§5 already confirmed ZERO
  production caller anywhere depends on `board()`'s current
  `FedosBoardService`-returning shape — the ONLY callers are this
  repository's OWN test suite, which this Arc updates directly. A
  transitional `readBoard()`/deprecated-`board()` split would
  therefore be introducing compatibility machinery for a compatibility
  problem that does not exist — an actively DISHONEST claim in the
  opposite direction (implying a real caller needs the old shape when
  none does). Option D is therefore NOT adopted.
- **Option E — remove `board()` entirely, require `query()` for all
  reads.** Rejected — Alpha 401 §6 already confirmed `board()`'s own
  direct-lookup and unpaginated-listing capabilities are NOT redundant
  with `query()`'s own mandatory pagination/ordering. Removing
  `board()` would remove real capability, not merely a bypass.

## 3. Decision

**Option C, adopted, exactly as this Arc's own preferred direction
names — "if it can be implemented without dishonest compatibility
claims."** It can: zero production caller exists (Alpha 401 §4/§5), so
`board()`'s return type is narrowed directly, from `FedosBoardService | null`
to `FedosBoardReader | null` (Alpha 403), with NO transitional
`readBoard()` accessor and NO deprecated legacy path — the two test
files that demonstrated the OLD bypass (Alpha 385 §3, Alpha 389 §12)
are updated by this Arc (Alpha 404) to demonstrate the bypass is now
CLOSED, exactly the ripple scope Alpha 401 §8 already named precisely.

## 4. How this decision avoids Alpha 401 §11's own hidden-exposure trap

`board()` does NOT return `this.#boardService` re-typed. It returns a
NEW `FedosBoardServiceReader` instance (Alpha 403) — a real object
whose own actual public surface has no `registerPost` property at all,
confirmed by direct inspection of the returned object, not merely its
declared TypeScript type. This is the difference between Option C
"implemented honestly" (adopted) and a naive Option C implementation
that would have reproduced Option B's own "false type safety"
rejection reason under a different name.

## 5. What this decision does NOT change

- `submitPost()` (Alpha 395) remains completely unchanged — already
  the sole canonical write path, this Arc closes the LAST alternative
  route to it, it does not alter it.
- `FedosBoardService`, `FedosBoardRepository`, `FedosBoardPersistence`,
  and `FedosBoardQuery` all keep their own frozen contracts —
  `FedosBoardService` gains only a purely additive
  `implements FedosBoardReader` declaration (Alpha 403 §"Minimal
  changes to FedosBoardService"), zero behavior change.
- `query()`'s own signature and behavior are completely untouched.

## 6. Conclusion

Option C — a clean, non-legacy replacement of `board()`'s own return
type — is the only candidate that closes the confirmed bypass without
introducing genuine runtime complexity (Option B), a dishonest
compatibility claim for a compatibility problem that does not exist
(Option D), or the loss of real, non-redundant read capability (Option
E), while Option A is rejected outright per this Arc's own explicit
instruction.

## 7. See also

- `docs/secure_runtime_alpha_401_host_write_surface_inventory.md`
- `docs/secure_runtime_alpha_392_write_coordination_ownership_decision.md`
- `docs/secure_runtime_alpha_385_board_service_access_review.md`
