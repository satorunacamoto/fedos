# Secure Runtime Alpha 059 — Identity Bootstrap Authority Review

**Status: this is a REVIEW / DESIGN DECISION document only. No
implementation file changes anywhere in this repository. It records a
decision that a future, separately-reviewed Stage (Alpha 060, per this
document's own §9 recommendation) may act on.**

## 1. Why now

Alpha 058 added `FedosRuntimeIdentity.bootstrapIdentity(): Promise<void>`
— a real, callable Bootstrap boundary, deliberately wired to nothing.
Today it is reachable only by directly constructing a
`FedosRuntimeIdentity`, which only `create_runtime.ts` does in this
entire repository, holding it as a private, function-scoped constant.
No caller anywhere invokes `bootstrapIdentity()`. This Stage decides
WHO should eventually be that caller — the Bootstrap **Authority** —
without implementing anything. That decision belongs on its own
record before any wiring Stage picks it up, exactly as Alpha 056
reviewed the Bootstrap call's own semantics before Alpha 057 acted on
that Decision.

## 2. Current state, recorded precisely

```
createRuntime()
  → constructs FedosRuntimeIdentity
  → returns AppRuntime (no identity field)
  → END (bootstrapIdentity() never called)

FedosRuntimeIdentity.bootstrapIdentity()
  → exists, fully implemented (Alpha 058)
  → called by: NOTHING, anywhere in this repository
```

Confirmed via a fresh repository search performed for this Stage:

- `create_runtime.ts` does not reference `bootstrapIdentity` anywhere
  in its own source.
- `src/worker.ts` does not reference `bootstrapIdentity`,
  `FedosRuntimeIdentity`, or `fedos_runtime_identity.ts` anywhere.
- `AppRuntime` (`src/runtime/types.ts`) has no `identity`,
  `runtimeIdentity`, or `bootstrapIdentity` field.
- `src/worker.ts`'s own `fetch()` handler calls `createRuntime(env)`
  once per incoming HTTP request (line 1244) — the SAME per-request
  construction Alpha 056 §3 already found and Alpha 057 already
  addressed for the (now-removed) automatic call.
- No CLI entry point exists anywhere in this repository — no `bin/`
  directory, no `src/cli/*`, and `package.json` has no `"bin"` field.
- No Desktop application shell exists anywhere in this repository
  either — no Electron/Tauri dependency, no `src/desktop/*` directory.
  "Desktop" appears only as declared future positioning:
  `docs/fedos_runtime_positioning.md` titles this project
  "Secure Runtime Platform, Desktop-first," and
  `docs/runtime_execution_backend.md` names "Native Desktop" as a
  "Future, unimplemented" execution candidate.
- `package.json` declares no `"main"`, `"bin"`, or `"exports"` field —
  consistent with a Worker-only deployment shape today, with no
  library/CLI consumption surface declared.
- No `Manager`/`Coordinator`-named class exists anywhere in
  `src/runtime/*` — this codebase's own naming convention favors plain
  nouns (`FedosRuntimeIdentity`, `RuntimeCryptoProviderRegistry`), not
  a coordination-layer pattern.
- A real, protocol-agnostic `src/federation/*` directory already
  exists (`types.ts`, `noop_federation.ts`, `nostr_mapping.ts`,
  `publish_intent.ts`, `outbound_queue.ts`), with a `FederationProvider`
  interface whose only concrete kinds today are explicit placeholders
  (`"nostr_placeholder"`, `"bluesky_placeholder"`,
  `"threads_placeholder"`, `"rss_placeholder"`) — "ActivityPub" itself
  appears only once in this repository, in `README.md` prose, never in
  code.

## 3. The five candidate Authorities

- **Option A** — Desktop Application calls `bootstrapIdentity()` once
  at its own startup.
- **Option B** — Worker calls `bootstrapIdentity()` on every incoming
  request.
- **Option C** — a CLI calls `bootstrapIdentity()` once at its own
  startup.
- **Option D** — expose `bootstrapIdentity()` on the Public Runtime
  API (`AppRuntime`), letting any consumer call it.
- **Option E** — add a new internal Bootstrap Manager, in a future
  Stage, that decides when to call it.

## 4. Comparison

| Criterion | A: Desktop | B: Worker (per-request) | C: CLI | D: Public Runtime API | E: Internal Bootstrap Manager |
|---|---|---|---|---|---|
| 責務 (Responsibility) | The long-running process that owns "when does identity matter" for its own users — matches Alpha 058 §8's own framing exactly | Diffuses responsibility across every request handler; no single owner decides timing, the Worker runtime does by default | Symmetric to Desktop: the CLI process itself owns its own one-shot lifecycle | Diffuses responsibility to WHOEVER holds an `AppRuntime` — Worker, a future Desktop shell, or a test, with no way to restrict who | Introduces a NEW responsible party that does not exist today; its own responsibility (dedupe? scheduling? retry?) is undefined until designed |
| 同期契約 (createRuntime() sync contract) | Zero effect — `createRuntime()` remains untouched; the call happens entirely outside it, in Desktop's own init code | Zero effect on `createRuntime()` itself, but reintroduces per-request async Identity work immediately after it returns — the exact shape Alpha 057 removed | Zero effect — same as Desktop | Zero effect on `createRuntime()` if implemented as a lazy field (matching `runtimeCapabilities`/`randomBytes`'s own existing pattern) — but this Stage's own mandate forbids any Public Runtime API addition regardless | Depends entirely on an undesigned Manager's own shape — cannot be assessed today |
| Runtime純粋性 (Runtime purity) | Fully preserved — `createRuntime()` stays exactly Construct Only (Alpha 057) | Fully preserved technically, but purity at the CALL SITE is defeated: Worker's own request path regains the identical async-Identity-per-construction shape this arc spent three Stages removing | Fully preserved, same as Desktop | Preserved for `createRuntime()` itself, but purity of INTENT is weaker — exposing the method on `AppRuntime` invites exactly the Worker-route misuse this table's own "Worker" row already flags as bad | Unknown — a Manager could preserve or violate purity depending on a design that does not exist |
| Worker | N/A — different deployment target entirely | Directly evaluated below (confirmed bad fit) | N/A | Worker COULD call it if exposed — Option D does not prevent this, it only fails to forbid it | A Manager could theoretically gate Worker out, but nothing requires it to, and no such Manager exists |
| Desktop | Directly evaluated below (best fit among real candidates) | N/A | N/A | Desktop could call it too, exactly as it could under Option A, with strictly MORE exposure surface and no additional benefit | Same as Worker's own row: undetermined until designed |
| CLI | N/A | N/A | Directly evaluated below (structurally equivalent to Desktop, but no CLI exists in this repository today) | CLI could call it too, once one exists, with the same exposure caveat as above | Undetermined |
| テスト (Testability) | Simple — a Desktop init function calling `bootstrapIdentity()` once is trivially unit-testable in isolation, exactly as Alpha 058's own 55 tests already exercise the method directly | Every request-path test would need to account for Identity Bootstrap latency/failure, coupling unrelated route tests to Identity concerns | Simple, same as Desktop | Testable via the same lazy-field pattern this repository already uses for `runtimeCapabilities()`/`randomBytes()`, but a wider Public API surface is itself more to test and maintain long-term | Cannot be tested — the Manager does not exist |
| 重複Bootstrap (Duplicate Bootstrap) | Low — a long-running Desktop process calls this once per its own lifetime, not once per operation | **Confirmed HIGH** — `src/worker.ts` calls `createRuntime(env)` once per HTTP request (line 1244), so any per-request `bootstrapIdentity()` call repeats the identical work every single request, the EXACT risk Alpha 056 §3/§4 already identified for the removed Alpha 055 call | Low, same as Desktop — a CLI invocation is naturally single-shot per process | Risk reappears WHEREVER a caller chooses to invoke it repeatedly — Option D does not prevent misuse, it only permits (or forbids) exposure | Could theoretically add real dedupe/only-once tracking if built — but no caller exists yet to need deduping, making this speculative machinery today |
| Registry一貫性 (Registry consistency) | Strong — one long-lived process holds one `FedosRuntimeIdentity` (and its internal Registry) across its own lifetime, so one Bootstrap call keeps that Registry meaningfully populated for as long as the process runs | Weak — since `createRuntime()` constructs a FRESH `FedosRuntimeIdentity` (and therefore a fresh, empty Registry) on every single request regardless of Authority, ANY per-request Bootstrap call registers into a Registry that is discarded the instant that request's response is sent | Strong, same as Desktop | Depends entirely on whichever process holds the `AppRuntime` — inherits Desktop's strength or Worker's weakness depending on caller, with no way to guarantee which | Undetermined |
| Protocol非依存性 (Protocol independence) | Unaffected by any Option — `FedosRuntimeIdentity`'s own Provider/Source abstraction (Alpha 032/048/049) already keeps this decision protocol-neutral regardless of WHO calls `bootstrapIdentity()` | Unaffected | Unaffected | Unaffected | Unaffected |
| Storage | No Option here reads or writes Storage — `bootstrapIdentity()` itself performs no Storage access (Alpha 058 §6), independent of who calls it | Same | Same | Same | Same |
| Network | No Option here opens a Network connection today — the current Null Source guarantees this regardless of caller; a FUTURE real Source's own network cost is what differs by CALL FREQUENCY, not by whether a connection happens at all | Same zero cost today, but the WORST future cost profile — per-request network calls, confirmed structurally by Worker's own per-request `createRuntime()` — once a real Source exists | Same low future cost as Desktop — single call per process lifetime | Future cost depends on caller choice, inheriting whichever pattern (Desktop-like or Worker-like) the exposing consumer follows | Undetermined until designed |
| Fail Closed | The calling Desktop process holds `bootstrapIdentity()`'s own real `Promise` and can choose a safe branch on rejection — Alpha 058 §7's own design intent exactly | A per-request rejection would need explicit handling in every response path to avoid leaking an unrelated failure into an HTTP response | Same as Desktop | Same as Desktop IF the exposing caller handles it — but exposure itself does not enforce that any caller actually does | Undetermined |
| Observability | Good — a real caller sees the real rejection directly, matching Alpha 058's own explicit design (no swallowed `.catch(() => {})`) | Harder — failures must be surfaced without corrupting the unrelated HTTP response the request handler is actually serving | Good, same as Desktop | Good in principle, same caveat as Fail Closed — depends on the exposing caller's own discipline, not enforced by the API surface itself | Undetermined |
| 将来Nostr (Future Nostr Source) | Good fit — a real Nostr profile fetch, run once at Desktop startup, matches how a desktop Nostr client already conventionally establishes its own identity at launch | Poor fit — a real per-request Nostr relay round-trip would add real, repeated latency and relay load to every HTTP request this Worker serves | Good fit, same as Desktop | Inherits whichever caller's own fit — good if Desktop-shaped, poor if Worker-shaped | Undetermined |
| 将来ActivityPub (Future ActivityPub) | Unaffected structurally by this decision — `src/federation/*`'s own `FederationProvider` remains a separate, still-placeholder-only abstraction untouched by any Identity Bootstrap Authority choice | Unaffected, same reasoning | Unaffected, same reasoning | Unaffected, same reasoning | Unaffected, same reasoning |

