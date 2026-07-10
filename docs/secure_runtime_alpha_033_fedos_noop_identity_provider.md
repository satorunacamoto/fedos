# FedOS Secure Runtime Alpha 033 — FedOS No-op Identity Provider

**Status: IMPLEMENTED — a single class only.** Adds
`NoopFedosIdentityProvider` (`src/identity/fedos_noop_identity_provider.ts`)
— the FIRST concrete `FedosIdentityProvider` (Alpha 029) implementation
anywhere in this repository. `provider` is the fixed literal `"noop"`;
`describeIdentity()` always resolves `null`. No constructor, no
configuration, no internal state, no thrown exceptions. This is the
sixth artifact in the FedOS Identity arc (Alpha 028–033), and it is
deliberately wired into nothing — not the Resolver (Alpha 032), not the
Service (Alpha 031), not the Runtime.

## 1. なぜNo-opを追加するのか (why add a No-op Provider now)

Alpha 032's own design doc (§7, reason 3) explicitly declined to build
"even a trivial" Provider merely to give the Resolver something
non-`null` to return, because doing so, at that time, would have been an
unauthorized, unreviewed Provider implementation smuggled in to serve
the Resolver's own convenience. This Stage is different: it is a
separately-reviewed Stage whose SOLE, EXPLICIT purpose is to add exactly
that Provider implementation — on its own merits, not as a side effect
of another Stage's needs. Its merit is independent of the Resolver:

- It is the first opportunity to confirm `FedosIdentityProvider`
  (Alpha 029) is actually IMPLEMENTABLE as specified — one field, one
  async method — by writing a real, compiling, type-checked class
  against it, rather than only ever consuming the interface as a type
  annotation (as Alpha 031's `FedosIdentityService` and Alpha 032's
  Resolver both do).
- It gives `FedosIdentityService` (Alpha 031) — which has required an
  explicit `FedosIdentityProvider` constructor argument since its own
  introduction, with nothing to construct it with — a real, safe object
  a caller COULD pass it today, without requiring that caller to write
  their own throwaway stub first.
- It mirrors Storage's own precedent directly: `RuntimeStorageBackend`
  (Alpha 021) and `MemoryStorageBackend` (Alpha 021, carried over
  byte-for-byte from Alpha 019) were introduced in the SAME Stage,
  precisely because an Interface with no implementation at all is
  unverifiable. Identity's own Interface (Alpha 029) and Resolver
  (Alpha 032) were split across separate Stages instead, which is why
  this arc has gone four Stages (029→032) with an Interface, a
  Capability, a Service, and a Resolver, but never once a class that
  actually implements the Interface — until now.

## 2. The Provider

```ts
export class NoopFedosIdentityProvider implements FedosIdentityProvider {
  readonly provider = "noop";

  async describeIdentity(): Promise<FedosIdentityDescriptor | null> {
    return null;
  }
}
```

`provider` is the fixed literal `"noop"` — never reassigned, never
derived from configuration or environment. `describeIdentity()`'s body
is exactly `return null;` — no branch, no `try`/`catch`, no field read,
no argument. `NoopFedosIdentityProvider` is the ONLY export of its own
file.

## 3. Resolverへまだ接続しない理由 (why this is NOT wired into `resolveFedosIdentityProvider()`)

`resolveFedosIdentityProvider()` (Alpha 032) still reads, unmodified:

```ts
export function resolveFedosIdentityProvider(): FedosIdentityProvider | null {
  return null;
}
```

Connecting `NoopFedosIdentityProvider` here — `return new
NoopFedosIdentityProvider();` — was considered and rejected, for a
reason distinct from (and stronger than) "the mandate forbids it":
doing so would make the Resolver's own `null` LIE. Today,
`resolveFedosIdentityProvider() === null` truthfully means "no Provider
is currently resolvable." If the Resolver instead started returning a
`NoopFedosIdentityProvider` instance, a future caller checking `if
(provider !== null)` would believe a real Provider had been resolved —
when what they actually received is an object that can NEVER report an
identity, `describeIdentity()` always resolving `null` itself. That is
a strictly WORSE signal than the Resolver's current honest `null`: it
trades an obviously-absent Provider for a silently-useless one, which
is more likely to mislead a future caller, not less. Alpha 032 §7's own
three reasons for staying `null` (no real answer exists; a placeholder
would mislead; this arc has never authorized a "safe default") each
still apply verbatim — this Stage's `NoopFedosIdentityProvider` is
exactly the "safe default" reason 3 warned against building
prematurely, and reason 2's "placeholder object" is, concretely, this
very class. Building it on its own merits (§1) does not retroactively
make it correct to WIRE it into the Resolver — those remain two
separate decisions, and only the first is this Stage's.

