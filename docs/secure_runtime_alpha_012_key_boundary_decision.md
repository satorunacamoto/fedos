# FedOS Secure Runtime Alpha 012 — Public Runtime Key Boundary Decision

**Status: REVIEW / DESIGN DECISION ONLY. No Runtime, Rust, Worker,
Production, `Cargo.toml`, `package.json`, `create_runtime.ts`, or
`fedos_wasm_loader.ts` change of any kind. No `#[wasm_bindgen]` attribute
is added, no Public API is added, no `encrypt()`/`decrypt()` is
implemented, no Key Handle or Opaque Class is implemented, and no Secure
Storage is implemented. This document and its guard test are the entire
deliverable.**

## 0. Where this picks up

Alpha 010 shipped `AppRuntime.generateAeadKey(): Promise<Uint8Array | null>`,
explicitly labeling the raw-bytes shape "a conscious, temporary
substitute — not the intended final design," and naming a future
migration to an opaque key-handle class as expected to land **before**
`encrypt()`/`decrypt()` are implemented.

Alpha 011 confirmed that if `encrypt()` ever adopts an Opaque Key Handle
for its `key` parameter while `generateAeadKey()` keeps returning raw
`Uint8Array`, the two Public APIs become mutually incompatible — a
caller could not feed `generateAeadKey()`'s own output directly into
`encrypt()`. Alpha 011 §7 provisionally recommended Alpha 012 build a
minimal `encrypt()` wrapper reusing the raw-bytes shape, but flagged this
as exactly the kind of compounding risk that needed its own dedicated
review before being treated as settled.

**This Stage is that review.** It formally compares the four candidates
already named, decides ONE as Secure Runtime Alpha's own key-boundary
policy, rejects the other three with reasons, and names the first
concrete implementation step for Alpha 013. No code is written here.

## 1. The four candidates, restated

- **① Defer** — keep `generateAeadKey()` unchanged now; break it later,
  after `encrypt()`/`decrypt()` already exist.
- **② Freeze raw bytes** — `encrypt()` also accepts/returns `Uint8Array`;
  the raw-bytes shape becomes Secure Runtime Alpha's permanent key
  boundary, not a temporary stand-in.
- **③ Migrate now** — change `generateAeadKey()`'s own return shape to an
  Opaque Key Handle before `encrypt()`/`decrypt()` are ever built, so
  neither is ever implemented against the raw-bytes shape.
- **④ Bridge** — keep `generateAeadKey()` returning `Uint8Array`
  permanently; add a new, separate `importKey()` Public API that wraps
  raw bytes into an Opaque Key Handle for `encrypt()`/`decrypt()` to
  consume.

## 2. Comparison across the nine fixed criteria

