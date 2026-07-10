# FedOS Secure Runtime Alpha 030 — FedOS Identity Capability

**Status: IMPLEMENTED — a single interface only.** Adds
`FedosIdentityCapability` (`src/identity/fedos_identity_capability.ts`)
— two fields, no method, no implementation, no Resolver, no Service, no
Runtime wiring. This Stage continues Alpha 028's
`FedosIdentityDescriptor` and Alpha 029's `FedosIdentityProvider`,
adding the third and (for now) final minimal artifact: a plain value
naming whether a given provider is available at all.

## 1. Why now

Alpha 029 named the CONTRACT (`FedosIdentityProvider`) a future provider
implementation would satisfy to describe a LINKED identity
(`describeIdentity()`). It left open a real, adjacent question a future
caller would also need answered before ever calling `describeIdentity()`
usefully: "does this provider even exist/apply right now?" — a
DIFFERENT question from "what identity does it currently describe."
This Stage names that answer's shape, as its own, separate, minimal
value type — not a new method on `FedosIdentityProvider` (see §7), not
a Resolver, not an implementation.

## 2. The Capability

```ts
export interface FedosIdentityCapability {
  readonly provider: string;
  readonly available: boolean;
}
```

Two fields, nothing else:

- **`provider`** — the SAME kind of plain, unconstrained `string` label
  used on `FedosIdentityDescriptor.provider` (Alpha 028) and
  `FedosIdentityProvider.provider` (Alpha 029) — naming which provider
  this capability describes. No protocol-specific vocabulary is
  introduced here either.
- **`available`** — a plain `boolean` answering EXACTLY ONE question:
  is this provider usable right now, at all? Nothing more granular, and
  nothing less.

No method, no class, no default value, no constructor.
`FedosIdentityCapability` is the ONLY export of its own file.

## 3. Capability責務 (responsibility) — availability, and only availability

`FedosIdentityCapability` answers ONE question: **"is this provider
available?"** It does NOT answer, and is deliberately incapable of
representing:

- Whether any user has signed in through this provider (that is an
  authentication ATTEMPT/status concern — §7 explicitly separates it).
- Whether a session is currently active (a session lifecycle concern,
  already modeled elsewhere by `src/identity/session_boundary.ts`,
  unrelated to and unreferenced by this type).
- Whether a network/protocol connection is currently open (a
  connectivity concern this arc has consistently kept out of the
  Identity layer — Storage/Crypto/Environment are Secure Runtime's own
  three concerns, per Alpha 026 §4, and connectivity is closer to those
  than to a provider-availability flag).
- Any credential, token, or descriptive profile data of any kind.

A `true` value means only "this provider mechanism could, in principle,
be asked" — never "a user is authenticated," never "data is currently
flowing." This distinction matters precisely because a caller checking
`available` before calling `describeIdentity()` must not be misled into
believing `available: true` implies anything about identity, session, or
connection state — it implies only that asking is not immediately
pointless.

## 4. Descriptorとの違い (difference from `FedosIdentityDescriptor`)

| | `FedosIdentityDescriptor` (Alpha 028) | `FedosIdentityCapability` (Alpha 030) |
|---|---|---|
| **Represents** | ONE linked identity's own value (`id`/`provider`/`publicIdentifier`) | Whether a provider is usable AT ALL — no identity data |
| **Cardinality** | Exists per LINKED IDENTITY (a user could have zero, one, or several) | Exists per PROVIDER (independent of whether any identity is linked through it) |
| **Field count** | Three (`id`, `provider`, `publicIdentifier`) | Two (`provider`, `available`) |
| **Can exist with no linked identity?** | No — its very existence implies a link | Yes — `available: true` with NO identity ever linked is a perfectly normal state |

They share only the `provider` label field, by the same deliberate
parallelism already noted for `FedosIdentityProvider` (Alpha 029 §3) —
never a merge, never an extension of one into the other.

## 5. Providerとの違い (difference from `FedosIdentityProvider`)

| | `FedosIdentityProvider` (Alpha 029) | `FedosIdentityCapability` (Alpha 030) |
|---|---|---|
| **Kind of thing** | A CONTRACT — an interface with a method | A plain VALUE — an interface with no method |
| **Job** | Obtain (or learn there is none of) a linked identity | Report whether the provider itself is usable |
| **Async?** | Yes (`describeIdentity()` returns a `Promise`) | N/A — a value has no execution, nothing to await |
| **Held vs. computed** | An implementation COMPUTES a `FedosIdentityDescriptor` when asked | A `FedosIdentityCapability` is itself a data point — see §7 for how a future caller might obtain one |

`FedosIdentityCapability` is not a "smaller `FedosIdentityProvider`" —
it is a different KIND of artifact (a result value, not a contract) that
a future caller would consult, likely BEFORE deciding whether to call
`describeIdentity()` on a matching `FedosIdentityProvider` at all.

## 6. Runtimeとの責務分離 (separation from Secure Runtime)

