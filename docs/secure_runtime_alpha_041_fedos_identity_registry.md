# FedOS Secure Runtime Alpha 041 — FedOS Identity Registry (Canonical Record Registry)

**Status: IMPLEMENTED — a single, minimal class only.** Adds
`FedosIdentityRegistry` (`src/identity/fedos_identity_registry.ts`) —
the first place `FedosIdentityRecord` (Alpha 040) values can actually be
held, found, listed, and removed. This is an IN-MEMORY-ONLY holder — no
Runtime connection, no Provider connection, no Storage persistence, no
Worker, no Crypto. This is the twelfth artifact in the FedOS Identity
arc (Alpha 028–041).

## 1. Why now

Alpha 040 gave the canonical cross-Provider identity model a name
(`FedosIdentityRecord`) but deliberately built "zero constructors, zero
producers, zero consumers" (Alpha 040 §11) — a Record could be written
as an object literal in a test, but nothing in this repository could
hold one, look one up, or enumerate them. This Stage is the smallest
possible next step that makes a Record USABLE at all, without yet
deciding WHO produces one (a future Provider-facing Stage), WHO
persists one (a future Storage-facing Stage), or WHO reads one from
Runtime (never, per Alpha 026's own layering). Following this arc's own
established shape-before-behavior discipline, `FedosIdentityRegistry`
is introduced as the minimal CRUD-shaped holder Alpha 040's own Record
needs before any real producer or consumer can be reviewed.

## 2. The Registry

```ts
export class FedosIdentityRegistry {
  readonly #records = new Map<string, FedosIdentityRecord>();

  register(record: FedosIdentityRecord): void {
    this.#records.set(record.id, record);
  }

  find(id: string): FedosIdentityRecord | null {
    return this.#records.get(id) ?? null;
  }

  list(): readonly FedosIdentityRecord[] {
    return [...this.#records.values()];
  }

  remove(id: string): boolean {
    return this.#records.delete(id);
  }
}
```

One private field (`#records`, a `Map<string, FedosIdentityRecord>`
keyed by each Record's own `id`), four methods, each a single, direct
`Map` operation:

- **`register(record)`** — `Map.set()`. Registering a second Record
  under the SAME `id` overwrites the first — `Map.set()`'s own native
  behavior, not special-cased logic this class adds.
- **`find(id)`** — `Map.get()`, coalesced to `null` when absent
  (`Map.get()` itself returns `undefined` for a missing key; this class
  translates that to `null` to match `FedosIdentityDescriptor`/
  `FedosNostrPublicIdentitySource`'s own established "`null` means
  absent" convention across this arc, rather than introducing
  `undefined` as a second "nothing here" value).
- **`list()`** — `Map.values()`, spread into a fresh array on every
  call. The return type is `readonly FedosIdentityRecord[]` — callers
  cannot push/splice/mutate the returned array to affect the Registry's
  own internal state, and a fresh array is returned every call so no
  caller can hold a live, mutable view into `#records` either.
- **`remove(id)`** — `Map.delete()`, whose own return value (`true` if
  a key existed and was removed, `false` otherwise) is returned
  unchanged.

No constructor argument, no configuration, no validation beyond what
`Map` itself performs, no derived or cached state, no method beyond
these four. `FedosIdentityRegistry` is the ONLY export of its own file.

## 3. Registryと Descriptorの責務 (boundary with `FedosIdentityDescriptor`, Alpha 028)

**The Registry never holds, accepts, or returns a Descriptor.** Its
`register()`/`find()`/`list()`/`remove()` signatures are all typed
against `FedosIdentityRecord`, never `FedosIdentityDescriptor` — the two
types remain as structurally distinct as Alpha 040 §3 already
established (a Descriptor is a per-call, per-Provider Read Model; a
Record is the eventual canonical model), and this Stage does not blur
that line by making the Registry accept either interchangeably. If a
future Stage ever maps a Descriptor onto a Record (Alpha 040 §5's own
"a Record, if a future Stage ever builds the mechanism, would be
assembled FROM one or more Descriptors" framing), that mapping happens
BEFORE anything reaches this Registry — the Registry itself only ever
sees the Record side of that boundary, never the Descriptor side.

## 4. RegistryとRecordの責務 (boundary with `FedosIdentityRecord`, Alpha 040)

**The Registry is a pure CONTAINER for Records — it does not validate,
enrich, merge, or interpret them.** `register()` does not check whether
`record.provider` is a recognized value, does not verify
`record.publicIdentifier`'s own shape, and does not reject a
structurally-identical-but-different Record under the same `id` — it
trusts the caller completely and stores exactly what it was given, keyed
by exactly the `id` the Record itself carries. This mirrors
`NostrIdentityProvider`'s own "never reformat or correct
`publicIdentifier`" discipline (Alpha 039 §6) one layer further out: the
Registry is even less involved than the Provider was — it does not even
validate presence/non-emptiness, because by the time a caller has a
real `FedosIdentityRecord` value to register, TypeScript's own type
system has already guaranteed the three fields exist as strings; this
Registry's job starts and ends at storage and retrieval by key.

## 5. RegistryとProviderの責務 (boundary with `FedosIdentityProvider`/`NostrIdentityProvider`/`NoopFedosIdentityProvider`)

**No Provider constructs, holds, or references a
`FedosIdentityRegistry` — confirmed by direct inspection of every
Provider file, all of them unmodified by this Stage.**
`NostrIdentityProvider.describeIdentity()` (Alpha 035/039) still returns
`FedosIdentityDescriptor | null`, never touching a Registry or a Record.
This Stage's own explicit mandate ("Providerを変更しない") makes this a
hard boundary, not merely an observation: even though a FUTURE Stage
might reasonably want "whenever a Provider successfully describes an
identity, register a Record for it," that wiring is a SEPARATE,
not-yet-authorized decision — this Stage builds the container the
future wiring would eventually populate, and stops there.

## 6. RegistryとRuntimeの責務 (boundary with Runtime)

**Zero Runtime reference of any kind** — confirmed by direct inspection:
`fedos_identity_registry.ts` imports nothing from `src/runtime/*`, and
`create_runtime.ts`/`types.ts`/every other `src/runtime/*` file has zero
reference to `FedosIdentityRegistry` or `FedosIdentityRecord`. Runtime
remains Crypto/Storage/Environment-only (Alpha 026 §4); this Registry
does not become a fourth concern for it, is never constructed by
`AppRuntime`, and is never reachable from any Public Runtime API
function.

## 7. RegistryとStorageの責務 (boundary with Storage)

**This Registry is Memory-only, and knows nothing about Storage —
confirmed by zero import of `storeCiphertext()`/`loadCiphertext()`/
`deleteCiphertext()`, any `RuntimeStorageBackend`, or the Storage
Resolver anywhere in this file.** Its own `#records` field is a plain
JavaScript `Map`, backed by nothing more durable than process memory —
constructing a new `FedosIdentityRegistry` and never registering
anything into it means a caller has zero Records, and every Record ever
registered is gone the moment the instance itself is garbage-collected
or the process exits. This is a DELIBERATE, temporary property (§8),
not an oversight: if a future Stage ever builds persistence for
`FedosIdentityRecord` data, it would do so exactly as Alpha 026 §3/Alpha
038 §7 already require of any Identity Layer persistence — via
`storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()`, never by
this Registry reaching into a `RuntimeStorageBackend` directly, and
never by this Stage building that mechanism prematurely.

## 8. RegistryとProtocol Adapterの責務 (boundary with Protocol Adapters — Nostr/ActivityPub/Bluesky/Session)

**No Protocol Adapter of any kind reads, writes, or references
`FedosIdentityRegistry`** — this repository still has zero Protocol
Adapter implementations (Alpha 027 §8, still respected). Per Alpha 040
§8's own two-layer separation (a Protocol Adapter produces a Descriptor
via a Provider; a Record is assembled FROM Descriptors by a future
reconciliation layer, never populated directly by a Protocol Adapter),
this Registry sits a THIRD layer away from any Protocol Adapter: even
once a future reconciliation layer exists and produces Records, THAT
layer — not any Protocol Adapter directly — would be the thing calling
`register()`. This keeps Protocol-specific vocabulary maximally far from
this file, consistent with every prior Stage's own "Identity Layer types
carry no protocol-specific vocabulary" discipline (Alpha 026 §5, Alpha
028 §6, Alpha 039 §4, Alpha 040 §8).

## 9. Memory Registryを採用した理由 (why a Memory Registry is chosen now)

- **It is the smallest possible thing that makes `FedosIdentityRecord`
  usable at all.** A Persistent Registry would require deciding a
  serialization format, a Storage-key scheme, and error handling for a
  Storage layer that can fail (`storeCiphertext()` already returns
  `boolean | null`, not a guaranteed `true`) — none of which this
  Stage's own narrow mandate ("Memoryのみ") authorizes deciding today.
  A Memory Registry requires none of that: `Map` already IS a complete,
  correct, zero-decision in-memory key-value store.
- **It mirrors `MemoryStorageBackend`'s own precedent directly** (Alpha
  019/021) — a real `Map`-backed implementation shipped BEFORE any
  persistent backend (`WindowsDpapiStorageBackend`, Alpha 023) existed,
  proving the Interface/shape was usable before persistence was ever
  designed. This Stage repeats that exact sequencing one layer up, for
  Identity Records instead of ciphertext.