| Criterion | ① Defer | ② Freeze raw bytes | ③ Migrate now | ④ Bridge (`importKey()`) |
|---|---|---|---|---|
| **Fail Closed** | Unaffected — the six-condition `FedosWasmLoader` gate and each Runtime Service's own `try`/`catch` do not read or depend on the key's own shape at all. | Unaffected, same reasoning. | Unaffected — an Opaque Handle is only ever RECEIVED from an already-gated call (`generateAeadKey()`), never independently constructed by JS; no new Fail-Closed surface is introduced by the type change itself. | Unaffected for `generateAeadKey()`/`encrypt()` individually; `importKey()` itself would need the SAME six-condition gate as every other Crypto API — a straightforward repetition of the existing pattern, not a new one. |
| **公開API互換性 (Public API compatibility)** | Preserved NOW, broken LATER — and by the time it breaks, `encrypt()`/`decrypt()` (and whatever calls them) exist on top of the raw shape too, so the break's surface area is strictly larger than if it happened today. | Preserved forever — this is the only candidate where "compatibility" and "never touching the temporary shape again" are the same outcome. | Broken NOW, once, before any second API is built against the raw shape — the smallest possible breakage surface (`generateAeadKey()` alone; no caller depends on it beyond this repository's own tests). | Preserved forever for existing callers; a NEW API (`importKey()`) is added rather than any existing one changed. |
| **Secure Runtime長期方針 (long-term policy)** | Aligns with the arc's own stated direction, but only after the deferred break — an extended interim period exists where policy and implementation disagree. | Never aligns — permanently contradicts `docs/public_crypto_opaque_handles.md`'s "opaque handle, never a raw byte getter" discipline and Alpha 007 §6's permanent exclusion of raw key material from the public surface. Converts an explicitly-labeled temporary compromise into permanent policy without ever revisiting it. | Aligns immediately and fully for the key-generation boundary — the ONE candidate that actually finishes the migration Alpha 010 itself announced, rather than working around the fact that it has not happened yet. | Aligns for `encrypt()`/`decrypt()`'s own boundary, but leaves `generateAeadKey()` itself permanently emitting raw key bytes — a partial alignment: the newer API is clean, the older one is never reconciled with it. |
| **Worker接続への影響 (Worker connection)** | None. | None. | None. | None. |
| **Productionへの影響** | None. | None. | None. | None. |
| **Secure Storageとの整合性** | Open until the deferred break — raw bytes remain trivially storable (structured-clone-compatible) up to that point. | Fully open — a `Uint8Array` is the natural shape any future Secure Storage layer would persist directly, with no bridging function ever required. | Narrows — once a key exists only as an opaque handle, any future Secure Storage design needs its OWN `exportKey()`-shaped bridge to ever obtain persistable bytes. This is not a new gap: Alpha 007 §6 already named `exportKey()` as needing "its own dedicated, separately-reviewed Stage" regardless of this Stage's own decision — ③ does not foreclose that future Stage, it simply means that Stage's own scope is unchanged from what Alpha 007 already anticipated. | Fully open via `generateAeadKey()`'s own unchanged raw-bytes return value — a future Secure Storage layer could persist that value with no bridge needed, independent of `importKey()`/`encrypt()` entirely. |
| **Opaque Handle設計との整合性** | Eventually yes, not today. | Never. | Yes, immediately, for the ONE type this Stage reviews (`FedosAeadKeyHandle`'s own cross-boundary shape). | Yes for `encrypt()`/`decrypt()`'s own input; `generateAeadKey()` itself remains outside the opaque design permanently — a split, not a unified, boundary. |
| **将来API破壊コスト (future breakage cost)** | Highest — breakage is deferred to a point where MORE public surface (`encrypt()`, `decrypt()`, and any code calling either) depends on the shape being broken. | Zero breakage, ever — but only because the compromise this arc called temporary is never corrected. | Lowest realistic non-zero cost — the break happens once, now, while `generateAeadKey()` is the ONLY caller-facing surface depending on the raw shape (this repository's own tests are the only "caller," updated in the same Stage that makes the change — the same ripple-and-fix pattern Alpha 008→010 already used for unrelated pub-fn-count bumps). | Zero breakage — but at the cost of a permanently split boundary (see above) rather than a resolved one. |
| **実装コスト (implementation cost)** | Low now (nothing built this Stage); the deferred migration Stage still has to build the SAME Opaque Class mechanism ③ would build today, plus migrate whatever was built against the raw shape in the meantime. | Lowest overall — no new mechanism is ever built for the key boundary. | Higher up front — requires building the Opaque Class `#[wasm_bindgen]` mechanism (a genuinely new mechanism in this crate, per Alpha 009 §3) as its own Stage, before `encrypt()` exists. | Highest total — requires the SAME Opaque Class mechanism ③ needs (for `encrypt()`/`decrypt()` to consume), PLUS a new, separate `importKey()` Public API and Rust Boundary wrapper on top of it. |

## 3. Consistency check against Alpha 007 / 009 / 010 / 011

- **Alpha 007 §6** fixed, as a PERMANENT exclusion, that raw key material
  as exportable bytes "may never belong on a public, general-purpose
  surface without its own dedicated, separately-reviewed Stage." ③ is the
  only candidate that brings `generateAeadKey()` into compliance with
  this permanent rule outright. ② converts the exclusion's one
  Alpha-limited exception (`generateAeadKey()`, explicitly reviewed and
  labeled temporary in Alpha 010) into a standing violation with no
  reconsideration path. ④ satisfies the rule for `encrypt()`/`decrypt()`
  but leaves `generateAeadKey()` itself as a permanent, un-reviewed-as-
  permanent exception.
- **Alpha 009 §3** already named the Opaque Class `#[wasm_bindgen]`
  mechanism as the structural fix for `FedosAeadKeyHandle`'s cross-
  boundary shape, and identified it as the crate's "opaque handle, never
  a raw byte getter" discipline applied to WASM specifically. ③ is the
  direct, undelayed execution of that finding; ④ executes it only for
  `encrypt()`/`decrypt()`, not for key generation itself; ① executes it
  eventually; ② never executes it.
- **Alpha 010** shipped the raw-bytes `generateAeadKey()` with an explicit
  written expectation: "A future arc is expected to replace this raw-bytes
  shape with an opaque, `#[wasm_bindgen]`-exported key-handle class...
  **before `encrypt()`/`decrypt()` are implemented**." This is the
  single strongest piece of direct evidence available to this Stage: the
  arc already committed, in writing, to sequencing the migration BEFORE
  `encrypt()`, not after and not never. ③ is the only candidate that
  honors this sequencing exactly as written. ① inverts it (migrate
  after). ② and ④ both abandon it (never migrate `generateAeadKey()`
  itself).
- **Alpha 011 §1** found the raw-bytes candidate for `encrypt()`'s OWN key
  parameter "directly re-triggers Alpha 007 §6's own permanent... exclusion
  a second time" — i.e., Alpha 011 already flagged that letting
  `encrypt()` also consume raw bytes (as ② would require, and as Alpha
  011 §7's own provisional Alpha 012 recommendation risked) compounds
  the very violation Alpha 010 only accepted once, temporarily. ③ is the
  candidate that prevents this compounding from ever occurring, by
  removing the raw-bytes shape before `encrypt()` has a chance to inherit
  it.

**Conclusion: every one of the four prior Stages' own findings, taken
together, point at ③ specifically** — not merely "an opaque handle
eventually," but "migrate the key boundary before `encrypt()`/`decrypt()`
exist," which is Alpha 010's own explicit, written sequencing.

## 4. Decision

**Secure Runtime Alpha adopts ③: migrate `generateAeadKey()`'s own return
shape to an Opaque Key Handle now, before `encrypt()`/`decrypt()` are
implemented.**

### Why ③

- It is the only candidate consistent with Alpha 010's own explicit,
  written sequencing commitment (§3 above) — this Stage is not choosing a
  new direction, it is executing a direction the arc already announced.
- It is the only candidate that fully satisfies Alpha 007 §6's permanent
  exclusion for the key-generation boundary specifically, rather than
  routing around it (④) or abandoning it (②) or merely postponing
  compliance (①).
- It has the LOWEST realistic breakage cost of any candidate that
  actually resolves the mismatch, precisely because it acts before any
  second Public API (`encrypt()`) exists to compound it — every day this
  migration is deferred, the eventual breakage surface can only grow.
- It does not foreclose ④ (`importKey()`) as a LATER, separately-reviewed
  addition if a genuine need for byte-level key portability (e.g., a
  future Secure Storage bridge, or importing an externally-obtained key)
  ever arises — ③ resolves THIS Stage's specific mismatch without ruling
  out other primitives Alpha 007 already named as legitimately deferred.

### Why not ① (defer)

Rejected because deferring the migration past `encrypt()`/`decrypt()`
directly contradicts Alpha 010's own written sequencing ("before
`encrypt()`/`decrypt()` are implemented") and strictly increases future
breakage cost by allowing more public surface to depend on the shape
being changed. No criterion in §2 favors ① over ③ except "implementation
cost is low **this Stage**" — which only shifts cost forward, at a
compounding rate, rather than reducing it.

### Why not ② (freeze raw bytes)

Rejected because it permanently violates Alpha 007 §6's own fixed
exclusion and this crate's own stated permanent Opaque Handle design
(`docs/public_crypto_opaque_handles.md`), converting Alpha 010's
explicitly-labeled temporary compromise into unreviewed permanent policy.
Every long-term-facing criterion in §2 (Secure Runtime long-term policy,
Opaque Handle design consistency) is worst-in-class for ②; its only
advantages (zero breakage, lowest implementation cost) are the advantages
of never finishing the migration at all.

### Why not ④ (bridge via `importKey()`)

Rejected AS THE FIX for this specific mismatch — not rejected as a
concept forever. `importKey()` was already named in Alpha 007 §1/§9 as a
legitimate, separately-scoped future candidate, and nothing in this
Stage's decision prevents a future Stage from adding it for its own,
independent reason (e.g., importing a key obtained outside this crate
entirely). But adopting it AS THE RESOLUTION to Alpha 011's finding would
mean: (a) building the same Opaque Class mechanism ③ requires ANYWAY (for
`encrypt()`/`decrypt()` to consume), (b) ALSO building a new, separate
Public API on top of it, and (c) still never bringing `generateAeadKey()`
itself into compliance with Alpha 007 §6 — strictly more work than ③ for
a strictly less complete result on the one question this Stage was asked
to decide.

## 5. Alpha roadmap, updated

1. **Alpha 013 (recommended, §6 below)** — migrate `generateAeadKey()`'s
   Rust Boundary wrapper and Public Runtime API to return an Opaque AEAD
   Key Handle instead of `Uint8Array`. A deliberate, reviewed, one-time
   breaking change to Alpha 010's shipped shape — the ONLY breaking
   change this decision authorizes, and the only one Secure Runtime Alpha
   is expected to ever need for this specific boundary.
2. **A later Stage** — the minimal `encrypt()` wrapper, built directly
   against the now-Opaque `FedosAeadKeyHandle` from its very first
   version — never implemented against a raw-bytes key shape at any point.
3. **A still-later, SEPARATE Stage** — `decrypt()`, per Alpha 009 §6 /
   Alpha 011 §6's reaffirmed "separate Stages, `encrypt()` first"
   recommendation — unaffected by this Stage's own decision.
4. **`importKey()`/`exportKey()`** — remain explicitly deferred, exactly
   as Alpha 007 §1/§9 already left them; this Stage neither schedules nor
   forecloses either.
5. **Secure Storage** — remains unimplemented and unscheduled; if it is
   ever designed, it will need its own `exportKey()`-shaped bridge per §2's
   Secure Storage row — a cost this Stage's decision makes explicit but
   does not need to pay itself.

## 6. Recommendation for Alpha 013 — the first implementation

> **Migrate `AppRuntime.generateAeadKey()`'s Rust Boundary wrapper and
> Public Runtime API to return an Opaque AEAD Key Handle instead of
> `Uint8Array`.**

This is the SAME structural mechanism (`#[wasm_bindgen]` on a struct,
producing a JS class instance backed by a Rust-owned value, reachable
only through exported methods) Alpha 009 §3 already reviewed for
feasibility. Alpha 013 itself must still review its own exact mechanics
(what methods, if any, the exported class needs beyond being an opaque
carrier; whether `generate_aead_key_32()`'s existing Rust Boundary
function is replaced or a new one added alongside it during a transition;
how the ripple of existing tests asserting `Uint8Array | null` gets
updated) before writing any code — the same discipline every prior Stage
in this arc has followed. No implementation is authorized by this
recommendation.

## 7. Fail Closed — reconfirmed

Consistent with §2's own row: this decision changes no Fail-Closed
guarantee. `initializeCrypto()`, `runtimeCapabilities()`, `randomBytes()`,
and `generateAeadKey()`'s CURRENT (Alpha 010) behavior are all confirmed
unchanged by this Stage's own guard test, via actual calls — this Stage
decides a FUTURE shape for `generateAeadKey()`; it does not implement it.

## 8. Unresolved / open questions for future Stages

- The exact Opaque Class mechanics for `FedosAeadKeyHandle` (methods,
  transition strategy, test-ripple scope) — Alpha 013's own review, not
  fixed here.
- Whether `importKey()` is ever added for a genuinely separate reason
  (external key import, Secure Storage bridging) — explicitly still
  open, per Alpha 007's own original deferral, unaffected by this
  Stage's rejection of ④ as the fix for Alpha 011's specific finding.
- Whether `exportKey()` is ever needed to support a future Secure Storage
  design — explicitly deferred, per Alpha 007 §6 and this Stage's own
  Secure Storage row.
- The eventual `encrypt()` signature itself (Alpha 011 §2's four
  candidates) — untouched by this Stage, which resolves only the key
  boundary, not the full `encrypt()` signature.
- The Ciphertext boundary (Alpha 011 §3) — untouched by this Stage;
  remains its own, separately unresolved question.

## 9. Confirmed unchanged

- `AppRuntime.initializeCrypto()` — `{ allowed: false, initialized:
  false, reason: "PrototypeDisabled" }`, byte-for-byte, confirmed by an
  actual call in this Stage's own guard test.
- `AppRuntime.runtimeCapabilities()` — Alpha 005's four fields, confirmed
  by an actual call.
- `AppRuntime.randomBytes()` — confirmed by an actual call.
- `AppRuntime.generateAeadKey()` — STILL `Promise<Uint8Array | null>` as
  of this Stage; confirmed by an actual call. This decision does not
  implement its own migration.
- `FedosWasmLoader`'s seven Plan interfaces — untouched.
- `src/worker.ts` — no reference to anything named in this document.
- `packages/fedos-core-rust/src/lib.rs` — still 30 `pub fn`, still
  exactly three `#[wasm_bindgen]` exports.
- `Cargo.toml`/`package.json` — no new dependency, no count change.
- `encrypt()`/`decrypt()`/`importKey()`/`exportKey()` — none implemented
  anywhere in this Stage.
- No Opaque Class, no Key Handle implementation, no Secure Storage of any
  kind exists anywhere in this Stage's own new files.

## 10. See also

- `docs/secure_runtime_alpha_007_crypto_api_surface_review.md` — §6's
  permanent exclusion this Decision measures every candidate against.
- `docs/secure_runtime_alpha_009_encrypt_api_surface_review.md` — §3's
  Opaque Class feasibility finding this Decision executes.
- `docs/secure_runtime_alpha_010_aead_key_generation.md` — the raw-bytes
  shape and its own explicit "before `encrypt()`/`decrypt()`" migration
  commitment this Decision honors.
- `docs/secure_runtime_alpha_011_encrypt_boundary_review.md` — the
  mismatch finding that opened this Decision.
- `docs/public_crypto_opaque_handles.md` — the permanent opaque-wrapper
  design this Decision brings `generateAeadKey()` into alignment with.
