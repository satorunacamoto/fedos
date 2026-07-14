# Secure Runtime Alpha 388 — Append-Only Host Compatibility Verification

**Status: this Stage verifies existing behavior by real execution — no
production code change. No Host factory default is changed.** Stage 8
of the Alpha 381–390 Canonical Board Query Host Integration & Startup
Failure Closure Arc.

## 1. Why an explicitly injected persistence, never the factory default

`createFedosDesktopHost()`'s own default `boardPersistence` remains
`InMemoryFedosBoardPersistence` (Alpha 334, UNCHANGED by this Arc —
confirmed by regression test) — this Arc's own instruction is explicit:
"Host defaults must remain in-memory until path ownership is
separately reviewed," and "Do NOT implement... default append-only
Host persistence." Every test in this Stage constructs
`AppendOnlyFedosBoardPersistence` directly and passes it via
`FedosDesktopHostDependencies.boardPersistence` — the SAME explicit
injection path Alpha 356/358/359/367 (Arc 351–360, Arc 361–370)
already used, never through the factory's own default.

## 2. What is verified

- **Persisted four-protocol fixtures hydrate correctly** through a
  real `FedosDesktopHost`, using the SAME real Board Adapter fixtures
  Alpha 359 (Arc 351–360) and Alpha 379 (Arc 371–380) each already
  used.
- **Host reaches `"ready"`** with a real, on-disk append-only log as
  its own persistence.
- **`query().recentFeed()` reads ALL hydrated posts**, correctly
  ordered, matching Alpha 373's own established `createdAt` DESC rule.
- **`query().thread()` groups correctly**, including a cross-protocol
  reply, matching Alpha 374's own established `createdAt` ASC rule.
- **Filters work** — `protocol`/`authorPublicIdentifier`/`since`/
  `until`, identically to the in-memory-backed case (Alpha 376,
  unmodified).
- **Pagination works** — `limit`/`offset`/`total`/`hasMore`,
  identically to the in-memory-backed case (Alpha 375, unmodified).
- **`stop()` denies access** — `board()`/`query()`/`desktop()` all
  `null` after `stop()`, identical to the in-memory-backed case.
- **A corrupt log causes `state() === "failed"`** — NEVER `"starting"`
  — the Alpha 382 fix, verified specifically against the REAL backend
  whose own throwing behavior originally exposed the defect (Alpha
  357/361).
- **A malformed/truncated trailing line cannot leave `state()` at
  `"starting"`** — the EXACT reproduction scenario Alpha 361/370 each
  used to CONFIRM the defect, now asserting the FIXED outcome, against
  the REAL corruption shape (not a synthetic stand-in).
- **No automatic repair** — the corrupt log file itself is NEVER
  modified, rewritten, or salvaged by `FedosDesktopHost` or by
  `AppendOnlyFedosBoardPersistence`'s own unmodified `listPosts()`
  (Alpha 357, unchanged).
- **No fallback to in-memory** — a `FedosDesktopHost` constructed with
  an EXPLICITLY injected `AppendOnlyFedosBoardPersistence` never
  silently substitutes `InMemoryFedosBoardPersistence` on any failure
  path; a hydration failure fails the WHOLE Host, it does not
  downgrade the backend.
- **No filesystem path is selected by Host** — every test in this
  Stage constructs its own temporary path (via `node:os`'s `tmpdir()`
  and `node:fs`'s `mkdtempSync()`) and passes it EXPLICITLY to
  `AppendOnlyFedosBoardPersistence`'s own constructor — `FedosDesktopHost`
  itself never reads, selects, resolves, or defaults a filesystem path
  of any kind, confirmed unchanged from Alpha 353 §5's own original
  finding.

## 2a. Test hygiene

Every temporary file/directory this Stage's own test suite creates is
removed in an `afterEach` hook, matching the EXACT pattern every prior
Arc's own append-only test suite already established (Alpha 353
onward) — no test artifact of any kind is left on disk or staged into
git.

## 3. Conclusion

`FedosDesktopHost` and `FedosBoardQuery` both work correctly, end to
end, against a REAL durable backend — explicitly injected, never
defaulted — with the Alpha 382 fix specifically re-verified against
the exact real-world corruption shape that originally exposed the
defect this whole Arc exists to close.

## 4. See also

- `docs/secure_runtime_alpha_387_host_query_lifecycle_verification.md`
- `docs/secure_runtime_alpha_359_four_protocol_append_only_verification.md`
- `docs/secure_runtime_alpha_357_crash_review.md`
- `docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md`