- **It carries zero Fail-Closed risk.** Every one of `register()`/
  `find()`/`list()`/`remove()` is a synchronous, always-succeeding `Map`
  operation — there is no `null`-on-failure branch to design, no
  exception to catch, no partial-failure state to reason about, because
  in-memory `Map` operations do not fail under normal operation the way
  a real I/O-backed persistence layer could.
- **It does not foreclose a future Persistent Registry** — see §10.

## 10. 将来Persistent Registryへ移行する際の方針 (the future Persistent Registry migration direction — advisory only)

This Stage schedules nothing, but records the reasoning a future Stage
would need:

1. **The Interface seam, if one is ever needed, is not yet named.**
   Unlike Storage (`RuntimeStorageBackend`, Alpha 021), this Stage does
   NOT introduce a `FedosIdentityRegistry`-shaped interface with
   `FedosIdentityRegistry` itself as merely one implementation — it
   ships the CLASS directly, because exactly one implementation exists
   and no second one is being designed in parallel (unlike Storage's own
   Alpha 021, which reviewed Memory and a future DPAPI backend
   together). A future Stage that wants a Persistent Registry alongside
   this Memory one would need to decide, as its own review, whether to
   retrofit an Interface (mirroring Storage's own Resolver pattern,
   Alpha 021/024) or replace this class outright.
