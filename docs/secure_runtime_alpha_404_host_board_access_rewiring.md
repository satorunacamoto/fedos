# Secure Runtime Alpha 404 — Host Board Access Rewiring

**Status: this Stage implements code.** Stage 4 of the Alpha 401–410
Desktop Host Canonical Write Boundary Closure Arc. Rewires
`FedosDesktopHost.board()` per the Alpha 402 decision.

## 1. Why now

Alpha 403 built the contract and its one real implementation. This
Stage wires it into `FedosDesktopHost`, closing the confirmed bypass.

## 2. Final shape adopted

**Preferred final shape, exactly as this Arc's own instruction names
it:**

```ts
host.board(): FedosBoardReader | null
```

No `readBoard()`, no deprecated legacy `board()` — Alpha 402 §3
already confirmed a transitional split is unnecessary (zero production
caller, Alpha 401 §4/§5) and would itself be a dishonest compatibility
claim in the opposite direction.

## 3. What changed in `FedosDesktopHost`

- New private field: `#boardReader: FedosBoardReader | null = null;`,
  alongside the UNCHANGED `#boardService`/`#boardQuery` fields.
- `start()`'s own final assignment sequence gains ONE new statement:
  `this.#boardReader = new FedosBoardServiceReader(hydration.service);`,
  constructed from the SAME `hydration.service` reference
  `#boardService` itself is assigned from — never from `#boardService`
  after the fact, so no code path can ever construct a `#boardReader`
  observing a DIFFERENT `FedosBoardService` instance than
  `#boardService`/`#boardQuery` themselves do.
- `start()`'s own `catch` block and `stop()` both now also set
  `#boardReader = null`, alongside the existing
  `#boardService`/`#boardQuery` clearing — the SAME unconditional,
  every-failure-shape clearing guarantee Alpha 382 established,
  extended to the new field.
- `board()`'s own body: `return this.#state === "ready" ?
  this.#boardReader : null;` — the EXACT SAME gating shape
  `desktop()`/`query()` already use (Alpha 336/384), returning
  `#boardReader` instead of `#boardService`.
- `#boardService` itself is NOT removed and NOT nulled anywhere new —
  `submitPost()` (Alpha 395) still calls
  `previewRegistration()`/`registerPost()` on it directly, internally.
  Only the PUBLIC `board()` accessor's own return value changed.

## 4. Required lifecycle behavior — verified

- **Null before ready**: `#boardReader` is `null` from construction
  until `start()`'s own final assignment sequence runs.
- **Reader while ready**: `board()` returns the `FedosBoardServiceReader`
  instance for the ENTIRE `"ready"` window.
- **Null after failed**: `start()`'s own `catch` block clears it.
- **Null after stopped**: `stop()` clears it.
- **Never throws**: `board()`'s own body is a single ternary — no
  `throw` of any kind, matching `desktop()`/`query()`'s own established
  shape exactly.

## 5. Live observation, not a stale snapshot — verified

`FedosBoardServiceReader` (Alpha 403) holds a REFERENCE to
`hydration.service`, never a copy of its data. Every
`findPost()`/`listBoardPosts()`/`listThreadPosts()` call forwards
directly to that live object at CALL time — a post registered via
`submitPost()` after `board()` was first called is visible on the NEXT
call to the SAME already-obtained reader reference, exactly like
`query()`'s own established live-observation guarantee (Alpha 396).

## 6. Compatibility/ripple handling

Zero production caller required any change (Alpha 401 §4/§5,
reconfirmed). Exactly seven pre-existing test files required an
update, precisely matching Alpha 401 §8's own predicted scope:

- Two files (`secure_runtime_alpha_385_board_service_access_review.test.ts`,
  `secure_runtime_alpha_389_four_protocol_host_query_verification.test.ts`)
  called `host.board()!.registerPost(...)` directly, demonstrating the
  bypass this Arc closes — both updated to demonstrate the bypass is
  now closed (`registerPost` is `undefined` on the returned object) and
  to use `submitPost()` for the write instead.
- Five files asserted `board()`'s own exact return type/body via a
  structural regex against `hostSource` — each updated to assert the
  NEW `FedosBoardReader`-returning shape, with an explicit comment
  naming Alpha 404 as the reason.

No test file that only called `.findPost()`/`.listBoardPosts()`/
`.listThreadPosts()` through `board()` required any change — all
fourteen continue to compile and pass unmodified, confirming
`FedosBoardReader`'s own three signatures are a genuine, lossless
match for how every existing read caller already used `board()`.

## 7. Conclusion

`board()` is REWIRED, not deprecated or duplicated: one accessor, one
new return type, zero legacy path, zero production caller affected,
and a precisely-scoped seven-file test ripple, exactly as Alpha 401's
own inventory predicted.

## 8. See also

- `docs/secure_runtime_alpha_403_read_only_board_access_model.md`
- `docs/secure_runtime_alpha_402_canonical_host_write_authority_decision.md`
- `docs/secure_runtime_alpha_401_host_write_surface_inventory.md`
- `docs/secure_runtime_alpha_396_immediate_query_visibility.md`
