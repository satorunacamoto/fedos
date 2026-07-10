# FedOS Secure Runtime Alpha 040 — FedOS Identity Record (Canonical Identity Model)

**Status: IMPLEMENTED — a single, minimal type only.** Adds
`FedosIdentityRecord` (`src/identity/fedos_identity_record.ts`) — the
first named shape for the "⑤ FedOS Identity中核" canonical model Alpha
026 §2/§6 recommended and Alpha 038 §2 (`linkedProtocols`'s own routing
destination) named but never built. This is a TYPE DEFINITION ONLY — no
Runtime wiring, no persistence, no Provider change, no Resolver change,
no Storage connection. This is the eleventh artifact in the FedOS
Identity arc (Alpha 028–040).

## 1. Why now

Alpha 038 §2 formally ROUTED three rejected `FedosIdentityDescriptor`
candidates to "a future SEPARATE canonical-identity model":
`linkedProtocols` (cross-provider mapping data), `device` (routed to the
existing `device_trust.ts` boundary instead, not this model), and,
implicitly, any future cross-provider reconciliation logic Alpha 026 §6
already named as the ⑤ direction. Until this Stage, that destination was
named in prose across four documents (Alpha 026 §2/§6, Alpha 037 §2,
Alpha 038 §2/§10) but had never been given an actual type. This Stage
gives it one — nothing more. Following this arc's own established
shape-first discipline (the same discipline that separated Alpha 028's
Descriptor from Alpha 031's Service from Alpha 032's Resolver, each its
own Stage), `FedosIdentityRecord` is introduced as a bare, three-field
type — deliberately matching `FedosIdentityDescriptor`'s own current
shape exactly, adding nothing Alpha 038 did not already formally
authorize.

## 2. The Record

```ts
export interface FedosIdentityRecord {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
}
```

Three fields, all `readonly string` — byte-for-byte the same field set
as `FedosIdentityDescriptor` (Alpha 028) today. No method, no class, no
default value, no constructor, no validation function.
`FedosIdentityRecord` is the ONLY export of its own file.

## 3. Descriptorとの差 (Descriptor vs. Record — the one distinction this Stage draws)

| | `FedosIdentityDescriptor` (Alpha 028) | `FedosIdentityRecord` (Alpha 040, this Stage) |
|---|---|---|
| **What it is** | A Read Model — the value `describeIdentity()` (Alpha 029) returns, fresh, on every call | A Canonical Model — the single, per-user shape a future Identity Layer would eventually PERSIST and reconcile across Providers |
| **Persistence** | Never persisted (Alpha 037 §3/Alpha 038 §3, reconfirmed) — recomputed every call | Intended, by future design, to be the thing that IS persisted — though this Stage builds no persistence mechanism |
| **Scope** | ONE Provider's own current report | Potentially spans MULTIPLE Providers once cross-protocol linkage (`linkedProtocols`, Alpha 038 §2) is ever built on top of it |
| **Who produces it today** | `NostrIdentityProvider`/`NoopFedosIdentityProvider`, via `describeIdentity()` | Nobody — no constructor, no factory, no mapping function exists anywhere in this repository as of this Stage |
| **Who consumes it today** | `FedosIdentityService` (Alpha 031), via pass-through | Nobody — zero importers by design (§8) |
| **Field shape today** | `id`/`provider`/`publicIdentifier` | `id`/`provider`/`publicIdentifier` — IDENTICAL, deliberately, since this Stage authorizes no divergence yet |

**This is the entire distinction this Stage draws, and no more**: a
Descriptor is a per-call, per-Provider SNAPSHOT; a Record is the
eventual per-user, cross-Provider RECORD a future Stage would build the
Descriptor-to-Record mapping and the Record's own persistence around.
Today, with identical fields and zero wiring on either side, the two
types are structurally interchangeable but SEMANTICALLY distinct — this
Stage's own guard test confirms they remain two independent
declarations (never a type alias of one to the other), because
conflating them would be a real category error even though their current
field sets happen to match: `FedosIdentityDescriptor` reads to `null` by
design when a Provider has nothing to report (this is a stable,
permanent property — see Alpha 033 §2/§4); `FedosIdentityRecord` has no
such "and it can be null too" property defined at all, because nothing
in this repository constructs one yet.

## 4. Capabilityとの責務 (boundary with `FedosIdentityCapability`, Alpha 030)

Unaffected by this Stage, and stays unaffected in principle:
`FedosIdentityCapability` answers "is this Provider usable at all" — a
question about a PROVIDER'S current availability, never about a
canonical, cross-Provider Record's own existence or completeness. A
future Record-holding layer might eventually ask "does a Record exist
for this user," but that is a DIFFERENT question from Capability's own
"is Provider X currently resolvable," and this Stage does not conflate
them — `FedosIdentityRecord` has no `available` field, and
`FedosIdentityCapability` has no `id`/`publicIdentifier` field, mirroring
Alpha 038 §4's own "zero field overlap, permanently, in both directions"
ruling, now reaffirmed a third time against a third type.

