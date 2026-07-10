# Secure Runtime Alpha 047 — FedOS Identity Record Expansion

## 1. Why now

Alpha 046 wired `snapshot.displayName`/`snapshot.avatar` from
`FedosNostrPublicIdentitySnapshot` (Alpha 044) through to
`FedosIdentityDescriptor` (Alpha 045) — the first real Provider-level
mapping either optional field had ever taken. That mapping stopped at
the Descriptor: `FedosIdentityService`'s own Descriptor→Record step
(Alpha 042) still named only three fields explicitly, so
`FedosIdentityRecord` (Alpha 040) — the canonical, Registry-held model —
continued to omit both fields no matter what the Descriptor carried.

This Stage closes that gap one layer further. `FedosIdentityRecord`
gains the identical two OPTIONAL fields, and `FedosIdentityService`'s
own Record-construction step now copies `descriptor.displayName`/
`descriptor.avatar` onto the Record it registers — two fields added to
one interface, and two lines added to one object literal, in two
files. Nothing downstream of the Registry (Resolver, Runtime, Worker,
Storage, Rust) is touched.

## 2. The change

`src/identity/fedos_identity_record.ts` — before:

```ts
export interface FedosIdentityRecord {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
}
```

after:

```ts
export interface FedosIdentityRecord {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
  readonly displayName?: string;
  readonly avatar?: string;
}
```

`src/identity/fedos_identity_service.ts` — before:

```ts
const record: FedosIdentityRecord = {
  id: descriptor.id,
  provider: descriptor.provider,
  publicIdentifier: descriptor.publicIdentifier,
};
```

after:

```ts
const record: FedosIdentityRecord = {
  id: descriptor.id,
  provider: descriptor.provider,
  publicIdentifier: descriptor.publicIdentifier,
  displayName: descriptor.displayName,
  avatar: descriptor.avatar,
};
```

