# FedOS Secure Runtime Alpha 028 — FedOS Identity Descriptor

**Status: IMPLEMENTED — a single, minimal type only.** Adds
`FedosIdentityDescriptor` (`src/identity/fedos_identity_descriptor.ts`)
— the one candidate Alpha 027 §9 recommended for this Stage, and
nothing else. No Identity Service, no Identity Provider, no Bridge, no
Runtime wiring, no Nostr connection. This is a type definition only.

## 1. Why now

Alpha 027 inventoried every existing Identity-related file in this
repository and formally decided Option C: add a new, correctly-scoped
Protocol Identity abstraction rather than repurposing the existing
`src/identity/provider_boundary.ts` (an AUTHENTICATION-reference
boundary, a structurally different concern). Alpha 027 §7 named the
minimal shape such an abstraction would eventually need and §9
recommended it, alone, as the single next Stage — smaller than an
Identity Service, smaller than a Provider Interface, smaller than a
Nostr Adapter review — the smallest possible unit of real forward
progress with zero risk to any existing file. This Stage is exactly
that recommendation, and nothing more.

## 2. The Descriptor

```ts
export interface FedosIdentityDescriptor {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
}
```

Three fields, all `readonly string`:

- **`id`** — a caller-supplied, opaque local identifier for this linked
  identity. Its exact meaning, format, and origin are intentionally
  left undecided by this Stage — consistent with Alpha 027 §7's own
  "left UNDECIDED... consistent with the mandate."
- **`provider`** — a label naming which provider this identity came
  through. Deliberately a PLAIN `string`, not a fixed union of named
  values — see §4/§6 for why no protocol-specific vocabulary is
  introduced here.
- **`publicIdentifier`** — the PUBLIC-by-definition identifier the
  provider/protocol already exposes (an npub, an actor URI, a DID —
  whatever the eventual provider happens to use). Never a value that
  is secret in its own protocol's own model.

No method, no class, no default value, no constructor, no validation
function. `FedosIdentityDescriptor` is the ONLY export of its own file.

## 3. Descriptor責務 (responsibility)

This type represents exactly one thing: **a label naming that "this
opaque local id, from this provider, corresponds to this public
identifier."** It is a pure data shape — it does not:

- Validate anything (no function of any kind exists in this file).
- Resolve, look up, or map between providers.
- Carry any behavior, lifecycle, or state transition (compare this to
  `provider_types.ts`'s own `IdentityProviderStatus`, which models an
  authentication attempt's lifecycle — this type has no such
  dimension; it is a static label, not a process).
- Decide anything about trust, verification, or ownership. A
  `FedosIdentityDescriptor` existing says nothing about whether the
  `publicIdentifier` was ever cryptographically confirmed to belong to
  whoever supplied it — that determination, if it is ever needed,
  belongs to a future, separately-reviewed layer, not this type.

Its ONLY job is to be a shape a future Identity layer could hold one of,
per linked identity — nothing is built to hold it yet.

## 4. 除外項目 (exclusion list) — every term, and why