## 5. Providerとの責務 (boundary with `FedosIdentityProvider`/`NostrIdentityProvider`/`NoopFedosIdentityProvider`)

**No Provider constructs, returns, accepts, or references
`FedosIdentityRecord` — confirmed by direct inspection of every file
this Stage did not touch.** `FedosIdentityProvider`'s own single method,
`describeIdentity()`, is typed to return `FedosIdentityDescriptor | null`
— unchanged, and this Stage does not add a second method, a second
Provider-shaped interface, or any Record-returning capability anywhere.
`NostrIdentityProvider` (Alpha 035/039) still delegates to its injected
`FedosNostrPublicIdentitySource` and still maps only onto
`FedosIdentityDescriptor` — this Stage adds no Record-mapping logic to
it. The eventual relationship (a future Stage's own scope, not this
one) would be: one or more Descriptors, over time, feed into a Record's
own eventual construction/reconciliation — never the reverse, and never
today.

## 6. Storageとの責務 (boundary with Storage)

**Zero Storage reference of any kind** — `fedos_identity_record.ts`
imports nothing, and this Stage's own guard test confirms no
`src/runtime/*` file references `FedosIdentityRecord` anywhere. This
continues, rather than revisits, Alpha 026 §3's "MUST NOT hold... a
`RuntimeStorageBackend` instance... directly" rule and Alpha 038 §7's
own reconfirmation: if `FedosIdentityRecord` is ever persisted by a
future Stage, that Stage's own design would go through
`storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()` exactly like
any other caller — this Stage builds no such mechanism, and the Record
type itself carries no Storage-shaped field (no `AeadCiphertextWire`, no
backend reference) that could even hint at bypassing that discipline.

## 7. Runtimeとの責務 (boundary with Runtime)

**Zero Runtime reference of any kind** — confirmed by direct inspection:
`create_runtime.ts`, `types.ts`, and every other `src/runtime/*` file
have zero reference to `FedosIdentityRecord`, and
`fedos_identity_record.ts` itself imports nothing from `src/runtime/*`.
Runtime remains Crypto/Storage/Environment-only (Alpha 026 §4); this
Stage does not create a fourth concern for it, and does not make Runtime
aware a canonical Identity model now has a name.

## 8. Protocol Adapterとの責務 (boundary with Protocol Adapters — Nostr/ActivityPub/Bluesky/Session)

**No Protocol Adapter of any kind reads, writes, or references
`FedosIdentityRecord`** — this repository still has zero Protocol
Adapter implementations (Alpha 027 §8's own exclusion list, still
respected). When a future Protocol Adapter and a future Record-holding
layer both eventually exist, the correct relationship (per Alpha 026 §5
and Alpha 038 §8's own translation-only boundary, extended one layer
further) would be: each Protocol Adapter still translates its own native
identity concept into a `FedosIdentityDescriptor` first, via a Provider
— never directly into a `FedosIdentityRecord`. A Record, if a future
Stage ever builds the mechanism, would be assembled FROM one or more
Descriptors by a future reconciliation layer, not populated directly by
a Protocol Adapter. This keeps Protocol-specific vocabulary two full
layers away from `FedosIdentityRecord`, not merely one.

## 9. 将来displayName/avatarを追加する場合の方針 (the future `displayName`/`avatar` policy)

Alpha 038 §2 formally ADOPTED `displayName`/`avatar` for
`FedosIdentityDescriptor`, reserved for "a future, separately-reviewed
implementation Stage." This Stage's own position on how that decision
applies to `FedosIdentityRecord`:

- **The Alpha 038 decision was scoped to the Descriptor, not
  automatically to the Record.** `FedosIdentityRecord` is a NEW type
  this Stage introduces — Alpha 038 could not, and did not, rule on a
  type that did not exist yet. This Stage does not retroactively expand
  Alpha 038's own scope to cover it.
- **The most likely future outcome is that BOTH types eventually gain
  `displayName`/`avatar` together, in the SAME future Stage** — since a
  canonical Record's own `displayName`/`avatar` would most naturally be
  derived FROM (or reconciled across) the `displayName`/`avatar` values
  one or more Descriptors report, once those exist on the Descriptor
  side. Building the Record's own optional fields before the Descriptor
  side exists would have nothing to be populated FROM.
- **This Stage does not schedule, name, or number that future Stage.**
  It only records the reasoning so a future Stage reviewing this
  decision does not have to re-derive it: extend `FedosIdentityDescriptor`
  first (per Alpha 038 §10 item 1), then extend `FedosIdentityRecord` to
  match, in whichever order or combination that future Stage's own
  review determines is correctly scoped.

