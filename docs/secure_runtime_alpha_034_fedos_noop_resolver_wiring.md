# FedOS Secure Runtime Alpha 034 — FedOS No-op Resolver Wiring

**Status: IMPLEMENTED — one function body changed, in one file.**
`resolveFedosIdentityProvider()` (`src/identity/fedos_identity_provider_resolver.ts`)
now returns a shared `NoopFedosIdentityProvider` (Alpha 033) singleton
instead of `null`. This is the seventh artifact in the FedOS Identity
arc (Alpha 028–034), and the ONLY file touched is the Resolver itself —
`FedosIdentityService` (Alpha 031), `FedosIdentityProvider` (Alpha 029),
`FedosIdentityDescriptor` (Alpha 028), `FedosIdentityCapability` (Alpha
030), `NoopFedosIdentityProvider` (Alpha 033), Runtime, Worker, and Rust
are all untouched.

## 1. null ResolverからNo-op Resolverへの変更理由 (why `null` became No-op now)

Alpha 032 §7 gave three reasons `resolveFedosIdentityProvider()` stayed
`null`-fixed at the time: no real answer existed; a placeholder object
would look like a real selection outcome; and this arc had never
authorized building a "safe default" Provider. All three reasons were
conditions of THAT Stage, not permanent facts — and Alpha 033
deliberately, separately changed the second and third: it built
`NoopFedosIdentityProvider` on its own merits (not to serve the
Resolver), and Alpha 033 §3 explicitly declined to wire it in AT THAT
TIME, reserving the wiring decision for its own, later, separately-
reviewed Stage. This Stage is that later Stage. The condition that
justified staying `null` — "ZERO `FedosIdentityProvider` implementations
exist anywhere in this repository" (Alpha 032's own exact words) — is
now simply false: one exists, is fully guard-tested, and has held that
status unchanged since Alpha 033's own commit. Continuing to return
`null` today would no longer be reporting "no Provider is resolvable";
it would be reporting a WRONG fact — a real, safe, importable
`FedosIdentityProvider` exists and this function was simply declining
to hand it over. `null`'s own honesty argument, which justified Alpha
032's decision, now argues for the opposite outcome.

## 2. The change

```ts
const sharedNoopProvider: FedosIdentityProvider = new NoopFedosIdentityProvider();

export function resolveFedosIdentityProvider(): FedosIdentityProvider | null {
  return sharedNoopProvider;
}
```

One shared, module-scoped `NoopFedosIdentityProvider` instance,
constructed once at module load — not a fresh instance per call — and
returned unconditionally. No `if`, no `switch`, no environment or
Authority read of any kind: this Stage adds a WIRING, not a SELECTION.
There is still only one implementation to choose between, so there is
still nothing to select — Alpha 032's own "no selection logic exists"
guardrail continues to hold, unchanged in spirit, even though the
return value changed.

The function's own return TYPE remains `FedosIdentityProvider | null`,
byte-for-byte the same signature Alpha 032 wrote — not narrowed to
`FedosIdentityProvider` alone. This is deliberate: narrowing the
signature would be a second, separate design decision (asserting this
function can now NEVER meaningfully return `null` again, permanently),
which this Stage's own minimal mandate — wire the Resolver, touch
nothing else, decide nothing else — does not authorize. A future Stage
that genuinely wants to make "always non-null" part of this function's
own contract remains free to narrow the signature then, on its own
review.

## 3. No-op Providerが実Providerの代替ではないこと (why the No-op Provider is NOT a stand-in for a real Provider)

Returning `NoopFedosIdentityProvider` here does not mean "this arc now
considers No-op adequate as an identity source," and this Stage takes
care not to imply that:

- `NoopFedosIdentityProvider.describeIdentity()` always resolves `null`
  (Alpha 033 §2) — every caller of `resolveFedosIdentityProvider()`
  today receives an object that can NEVER report an identity, no matter
  how many times or in what context `describeIdentity()` is called. This
  Stage makes that object REACHABLE; it does not make it CAPABLE of
  anything it wasn't already capable of on its own.