## 5. Answers to the confirmation questions

**Is `bootstrapIdentity()` still not called from `createRuntime()`?**
Confirmed — `create_runtime.ts`'s own source contains no reference to
`bootstrapIdentity` anywhere; `createRuntime()` remains Construct Only,
exactly as Alpha 057 left it.

**Is `bootstrapIdentity()` still not called from Worker?** Confirmed —
`src/worker.ts`'s own source contains no reference to
`bootstrapIdentity`, `FedosRuntimeIdentity`, or
`fedos_runtime_identity.ts` anywhere.

**Is `bootstrapIdentity()` still unexposed on the Public Runtime API?**
Confirmed — `AppRuntime` (`src/runtime/types.ts`) has no `identity`,
`runtimeIdentity`, or `bootstrapIdentity` field; this Stage adds none.

**Is Desktop the ONLY candidate?** No — Option C (CLI) is
architecturally identical to Option A in every row of §4 except that
no CLI exists in this repository today, while "Desktop-first" is
already this repository's own stated positioning
(`docs/fedos_runtime_positioning.md`) and Alpha 058 §8 already named
Desktop specifically. Desktop is the RECOMMENDED primary Authority
because it is the target this repository already commits to in its
own docs, not because CLI is structurally inferior — a future CLI
Stage could adopt the identical reasoning this Stage applies to
Desktop, should this repository ever grow one.

