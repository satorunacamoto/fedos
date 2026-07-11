# Secure Runtime Alpha 089 — Desktop Runtime Separation Review

**Status: this Stage is REVIEW / DECISION ONLY. It makes NO
implementation change of any kind. `src/` is untouched by this Stage
— no code, no comment, no field, no method, nothing. This document,
its own guard test, and a `README.md` entry are the entire
deliverable. This is Stage 3 of the Alpha 087–090 Desktop Integration
Review Arc.**

## 1. Why now

Alpha 086 fixed the SHAPE of the boundary (Desktop constructs its own
`FedosRuntimeIdentity`, independent of `createRuntime()`). Alpha 087
fixed WHEN. Alpha 088 fixed HOW LONG. None of the three closed a
specific, concrete loophole: `createRuntime()` accepts a
`RuntimeOverrides` parameter that lets a caller inject a pre-built
adapter for eleven different `AppRuntime` fields today. Nothing so far
has explicitly forbidden a future Stage from adding a twelfth —
`identity`/`runtimeIdentity` — letting Desktop hand ITS OWN, already-
bootstrapped `FedosRuntimeIdentity` instance BACK into `createRuntime()`
via `overrides`, quietly reversing Alpha 086's own separation through
a side door that Alpha 086 itself never examined. This Stage closes
that door explicitly.

## 2. Review target

Should `FedosRuntimeIdentity`, once constructed and bootstrapped by
Desktop, ever be handed back into `createRuntime()` — via
`RuntimeOverrides` or any other mechanism — so that it becomes
reachable through the returned `AppRuntime` object?

## 3. Grounding in the actual source

- `RuntimeOverrides` (`src/runtime/types.ts`), read directly, declares
  ELEVEN fields today — `mode`, `eventCache`, `assetCache`,
  `notificationBridge`, `meshKVClient`, `meshKVApi`, `spaceDirectory`,
  `metadataIndex`, `signatureVerifier`, `promotionProvider`,
  `recommendationProvider`, `relayPublisher`, `paymentProvider`,
  `webAuthnProvider`, `cryptoProvider`, `storageBackend`,
  `federationProvider`, `chatProvider`, `marketplaceProvider`,
  `creatorEntitlementProvider`, `runtimeCryptoProvider` — and NONE of
  them is `identity`, `runtimeIdentity`, or any other
  Identity-shaped field. `createRuntime()`'s own body never reads any
  such field from `overrides` — confirmed directly against
  `create_runtime.ts`'s own source, which constructs its own internal
  `FedosRuntimeIdentity` unconditionally, with no override path of any
  kind.
