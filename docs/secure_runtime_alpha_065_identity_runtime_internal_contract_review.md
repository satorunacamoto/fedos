# Secure Runtime Alpha 065 — Identity Runtime Internal Contract Review

**Status: this is a REVIEW / DESIGN DECISION document only. No
implementation file changes anywhere in this repository. It records a
decision that a future, separately-reviewed Stage (Alpha 066, per this
document's own §9 recommendation) may act on.**

## 1. Why now

Alpha 050–064 grew `FedosRuntimeIdentity` from a three-method
pass-through shell into a seven-method class with real internal state
(`#bootstrapped`/`#descriptor`/`#identityVersion`). Every one of those
additions was reviewed in isolation, against its own narrow question
("should Bootstrap be resettable," "what should Bootstrap cache," "how
do we detect a change"). None of them stepped back and asked whether
the SEVEN methods, taken together, still form a coherent, non-redundant
contract — or whether a name chosen in isolation (`identityVersion()`,
Alpha 064) still means what it claims once checked against the actual
reachable states of the class. This Stage performs that step-back
review, before any of these seven methods is ever exposed past this
file's own boundary (Alpha 059 §2, reconfirmed unchanged: nothing in
this repository calls any of them today).

## 2. Current state, recorded precisely

```
FedosRuntimeIdentity (src/runtime/fedos_runtime_identity.ts)
  #registry/#service/#resolver   — set once, in the constructor
  #bootstrapped: boolean = false
  #descriptor: FedosIdentityDescriptor | null = null
  #identityVersion: number = 0

  async describeIdentity(): Promise<FedosIdentityDescriptor | null>
    return this.#service.describeIdentity();

  findIdentity(id: string): FedosIdentityRecord | null
    return this.#resolver.findIdentity(id);

  listIdentities(): readonly FedosIdentityRecord[]
    return this.#resolver.listIdentities();

  async bootstrapIdentity(): Promise<void>
    if (this.#bootstrapped) { return; }
    this.#descriptor = await this.#service.describeIdentity();
    this.#bootstrapped = true;
    this.#identityVersion += 1;

  isBootstrapped(): boolean
    return this.#bootstrapped;

  currentIdentity(): FedosIdentityDescriptor | null
    return this.#descriptor;

  identityVersion(): number
    return this.#identityVersion;
```

Confirmed via a fresh reading of the actual source for this Stage
(no assumption is taken from any prior Stage's own doc without
re-verifying it against this file and `src/identity/fedos_identity_service.ts`
directly):

- `#bootstrapped`, `#descriptor`, and `#identityVersion` are each
  assigned in EXACTLY ONE place in this entire file — the three
  consecutive statements inside `bootstrapIdentity()`'s own guarded
  body (lines `this.#descriptor = await …`, `this.#bootstrapped =
  true;`, `this.#identityVersion += 1;`, in that order). No other
  method, and no other statement anywhere in the file, ever assigns to
  any of the three.
- `describeIdentity()`'s own body reads `this.#service.describeIdentity()`
  and returns its result directly — it references NONE of
  `#bootstrapped`/`#descriptor`/`#identityVersion`, either to read or
  write.
- `FedosIdentityService.describeIdentity()` (`src/identity/fedos_identity_service.ts`,
  Alpha 031/042/047) calls `registry.register(record)` on every
  non-`null` resolution — a REAL Registry write — regardless of which
  `FedosRuntimeIdentity` method reached it (`describeIdentity()`
  directly, or `bootstrapIdentity()`'s own internal call).

## 3. The six confirmation questions

**1. 同一インスタンスで値が2以上になる経路は存在するか？** No. The ONLY
statement that increments `#identityVersion` is the third line of
`bootstrapIdentity()`'s own guarded body, reached only when
`this.#bootstrapped` was `false` at the moment of the call (the guard's
own condition). By the time that line executes, the immediately
preceding statement has ALREADY set `this.#bootstrapped = true;` — so
every subsequent call to `bootstrapIdentity()`, on the SAME instance,
hits the guard and `return`s before reaching the increment ever again.
There is no retry path, no reset path (Alpha 062, formally rejected),
and no second constructor call on an existing instance. `identityVersion()`
is therefore bounded to `{0, 1}` for the entire lifetime of any single
instance — a mathematical consequence of Alpha 061's own idempotency
guard, not a coincidence of testing.

**2. Identity Descriptorが変化する経路は存在するか？** No, for the
IDENTICAL structural reason as Question 1. `#descriptor` is assigned in
the SAME guarded body, at the statement immediately before
`#bootstrapped`'s own assignment. Once set (to `null` or to a real
Descriptor), it can never be reassigned on that instance — the guard
that protects `#identityVersion` from incrementing twice is the EXACT
SAME guard that protects `#descriptor` from ever being overwritten.
`currentIdentity()`'s own return value is therefore fixed for an
instance's entire lifetime, from the moment `bootstrapIdentity()` first
succeeds. There is no Descriptor "change" to detect on a single
instance — full stop, not merely `identityVersion()`'s own value.

**3. 新しいFedosRuntimeIdentityへ切り替えた際、旧versionと比較できるか？**
No. Each `FedosRuntimeIdentity` constructs its OWN, independent
`#identityVersion`, starting at `0` (the constructor, unchanged since
Alpha 050, does not accept or read any external counter). Two
instances' own `identityVersion()` values carry no relationship to each
other — a freshly-constructed replacement instance's `identityVersion()`
starts at `0` again regardless of what the PRIOR instance's own value
was. There is no shared, monotonic, cross-instance counter anywhere in
this file or in `create_runtime.ts`. A caller comparing
`oldIdentity.identityVersion()` to `newIdentity.identityVersion()`
learns nothing it did not already know from the mere fact that it
itself constructed a new instance (Alpha 062's own established
switching mechanism) — the comparison is definitionally redundant with
the caller's own action.

**4. isBootstrapped()と独立した情報を持つか？** No. Reading `§2`'s own
recorded code directly: `this.#bootstrapped = true;` and
`this.#identityVersion += 1;` are two ADJACENT statements inside the
SAME guarded branch, with no conditional, no `try`/`catch`, and no
`await` between them — nothing in this file can ever execute one
without executing the other, and nothing can ever execute either one
more than once per instance (Question 1). This yields a genuine,
provable INVARIANT across every reachable state of this class:

```
identityVersion() === (isBootstrapped() ? 1 : 0)
```

`identityVersion()` is not "related to" `isBootstrapped()` — it is a
`number`-typed RE-ENCODING of the exact same boolean fact, carrying
zero additional bits of information. This is confirmed as a structural
property of the code (§2), not an empirical observation that some
future Stage might invalidate by accident — no code path in this file
can break the invariant without also changing `bootstrapIdentity()`'s
own guarded body, which is the SAME body both fields depend on.

**5. Desktop/UIが変更検知へ利用できるか？** No, for a purpose distinct
from what its own name promises. Alpha 059 already designated Desktop
startup as the caller of `bootstrapIdentity()`, calling it ONCE per its
own process lifetime; Alpha 062 already established that a DIFFERENT
identity means constructing a NEW `FedosRuntimeIdentity`, an action
Desktop itself performs deliberately. A Desktop process holding a
SINGLE instance can only ever observe `identityVersion()` transition
`0 → 1`, exactly once, at the moment its own `bootstrapIdentity()` call
resolves — information `isBootstrapped()` (or simply awaiting the
`bootstrapIdentity()` call itself) already gives it, with no polling
required. A Desktop process that switches instances already knows it
switched, because IT performed the construction — it gains nothing by
comparing the old instance's frozen `identityVersion()` to the new
instance's freshly-reset one (Question 3). There is no scenario, under
this Runtime's own already-ratified architecture (Alpha 059/061/062),
in which a UI would need to POLL `identityVersion()` to learn something
it does not already know.

**6. 「Identity Change Detection」という名称は事実に合うか？** No. "Change
Detection" implies observing a value transition FROM one state TO a
DIFFERENT state, at a time the observer does not already control or
know. Per Questions 1–2, no value this class holds (`#descriptor`,
`#bootstrapped`, `#identityVersion`) can transition more than once on a
single instance, and per Question 5, a cross-instance transition is
never something a caller learns FROM this API — it is something the
caller ALREADY KNOWS because it performed the construction itself. What
`identityVersion()` actually reports is "has `bootstrapIdentity()` ever
completed successfully on this exact object" — precisely
`isBootstrapped()`'s own definition (Alpha 060 §"full design
rationale"), merely typed as a bounded `number` instead of a `boolean`.
The name overstates a capability the implementation does not have.

## 4. The five candidate options

- **Option A** — status quo: keep `identityVersion()` exactly as
  Alpha 064 shipped it, `{0, 1}` per instance.
- **Option B** — delete `identityVersion()`/`#identityVersion` entirely,
  resolving the duplication with `isBootstrapped()`.
- **Option C** — rename to `bootstrapGeneration()` (or similar), keeping
  the SAME `{0, 1}`-per-instance mechanism but naming it for what it
  actually measures (a Bootstrap generation counter, not an Identity
  change signal).
- **Option D** — consolidate onto `isBootstrapped()` as the SOLE
  Bootstrap-state reader; delete `identityVersion()`/`#identityVersion`.
- **Option E** — design a REAL Identity revision: a value that updates
  ONLY when the Descriptor's own CONTENT changes, independent of
  Bootstrap call count.

## 5. Comparison

| Criterion | A: status quo | B: delete (resolve duplication) | C: rename to `bootstrapGeneration()` | D: consolidate on `isBootstrapped()` | E: real content-based revision |
|---|---|---|---|---|---|
| 事実正確性 (Name matches what it measures) | **Fails** — "Change Detection" implies a capability §3 Q1/Q2/Q5 confirm does not exist | N/A — no method, no name to be wrong | **Passes** — "generation" accurately describes a monotonic-within-instance counter bounded to `{0,1}`, without implying cross-value change detection | N/A — no second method exists to name; `isBootstrapped()`'s own existing name already accurately describes what it reads | Would accurately need the name it claims, IF built — but see Reset/Idempotency compatibility row below |
| isBootstrapped()との重複 (Duplication with isBootstrapped()) | **Confirmed identical information** (§3 Q4's own invariant) — kept anyway | Fully resolved — nothing left to duplicate | **Still fully duplicated** — a rename changes the LABEL, not the fact that `bootstrapGeneration() === (isBootstrapped() ? 1 : 0)` remains true for every reachable state | Fully resolved, by definition — `isBootstrapped()` becomes the ONLY state reader | Would NOT duplicate `isBootstrapped()` — a content-based revision is genuinely independent information (revision could stay unchanged across MULTIPLE bootstrap-adjacent events, or in principle change without a fresh `bootstrapIdentity()` call in a redesigned model) |
| Alpha 061 冪等性との整合 (Compatibility with idempotency) | Compatible (unaffected either way) | Compatible | Compatible | Compatible | **Incompatible without revisiting Alpha 061** — a revision that reacts to CONTENT change requires either re-running `describeIdentity()` after a successful Bootstrap (which the guard explicitly forbids, by design) or comparing against a value obtained OUTSIDE the guarded body, neither of which this file's own current architecture provides |
| Alpha 062 Reset禁止/再生成方針との整合 (Compatibility with reset-ban / regenerate-only policy) | Compatible | Compatible | Compatible | Compatible | **Tension** — the only way §3 Q2's "Descriptor never changes on one instance" constraint could be lifted is a Bootstrap re-attempt on an EXISTING instance, which Alpha 062 §6 explicitly rejected as an in-place mutation; a genuinely content-reactive revision effectively re-opens the exact question Alpha 062 already closed |
| YAGNI (no caller exists) | Kept despite zero known callers (Alpha 059 §2: nothing calls any of these seven methods yet) | Removes speculative surface with zero current cost — nothing breaks, since nothing calls it | Keeps the same speculative surface, merely renamed | Removes the speculative surface, same as B | Adds MORE speculative surface (a redesigned Bootstrap/Provider re-query mechanism) for a capability no caller has asked for and Alpha 059's own review found no real caller exists for anything in this file yet |
| Public公開前の削除コスト (Cost of removing before any public exposure) | N/A (not removed) | **Minimal** — no `AppRuntime` field, no Worker reference, no Desktop wiring exists anywhere to update; the entire blast radius is this one file plus its own tests | N/A (not removed, only renamed — tests referencing the old name still need updating regardless) | **Minimal**, identical to B | N/A (not applicable, this Option ADDS scope rather than removing it) |
| テスト容易性 (Testability) | Already covered by Alpha 064's own 43 tests | Simpler overall test surface — one fewer state accessor whose own value must stay synchronized with `isBootstrapped()` in every future test | Requires the SAME `{0,1}`-per-instance invariant tests as A, just against a renamed method | Simplest — a single boolean accessor is the entire state-reading surface | Would require an entirely new test suite for content-comparison semantics, retry/re-query interaction with the Alpha 061 guard, and cross-instance comparison — the largest test surface of any Option |
| Runtime純粋性 (Runtime purity) | Unaffected either way — no I/O in any Option's read path | Removes one private field and one method — strictly SMALLER surface, matching this file's own repeatedly-stated "no speculative machinery" discipline (Alpha 059 §6, Alpha 062 §6) | Same surface as A, differently named | Same reduction as B | Would need a NEW dependency (a comparison function, or re-invoking the Provider) that this file has never had — the LARGEST purity cost of any Option |
| 将来Provider (Future Provider fit) | A future real Provider still only ever contributes ONE Descriptor per instance (Alpha 061's own guard is unaffected by Provider identity) — `identityVersion()` gains no new meaning as Provider realism increases | Unaffected — nothing is lost, since nothing meaningful was measured to begin with | Unaffected, same reasoning as A | Unaffected | A REAL revision would become MORE valuable once a real Provider exists (e.g. profile updates) — but building it now, against a Null Source, cannot be validated against real content-change behavior, and the architecture required (Question above) is not compatible with today's guard/reset policy regardless |
| 責務明確性 (Responsibility clarity) | Two methods answer the same question in two shapes — unclear to a future reader WHICH one is authoritative | One method, one clear answer to "has Bootstrap succeeded" | Two methods still answer the same question — renaming clarifies WHAT is measured but not WHY there are two readers for it | One method, unambiguous | Would give each method a clearly DIFFERENT question to answer ("has Bootstrap succeeded" vs "has the Descriptor's own content changed") — but only if actually built to do so, which this Stage does not authorize |

## 6. Full internal API inventory

| Method | 分類 (Classification) | Grounds |
|---|---|---|
| `bootstrapIdentity()` | **ライフサイクル操作** (Lifecycle operation) | The ONLY method that mutates `#bootstrapped`/`#descriptor`/`#identityVersion`, and the only one that drives a real Provider read + conditional Registry write (via `#service`). |
| `isBootstrapped()` | **ライフサイクル状態** (Lifecycle state reader) | Synchronous, side-effect-free read of `#bootstrapped` — the single, minimal boolean answer to "did Bootstrap ever succeed on this instance." |
| `currentIdentity()` | **現在値Reader** (Current-value reader) | Synchronous, side-effect-free read of `#descriptor` — the cached RESULT of the one successful Bootstrap, distinct in both TYPE (`FedosIdentityDescriptor`) and PURPOSE (a snapshot, not a status) from `isBootstrapped()`. |
| `identityVersion()` | **重複 / 削除候補** (Duplicate / deletion candidate) | Per §3 Q4's own proven invariant, carries EXACTLY the same information as `isBootstrapped()`, merely re-typed as `{0,1}` — not a distinct classification of its own. |
| `describeIdentity()` | **Provider直接Reader** (direct Provider reader) — see §7 for the bypass finding | A raw, stateless pass-through to `#service.describeIdentity()`; touches NEITHER `#bootstrapped`/`#descriptor`/`#identityVersion` nor `#registry` directly, but its OWN callee (`FedosIdentityService`) still performs a real Registry `register()` write on a non-`null` result. |
| `findIdentity()` | **Registry Reader** | A pure, single-call pass-through to `#resolver.findIdentity(id)`, itself a pure pass-through to `#registry.find(id)` (Alpha 043). Requires a caller-supplied `id`; never mutates. |
| `listIdentities()` | **Registry Reader** | Same shape as `findIdentity()`, zero-argument, pass-through to `#registry.list()`. |

No method in this inventory is classified **改名候補** under the
adopted Decision (§8) — `identityVersion()` is removed rather than
renamed (Option D over Option C, per §5's own duplication row). No
method is classified **将来Public候補** in this Stage — that
determination belongs to §7, scoped specifically to the Desktop
exposure question, not to this general inventory.

## 7. The three named overlaps, examined directly

### `bootstrapIdentity()` vs. `describeIdentity()` — a confirmed bypass

Both methods reach `this.#service.describeIdentity()`. `bootstrapIdentity()`
wraps that call inside the Alpha 061 guard and captures its result into
`#descriptor`/`#bootstrapped`/`#identityVersion`; `describeIdentity()`
calls the SAME underlying method directly, with NONE of that state
management. Tracing `FedosIdentityService.describeIdentity()`
(`src/identity/fedos_identity_service.ts`, Alpha 042) confirms it
STILL performs its own real side effect — `registry.register(record)`
— on every non-`null` resolution, regardless of which
`FedosRuntimeIdentity` method reached it.

**Confirmed: calling `describeIdentity()` directly on a
`FedosRuntimeIdentity` instance is a genuine Bootstrap-lifecycle
bypass.** A caller that calls `describeIdentity()` instead of
`bootstrapIdentity()` can cause a REAL Registry write (observable via
`findIdentity()`/`listIdentities()`) while `isBootstrapped()` stays
`false` and `currentIdentity()` stays `null` — a reachable, internally
inconsistent state this file's own design has never explicitly
forbidden, because `describeIdentity()` was never REMOVED when
`bootstrapIdentity()` was added (Alpha 058 §"HARD GUARDRAILS" keeps
`describeIdentity()` a "PURE PASS-THROUGH," by design, not by oversight
— Alpha 053/054's own original mandate). This Stage does not resolve
this finding — removing or gating `describeIdentity()` is explicitly
OUT OF SCOPE for this Stage's own mandate (no implementation change)
and is named as a distinct, separately-scoped candidate in §9's own
"NOT recommended for Alpha 066" list.

### `currentIdentity()` vs. `findIdentity()` — confirmed NOT a duplicate

`currentIdentity()` returns a `FedosIdentityDescriptor | null` — the
Provider's own raw output, cached at Bootstrap time, requiring NO
argument, always describing "the one identity THIS instance bootstrapped
with." `findIdentity(id)` returns a `FedosIdentityRecord | null` — a
Registry-stored, mapped value (Alpha 047: `id`/`provider`/
`publicIdentifier`/`displayName`/`avatar`, copied FROM a Descriptor by
`FedosIdentityService`, Alpha 042), requiring a caller-supplied `id`,
answering "what does the Registry hold for THIS specific key," a
question that has nothing to do with which instance's own Bootstrap
populated it. The TYPE differs (`Descriptor` vs. `Record`), the ARITY
differs (zero-argument vs. one-argument), and the SOURCE differs (a
private cached field vs. a shared, mutable `Map` reachable by any
registered `id`, including ones registered by the §7-confirmed
`describeIdentity()` bypass above). **Confirmed: responsibility is
cleanly separated — no overlap exists.**

### `isBootstrapped()` vs. `identityVersion()` — confirmed duplicate

Already proven structurally in §3 Q4: `identityVersion() ===
(isBootstrapped() ? 1 : 0)` for every reachable state of this class,
because both fields are written in the same guarded branch, in
adjacent statements, with no code path capable of setting one without
the other. **Confirmed: this is the one genuine, provable duplication
among all seven methods.**

## 8. Public Runtime exposure — conditions for a future Stage

This Stage adds NO Public Runtime API — the following is a RECORD of
conditions a future, separately-reviewed exposure Stage should apply,
not an implementation of any of them.

- **Desktopが呼ぶべき操作 (Desktop should CALL):** `bootstrapIdentity()`
  only — Alpha 059's own designated Authority, unchanged by this
  Stage.
- **Desktopが読むべき状態 (Desktop should READ):** `isBootstrapped()`
  and `currentIdentity()` — the two genuinely independent, side-effect-free
  state readers this review confirms (§6, §7). `identityVersion()` is
  explicitly EXCLUDED from this list per §9's own Decision — exposing a
  redundant reader publicly would durably enshrine the confirmed
  duplication (§3 Q4) into a Public API surface this Runtime cannot
  cheaply retract later.
- **Desktopへ出してはいけない内部API (Must NOT be exposed to Desktop):**
  `describeIdentity()` — §7's own confirmed bypass finding means public
  exposure would hand any future consumer a way to silently desynchronize
  `isBootstrapped()`/`currentIdentity()` from the Registry's own actual
  contents. This is a STRONGER exclusion than "not yet needed" — it is
  "actively unsafe to expose without first resolving the bypass," a
  question this Stage explicitly defers (§7, §9).
- **Provider/Registryを迂回するAPI (APIs that bypass Provider/Registry):**
  `isBootstrapped()`/`currentIdentity()`/`identityVersion()` all
  intentionally bypass Provider/Registry — that is their entire
  purpose, as cheap synchronous cache reads, and is NOT a defect (this
  is the correct, by-design behavior established by Alpha 060/063/064
  respectively). `describeIdentity()` is the inverse case: it does NOT
  bypass Provider/Registry (it reaches both, through `#service`) — it
  bypasses this file's own STATE-TRACKING layer instead, which is the
  actual concern named above.
- **Protocol非依存で維持できるAPI (APIs that remain protocol-independent):**
  All seven methods, without exception — none references Nostr,
  ActivityPub, or any other named protocol; every one routes through
  the already-established Provider/Registry/Resolver abstraction
  (Alpha 032/041/043), unaffected by this Stage.

## 9. Decision

**Option D is adopted: `identityVersion()`/`#identityVersion` are to be
REMOVED, and `isBootstrapped()` is to remain the SOLE Bootstrap-state
reader.** Option A (status quo) is rejected — §3's own six questions
confirm the method's name overstates its actual capability, and §5's
own duplication row proves it carries zero information
`isBootstrapped()` does not already provide. Option C (rename to
`bootstrapGeneration()`) is rejected: a rename would correct the NAME
but leaves the DUPLICATION fully intact (§5's own "isBootstrapped()と
の重複" row is identical for A and C) — since this file has zero known
callers today (Alpha 059 §2) and Public exposure has not happened yet,
the cost of removing the redundant reader now is minimal, while the
cost of carrying a permanently-duplicated internal contract forward
(even honestly named) is not zero — a future reader still has to learn
and remember that two methods answer the same question. Option E (a
real content-based revision) is rejected as INCOMPATIBLE with this
Runtime's own already-ratified architecture without reopening two
separate, already-closed Decisions: Alpha 061's idempotency guard
(which forbids a second real Bootstrap attempt on an existing instance)
and Alpha 062's reset-ban / regenerate-only policy (which forbids any
in-place mutation of an already-bootstrapped instance's own Descriptor)
— building Option E today would mean silently violating one of those
two Decisions, which this Stage's own mandate does not authorize.
Option B and Option D reach the IDENTICAL concrete outcome (delete
`identityVersion()`/`#identityVersion`); Option D is adopted as the
formal framing because it also names the POSITIVE replacement contract
("`isBootstrapped()` as the sole state reader"), not merely the
negative action of deletion.

## 10. What this Stage does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts`.
- Does **not** modify `src/runtime/create_runtime.ts`.
- Does **not** modify `src/runtime/types.ts` or any `AppRuntime` field.
- Does **not** modify any `src/identity/*` file (Provider, Registry,
  Resolver, Service, Descriptor, or Record).
- Does **not** modify `src/worker.ts`.
- Does **not** modify any Storage or Crypto file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** add any Public Runtime API.
- Does **not** implement Desktop, Nostr, Relay, or Authentication
  behavior of any kind.
- Does **not** delete `identityVersion()`/`#identityVersion` itself —
  that remains, per §9, a future Stage's own separately-reviewed
  implementation (§11's own single recommendation).

## 11. Alpha 066 recommendation — ONE change only

**Alpha 066 should implement §9's own Decision directly: delete
`identityVersion()` and `#identityVersion` from
`fedos_runtime_identity.ts`, and nothing else.** This is the single,
most direct consequence of this Stage's own Decision — the method and
its backing field are confirmed redundant (§3 Q4, §5, §6), no caller
anywhere in this repository references either (Alpha 059 §2,
reconfirmed unchanged by this Stage), and removing them before any
Public exposure keeps the change's own blast radius to exactly one
file plus its own tests, with zero `AppRuntime`/Worker/Desktop surface
to update.

**Explicitly NOT recommended for Alpha 066** (named here so a future
Stage does not need to re-discover them, but deliberately deferred to
keep this recommendation singular, per this Stage's own instruction not
to recommend more than one change at once):

- **`describeIdentity()`直接Readerの廃止レビュー** — §7's own confirmed
  bypass finding is real and unresolved, but is a SEPARATE question
  from `identityVersion()`'s own redundancy, deserving its own
  dedicated review (comparing "remove the pass-through," "gate it
  behind `#bootstrapped`," and "document the bypass as intentional,"
  among other options) rather than being folded into this Stage's own
  narrower Decision.
- **API名の変更** — moot once Option D (delete, not rename) is adopted.
- **Identity Runtime完成宣言** — premature while the §7 bypass finding
  remains open.
- **Desktop Integration Boundary Review** — premature while the §7
  bypass finding remains open, since it directly affects which methods
  are safe to expose.

## 12. Summary

This Stage's own net effect on `src/` is ZERO — no file is modified.
It reviews all seven of `FedosRuntimeIdentity`'s own internal methods
against six code-grounded confirmation questions, proves — as a
structural property of the actual source, not an estimate — that
`identityVersion()` (Alpha 064) can only ever read `0` or `1` per
instance, can never observe a Descriptor change on a single instance,
carries no cross-instance comparison value, and is informationally
IDENTICAL to `isBootstrapped()` (Alpha 060) for every reachable state.
It formally compares five remediation options and adopts Option D:
delete `identityVersion()`/`#identityVersion`, keeping `isBootstrapped()`
as the sole Bootstrap-state reader — rejecting a rename (Option C, which
would fix the name but not the duplication) and a genuine content-based
revision (Option E, incompatible with the already-ratified Alpha
061/062 architecture without reopening both). It separately confirms
`currentIdentity()`/`findIdentity()` are NOT duplicates (cleanly
separated by type, arity, and source), and surfaces a real, previously
unexamined finding — `describeIdentity()` can bypass the Bootstrap
state-tracking layer while still writing the Registry — explicitly
deferred to its own future review rather than folded into this Stage's
narrower Decision. Alpha 066 is recommended to implement exactly one
change: remove `identityVersion()`/`#identityVersion`.

## 13. See also

- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
- `docs/secure_runtime_alpha_060_identity_bootstrap_status.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md`
- `docs/secure_runtime_alpha_063_runtime_identity_descriptor_cache.md`
- `docs/secure_runtime_alpha_064_identity_change_detection.md`