## 4. null Resolverとの責務分離 (separation from the Resolver's own `null`)

This Stage produces two DIFFERENT `null`s that must not be confused:

| | Resolver's `null` | `NoopFedosIdentityProvider.describeIdentity()`'s `null` |
|---|---|---|
| **Who returns it** | `resolveFedosIdentityProvider()` (Alpha 032) | An already-constructed `NoopFedosIdentityProvider` instance |
| **What it means** | "No `FedosIdentityProvider` is currently resolvable at all" | "This Provider WAS resolved/constructed, and, having been asked, has no identity to report" |
| **When it is produced** | Before any Provider object exists | After a real Provider object exists and was actually asked |
| **Changes when a real Provider (e.g. Nostr) is added?** | Yes — this is precisely what §5 below describes | No — even after a Nostr Provider exists elsewhere, calling `describeIdentity()` on THIS specific `NoopFedosIdentityProvider` instance would still resolve `null`, forever, by definition |
| **Caller's correct next step on seeing it** | "Try again later, or fall back to no-identity-available behavior" | "This particular Provider instance has nothing — if a different Provider is available, ask that one instead" |

The Resolver's `null` is about PROVIDER AVAILABILITY (is there anyone to
ask). The Noop Provider's `null` is about IDENTITY AVAILABILITY (having
asked someone, what did they say). Collapsing these into "one `null`"
would erase a distinction a future caller needs: "nobody to ask" and "I
asked, and there's nothing" are different facts, and this Stage keeps
them produced by two different, mutually unaware code paths, exactly as
Alpha 032 §4 already established the Resolver and Service are mutually
unaware of each other.

## 5. 将来Nostr Providerへ置換される位置 (the future position a Nostr Provider would take)