## 10. まだ追加しない理由 (why every other candidate stays excluded)

Every term this Stage's own mandate explicitly excludes, and why, item
by item — extending Alpha 028 §4's own exclusion-table discipline to
this second type:

| Excluded term | Why |
|---|---|
| `displayName`/`avatar` | Deferred per §9 — not yet on the Descriptor side either, so nothing exists yet for a Record-side field to be derived from. |
| `profile` | Same reasoning Alpha 037 §2/Alpha 038 §2 already gave for the Descriptor: an open, unreviewed bag defeats field-by-field public-safety review — REJECTED there, and not reconsidered here for a second type. |
| `metadata` | Identical reasoning to `profile`. |
| `linkedProtocols` | This is the eventual REASON `FedosIdentityRecord` exists at all (§1) — but adding the field itself, before any reconciliation mechanism exists to populate it meaningfully, would be building ahead of need. A future Stage that actually implements cross-Provider linkage is the correct place to add it. |
| `device` | Alpha 038 §2 routed this to the ALREADY-EXISTING `device_trust.ts`/`device_registration.ts` boundary, explicitly not to any future canonical-identity model — this Stage does not reopen that routing decision. |
| `createdAt`/`updatedAt` | Alpha 038 §2 routed these to "a future SEPARATE persistence-record model, IF Identity persistence is ever built" — arguably `FedosIdentityRecord` IS that eventual model, but this Stage builds no persistence mechanism for it yet, so there is no honest "created"/"updated" moment to timestamp today, mirroring Alpha 037 §3's own reasoning for the Descriptor exactly. |
| `capability` | `FedosIdentityCapability` (Alpha 030) already exists as the correct, separate home for availability questions — see §4. |
| `status` | No lifecycle or state-machine concept belongs on a plain data shape — mirrors Alpha 028 §3's own "it is a static label, not a process" finding for the Descriptor. |
| `authentication`/`credential`/`session` | Permanently excluded per Alpha 038 §2's own "REJECTED, permanently, on `FedosIdentityDescriptor` or ANY future Identity-content model this decision authorizes" ruling — `FedosIdentityRecord` is exactly the kind of future Identity-content model that ruling already covers; this Stage does not need to re-argue it, only respect it. |
| `secret`/`privateKey`/`seed`/`mnemonic` | Permanently excluded per Alpha 007 §6/Alpha 038 §2's own unconditional, no-future-model-exception ruling — the one candidate class with NO escape hatch of any kind, reaffirmed here for a second type. |
| `AeadKeyHandle` | This type has no relationship to Secure Runtime's Crypto Layer opaque handles — see §6/§7. |
| `Storage`-shaped fields | See §6 — this type is not wired into any Storage API and carries no Storage-internal construct. |
| `Runtime`-shaped fields | See §7. |

## 11. What this Stage does NOT do

- Does **not** implement a canonical-identity reconciliation mechanism,
  factory, or mapping function of any kind — `FedosIdentityRecord` has
  zero constructors, zero producers, and zero consumers in this
  repository as of this Stage.
- Does **not** modify `fedos_identity_descriptor.ts` (Alpha 028),
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
- Does **not** add authentication, credential, session, or Relay/DM
  handling of any kind.
- Does **not** add a constructor, class, function, or default export of
  any kind — this file exports exactly one `interface`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.
- Does **not** change any Public Runtime API signature.

## 12. See also

- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md` (Secure
  Runtime Alpha 028) — `FedosIdentityDescriptor`'s own shape and
  exclusion-table format this Stage's §3/§10 directly reuses and
  extends.
- `docs/secure_runtime_alpha_026_identity_layer_boundary_review.md`
  (Secure Runtime Alpha 026) — §2/§6's own "⑤ FedOS Identity中核"
  canonical-model direction this Stage finally gives a named type to.
- `docs/secure_runtime_alpha_030_fedos_identity_capability.md` /
  `secure_runtime_alpha_031_fedos_identity_service_skeleton.md` (Secure
  Runtime Alpha 030/031) — the Capability/Service boundaries this
  Stage's §4/§5 reaffirm remain unaffected.
- `docs/secure_runtime_alpha_037_fedos_identity_descriptor_field_review.md`
  / `secure_runtime_alpha_038_fedos_identity_descriptor_decision.md`
  (Secure Runtime Alpha 037/038) — the eight-plus-two candidate
  ADOPT/REJECT/ROUTE decision this Stage's §9/§10 apply, unmodified, to
  a second type.
- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
  (Secure Runtime Alpha 039) — the most recent Provider-side change,
  confirmed unaffected by this Stage's own guard test.
