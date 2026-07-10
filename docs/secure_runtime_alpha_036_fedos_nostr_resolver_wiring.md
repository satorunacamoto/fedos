# FedOS Secure Runtime Alpha 036 — FedOS Nostr Resolver Wiring

**Status: IMPLEMENTED — one function body changed, in one file.**
`resolveFedosIdentityProvider()`
(`src/identity/fedos_identity_provider_resolver.ts`) now returns a
shared `NostrIdentityProvider` (Alpha 035) singleton instead of the
shared `NoopFedosIdentityProvider` (Alpha 033) singleton it returned
since Alpha 034. This is the ninth artifact in the FedOS Identity arc
(Alpha 028–036), and the ONLY file touched under `src/` is the Resolver
itself — `FedosIdentityService` (Alpha 031), `FedosIdentityProvider`
(Alpha 029), `FedosIdentityDescriptor` (Alpha 028),
`FedosIdentityCapability` (Alpha 030), `NoopFedosIdentityProvider`
(Alpha 033), `NostrIdentityProvider` (Alpha 035), Runtime, Worker, and
Rust are all untouched.

## 1. NoopからNostrへResolverを切り替えた理由 (why this Resolver switched from Noop to Nostr)

Alpha 034 §1 gave the honesty argument for wiring in
`NoopFedosIdentityProvider` at the time: continuing to return `null`
would have misreported reality, because a real, safe
`FedosIdentityProvider` implementation existed and the Resolver was
simply declining to hand it over. Alpha 035 changed the same underlying
fact a second time — it built `NostrIdentityProvider`, this arc's
Nostr-labeled `FedosIdentityProvider` implementation, and Alpha 035 §3
explicitly declined to wire it in, reserving that decision for its own,
later, separately-reviewed Stage. This Stage is that later Stage, and
the same honesty reasoning Alpha 034 §1 used now points at Nostr
specifically:

- **Nostr was always the named destination, not a hypothetical.** Alpha
  027 §8 named Nostr as the "first Protocol Adapter candidate"; Alpha
  033 §5 and Alpha 034 §5 both described a future `NostrIdentityProvider`
  as the eventual real answer this Resolver would return, by name, well
  before that class existed. Once Alpha 035 built it, continuing to
  return `NoopFedosIdentityProvider` here would mean the Resolver was
  pointed at the wrong one of two available answers — not "no answer,"
  which was Alpha 032's problem, but "the less specific of two existing
  answers."
- **`NostrIdentityProvider` is not a replacement for `Noop`'s own
  meaning — it is a more specific one.** Both classes behave identically
  today (`describeIdentity()` always resolves `null` — see §2), but
  `provider === "nostr"` tells a future caller WHICH protocol this
  identity arc is actively building toward, where `provider === "noop"`
  told them nothing beyond "no identity available." Given a caller who
  intends to consume `resolveFedosIdentityProvider()`'s result as "the
  Provider this arc is developing," `"nostr"` is honest and `"noop"` is
  not, even though neither currently returns real identity data.
- **This Stage's own mandate authorizes exactly this, and nothing
  more.** "Resolverだけを変更し、NostrIdentityProviderを返すようにして
  ください" is a direct instruction to perform precisely the wiring
  Alpha 035 §3 deferred — this Stage does not independently justify the
  change beyond executing that deferred decision under its own,
  separate review.

## 2. describeIdentity()はまだnullである理由 (why `describeIdentity()` still always resolves `null`)

This Stage changes NOTHING about `NostrIdentityProvider` itself —
`fedos_nostr_identity_provider.ts` is byte-for-byte unchanged (see §5),
and its `describeIdentity()` body remains exactly what Alpha 035 §2
wrote:

```ts
async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
  return null;
}
```