- `AppRuntime` itself (§3 of Alpha 086's own review, reconfirmed) has
  no `identity` field among its thirty fields.
- `FedosRuntimeIdentity`'s own constructor takes no arguments — there
  is no way to inject an already-constructed identity dependency into
  a NEW instance even if one wanted to; the class's own shape does not
  support an "adopt an existing Descriptor" pattern at all. Handing a
  bootstrapped instance back into `createRuntime()` would therefore
  require EITHER a new `AppRuntime` field (already rejected by Alpha
  086's own Option C) OR a wholesale reshaping of
  `FedosRuntimeIdentity`'s own constructor — either path reopens
  Decisions this Arc has already closed.

## 4. Decision

**`createRuntime()`, `RuntimeOverrides`, and `AppRuntime` are
PERMANENTLY forbidden from ever accepting, exposing, or otherwise
becoming aware of a Desktop-owned `FedosRuntimeIdentity` instance, in
any form, through any mechanism — override, field, or otherwise.
Desktop's own bootstrapped Identity is NEVER handed back to
`createRuntime()`.**

This closes the specific `RuntimeOverrides` loophole identified in
§1/§3, on top of Alpha 086's own general Option C rejection (a direct
`AppRuntime.identity` field): a future `overrides.runtimeIdentity` (or
similarly-named) escape hatch would achieve the exact same forbidden
outcome — Identity becoming reachable FROM `createRuntime()`'s own
returned object — through a different mechanical route, and is
therefore equally forbidden, not merely unaddressed.

`createRuntime()`'s own internal `FedosRuntimeIdentity` construction
(Alpha 050–057) remains exactly what it has always been: a private,
function-scoped, immediately-discarded instance, permanently unrelated
to whatever separate instance Desktop constructs and holds for its own
purposes (Alpha 087/088).

## 5. Comparison

- **責務:** `createRuntime()` owns assembling `AppRuntime`'s eleven
  overridable seams; Desktop owns its own Identity Bootstrap entirely
  separately. This Stage formally fixes that these two responsibility
  sets never merge, in either direction.
- **Lifetime:** Unaffected — `createRuntime()`'s own internal instance
  stays call-scoped (Alpha 088 already confirmed this is fundamentally
  incompatible with a long-lived Desktop instance); this Stage adds
  that even a DELIBERATE hand-back would not change that
  incompatibility, since `createRuntime()` itself has no field to
  receive one.
- **Bootstrap Authority:** Unaffected — Desktop alone (Alpha 059);
  this Stage confirms that authority cannot be diluted by
  `createRuntime()` becoming a secondary reader of an
  already-bootstrapped instance.
- **Runtime純粋性:** Directly reinforced — accepting an
  already-bootstrapped Identity via `overrides` would make
  `createRuntime()`'s own output depend on EXTERNAL Bootstrap timing
  (whether Desktop had already called `bootstrapIdentity()` before
  constructing the Runtime), breaking the synchronous, self-contained
  purity Alpha 056/057 already fixed.
- **Workerとの差:** Reinforced — if `RuntimeOverrides` ever gained an
  identity-shaped field, Worker's own per-request `createRuntime()`
  calls would need to either supply one every time (impossible — no
  long-lived instance exists in a Worker request handler) or leave it
  `undefined` every time, making the field permanently dead weight on
  Worker's own call sites specifically. Forbidding the field avoids
  ever creating that asymmetry.
- **Protocol非依存性:** Unaffected.
- **Public API:** Zero change — confirmed no `identity` field exists
  in `RuntimeOverrides` or `AppRuntime` today (§3); this Decision fixes
  that neither ever gains one for this purpose.
- **YAGNI:** Satisfied — no override field, no adapter, no bridging
  method between Desktop's own instance and `createRuntime()`'s own
  output is introduced; nothing in the current source needs one, since
  Desktop already reaches everything it needs through its own directly
  -held `FedosRuntimeIdentity` instance (Alpha 086 Option A).
- **テスト容易性:** Strong — directly verifiable against the actual
  `RuntimeOverrides`/`AppRuntime` field lists, with no behavioral
  ambiguity: either an `identity`-shaped field exists or it does not.

## 6. What this Stage does NOT do

- Does **not** modify `src/runtime/fedos_runtime_identity.ts`,
  `create_runtime.ts`, or `types.ts` — no code, no comment, no field,
  no method, on any of them.
- Does **not** modify `worker.ts`, any `src/identity/*` file, Storage,
  Rust, `Cargo.toml`, or `package.json`.
- Does **not** implement a Desktop Shell of any kind.
- Does **not** add or remove any `RuntimeOverrides`/`AppRuntime`
  field.
- Does **not** reopen Alpha 086's own Option C rejection — it closes a
  DIFFERENT, more specific mechanism (an `overrides` field) that Alpha
  086 did not itself examine.

## 7. See also

- `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
- `docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md`
- `docs/secure_runtime_alpha_057_identity_bootstrap_removal.md`
- `docs/secure_runtime_alpha_086_desktop_integration_boundary_review.md`
- `docs/secure_runtime_alpha_087_desktop_bootstrap_ownership_review.md`
- `docs/secure_runtime_alpha_088_desktop_lifetime_review.md`