Everything else in both files — the Record interface's three required
fields, the Service's constructor, `describeIdentity()`'s own
`null`-short-circuit and `registry.register(record)` call, and
`describeCapability()` in full — is confirmed byte-for-byte unchanged.
Cross-reference: `docs/secure_runtime_alpha_040_fedos_identity_record.md`
(original Record rationale), `docs/secure_runtime_alpha_042_fedos_identity_service_registry_integration.md`
(original Service/Registry wiring), `docs/secure_runtime_alpha_045_fedos_identity_descriptor_expansion.md`
(Descriptor's own two-field expansion), and
`docs/secure_runtime_alpha_046_nostr_identity_provider_descriptor_expansion.md`
(the Provider-level mapping this Stage extends one layer further).

## 3. RecordとDescriptorの責務 (boundary between `FedosIdentityRecord` and `FedosIdentityDescriptor`, Alpha 040/028)

The Descriptor is the per-call, non-persistent value a single
`describeIdentity()` invocation returns — owned by whichever Provider
produced it, discarded once its caller is done with it. The Record is
the canonical, Registry-held model this repository's own Identity
Layer intends to reconcile across multiple Providers over time. Before
this Stage, the Record's field set was a strict SUBSET of the
Descriptor's — three required fields, no optional ones — meaning every
Record was structurally incapable of representing what a rich
Descriptor already knew. This Stage removes that structural gap for
`displayName`/`avatar` specifically, without merging the two types'
responsibilities: the Record still has no `describeIdentity()` method,
no Provider reference, and no per-call semantics; the Descriptor still
has no Registry membership, no `id`-based lookup, and no persistence
expectation. The two types remain independently declared, matching by
field name/order/optionality but never sharing an implementation.

## 4. Recordへコピーする理由 (why `displayName`/`avatar` are copied onto the Record)

A Record that is missing information its own source Descriptor already
had would be a silently lossy canonical model — every future consumer
of `FedosIdentityRegistry.find()`/`list()` (Alpha 043's own Resolver,
or any later caller) would need to separately re-fetch the Descriptor
just to learn a display name or avatar the Registry could have held
all along. Since Alpha 046 already made `displayName`/`avatar`
available on a real Descriptor for the first time, and since both
remain purely public, display-only, non-sensitive data (Alpha 038 §2),
there is no responsibility-boundary reason left to withhold them from
the Record. Copying them through is the direct, minimal continuation of
Alpha 046's own wiring — the Snapshot→Descriptor step is Alpha 046's;
the Descriptor→Record step is this Stage's.

## 5. Serviceで加工しない理由 (why the Service does not process either field)

`FedosIdentityService`'s own Descriptor→Record mapping has never
reformatted, validated, or derived any field it copies — not `id`, not
`provider`, not `publicIdentifier`, and now not `displayName`/`avatar`
either. The Service's role in this mapping is exclusively structural:
take a value the Provider already produced and place it, unmodified,
onto a differently-shaped object. Adding field-specific logic here
would duplicate whatever validation the Provider itself is responsible
for (and which `NostrIdentityProvider`, per Alpha 046, deliberately
does not perform on these two fields either) and would make the
Service a second source of truth for what a "valid" `displayName`/
`avatar` looks like — a responsibility this Stage does not take on.

## 6. Registryが値を検証しない理由 (why `FedosIdentityRegistry` does not validate the values)

`FedosIdentityRegistry` (Alpha 041) is, and remains, a pure Map-backed
store — `register()`/`find()`/`list()`/`remove()`, all keyed on
`record.id`, none inspecting any other field. This Stage does not
modify the Registry's own API or implementation at all: it continues to
accept whatever `FedosIdentityRecord` shape callers construct, now
including a `displayName`/`avatar` it was not previously asked to
store. A store that validated the CONTENTS of what it holds, rather
than just the identity key it indexes by, would need to know the
business rules for every field ever added to the Record — an
ever-growing, layering-violating responsibility this repository's own
Identity Layer has consistently kept out of the Registry, and continues
to here.

## 7. displayName/avatarをoptional維持する理由 (why both fields remain optional)

No Provider in this repository is required, by this Stage's own
mandate, to populate either field on the Descriptor it produces — so
requiring them on the Record would force every Record-construction
site (including every prior guard-test file that already builds a
`FedosIdentityRecord` directly) to supply a value this Stage does not
mandate exists. Optionality also correctly models reality: a linked
identity legitimately may have no display name or no avatar, and a
Record that could not represent that state would be lying about what
the underlying Provider actually reported. This mirrors Alpha 044 §2's
and Alpha 045 §2's own identical reasoning for the Snapshot and
Descriptor respectively.

## 8. Runtimeへまだ渡さない理由 (why this stays disconnected from Runtime)

`FedosIdentityRegistry` is an in-memory, standalone store with no
Runtime reference before or after this Stage — `create_runtime.ts` does
not construct one, `AppRuntime` does not expose one, and no
`src/runtime/*` file imports anything from `src/identity/`. This
Stage's own mandate is explicit: Runtime, Worker, and Storage
connections all remain future, separately-reviewed Stages. Extending a
type two optional fields deeper into an already-isolated pipeline does
not change that isolation in either direction.

## 9. Authentication情報を持たない理由 (why the Record carries no Authentication-shaped data)

`FedosIdentityRecord` has never had, and does not gain here, any field
resembling a session token, credential, permission grant, or sign-in
state. `displayName`/`avatar` are exactly the same two fields Alpha 038
originally scoped as permissible — public, cosmetic, and already
visible wherever the underlying Provider's own public identifier is
visible. Nothing added by this Stage lets the Record answer "is this
caller authenticated" or "what can this caller do" — those remain
entirely outside this type's own responsibility, unchanged from every
prior Stage in this arc.

## 10. 秘密情報を持たない理由 (why the Record carries no secret information)

No private key, `nsec`, seed, mnemonic, or other secret material has
ever been representable in `FedosIdentityRecord`, and this Stage adds
no new field capable of holding one. `avatar` remains a URL/CID
reference only — its type is `string`, matching the Descriptor's and
Snapshot's own identical `avatar?: string`, never a binary/byte-array
field capable of embedding image data directly. This is Alpha 038 §2's
own BINDING constraint, applied a fourth time (Descriptor originally,
Snapshot at Alpha 044, Descriptor's own field at Alpha 045, now the
Record's own field here) — never a new decision, and never weakened.

## 11. What this Stage does NOT do

- Does **not** modify `fedos_identity_descriptor.ts` (Alpha 028/045) —
  the Descriptor's own five-field shape is unchanged.
- Does **not** modify `fedos_identity_registry.ts` (Alpha 041) — its
  own four-method API is unchanged, and it performs no new validation.
- Does **not** modify `fedos_identity_resolver.ts` (Alpha 043) — its
  own `findIdentity()`/`listIdentities()` pass through whatever the
  Registry holds, unchanged.
- Does **not** modify `fedos_identity_provider.ts`, any concrete
  `FedosIdentityProvider` implementation, `fedos_nostr_public_identity_source.ts`,
  or `fedos_null_nostr_public_identity_source.ts`.
- Does **not** validate, reformat, or normalize `displayName`/`avatar`
  anywhere in this Stage's own code.
- Does **not** wire `displayName`/`avatar` into Runtime, Worker, or
  Storage in any way.
- Does **not** modify `create_runtime.ts` or any `src/runtime/*` file.
- Does **not** change `Cargo.toml`, any Rust source, or `package.json`.
- Does **not** change any Public Runtime API signature.

## 12. See also

- `docs/secure_runtime_alpha_040_fedos_identity_record.md`
- `docs/secure_runtime_alpha_042_fedos_identity_service_registry_integration.md`
- `docs/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion.md`
- `docs/secure_runtime_alpha_045_fedos_identity_descriptor_expansion.md`
- `docs/secure_runtime_alpha_046_nostr_identity_provider_descriptor_expansion.md`