Per this Stage's own explicit mandate, NONE of the following appears
anywhere in `fedos_identity_descriptor.ts` — confirmed by direct,
case-sensitive-aware source inspection (this Stage's own test suite):

| Excluded term | Why |
|---|---|
| `privateKey` | This type never carries key material of any kind, public or private. |
| `secret` | No field of any kind may hold secret data — `publicIdentifier` is PUBLIC by definition. |
| `seed` | Key/identity derivation is entirely out of this type's scope. |
| `mnemonic` | Same reasoning as `seed`. |
| `AeadKeyHandle` | This type has no relationship to Secure Runtime's Crypto Layer opaque handles at all — it does not reference, wrap, or serialize one. |
| `Ciphertext` | This type is never encrypted data or a reference to any — it is a plain, public label. |
| `RuntimeCapabilities` | This type has no relationship to Runtime's own environment-report shape. |
| `Storage` | This type is not wired into `storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()` or any Storage Backend — it is not persisted anywhere by this Stage. |
| `Worker` | Zero reference — this Stage explicitly does not connect Worker. |
| `Relay` | No relay/network concept belongs at this layer — see §6. |
| `Profile` | A user-facing profile (display name, bio, avatar, etc.) is a distinct, much larger concern than a bare identity label; not scoped here. |
| `Avatar` | Same reasoning as `Profile`. |
| `Metadata` | This type carries exactly three named fields, never an open-ended metadata bag — that would reintroduce the "Arbitrary Object Store" risk Alpha 025 §3 already rejected, one layer up. |
| `UI` | This is a pure data type with zero rendering/presentation concern. |
| `Session` | A session lifecycle (per `src/identity/session_boundary.ts`) is a different, already-existing concern this type does not model or reference. |
| `Credential` | No token, JWT, or credential of any kind is representable by this type's own three fields. |
| `Authentication` | This type names a LINK, not an authentication ATTEMPT or its outcome — no status/lifecycle field exists here, unlike `provider_types.ts`'s own `IdentityProviderStatus`. |
| `Passkey` | No relationship to the existing Passkey/WebAuthn boundary (`src/identity/passkey_boundary.ts`/`webauthn_adapter.ts`) — a separate, unmodified concern. |

## 5. Identity Layerとの関係

Per Alpha 026/027's own confirmed layering:

```txt
Application
    |
    v
Protocol Adapter                   (not built)
    |
    v
FedOS Identity Service              (not built -- would eventually hold/manage FedosIdentityDescriptor values)
    |
    v
Identity Provider Boundary          (existing provider_boundary.ts, unmodified; a future Protocol Identity
    |                                Provider, not built)
    v
Secure Runtime
```

`FedosIdentityDescriptor` is the shape a FUTURE Identity Service would
hold — it is NOT the Service itself, and this Stage builds no Service,
no storage for it, no lookup function, and no wiring of any kind. The
type exists today purely as a named, reviewed, guard-tested shape a
later Stage can build against, exactly as Alpha 027 §9 scoped it.

## 6. Protocol Adapterとの関係

A future Protocol Adapter (Nostr, ActivityPub, AT Protocol, Session —
none built) would eventually be the thing that PRODUCES a
`FedosIdentityDescriptor` (from its own protocol-specific identity
concept) and hands it to a future Identity Service — never the reverse,
and never directly to Secure Runtime. This is why `provider` stays a
plain `string` rather than a union of named protocol values today:
fixing `"nostr" | "activitypub" | ...` into this type NOW would mean
`FedosIdentityDescriptor` itself starts carrying Protocol-specific
vocabulary — exactly what Alpha 026 §5 already forbade ("each Protocol
must NOT bring its own event semantics down into Identity Layer's own
interface"). Naming a fixed provider union is explicitly deferred to
whichever future Stage actually builds the first real Protocol Adapter,
when the real, needed value set is known rather than guessed.

## 7. 将来拡張方針 (future extension direction — advisory only)

- `provider: string` MAY later become a union of named literal values,
  once a real Protocol Adapter needs one — deferred by this Stage, not
  decided.
- A future Identity Service (Alpha 027 §9 candidate 3, still premature)
  would be the first real consumer/holder of this type.
- A future Protocol Identity Provider Interface (Alpha 027 §5 Option C)
  would be the first real producer, via a per-protocol Adapter.
- None of the above is scoped, designed, or authorized by this Stage —
  each remains its own, separately-reviewed future Stage.

## 8. What this Stage does NOT do

- Does **not** implement a FedOS Identity Service.
- Does **not** implement a FedOS Identity Provider or Provider
  Interface.
- Does **not** implement any Bridge (Identity ↔ anything).
- Does **not** wire `FedosIdentityDescriptor` into Runtime, Worker, or
  any other module — it has zero importers by design.
- Does **not** connect Nostr, ActivityPub, AT Protocol, or Session in
  any way.
- Does **not** change any `src/runtime/*` file or any Public Runtime
  API signature.
- Does **not** change any existing `src/identity/*` file.
- Does **not** change `src/worker.ts`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.

## 9. See also

- `docs/secure_runtime_alpha_027_identity_foundation_inventory.md`
  (Secure Runtime Alpha 027) — the inventory and Option C decision this
  Stage directly implements the §7/§9 recommendation of.
- `docs/secure_runtime_alpha_026_identity_layer_boundary_review.md`
  (Secure Runtime Alpha 026) — the layering (Runtime holds no Identity
  semantics; Protocol must not push semantics into Identity's own
  interface) this Stage's §6 applies to the `provider` field.
- `docs/secure_runtime_alpha_025_secure_storage_api_scope_review.md`
  (Secure Runtime Alpha 025) — the "no Arbitrary Object Store" finding
  this Stage's §4 (`Metadata` row) reapplies at the Identity layer.
