# Secure Runtime Alpha 092 — Bootstrap Sequence Review

**Status: this Stage is DESIGN REVIEW ONLY. Implementation is
absolutely forbidden. `src/` is untouched by this Stage — no code, no
comment, no field, no method, nothing. This document, its own guard
test, and a `README.md` entry are the entire deliverable. This is
Stage 2 of the Alpha 091–095 Desktop Shell Integration Design Arc.**

## 1. Why now

Alpha 091 fixed WHERE the construction call lives — a dedicated
`Application bootstrap()` function. It did not fix the exact SEQUENCE
of operations inside that function, or the invariants that sequence
must uphold. This Stage fixes both.

## 2. Review target

What is the exact call order inside `Application bootstrap()`, and
what must never happen to it?

## 3. The sequence

```
construct
  ↓
bootstrapIdentity()
  ↓
Desktop ready
```

Three steps, strictly in this order: `new FedosRuntimeIdentity()`,
then `await bootstrapIdentity()` on that same instance, then — only
after that `await` resolves (Alpha 087 already fixed this as the SAME
instance's own construct-once/bootstrap-once contract) — Desktop
itself is considered ready to proceed (show its own window, accept
its own input, or otherwise begin normal operation).

## 4. Grounding in the actual source

- `bootstrapIdentity()`'s own idempotency (Alpha 061) is a SAFETY NET,
  not the primary mechanism relied on here: `if (this.#isBootstrapped())
  { return; }` makes a SECOND call on the SAME instance a cheap no-op,
  but Alpha 092's own Decision (below) is that `Application bootstrap()`
  itself is structured to issue exactly ONE call in the first place —
  idempotency is a backstop against an accidental second call
  elsewhere, not license to call it casually more than once.
- `FedosRuntimeIdentity`'s own constructor performs no Bootstrap of
  its own (confirmed directly from the HARD GUARDRAILS: no argument,
  no `RuntimeEnv` read, no environment classification) — `construct`
  and `bootstrapIdentity()` are, and must remain, two textually and
  temporally SEPARATE steps in the sequence, never collapsed into one.
- Alpha 089 (Runtime Separation) already fixed that `createRuntime()`
  never receives or exposes Desktop's own Identity instance — this
  Stage's own third invariant (below) extends that separation into an
  explicit ORDERING rule between the two independent startup actions
  Desktop performs.

## 5. Decision — three invariants

`Application bootstrap()`'s own sequence must uphold ALL three,
permanently:

1. **Bootstrap is never called more than once per instance.** The
   sequence itself issues exactly one `bootstrapIdentity()` call;
   Alpha 061's own idempotency guard exists as a safety net against a
   future bug, not as a substitute for this discipline.
2. **Identity is never swapped mid-sequence.** The SAME
   `FedosRuntimeIdentity` instance constructed in step 1 is the SAME
   instance `bootstrapIdentity()` is called on in step 2 — no
   replacement, no second `new FedosRuntimeIdentity()` call, between
   construction and Bootstrap completion.
3. **Bootstrap is never called later than Runtime generation.**
   Identity Bootstrap (this sequence) must complete at or before
   `createRuntime()` is ever invoked elsewhere in Desktop's own
   startup path — never after. This does not mean the two become
   coupled (Alpha 089 still permanently forbids Identity from ever
   reaching `createRuntime()`'s own output) — it fixes only the
   ORDER two independent actions occur in, so that by the time
   Desktop's own Runtime-dependent features are assembled, Identity
   has already, unambiguously, either succeeded or failed.

## 6. What this Stage does NOT do

- Does **not** implement `bootstrap()` or any Desktop Shell construct
  of any kind.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, any `src/identity/*`
  file, Storage, Rust, `Cargo.toml`, or `package.json`.
- Does **not** modify the Public Runtime API in any way.
- Does **not** implement Bootstrap or Observation of any kind.
- Does **not** couple `createRuntime()` to Identity in any way — the
  ordering invariant in §5.3 fixes WHEN, not WHETHER they interact
  (they never do, per Alpha 089).

## 7. See also

- `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_087_desktop_bootstrap_ownership_review.md`
- `docs/secure_runtime_alpha_089_desktop_runtime_separation_review.md`
- `docs/secure_runtime_alpha_091_desktop_entry_point_review.md`
