# Secure Runtime Alpha 406 — Legacy Direct Write Detection

**Status: this Stage implements code (test-only — regression guards,
no production source change).** Stage 6 of the Alpha 401–410 Desktop
Host Canonical Write Boundary Closure Arc. Adds structural regression
guards that fail loudly if a future change reintroduces a
Persistence-bypassing Host write route.

## 1. Why now

Alpha 404 closed the confirmed bypass. This Stage exists so a FUTURE
change cannot silently reopen it — matching this repository's own
established discipline of pairing every closed gap with a regression
test that would fail if the gap reopened (e.g. Alpha 386's own
structural guard against a Query-delegation convenience method being
added later).

## 2. What is scanned, and how

This Stage scans PRODUCTION source only — every file under `src/`,
excluding `test/` entirely — for the specific bypass shapes this Arc's
own instruction names:

1. `host.board()?.registerPost(...)` / `host.readBoard()?.registerPost(...)`
   — a direct call chain reaching a mutating method through a Host
   accessor.
2. A new getter exposing `FedosBoardService` (with its own
   `registerPost`) from `FedosDesktopHost` beyond the two SANCTIONED
   private fields (`#boardService`, used only internally by
   `submitPost()`) and the read-only `#boardReader` `board()` already
   returns.
3. A Host method returning `FedosBoardRepository` or
   `FedosBoardPersistence` directly.
4. `FedosBoardReader`/`FedosBoardServiceReader` (`src/board/repository/fedos_board_reader.ts`)
   gaining a mutating method — checked directly against that file's own
   source, not merely against the Host.

## 3. Allowed vs. forbidden, precisely distinguished

**Allowed, and NOT scanned as a violation:** any TEST file
constructing a `FedosBoardService` directly (`new FedosBoardService()`)
and calling `.registerPost()` on THAT instance — this is testing the
Board Application layer itself (Alpha 307's own test suite, and every
Stage since that verifies `FedosBoardService` in isolation), never a
Host-reachable write. This Stage's own guard scans `src/` only —
outside the scope of any test file's own constructions — so this
distinction is structural, not a matter of pattern-matching test
intent.

**Forbidden, and actively scanned for:** any occurrence of
`.board()` immediately chained with `.registerPost(` or
`.previewRegistration(` anywhere under `src/` (a Host-reachable call,
since `.board()` on any other object in this repository does not
exist — confirmed by direct search, `.board()` is a method name unique
to `FedosDesktopHost`); any NEW public method on `FedosDesktopHost`
whose return type includes `FedosBoardService`, `FedosBoardRepository`,
or `FedosBoardPersistence`; and any mutating method
(`register`/`put`/`write`/`delete`/`remove`) added to
`FedosBoardReader`.

## 4. Result

Zero violation found in current production source — `board()` returns
`FedosBoardReader | null` exclusively, `#boardService` remains a
PRIVATE field never exposed by any public method beyond `submitPost()`'s
own internal use, and `FedosBoardReader`/`FedosBoardServiceReader`
carry no mutating method of any kind. This Stage's own regression test
suite is designed to FAIL the moment any of these conditions changes —
verified by temporarily reasoning through each guard's own regex
against a hypothetical reintroduced bypass (not committed, a design
check only).

## 5. Conclusion

The bypass this Arc closes now has a standing structural guard against
its own reintroduction, scoped precisely to production source and
precisely to the bypass shapes this Arc's own instruction names —
distinguishing forbidden Host-reachable mutation exposure from
legitimate, unrelated direct `FedosBoardService` testing.

## 6. See also

- `docs/secure_runtime_alpha_404_host_board_access_rewiring.md`
- `docs/secure_runtime_alpha_403_read_only_board_access_model.md`
- `docs/secure_runtime_alpha_401_host_write_surface_inventory.md`