`NoopFedosIdentityProvider` and a future `NostrIdentityProvider` (Alpha
027 §8's leading candidate) are, and will remain, SIBLINGS — both are
plain `FedosIdentityProvider` implementations, neither privileged over
the other by the interface itself. Concretely, when a future,
separately-reviewed Stage builds a real Nostr Provider:

- It will implement the SAME `FedosIdentityProvider` interface this
  Stage's class already implements — no interface change required.
- It will NOT subclass, wrap, or otherwise depend on
  `NoopFedosIdentityProvider` — the two are independent implementations,
  not a base/derived pair. "No-op" is not a partial Nostr
  implementation; it is a complete, permanently-empty one.
- Wherever `resolveFedosIdentityProvider()`'s body eventually stops
  being `return null;`, the natural replacement value is a Nostr
  Provider instance, not this Stage's Noop instance —
  `NoopFedosIdentityProvider` is not a rung on the way to a real
  Provider, it is a distinct, permanently-valid answer in its own right
  (see §6) for contexts that specifically want a safe, always-empty
  Provider (e.g. tests, or a caller that explicitly wants "no identity"
  behavior without querying anything real).
- `FedosIdentityService` (Alpha 031) already accepts either — its
  constructor takes any `FedosIdentityProvider`, so a future caller
  could construct it with `new
  FedosIdentityService(new NoopFedosIdentityProvider())` today, or with
  a Nostr Provider once one exists, with zero Service-side change either
  way. This is the entire value of Alpha 029's Interface-first design:
  the Service was already correct for a Provider that did not exist yet.

## 6. Storage Backendとの比較 (comparison against `MemoryStorageBackend`)

| | `MemoryStorageBackend` (Alpha 019/021) | `NoopFedosIdentityProvider` (Alpha 033) |
|---|---|---|
| **Interface implemented** | `RuntimeStorageBackend` | `FedosIdentityProvider` |
| **Internal state** | A real `Map<string, AeadCiphertextWire>` — actually stores data | None — zero fields beyond the fixed `provider` literal |
| **Behavior** | Genuinely stores, loads, and deletes whatever is given to it | Never has, and structurally never can have, anything to report |
| **Is it a "real" implementation or a stand-in?** | Real — a fully working backend, permanently useful even after Alpha 023's DPAPI backend was added | A stand-in — its entire behavior is "report nothing," by design, forever |
| **Was it wired into its own Resolver immediately?** | Yes — `resolveRuntimeStorageBackend()` (Alpha 021) returned a real `MemoryStorageBackend` from the SAME Stage that introduced the Backend Interface itself | No — `resolveFedosIdentityProvider()` (Alpha 032, one Stage EARLIER than this one) remains `null`-fixed; see §3 for why |
| **Expected long-term fate** | Permanent — remains the default in-process backend indefinitely, independent of whatever OS-backed backends exist alongside it | Likely permanent ALSO, but as a deliberately-empty option (tests, explicit "no identity" callers) — never expected to become the arc's primary Provider the way Memory is Storage's primary backend |
| **Why the sequencing differs** | Storage's Interface (Alpha 021) and its first, real, useful implementation were never separable — a storage abstraction with no backend at all stores nothing meaningfully testable | Identity's Interface (Alpha 029) was independently useful as a TYPE (Service and Resolver both reference it) well before any implementation existed — deferring the first implementation to its own Stage caused no gap the way it would have for Storage |

The key structural difference: `MemoryStorageBackend` is real and
useful BECAUSE it stores real data — its trivial implementation
(a `Map`) is trivial in mechanism only, not in the value it provides.
`NoopFedosIdentityProvider` is trivial in BOTH mechanism and value — it
provides exactly nothing, on purpose, and that is its entire point. The
former is "the simplest REAL implementation." The latter is "the
simplest POSSIBLE implementation, which happens to also be maximally
safe" — a different kind of triviality.

## 7. What this Stage does NOT do

- Does **not** implement any Nostr, ActivityPub, or Bluesky Provider.
- Does **not** wire `NoopFedosIdentityProvider` into
  `resolveFedosIdentityProvider()` (Alpha 032) — the Resolver remains
  byte-for-byte `return null;`.
- Does **not** wire `NoopFedosIdentityProvider` into
  `FedosIdentityService` (Alpha 031), the Runtime, or `src/worker.ts` —
  it has zero importers by design.
- Does **not** add authentication, login, session, or credential
  handling of any kind.
- Does **not** add a constructor, configuration, internal state, or any
  field beyond the fixed `provider` literal.
- Does **not** throw an exception under any circumstance.
- Does **not** modify `fedos_identity_descriptor.ts` (Alpha 028).
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029).
- Does **not** modify `fedos_identity_capability.ts` (Alpha 030).
- Does **not** modify `fedos_identity_service.ts` (Alpha 031).
- Does **not** modify `fedos_identity_provider_resolver.ts` (Alpha 032).
- Does **not** change any `src/runtime/*` file or any Public Runtime
  API signature.
- Does **not** change `src/worker.ts`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.

## 8. See also

- `docs/secure_runtime_alpha_032_fedos_identity_provider_resolver.md`
  (Secure Runtime Alpha 032) — the unmodified, `null`-fixed Resolver
  this Stage's §3/§4 explain the deliberate non-connection to.
- `docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md`
  (Secure Runtime Alpha 031) — the unmodified `FedosIdentityService`
  this Stage's §5 notes could already accept this Provider today, with
  zero Service-side change.
- `docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md`
  (Secure Runtime Alpha 029) — the `FedosIdentityProvider` contract this
  Stage is the first to actually implement.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md`
  (Secure Runtime Alpha 021) — `MemoryStorageBackend`, this Stage's §6
  comparison point.
- `docs/secure_runtime_alpha_027_identity_foundation_inventory.md`
  (Secure Runtime Alpha 027) — the Nostr-as-first-Protocol-Adapter
  framing this Stage's §5 references.
