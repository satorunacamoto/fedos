# Secure Runtime Alpha 067 — Identity Reader Boundary Review

**Status: this is a REVIEW / DESIGN DECISION document only. No
implementation file changes anywhere in this repository. It records a
decision that a future, separately-reviewed Stage (Alpha 068, per this
document's own §9 recommendation) may act on.**

## 1. Why now

Alpha 065 §7 examined `bootstrapIdentity()` vs. `describeIdentity()`
and surfaced a finding it explicitly deferred rather than resolved: a
"genuine Bootstrap-lifecycle bypass" reachable by calling
`describeIdentity()` directly. Alpha 066 implemented Alpha 065's own
NARROWER Decision (removing `identityVersion()`) and explicitly left
the bypass finding untouched, naming it as its own future review. This
Stage is that review — the Identity Runtime now has exactly two
Descriptor-producing paths (`bootstrapIdentity()`/`describeIdentity()`)
and three read-only accessors (`currentIdentity()`/`findIdentity()`/
`listIdentities()`); this Stage determines, from the actual code and
nothing else, whether that boundary is sound, and what (if anything)
should change about it.

## 2. Current state, recorded precisely

`src/runtime/fedos_runtime_identity.ts` (unchanged since Alpha 066):

```ts
async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
  return this.#service.describeIdentity();
}

findIdentity(id: string): FedosIdentityRecord | null {
  return this.#resolver.findIdentity(id);
}

listIdentities(): readonly FedosIdentityRecord[] {
  return this.#resolver.listIdentities();
}

async bootstrapIdentity(): Promise<void> {
  if (this.#bootstrapped) {
    return;
  }
  this.#descriptor = await this.#service.describeIdentity();
  this.#bootstrapped = true;
}

isBootstrapped(): boolean {
  return this.#bootstrapped;
}

currentIdentity(): FedosIdentityDescriptor | null {
  return this.#descriptor;
}
```

`src/identity/fedos_identity_service.ts`'s own `describeIdentity()`
(Alpha 031/042/047, unchanged since Alpha 047), the SAME method both
`FedosRuntimeIdentity.describeIdentity()` and
`FedosRuntimeIdentity.bootstrapIdentity()` call:

```ts
async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
  const descriptor = await this.#provider.describeIdentity();
  if (descriptor === null) {
    return null;
  }
  const record: FedosIdentityRecord = {
    id: descriptor.id,
    provider: descriptor.provider,
    publicIdentifier: descriptor.publicIdentifier,
    displayName: descriptor.displayName,
    avatar: descriptor.avatar,
  };
  this.#registry.register(record);
  return descriptor;
}
```

## 3. bootstrapIdentity()/describeIdentity(), broken down along all four mandated dimensions

| Dimension | `bootstrapIdentity()` | `describeIdentity()` |
|---|---|---|
| **Provider呼び出し** | YES — via `this.#service.describeIdentity()` → `this.#provider.describeIdentity()`, exactly once per call that reaches it (guarded — see §4) | YES — via the IDENTICAL `this.#service.describeIdentity()` → `this.#provider.describeIdentity()` call, EVERY single invocation, with no guard of any kind |
| **Registry更新** | YES, conditionally — `FedosIdentityService.describeIdentity()`'s own `registry.register(record)` fires whenever the resolved Descriptor is non-`null`, reached through `bootstrapIdentity()`'s own call | YES, conditionally — the IDENTICAL `registry.register(record)` call, through the SAME Service method, on the SAME non-`null` condition — there is no code-level difference in this effect between the two callers |
| **Descriptor Cache更新 (`#descriptor`)** | YES — `this.#descriptor = await this.#service.describeIdentity();` is `bootstrapIdentity()`'s own second statement | **NO** — `describeIdentity()`'s own body is `return this.#service.describeIdentity();`; the resolved value is returned to the CALLER, never assigned to `this.#descriptor` |
| **Bootstrapped更新 (`#bootstrapped`)** | YES — `this.#bootstrapped = true;` is `bootstrapIdentity()`'s own third and final statement | **NO** — `#bootstrapped` does not appear anywhere in `describeIdentity()`'s own body |

## 4. Bootstrap迂回可否 — determined from the code, not assumed

**Confirmed: `describeIdentity()` is a genuine Bootstrap-lifecycle
bypass.** This is not inferred from naming or intent — it follows
directly from §3's own table, cross-checked against two additional
code facts:

- **No idempotency guard exists on `describeIdentity()`.**
  `bootstrapIdentity()`'s own FIRST statement is `if
  (this.#bootstrapped) { return; }` (Alpha 061) — `describeIdentity()`
  has no equivalent statement of any kind. Every call to
  `describeIdentity()`, called any number of times, re-invokes the
  Provider AND re-registers into the Registry on every single call
  when the Descriptor is non-`null` — there is no "already done" state
  it ever checks.
- **`bootstrapIdentity()` itself does NOT call `this.describeIdentity()`.**
  Its own body calls `this.#service.describeIdentity()` DIRECTLY — the
  SAME underlying Service method `describeIdentity()` also calls, but
  through a SEPARATE, INDEPENDENT code path. `describeIdentity()` (the
  public `FedosRuntimeIdentity` method) has ZERO internal callers
  anywhere in this file — it exists solely as an externally-reachable
  pass-through that happens to share its own underlying Service call
  with `bootstrapIdentity()`, not because `bootstrapIdentity()` routes
  through it.

The practical consequence, stated precisely: a caller that invokes
`identity.describeIdentity()` instead of `identity.bootstrapIdentity()`
can cause a REAL `registry.register()` write — observable via
`findIdentity()`/`listIdentities()` on the SAME instance — while
`isBootstrapped()` stays `false` and `currentIdentity()` stays `null`,
indefinitely, no matter how many times `describeIdentity()` is called.
This is a reachable, internally inconsistent state.

**This risk is currently DORMANT, not exploited.** A fresh repository
search performed for this Stage confirms `create_runtime.ts`'s own
`createRuntime()` never calls `describeIdentity()` or
`bootstrapIdentity()` on the `FedosRuntimeIdentity` it constructs — the
function's own body is `const runtimeIdentity: FedosRuntimeIdentity =
new FedosRuntimeIdentity(); void runtimeIdentity;`, unchanged since
Alpha 057. `src/worker.ts` contains no reference to
`FedosRuntimeIdentity`/`describeIdentity` at all. NOTHING in
`src/` calls `describeIdentity()` on a `FedosRuntimeIdentity` instance
today — the only 31 call sites across this repository calling
`.describeIdentity()` on ANY object are in `test/*.test.ts` files,
deliberately exercising the method's own documented pass-through
behavior. The bypass is real and reachable, but no production code
path currently triggers it.

## 5. The five candidate options

- **Option A** — status quo: `describeIdentity()` stays public,
  unguarded, unchanged.
- **Option B** — delete `describeIdentity()` from `FedosRuntimeIdentity`
  entirely.
- **Option C** — make `describeIdentity()` a true private (`#`) method,
  unreachable from outside the class, with `bootstrapIdentity()`
  continuing to call `this.#service.describeIdentity()` directly as it
  already does (the private method would have ZERO internal callers).
- **Option D** — make `describeIdentity()` a true private (`#`) method
  AND rewire `bootstrapIdentity()` to call it (`this.#describeIdentity()`)
  instead of reaching `this.#service.describeIdentity()` directly —
  consolidating the class down to exactly ONE internal code path that
  reaches the Service.
- **Option E** — extract a separate Reader Service (e.g. a new
  `FedosIdentityReader` class) dedicated to on-demand, Bootstrap-independent
  Provider reads, distinct from `FedosRuntimeIdentity`.

## 6. Comparison

| Criterion | A: status quo | B: delete | C: private, unused internally | D: private, becomes bootstrapIdentity()'s own call site | E: separate Reader Service |
|---|---|---|---|---|---|
| Bootstrap迂回の解消 (Resolves the bypass) | **No** — the bypass (§4) remains fully reachable from any external caller | **Yes** — nothing external can reach the Service's own `describeIdentity()` through this class anymore except via `bootstrapIdentity()` | **Yes** — external reachability is removed, identical effect to B on the bypass itself | **Yes**, identically to B/C | **Yes** for THIS class, but only by relocating the identical risk — the new Reader Service would need its OWN Bootstrap-awareness design, or the bypass simply moves house |
| 内部呼び出し経路の重複解消 (Resolves the internal two-path duplication) | No — `bootstrapIdentity()` and `describeIdentity()` remain two INDEPENDENT call sites reaching `this.#service.describeIdentity()` (§4) | N/A — the duplication disappears because one of the two paths is deleted, not consolidated | **No** — `describeIdentity()` becomes a private method with ZERO callers (dead code); `bootstrapIdentity()` still reaches `this.#service.describeIdentity()` directly, unchanged; the two-path duplication persists, just with one path now unreachable from outside AND unreachable from inside | **Yes** — `bootstrapIdentity()` is rewired to call the (now private) `describeIdentity()`, leaving exactly ONE code path in this file that ever reaches `this.#service.describeIdentity()` | Depends on the new Service's own design — not determined by this Option alone |
| Dead code / YAGNI risk | None — nothing removed | None — nothing left over | **Real** — a private method with no caller of any kind is exactly the kind of unused machinery this repository's own established discipline (Alpha 059 §6, Alpha 065's own Decision) has consistently avoided | None — the private method gets a real, permanent caller (`bootstrapIdentity()`) the moment it is created | Depends on the new Service's own eventual caller — speculative until one exists |
| 既存テストへの影響範囲 (Ripple size) | **Zero** — nothing changes | **Largest** — 31 test files across this repository call `.describeIdentity()` on some object; every direct-call assertion against `FedosRuntimeIdentity.describeIdentity()` specifically would need updating or removing | Same order of magnitude as B — every EXTERNAL `identity.describeIdentity()` call in a test breaks identically, since visibility (not existence) is what a test can observe from outside the class | Same order of magnitude as B/C for the EXTERNAL-call tests; ADDITIONALLY requires re-verifying `bootstrapIdentity()`'s own body text (already ripple-sensitive per Alpha 060/061/063/064/066's own history) | Same order of magnitude as B/C for `FedosRuntimeIdentity`'s own tests, PLUS a new test suite for the new Reader Service |
| Runtime純粋性 (matches this class's own established minimal-surface discipline) | Preserved, but preserves the ONE known duplication/risk pair `bootstrapIdentity()`/`describeIdentity()` still represent | Preserved, simplest surface of all — one fewer method | Preserved externally, but WORSE internally — a private method that exists solely to NOT be called is arguably less pure than either removing it (B) or giving it a real purpose (D) | Preserved AND improved — consolidates two call sites into one, the cleanest internal shape of any Option | New file, new class — the LARGEST surface-area increase of any Option, for a capability (Bootstrap-independent reads) no caller has asked for (Alpha 059 §2, reconfirmed unaffected through Alpha 066) |
| 将来Public公開適合性 (Fitness for eventual Desktop/Public exposure) | Would carry the bypass INTO any future Public API design, per Alpha 065 §8's own "Desktop must NOT call `describeIdentity()`" guidance — a landmine for whichever future Stage writes that exposure layer | Cleanest — nothing to accidentally expose | Clean externally, but the private method's own EXISTENCE (unused) invites a future maintainer to ask "why is this here," a question B/D don't raise | Cleanest of the non-deletion Options — the private method has an obvious, self-documenting purpose (`bootstrapIdentity()`'s own internal implementation detail) | Depends entirely on a design that does not exist yet |
| Provider呼び出し回数への影響 (Changes how often the Provider is actually called by `bootstrapIdentity()`) | None | None | None | **None** — `bootstrapIdentity()`'s own guard (Alpha 061) still fires before either the direct call OR the routed-through-private-method call; the SAME idempotency guarantee holds regardless of which internal path is used, since the guard sits BEFORE either | None determinable without a new design |
| Registry整合性 (Consistency between Registry contents and `isBootstrapped()`/`currentIdentity()`) | **Unresolved** — the exact inconsistency §4 describes remains reachable | Resolved — no external path can populate the Registry without also updating `#bootstrapped`/`#descriptor` through `bootstrapIdentity()` | Resolved, identically to B | Resolved, identically to B/C | Resolved for `FedosRuntimeIdentity` itself, but the new Reader Service would need its OWN Registry-consistency story, undetermined here |
| 責務明確性 (Responsibility clarity) | Two methods answer "get me the current identity" with materially different accounting behavior, undocumented as a distinction to an external reader | One method (`bootstrapIdentity()`) owns identity acquisition entirely | Same as B externally; internally, an unused private method with unclear purpose slightly WORSENS clarity rather than improving it | **Clearest** — exactly one code path reaches the Service, and that path's own name (a private `describeIdentity()` called only by `bootstrapIdentity()`) documents its own purpose by construction | Would split responsibility across two classes, a larger design question this Stage's own mandate does not authorize deciding |
| テスト容易性 (Testability going forward) | Unaffected — already covered by 31 files' worth of existing tests | Simpler — no external `describeIdentity()` behavior to maintain tests for | Same simplification as B for EXTERNAL tests, but an unused private method cannot be tested meaningfully at all (nothing calls it) | Same external simplification as B/C; the private method remains INDIRECTLY testable through `bootstrapIdentity()`'s own existing, extensive test coverage | Would need an entirely new test suite for the new class, on top of updating `FedosRuntimeIdentity`'s own tests |
| Idempotency (Alpha 061) 整合性 | Unaffected — the guard's own behavior is unchanged by any Option here, since none of these Options touch the guard itself | Preserved | Preserved | Preserved — moving the call site inside a private method changes NOTHING about when the guard fires, since the guard is `bootstrapIdentity()`'s own first statement, evaluated before EITHER call shape | Preserved for `FedosRuntimeIdentity`; undetermined for the new Service |
| Alpha 062 短命オブジェクト方針との整合 (Consistency with the "short-lived object, no reset" policy) | Unaffected by any Option — none of the five options touches `#bootstrapped`/`#descriptor`'s own reset semantics | Unaffected | Unaffected | Unaffected | Unaffected |
| 段階的移行のしやすさ (Ease of staged rollout) | N/A — no migration needed | A single, all-at-once removal — matches Alpha 066's own precedent, but at roughly 3-4x the file count | Same rollout shape as B — visibility change is a single commit, same ripple size | Same rollout shape as B/C, with one additional internal rewrite (`bootstrapIdentity()`'s own body) that is itself trivially small and low-risk | Requires designing and shipping a new class BEFORE any migration can even begin — the slowest path to actually resolving the bypass |
| コードベース既存規約との整合 (Consistency with this arc's own established precedent) | Contradicts the precedent Alpha 065/066 just set — reviewing a confirmed structural finding and then changing nothing | Consistent with Alpha 066's own precedent (delete a confirmed-redundant/risky surface), but at a different scale | Weakly consistent — narrows exposure like Alpha 066, but leaves genuinely dead code behind, which no prior Stage in this arc has ever done deliberately | **Most consistent** — narrows exposure exactly like Alpha 066 AND additionally follows this repository's own "reach one link deeper, keep it minimal" precedent (named explicitly in Alpha 059 §6, applied repeatedly across the `fedos_*.ts` chain) by consolidating to one call path | Introduces a NEW architectural layer this arc has never needed — the kind of premature abstraction Alpha 059 §6/Alpha 062 §6/Alpha 065 §6 have each, independently, rejected for this exact class |
| 将来Provider (Fitness once a real, non-Null Provider exists) | Worsens with a real Provider — an unguarded `describeIdentity()` reachable externally would mean a real network/Storage-adjacent read is repeatable, unthrottled, and Registry-mutating on every external call, exactly the per-call cost profile Alpha 061 was built to prevent for `bootstrapIdentity()` | Removes the exposure entirely — a real Provider's own cost is paid ONLY through the guarded `bootstrapIdentity()` path | Same removal of exposure as B | Same removal of exposure as B/C | Depends on a design that does not exist; cannot be assessed |
| 何を意味するか (What each surviving method actually promises, once resolved) | Ambiguous — two methods, unclear which is authoritative | `bootstrapIdentity()` alone promises "acquire identity, exactly once, accounted for" | Same promise as B/D from the OUTSIDE; internally ambiguous (why keep dead code) | **Unambiguous** — `bootstrapIdentity()` is the ONLY way to reach the Provider from outside this class, and its own now-private helper exists for no reason other than serving it | Undetermined — depends on the new class's own eventual contract |

## 7. Desktop視点 — what Desktop should call, and what it must not

- **Desktopが呼ぶべきReader:** `bootstrapIdentity()` (Alpha 059's own
  designated Authority call, unchanged), `isBootstrapped()`, and
  `currentIdentity()` — the three methods that together give Desktop a
  complete, internally-consistent view: "did acquisition happen, and
  what did it produce." `findIdentity(id)`/`listIdentities()` are also
  safe for Desktop to call for Registry lookup by key — both are pure,
  side-effect-free reads through `FedosIdentityResolver` (Alpha 043),
  confirmed to never call `registry.register()`/`registry.remove()`
  (Alpha 043's own "HARD GUARDRAILS").
- **Desktopが呼んではいけないReader:** `describeIdentity()` — per §4's
  own confirmed finding, calling it directly on the SAME instance
  Desktop uses for `bootstrapIdentity()` can silently populate the
  Registry while leaving `isBootstrapped()`/`currentIdentity()` stale,
  AND does so on EVERY call, with no idempotency protection of any
  kind, unlike `bootstrapIdentity()`. This guidance is stated
  explicitly here because, as of THIS Stage, `describeIdentity()`
  remains fully public and callable — Option D's own adoption (§8)
  does not take effect until a future Stage implements it; until then,
  this guidance is the ONLY protection against the confirmed bypass.

## 8. Public Runtime公開前 — what to keep, remove, or privatize

- **残す内部API (keep, as public methods on `FedosRuntimeIdentity`):**
  `bootstrapIdentity()`, `isBootstrapped()`, `currentIdentity()`,
  `findIdentity()`, `listIdentities()` — five methods, each with a
  distinct, non-overlapping responsibility already confirmed by this
  arc's own prior reviews (Alpha 065 §7: `currentIdentity()`/
  `findIdentity()` are NOT duplicates; this Stage's own §4: neither
  duplicates `bootstrapIdentity()`, which alone performs accounting).
- **削除候補:** none identified by this Stage. `describeIdentity()` is
  NOT a deletion candidate — §6's own comparison shows Option D
  (privatize AND consolidate) preserves 100% of its underlying
  capability for internal use, unlike Option B, while still resolving
  the external bypass.
- **private候補:** `describeIdentity()` — per §9's own adopted Decision
  (Option D), the ONLY method this Stage identifies as a genuine
  visibility-change candidate, to be resolved by making it a true `#`
  private method AND rewiring `bootstrapIdentity()`'s own internal call
  to use it, in place of its current direct
  `this.#service.describeIdentity()` reach.

## 9. Decision

**Option D is adopted: `describeIdentity()` is to become a true
private (`#`) method, with `bootstrapIdentity()` rewired to call it
instead of reaching `this.#service.describeIdentity()` directly.**
Option A (status quo) is rejected — it is the only Option that leaves
§4's own confirmed bypass fully reachable, and directly contradicts the
Desktop guidance this Stage's own §7 has to state as an explicit,
manual precaution in its absence. Option B (delete) is rejected because
it discards a real, currently-useful capability (a raw, unguarded
Provider read, which Option D preserves for internal use with zero
loss) for no additional benefit over D on the one axis that matters
most — bypass resolution — while being no cheaper to ripple than D
(§6's own "ripple size" row: same order of magnitude for both). Option
C (privatize without rewiring `bootstrapIdentity()`) is rejected on a
concrete YAGNI defect: it would leave a private method with ZERO
callers of any kind, dead code this repository's own established
discipline has never deliberately produced. Option E (separate Reader
Service) is rejected as premature architecture — it introduces a new
class for a capability (Bootstrap-independent reads) no caller has
ever asked for, repeating the exact reasoning this arc has already
applied against comparable proposals (Alpha 059 §6 against an internal
Bootstrap Manager; Alpha 062 §6 against a Reset API; Alpha 065 §6
against a real content-based revision).

## 10. What this Stage does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts`.
- Does **not** modify `src/runtime/create_runtime.ts`.
- Does **not** modify `src/runtime/types.ts` or any `AppRuntime` field.
- Does **not** modify any `src/identity/*` file (Provider, Registry,
  Resolver, Service, Descriptor, or Record).
- Does **not** modify `src/worker.ts`.
- Does **not** modify any Storage file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** add any Public Runtime API.
- Does **not** implement Desktop, Nostr, Relay, or Authentication
  behavior of any kind.
- Does **not** make `describeIdentity()` private, and does **not**
  rewire `bootstrapIdentity()`'s own internal call — that remains,
  per §11, a future Stage's own separately-reviewed implementation.

## 11. Alpha 068 recommendation — ONE change only

**Alpha 068 should implement §9's own Decision directly: make
`describeIdentity()` a true private (`#describeIdentity()`) method on
`FedosRuntimeIdentity`, and rewire `bootstrapIdentity()`'s own second
statement to call `this.#describeIdentity()` instead of
`this.#service.describeIdentity()` — and nothing else.** This is
explicitly flagged as the LARGEST ripple this arc has produced to
date: `grep`-ing this repository for `.describeIdentity()` confirms 31
test files reference the method, spanning Alpha 029 through Alpha 066
— an order of magnitude larger than Alpha 066's own nine-file ripple
for `identityVersion()`'s removal. Alpha 068 should budget for this
explicitly: most of those 31 files exercise
`FedosIdentityProvider.describeIdentity()`/`FedosIdentityService.describeIdentity()`
directly (untouched by this Decision, since neither is modified) —
only the SUBSET that specifically calls
`FedosRuntimeIdentity.describeIdentity()` as an external consumer, or
asserts its continued PUBLIC presence/behavior on that class, actually
needs updating. Alpha 068's own first task should be enumerating that
exact subset before making any change, exactly as this Stage enumerated
the dimension-by-dimension behavior (§3) before recommending anything.

## 12. Summary

This Stage reviews the Identity Reader Boundary — the two
Descriptor-producing paths (`bootstrapIdentity()`/`describeIdentity()`)
and three read-only accessors on `FedosRuntimeIdentity` — entirely from
the actual source, confirming via a dimension-by-dimension breakdown
(§3) that `describeIdentity()` performs the IDENTICAL Provider call and
Registry write as `bootstrapIdentity()` but updates NEITHER
`#descriptor` nor `#bootstrapped`, and carries NO idempotency guard of
its own. This is confirmed, not assumed, to be a genuine Bootstrap-lifecycle
bypass (§4) — currently dormant, since no production code path in this
repository calls `describeIdentity()` on a `FedosRuntimeIdentity`
instance today, but fully reachable the moment any future caller does.
It formally compares five remediation options across fifteen mandated
criteria and adopts Option D — make `describeIdentity()` private and
have `bootstrapIdentity()` call it internally, consolidating the class
down to exactly one code path that reaches the Identity Service —
rejecting status quo (leaves the bypass open), deletion (discards a
useful capability for no added benefit over D), plain privatization
without rewiring (produces dead code), and a separate Reader Service
(premature architecture). `currentIdentity()`/`findIdentity()`/
`listIdentities()` are confirmed to have no overlapping responsibility
with either Descriptor-producing path. Alpha 068 is recommended to
implement Option D directly, with an explicit warning that its own
ripple (31 referencing test files) is the largest this arc has
produced.

## 13. See also

- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md`
- `docs/secure_runtime_alpha_065_identity_runtime_internal_contract_review.md`
- `docs/secure_runtime_alpha_066_identity_version_removal.md`