2. **Any future persistence would route through Runtime's own Storage
   API, never bypass it.** Per §7, a Persistent Registry's own
   `register()` would call `storeCiphertext()` with an ID scheme and
   serialization format that future Stage's own review would need to
   define — this Stage does not pre-decide either.
3. **`list()`'s own synchronous, always-available contract would likely
   need to change.** A Persistent Registry backed by real I/O could not
   honestly offer a synchronous `list(): readonly FedosIdentityRecord[]`
   the way this Memory Registry does — a future Stage would need to
   decide whether `list()` becomes `async`, whether an in-memory cache
   is layered on top of Storage, or some other resolution. This Stage
   does not need to solve it because Memory has no such constraint.
4. **This Stage's own guardrail — Registryは Providerを一切変更しない
   ("Registry does not modify a Provider") — would still apply.** Even
   a Persistent Registry would be populated by SOME future caller
   explicitly choosing to register a Record; it would not retroactively
   require `NostrIdentityProvider` or any other Provider to change its
   own `describeIdentity()` contract.

## 11. What this Stage does NOT do

- Does **not** modify `fedos_identity_record.ts` (Alpha 040),
  `fedos_identity_descriptor.ts` (Alpha 028),
  `fedos_identity_provider.ts` (Alpha 029),
  `fedos_identity_capability.ts` (Alpha 030),
  `fedos_identity_service.ts` (Alpha 031),
  `fedos_identity_provider_resolver.ts` (Alpha 032/034/036),
  `fedos_noop_identity_provider.ts` (Alpha 033),
  `fedos_nostr_identity_provider.ts` (Alpha 035/039),
  `fedos_nostr_public_identity_source.ts` (Alpha 039), or
  `fedos_null_nostr_public_identity_source.ts` (Alpha 039).
- Does **not** modify `create_runtime.ts` or any `src/runtime/*` file.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any existing `src/nostr/*` file.
- Does **not** persist any Record anywhere — `register()`/`find()`/
  `list()`/`remove()` all operate on the in-process `#records` Map only.
- Does **not** add authentication, credential, session, Relay, or DM
  handling of any kind.
- Does **not** add `displayName`, `avatar`, or any field beyond
  `FedosIdentityRecord`'s own existing three (Alpha 040) — this Stage
  adds a CONTAINER for the existing Record shape, not a new shape.
- Does **not** add a constructor argument, configuration option, or any
  method beyond the four named in §2.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.
- Does **not** change any Public Runtime API signature.

## 12. See also

- `docs/secure_runtime_alpha_040_fedos_identity_record.md` (Secure
  Runtime Alpha 040) — `FedosIdentityRecord`'s own shape, and the
  "zero constructors, zero producers, zero consumers" gap this Stage
  begins closing on the CONTAINER side only.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md` /
  `secure_runtime_alpha_023_windows_dpapi_storage_backend.md` (Secure
  Runtime Alpha 021/023) — `MemoryStorageBackend`'s own
  ship-Memory-before-persistence precedent this Stage's §9 directly
  reuses.
- `docs/secure_runtime_alpha_026_identity_layer_boundary_review.md`
  (Secure Runtime Alpha 026) — the Runtime/Storage/Protocol boundaries
  §6/§7/§8 reaffirm for a fourth and fifth Identity-arc type.
- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
  (Secure Runtime Alpha 039) — the "never reformat or correct" Provider
  discipline §4 extends one layer further out to the Registry.