`fedos_identity_capability.ts` imports NOTHING — not
`FedosIdentityDescriptor`, not `FedosIdentityProvider`, and nothing from
`src/runtime/` at all. It is the simplest of the three Identity
artifacts this arc has added so far (Alpha 028/029/030), with zero
dependency even within `src/identity/` itself. Consistent with Alpha
026 §3/§4: Runtime holds no Identity semantics, and this type holds no
Runtime reference either.

## 7. Authenticationとの責務分離 (separation from authentication) — and the `describeCapability()` review

**`available` is never an authentication/login/connection status.**
This Stage reaffirms, and narrows further, Alpha 029 §5's own
distinction:

- The EXISTING `src/identity/provider_types.ts` already exports a
  DIFFERENT, unrelated type that happens to share the English word
  "Capability" — `IdentityProviderCapability` (a union of four
  `*_placeholder` labels an AUTHENTICATION provider might one day
  advertise, e.g. `"apple_placeholder"`). **This is flagged explicitly
  to avoid confusion**: `FedosIdentityCapability` (this Stage) and
  `IdentityProviderCapability` (Alpha 027 §2/existing) are two
  unrelated types in two unrelated concerns — one is a per-provider
  boolean AVAILABILITY flag for the new Protocol Identity layer, the
  other is a set of named, still-unimplemented AUTHENTICATION-method
  labels for the existing AUTH-provider boundary. Neither imports,
  extends, or references the other.
- `src/identity/session_boundary.ts`'s own session-lifecycle concern
  and `provider_boundary.ts`'s own `idle → waiting → authenticated →
  cancelled/error` attempt lifecycle (Alpha 029 §5) both remain entirely
  separate, unreferenced concerns.

**Reviewed, per this Stage's own mandate, but NOT implemented**: a
future `describeCapability(): Promise<FedosIdentityCapability>` method
on `FedosIdentityProvider` (Alpha 029) is architecturally sound and
would be a natural, INDEPENDENT companion to `describeIdentity()` — a
provider implementation could answer "am I available" without needing
to also answer "what identity do I currently describe," and a caller
could cheaply check availability before paying the cost of the fuller
query. This would NOT collapse the two methods into one, would NOT
change `describeIdentity()`'s own signature, and would NOT require
`FedosIdentityCapability` to gain any new field. **`fedos_identity_provider.ts`
is NOT modified by this Stage** — this review names a plausible future
addition without authorizing it; a future, separately-reviewed Stage
would need to make that decision for real.

## 8. 将来Resolverとの関係 (relationship to a future Resolver — not built)

Exactly as Alpha 029 §7 already described for `FedosIdentityProvider`
itself: a future Resolver (mirroring `resolveRuntimeStorageBackend()`)
would eventually be the thing that, given a `provider` label, returns
BOTH a `FedosIdentityCapability` (is it available) and a
`FedosIdentityProvider` (how to ask it for an identity) — or perhaps
consults `FedosIdentityCapability` values to decide WHICH
`FedosIdentityProvider` to hand back at all (skipping unavailable ones).
Neither the Resolver nor any implementation producing a real
`FedosIdentityCapability` value exists after this Stage. This type is
the SHAPE such logic would eventually consume/produce — nothing is
built to compute it yet.

## 9. What this Stage does NOT do

- Does **not** implement any producer of a real
  `FedosIdentityCapability` value (no function, no class).
- Does **not** implement a Resolver of any kind.
- Does **not** implement a FedOS Identity Service.
- Does **not** implement any `FedosIdentityProvider`.
- Does **not** add authentication, login, or connection status of any
  kind.
- Does **not** add a `Session`, `Credential`, `Profile`, or `Metadata`
  field or type.
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029) — the
  reviewed `describeCapability()` addition (§7) is advisory only.
- Does **not** modify `fedos_identity_descriptor.ts` (Alpha 028).
- Does **not** modify `provider_boundary.ts`/`provider_types.ts` or any
  other existing `src/identity/*` file.
- Does **not** wire `FedosIdentityCapability` into Runtime, Worker, or
  any other module — it has zero importers by design.
- Does **not** connect Nostr, ActivityPub, AT Protocol, or Session in
  any way.
- Does **not** change any `src/runtime/*` file or any Public Runtime
  API signature.
- Does **not** change `src/worker.ts`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.

## 10. See also

- `docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md`
  (Secure Runtime Alpha 029) — the unmodified `FedosIdentityProvider`
  contract this Stage's §5/§7 differentiates from and reviews a future
  companion method against.
- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md` (Secure
  Runtime Alpha 028) — the unmodified `FedosIdentityDescriptor` value
  this Stage's §4 differentiates from.
- `docs/secure_runtime_alpha_027_identity_foundation_inventory.md`
  (Secure Runtime Alpha 027) — the existing `IdentityProviderCapability`
  type (`provider_types.ts`) this Stage's §7 explicitly distinguishes
  `FedosIdentityCapability` from, by name, to avoid confusion.
- `docs/secure_runtime_alpha_026_identity_layer_boundary_review.md`
  (Secure Runtime Alpha 026) — the Runtime/authentication responsibility
  boundaries this Stage's §6/§7 reapply.
