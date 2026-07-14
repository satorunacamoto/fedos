# Secure Runtime Alpha 363 — Corruption Classification

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 3 of the Alpha 361–370 Board Recovery & Host Robustness
Arc.

## 1. Why now

Alpha 361/362 focused on ONE failure shape (a thrown exception during
hydration). This Stage builds the complete taxonomy of every
corruption shape `AppendOnlyFedosBoardPersistence` and the layers
above it can encounter, so Alpha 364's own Recovery Strategy has a
complete map to design against, and so no corruption category is
addressed twice or missed.

## 2. Taxonomy

| Category | Example | Detected by | Current handling |
|---|---|---|---|
| **A. Not corruption** | Empty/missing file | `AppendOnlyFedosBoardPersistence.listPosts()` | Returns `[]` — normal |
| **B. Content-level corruption, syntactically invalid** | A truncated/malformed JSON line (crash mid-write, or hand-edited) | `AppendOnlyFedosBoardPersistence.listPosts()` (`JSON.parse` failure) | THROWS (Alpha 357) |
| **C. Log-level conflict** | Two lines, same `id`, different content | `AppendOnlyFedosBoardPersistence.listPosts()` (replay dedup check) | THROWS (Alpha 357) |
| **D. Content-level corruption, syntactically valid but semantically invalid** | Unknown `schemaVersion`, missing required field, wrong field type | `deserializeFedosBoardPost` (Alpha 314), one layer above the persistence backend | Returns `null` for that record → `hydrateFedosBoardService` returns `"rejected-corrupt-record"` (Alpha 318) |
| **E. Cross-record graph corruption** | A reply whose parent was never persisted; a cross-board reply | `hydrateFedosBoardService`'s own bounded topological pass (Alpha 318) | Returns `"rejected-unresolvable-thread-integrity"` |
| **F. Environmental / I/O failure, read path** | A permissions error reading the log file (NOT a missing file) | `AppendOnlyFedosBoardPersistence.listPosts()` (any error other than `ENOENT`) | THROWS, unmodified — never conflated with "empty" (Alpha 353) |
| **G. Environmental / I/O failure, write path** | A missing parent directory, a full disk | `AppendOnlyFedosBoardPersistence.putPost()` | Returns `"failed"` (Alpha 356) — the ONLY category with a defined, non-throwing signal |

## 3. Two independent axes

- **WHERE the corruption is detected** — persistence layer (B, C, F,
  G) vs. codec/hydration layer (D, E). This axis is already fully
  reviewed (Alpha 342 §2, Alpha 351 §6): each layer validates only what
  it alone can see, and this Arc changes none of that layering.
- **HOW it is signaled** — throw (B, C, F) vs. returned token (D, E,
  G). This is EXACTLY the axis Alpha 362's own policy addresses:
  regardless of category, a failure during `FedosDesktopHost.start()`
  must produce `state() === "failed"`, which today holds for D/E/G but
  not for B/C/F (Alpha 361's own confirmed defect).

## 4. Why category A is not corruption, restated precisely

An empty/missing log is the ONLY category in this table that
represents an EXPECTED, non-error state — every other category
represents an actual anomaly. Conflating A with any of B–G (e.g. by
silently treating a genuinely corrupt file as "empty" on any read
error) would be a MUCH worse failure mode than throwing — data loss
disguised as normal startup. `AppendOnlyFedosBoardPersistence`'s own
`isEnoent()` check (Alpha 353/357) is deliberately narrow — catching
EXACTLY the one error code that means "no file yet," nothing broader —
precisely to keep category A from ever silently absorbing any of B–G.

## 5. Severity, informally ranked

1. **G (write failure)** — least severe: no data is lost or
   misrepresented; the caller is told immediately, synchronously, via
   a defined token.
2. **D/E (semantic corruption)** — moderate: the WHOLE Board fails to
   hydrate (fail closed), but the failure is precisely diagnosed
   (`FedosBoardHydrationResult.outcome` names which case) and the log
   file itself is never touched or altered.
3. **B/C/F (persistence-layer throw)** — most severe FOR THE HOST
   SPECIFICALLY: not because the underlying data risk is worse than
   D/E (it is not — nothing is lost or altered in any of these cases
   either), but because THIS is the category where `FedosDesktopHost`'s
   own state-reporting currently falls short of its own policy (Alpha
   362), making the failure harder for an operator to DIAGNOSE after
   the fact, even though the ORIGINAL failure was reported correctly
   to whoever called `start()` directly.

## 6. Conclusion

Seven corruption/non-corruption categories exist across two
independent axes (detection layer, signaling mechanism). Every
category correctly fails closed with no data loss or silent
misrepresentation; the ONE outstanding gap is diagnosability after the
fact for the throw-signaled categories (B/C/F), not data safety.

## 7. See also

- `docs/secure_runtime_alpha_362_hydration_failure_policy.md`
- `docs/secure_runtime_alpha_361_host_failure_inventory.md`
- `docs/secure_runtime_alpha_357_crash_review.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