Alpha 035 §2 already gave three independent reasons this stays `null` —
no secret key exists to read, building the fetching mechanism is a
separate, unauthorized decision, and a fabricated non-`null` value would
be actively worse than `null` — and this Stage does not revisit any of
them. Reaching `NostrIdentityProvider` through the Resolver (this
Stage's own entire change) does not create a key, a signer, or a Relay
connection where none existed before; it only makes an
already-`null`-returning object reachable from a new call site. Every
caller of `resolveFedosIdentityProvider()` before this Stage received an
object whose `describeIdentity()` always resolved `null`
(`NoopFedosIdentityProvider`); every caller after this Stage still
receives an object whose `describeIdentity()` always resolves `null`
(`NostrIdentityProvider`) — the wiring changes `provider`'s value, not
`describeIdentity()`'s behavior for any caller, old or new.

## 3. Runtime未接続である理由 (why this stays disconnected from Runtime)

`resolveFedosIdentityProvider()` is still not imported by
`create_runtime.ts`, `AppRuntime`, or any other `src/runtime/*` file —
confirmed unchanged from Alpha 032/034, and reconfirmed by this Stage's
own guard test. The two reasons Alpha 034 §4 gave both still apply,
unchanged:

1. **`FedosIdentityService` (Alpha 031) still requires an explicit
   constructor argument, with no default.** This Stage's own explicit
   mandate ("Service変更禁止") forbids adding one, exactly as Alpha 034's
   own mandate did.
2. **Runtime wiring would make a permanently-empty Provider look like a
   Runtime capability.** This risk is, if anything, SLIGHTLY sharper
   after this Stage than before it: a caller who saw `provider ===
   "nostr"` might reasonably (if mistakenly) assume Nostr identity data
   is now available somewhere in the Runtime, when `describeIdentity()`
   still unconditionally returns `null` (§2). Stopping the wiring at the
   Resolver — a file only Identity-arc code and this Stage's own test
   currently reach — keeps that risk contained to exactly the layer that
   already documents it.

This Stage's own mandate ("Runtime配線は禁止", "create_runtime変更禁止",
"AppRuntime変更禁止") states the same boundary directly, and this Stage
treats it as a hard constraint independent of the two reasons above.

## 4. 将来Descriptor取得へ繋がる位置 (the position this wiring leads toward for future Descriptor-fetching)

This Stage does not build any real Descriptor-fetching behavior — it
only changes which permanently-`null` object sits behind the Resolver.
The value of doing so now, rather than leaving `NoopFedosIdentityProvider`
wired in indefinitely, is structural: it moves the SEAM a future,
separately-reviewed Stage would touch to add real behavior from a
generic "no Provider selected yet" position to a Nostr-specific one.
Concretely:

- **A future Stage that gives `NostrIdentityProvider.describeIdentity()`
  a real body (per Alpha 035 §5's own four-step plan — a key/signer
  source, a public-key-only read, no Relay round-trip for this specific
  method, each its own future Stage) changes NOTHING about this
  Resolver.** `sharedNostrProvider` already points at the correct class;
  a future Stage edits `fedos_nostr_identity_provider.ts` only, and every
  existing caller of `resolveFedosIdentityProvider()` observes the new
  behavior automatically, with zero Resolver-side change required.
- **This wiring does not commit to Nostr being the ONLY future Provider.**
  The Resolver's return type (`FedosIdentityProvider | null`, unchanged
  — see §6) and its function signature remain exactly as general as they
  were when `NoopFedosIdentityProvider` was wired in. A future Stage
  that wants to select between multiple real Providers (Nostr,
  ActivityPub, Bluesky, ...) would still need to add selection logic
  here — this Stage adds none, matching Alpha 034 §2's own "wiring, not
  selection" framing exactly one Provider later.
- **The Resolver is now honest about this arc's own direction, not just
  its own current state.** Before this Stage, `resolveFedosIdentityProvider()`
  answered "is any Provider resolvable" with a generic-safe answer.
  After this Stage, it answers the same structural question while also
  naming WHICH protocol identity this arc is building toward — a fact
  every one of Alpha 027 §8, Alpha 033 §5, and Alpha 034 §5 already
  stated in prose, now reflected in the Resolver's own observable
  behavior for the first time.

## 5. Noop Providerを削除しない理由 (why `NoopFedosIdentityProvider` is not deleted)

`fedos_noop_identity_provider.ts` is confirmed BYTE-FOR-BYTE unchanged
by this Stage — this Stage's own mandate ("Noop Providerは削除しません")
states this directly, and three independent reasons make it the correct
choice regardless:

- **`NoopFedosIdentityProvider` remains a real, importable, safe
  `FedosIdentityProvider` implementation with its own independent value**
  (Alpha 033 §1) — proving the interface is genuinely implementable, and
  giving `FedosIdentityService` (Alpha 031) a Provider any caller could
  still construct it with today. Neither of those reasons depended on
  the Resolver ever returning it, and neither stops being true now that
  the Resolver returns something else.
- **Deleting it would be a strictly LARGER, riskier change than this
  Stage's own mandate authorizes.** This Stage's mandate is "Resolverだ
  け を変更し" — the Resolver, and only the Resolver. Removing a file, even
  an orphaned one, is a different and larger kind of change than editing
  one function body, and this Stage does not need to make it: no test,
  no doc, and no other source file in this repository requires
  `NoopFedosIdentityProvider` to be reachable from the Resolver in order
  to remain valid.
- **A future Stage may still want it.** `NoopFedosIdentityProvider` is,
  by design, a permanently-safe "no identity, explicitly" answer (Alpha
  033 §5) — useful for tests, or any future caller that explicitly wants
  a Provider guaranteed never to report an identity, independent of
  whichever real Provider the Resolver happens to point at. Deleting it
  now would foreclose that future use for no benefit to this Stage's own
  narrow mandate.