- The wiring exists to close a different, narrower gap: before this
  Stage, any code that wanted to call `resolveFedosIdentityProvider()`
  and immediately use the result as a `FedosIdentityProvider` (rather
  than branch on `null` first) had no way to do so safely.
  `resolveFedosIdentityProvider()` returning a real, working
  (if permanently empty) object closes that gap WITHOUT requiring a real
  identity source to exist yet.
- A real Provider (Nostr being the leading candidate, per Alpha 027 §8)
  replacing the No-op here is a SEPARATE, future, and REQUIRED step for
  this arc's identity work to have any actual content — this Stage does
  not reduce the need for that future Stage by even one requirement, and
  explicitly does not claim to.

## 4. Runtime未接続である理由 (why this stays disconnected from Runtime)

`resolveFedosIdentityProvider()` is not imported by `create_runtime.ts`,
`AppRuntime`, or any other `src/runtime/*` file — confirmed unchanged
from Alpha 032, and reconfirmed by this Stage's own guard test. Two
independent reasons:

1. **`FedosIdentityService` (Alpha 031) still requires an explicit
   constructor argument, with no default.** Wiring
   `resolveFedosIdentityProvider()` into Runtime would first require
   wiring it into the Service (e.g. as a default constructor argument,
   mirroring how `storeCiphertext()` defaults its own `storage`
   parameter to `resolveRuntimeStorageBackend()`, Alpha 021) — a
   decision Alpha 031 §4 and Alpha 032 §4 both already deferred to their
   own future Stage, and this Stage's own explicit mandate ("Service変更
   禁止") forbids making now.
2. **Runtime wiring would make a permanently-empty Provider look like a
   Runtime capability.** If `AppRuntime` gained an identity-describing
   method backed by this Resolver today, every real caller of that
   method would receive `null` forever — a working-looking API surface
   that can never do anything, indistinguishable from a bug to anyone
   who didn't read this Stage's own design doc. Stopping the wiring at
   the Resolver (a file only Identity-arc code and this Stage's own test
   currently reach) keeps that permanently-empty behavior contained to
   exactly the layer that already knows about it.

## 5. Nostr Providerとの差 (difference from a future Nostr Provider)

| | `NoopFedosIdentityProvider` (wired in, Alpha 034) | A future `NostrIdentityProvider` (not built) |
|---|---|---|
| **`describeIdentity()` result** | Always `null` — structurally, permanently | A real `FedosIdentityDescriptor` when linked, `null` when not |
| **Depends on external state?** | No — the result is fixed at compile time | Yes — an actual Nostr key/signer/relay state |
| **Can this Stage's wiring decision be revisited when Nostr arrives?** | Yes — trivially, by changing this Resolver's own body again, exactly as this Stage changed Alpha 032's | — |
| **Does wiring No-op now make wiring Nostr later harder?** | No — the Resolver's own signature (`FedosIdentityProvider \| null`) does not change; a future Stage replaces `sharedNoopProvider` with a real instance (or a Storage-Resolver-style `if`/`switch` selecting between several), touching only this same file again | — |
| **Is No-op a step toward, or a precondition for, Nostr?** | Neither — see §3; it is an independent, permanently-valid answer for contexts that want a safe, always-empty Provider, not a rung on a ladder Nostr climbs past |

The Resolver returning No-op today does not commit this arc to any
particular SHAPE of eventual Nostr wiring (a straight replacement, a
selection between several Providers, an environment-gated choice) — it
only demonstrates the seam is real and can be re-pointed by editing
exactly one file, which is the entire structural point of having built
a Resolver (Alpha 032) before any real Provider existed.

## 6. Storage Resolverとの比較 (comparison against `resolveRuntimeStorageBackend()`)

