# Secure Runtime Alpha 408 — Failure and Boundary Verification

**Status: this Stage is verification only — it makes NO production
code change of any kind.** Stage 8 of the Alpha 401–410 Desktop Host
Canonical Write Boundary Closure Arc. Verifies every real failure case
this Arc's own instruction names, with particular attention to the
ACTUAL public object surface — not merely TypeScript's own static
checking.

## 1. Why now

Alpha 405 reverified `submitPost()`'s own established failure
properties survive Alpha 404's rewiring. This Stage goes further,
verifying Host-STATE-gated failure (not-ready/failed/stopped) and,
critically, the closure claim Alpha 401 §11 identified as this Arc's
own central risk: that `board()`'s returned object cannot be cast or
otherwise used to reach `registerPost()`.

## 2. Host-state-gated failures — verified

- **Host not ready → `submitPost()` fails closed**: calling
  `submitPost()` before `start()` throws
  `"FedosDesktopHost.submitPost() may only be called from the ready
  state."` — reconfirmed unchanged from Alpha 395.
- **Host failed → `submitPost()` fails closed**: after a failed
  `start()`, `submitPost()` still throws the same guard error;
  `board()`/`query()` both return `null`.
- **Host stopped → `submitPost()` fails closed**: after `stop()`, the
  same guard applies; `board()`/`query()` both return `null`.
- **Malformed/corrupt persistence startup → no reader/query/write
  access**: a `start()` that fails due to a corrupt
  `AppendOnlyFedosBoardPersistence` log (the exact Alpha 361/382
  scenario) leaves `board()`, `query()`, AND `submitPost()` all
  unusable — `state()` is `"failed"`, `board()`/`query()` return
  `null`, `submitPost()` throws the ready-state guard. No PARTIAL
  access of any kind survives a failed startup.

## 3. Write-path failures — reconfirmed (see Alpha 405/398 for the full matrix)

- Append I/O failure → no in-memory post (`board()!.findPost()` returns
  `null`).
- Persistence conflict → no in-memory post.
- Repository conflict prediction (`previewRegistration()` rejecting) →
  no persistence append at all — the write never reaches step 2.
- Unexpected persistence exception → original exception propagates
  unmodified, `state()` stays `"ready"`, no in-memory mutation.
- A successful post AFTER a prior rejected post on the SAME Host still
  works — no Host-level "poisoning" from one rejected write.

## 4. The actual public object surface — verified directly, not assumed

**This Arc's own instruction is explicit: "Do not claim runtime
impossibility merely from TypeScript `readonly`. Verify the actual
public object surface."** This Stage does exactly that, against the
REAL object `board()` returns while ready:

- `typeof reader.registerPost === "undefined"` — the property does not
  exist on the object AT ALL, confirmed by direct runtime inspection
  (`Object.keys(reader)` does not include it; `"registerPost" in
  reader` is `false`), not merely absent from its declared TypeScript
  type.
- An explicit unsafe cast —
  `(host.board() as unknown as { registerPost: unknown }).registerPost` —
  is STILL `undefined` at runtime, because the underlying object
  genuinely has no such property; TypeScript's cast changes only the
  STATIC type the compiler reasons about, never the actual runtime
  object `FedosBoardServiceReader`'s own constructor produced. Calling
  `(host.board() as any).registerPost(post)` throws
  `TypeError: ... registerPost is not a function` — verified directly,
  not inferred.
- `Object.getPrototypeOf(host.board())` is `FedosBoardServiceReader.prototype`
  — the returned object is never, at any point, the actual
  `FedosBoardService` instance `#boardService` holds; the two are
  DIFFERENT objects held in DIFFERENT private fields, confirmed by
  reference inequality (`host.board() !== <anything reachable from
  submitPost()'s own internal `#boardService`>`, which itself is never
  exposed by any public method — Alpha 406 §"guard 7").

## 5. `query()` remains read-only — reconfirmed

`FedosBoardQuery`'s own public surface (`recentFeed`/`thread`,
constructor) is unchanged by this Arc — confirmed by the SAME
structural check Alpha 381 §5 already established, rerun against the
current source.

## 6. Conclusion

Every Host-state and write-path failure case behaves exactly as prior
Arcs established, unaffected by this Arc's own `board()` rewiring, and
the central closure claim — that `board()`'s returned object cannot be
used, cast or otherwise, to reach a mutating method — is verified
against the ACTUAL runtime object surface, not inferred from
TypeScript's own static type system alone.

## 7. See also

- `docs/secure_runtime_alpha_406_legacy_direct_write_detection.md`
- `docs/secure_runtime_alpha_405_submit_post_authority_verification.md`
- `docs/secure_runtime_alpha_401_host_write_surface_inventory.md`
- `docs/secure_runtime_alpha_398_write_atomicity_verification.md`