## 6. Decision

**Desktop Application startup (Option A) is adopted as the designated
Identity Bootstrap Authority.** Worker (Option B) is explicitly
rejected — it is the one candidate with a CONCRETE, PROVEN structural
flaw in this repository today (per-request `createRuntime()`
construction, confirmed at `src/worker.ts:1244`, turning any per-request
Bootstrap call into guaranteed duplicate work against a Registry that
is discarded before the next request even begins). Public Runtime API
exposure (Option D) is rejected for this Stage: it does not prevent
the Worker misuse identified above — it only fails to forbid it — and
this Stage's own mandate explicitly forbids any Public Runtime API
addition regardless. An internal Bootstrap Manager (Option E) is
rejected as premature: no caller needing coordination, dedupe, or
scheduling exists yet, no naming precedent for such a class exists
anywhere in `src/runtime/*`, and building coordination machinery ahead
of a single real caller would violate this repository's own
established "reach one link deeper, keep it minimal" discipline (the
same discipline `reachCryptoLoaderFacade()`/`createCryptoLoaderFacade()`
and every `fedos_*.ts` `PlanningOnly` layer has followed throughout
this repository's history). CLI (Option C) is not rejected on its own
merits — it is structurally equivalent to Desktop — but is not adopted
as the PRIMARY Authority because no CLI exists in this repository
today, while Desktop is this repository's own already-declared
positioning.

## 7. Worker evaluation

Worker fails this decision for one concrete, already-measured reason:
`src/worker.ts`'s own `fetch()` handler constructs a fresh
`FedosRuntimeIdentity` (via a fresh `createRuntime(env)` call) on every
single incoming HTTP request, and that instance — Registry included —
is discarded the moment that request's response is returned. Any
`bootstrapIdentity()` call reachable from inside that per-request path
repeats the identical Bootstrap work every request, for a Registry that
never survives past that one request, with no future benefit
accumulating across requests. This is not a hypothetical risk — it is
the same structural fact Alpha 056 §3 found and Alpha 057 already fixed
once for the (now-removed) automatic call; wiring `bootstrapIdentity()`
into Worker's own request path would reintroduce it in a new place.

## 8. Desktop / CLI evaluation

Desktop and CLI share the same underlying shape: a single, long-running
(Desktop) or single-execution (CLI) process that constructs exactly one
`AppRuntime` (and, internally, exactly one `FedosRuntimeIdentity`) for
its own entire lifetime, giving one Bootstrap call one coherent Registry
to populate that stays meaningfully populated for as long as that
process runs. Neither exists in this repository today — no
`src/desktop/*` directory, no Electron/Tauri dependency, no `src/cli/*`,
no `"bin"` field in `package.json`. Desktop is preferred as the
DESIGNATED Authority specifically because this repository's own
existing docs (`docs/fedos_runtime_positioning.md`) already commit to a
"Desktop-first" target, and Alpha 058 §8 already named Desktop by name
— not because CLI is architecturally worse. Should a CLI entry point
ever be added to this repository, the identical reasoning in §4/§6
would apply to it without needing to re-litigate Worker's own rejection.

## 9. Alpha 060 recommendation — ONE minimal change only

**Alpha 060 should make NO code change and add NO new entry point.**
Building a Desktop (or CLI) shell purely to give this Decision a real
caller would invent infrastructure this repository does not have and
this Stage's own mandate does not authorize designing. The single
recommended follow-up is a documentation-only annotation: update
`fedos_runtime_identity.ts`'s own header comment on
`bootstrapIdentity()` to name Desktop as this arc's own designated,
reserved Authority — mirroring the precedent already set by
`docs/runtime_explicit_crypto_initialization.md` Rule #3, which reserved
a future `initCrypto()`-style call's own name and shape years before
any Stage implemented it. Wiring a real Desktop call site remains its
own future, separately-reviewed Stage, to be taken up only once this
repository actually has a Desktop application shell to wire it into.

## 10. What this Stage does NOT do

- Does **not** modify any `src/runtime/*` file, including
  `create_runtime.ts` and `fedos_runtime_identity.ts`.
- Does **not** modify any `src/identity/*` file.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any Storage or Crypto file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** add any Public Runtime API field.
- Implements **no** Desktop shell, CLI, or internal Bootstrap Manager
  of any kind — this Stage is a Decision record only.

## 11. Summary

This Stage's own net effect on `src/` is ZERO — no file is modified.
It formally compares five candidate Authorities for
`bootstrapIdentity()` (Alpha 058) across sixteen mandated criteria,
confirms via fresh repository search that `bootstrapIdentity()` remains
called by nothing, uncalled by `createRuntime()`, uncalled by Worker,
and unexposed on `AppRuntime`, and adopts Desktop Application startup
as the designated Bootstrap Authority — rejecting Worker on a concrete,
measured structural flaw, rejecting Public Runtime API exposure and an
internal Bootstrap Manager as premature/out-of-scope, and treating CLI
as structurally equivalent to Desktop but not currently real in this
repository. Alpha 060 is recommended to make no code change at all,
deferring any real wiring to a future Stage that has an actual Desktop
shell to wire into.

## 12. See also

- `docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md`
- `docs/secure_runtime_alpha_057_identity_bootstrap_removal.md`
- `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md`
- `docs/fedos_runtime_positioning.md`
- `docs/runtime_explicit_crypto_initialization.md`