| | `resolveRuntimeStorageBackend()` (Alpha 021/024) | `resolveFedosIdentityProvider()` (Alpha 032/034) |
|---|---|---|
| **First return value, at its own Resolver's introduction** | A real, working `MemoryStorageBackend` (Alpha 021) | `null` (Alpha 032) |
| **When did it start returning a real, working implementation?** | Immediately — same Stage as the Resolver itself | Two Stages later (Alpha 034), after the implementation (Alpha 033) was built and reviewed separately |
| **Selection logic today** | Two-axis `if` (Runtime Mode × Platform), added at Alpha 024 once a second real backend existed | None — still a single unconditional return, since only one `FedosIdentityProvider` implementation exists |
| **Is the returned object "safe to use" in the sense of doing real work?** | Yes — `MemoryStorageBackend` genuinely stores and returns data | No — `NoopFedosIdentityProvider` genuinely reports nothing, ever; "safe" here means "harmless to hold," not "useful to call" |
| **Wired into Runtime?** | Yes — `fedos_runtime_ciphertext_storage.ts` defaults its own `storage` parameter to this Resolver | No — explicitly out of scope for this Stage (§4) |
| **Sequencing precedent this Stage follows** | — | Mirrors Alpha 024's own step one arc behind: Interface + Resolver seam first (Alpha 021 / Alpha 032), real implementation next (Alpha 023 / Alpha 033), Resolver wired to the real implementation last (Alpha 024 / THIS Stage) — with Identity's own version of that last step returning a permanently-empty implementation rather than a genuinely useful one, since that is the only implementation that exists yet |

The key structural difference, unchanged from Alpha 032 §6's own
framing: Storage's Resolver could return something REAL from its very
first Stage because a real backend already existed; Identity's Resolver
could not, and waited two full Stages for that precondition (Alpha
033's implementation) before this Stage could honestly do the same
thing Storage did on day one.

## 7. What this Stage does NOT do

- Does **not** modify `create_runtime.ts` or `AppRuntime` — Runtime
  remains fully unaware `resolveFedosIdentityProvider()` exists.
- Does **not** modify `fedos_identity_service.ts` (Alpha 031) — its
  constructor still requires an explicit `FedosIdentityProvider`
  argument, with no default.
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029),
  `fedos_identity_descriptor.ts` (Alpha 028), or
  `fedos_identity_capability.ts` (Alpha 030).
- Does **not** modify `fedos_noop_identity_provider.ts` (Alpha 033) —
  `NoopFedosIdentityProvider` is imported, never changed.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any `src/runtime/*` file, including
  `fedos_runtime_storage_backend.ts` /
  `fedos_runtime_storage_resolver.ts` — Storage is untouched.
- Does **not** implement any Nostr, ActivityPub, or Bluesky Provider.
- Does **not** add authentication, login, session, or credential
  handling of any kind.
- Does **not** add any selection condition, `if`, or `switch` — still a
  single unconditional return.
- Does **not** read `process.env`, call
  `determineFedosRuntimeMode()`/`determineFedosRuntimePlatform()`, or
  reference either Authority module.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.

## 8. See also

- `docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md`
  (Secure Runtime Alpha 032) — the `null`-fixed Resolver this Stage
  changes, including the three original reasons for `null` this Stage's
  §1 reassesses.
- `docs/secure_runtime_alpha_033_fedos_noop_identity_provider.md`
  (Secure Runtime Alpha 033) — `NoopFedosIdentityProvider` itself,
  including its own §3 explanation for why it was NOT wired in at the
  time, which this Stage's §1 directly continues.
- `docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md`
  (Secure Runtime Alpha 031) — the unmodified `FedosIdentityService`
  this Stage's §4 explains the wiring deliberately stops short of.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md` /
  `secure_runtime_alpha_024_dpapi_resolver_integration.md` (Secure
  Runtime Alpha 021/024) — the Resolver-wired-to-a-real-implementation
  precedent this Stage's §6 compares itself against.