`NoopFedosIdentityProvider` and `NostrIdentityProvider` remain SIBLINGS,
exactly as Alpha 035 §4 established — this Stage changes which sibling
the Resolver points at; it does not change the sibling relationship
itself, and does not touch the file that is not currently pointed at.

## 6. Resolverの変更内容 (the exact change)

```ts
const sharedNostrProvider: FedosIdentityProvider = new NostrIdentityProvider();

export function resolveFedosIdentityProvider(): FedosIdentityProvider | null {
  return sharedNostrProvider;
}
```

One shared, module-scoped `NostrIdentityProvider` instance, constructed
once at module load — not a fresh instance per call — and returned
unconditionally, replacing the previous `sharedNoopProvider` /
`NoopFedosIdentityProvider` pairing one-for-one. No `if`, no `switch`,
no environment or Authority read of any kind: this Stage remains a
WIRING change, not a SELECTION — there is still only one Provider
constructed and returned, so there is still nothing to select between.
The function's own return TYPE remains byte-for-byte
`FedosIdentityProvider | null` — unchanged since Alpha 032, and Alpha
034 §2's own reasoning for not narrowing it applies again unchanged:
narrowing the signature to assert "this function can now never
meaningfully return `null`" would be a second, separate design decision
this Stage's own minimal mandate ("戻り値型...は変更禁止") does not
authorize, and explicitly forbids, making now.

## 7. What this Stage does NOT do

- Does **not** modify `create_runtime.ts` or `AppRuntime` — Runtime
  remains fully unaware `resolveFedosIdentityProvider()` exists.
- Does **not** modify `fedos_identity_service.ts` (Alpha 031) — its
  constructor still requires an explicit `FedosIdentityProvider`
  argument, with no default.
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029),
  `fedos_identity_descriptor.ts` (Alpha 028), or
  `fedos_identity_capability.ts` (Alpha 030).
- Does **not** modify `fedos_noop_identity_provider.ts` (Alpha 033), and
  does **not** delete it — `NoopFedosIdentityProvider` remains a real,
  unchanged, unimported-by-the-Resolver implementation (see §5).
- Does **not** modify `fedos_nostr_identity_provider.ts` (Alpha 035) —
  `NostrIdentityProvider` is imported, never changed. `describeIdentity()`
  still always resolves `null`.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any `src/runtime/*` file, including
  `fedos_runtime_storage_backend.ts` / `fedos_runtime_storage_resolver.ts`
  — Storage is untouched.
- Does **not** modify any existing `src/nostr/*` file.
- Does **not** implement any Relay connection, event construction,
  publishing, or subscribing.
- Does **not** sign or verify any signature.
- Does **not** generate, derive, read, or store any secret key, `nsec`,
  or `npub`.
- Does **not** implement any Direct Message (DM) feature of any kind.
- Does **not** add authentication, login, session, or credential
  handling of any kind.
- Does **not** add any selection condition, `if`, or `switch` — still a
  single unconditional return.
- Does **not** change the Resolver's own return TYPE — still
  byte-for-byte `FedosIdentityProvider | null`.
- Does **not** read `process.env`, call
  `determineFedosRuntimeMode()`/`determineFedosRuntimePlatform()`, or
  reference either Authority module.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.

## 8. See also

- `docs/secure_runtime_alpha_035_fedos_nostr_identity_provider.md`
  (Secure Runtime Alpha 035) — `NostrIdentityProvider` itself, including
  its own §3 explanation for why it was NOT wired in at the time, which
  this Stage's §1 directly continues.
- `docs/secure_runtime_alpha_034_fedos_noop_resolver_wiring.md` (Secure
  Runtime Alpha 034) — the previous wiring (Noop), including the
  honesty argument (§1) and the two Runtime-disconnection reasons (§4)
  this Stage's §1/§3 each reapply one Provider later.
- `docs/secure_runtime_alpha_033_fedos_noop_identity_provider.md`
  (Secure Runtime Alpha 033) — `NoopFedosIdentityProvider`, unchanged
  and undeleted by this Stage, per §5.
- `docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md`
  (Secure Runtime Alpha 032) — the original Resolver and its
  never-narrowed return type, still respected unchanged by this Stage's
  §6.
- `docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md`
  (Secure Runtime Alpha 031) — the unmodified `FedosIdentityService`
  this Stage's §3 explains the wiring deliberately stops short of.
- `docs/secure_runtime_alpha_027_identity_foundation_inventory.md`
  (Secure Runtime Alpha 027) — §8's "Nostr Adapter — first Protocol
  Adapter candidate" framing this Stage's Resolver finally, if still
  emptily, points at.
