# FedOS Secure Runtime Alpha 038 — FedOS Identity Descriptor Decision

**Status: REVIEW / DESIGN DECISION ONLY. No implementation of any kind.
`fedos_identity_descriptor.ts` and every other `src/identity/` file,
every `src/runtime/*` file, `src/worker.ts`, Rust, `Cargo.toml`, and
`package.json` are all byte-for-byte unchanged. This document formally
ratifies Alpha 037's own field-by-field review into a binding decision
— which candidates are ADOPTED (as a future, separately-reviewed
implementation Stage's own mandate), which are REJECTED permanently,
and which are routed to a future SEPARATE model — and formally answers
six mandated responsibility-boundary questions. This document and its
guard test are the entire deliverable.**

## 0. Where this picks up

Alpha 037 reviewed eight candidate fields for a future,
multi-protocol-aware `FedosIdentityDescriptor` — `displayName`,
`avatar`, `profile`, `linkedProtocols`, `capabilities`, `device`,
`metadata`, and `createdAt`/`updatedAt` — and answered seven
responsibility-boundary questions, but explicitly stopped short of a
binding decision: its own §11 states "§2's ADOPT verdicts... are
advisory recommendations for a FUTURE Stage's own scope, not a
pre-approval this Stage grants on that future Stage's behalf." **This
Stage is that formal ratification.** It does not re-review any
candidate from first principles — it converts Alpha 037's own
per-candidate reasoning into an official ADOPT/REJECT/DEFER-TO-FUTURE-MODEL
decision, and adds two boundary questions Alpha 037 did not cover
(Identity Service, Protocol Adapter) to the five it already answered.

## 1. Decision — current shape, reconfirmed unchanged

```ts
export interface FedosIdentityDescriptor {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
}
```

**Decision: no field is added, removed, or renamed by this Stage.** The
interface remains exactly as Alpha 028 shipped it. Every decision below
concerns what a FUTURE, separately-reviewed implementation Stage is now
authorized (or not authorized) to do — this Stage authorizes zero
implementation of its own, mirroring Alpha 012 §4's own "adopts ③... no
code is written here" precedent exactly.

## 2. Formal decision table — all eight Alpha 037 candidates

| Candidate | Alpha 037 verdict | **Formal decision (this Stage)** |
|---|---|---|
| `displayName` | ADOPT (future Stage) | **ADOPTED.** A future, separately-reviewed implementation Stage is authorized to add `displayName: string \| null` (or equivalently-shaped optional field) to `FedosIdentityDescriptor`. Not implemented here. |
| `avatar` | ADOPT, as a reference only | **ADOPTED, with the reference-only constraint made BINDING.** A future Stage is authorized to add `avatar` ONLY as a URI/reference-shaped `string \| null` — never embedded image bytes. A future proposal that embeds bytes directly is REJECTED by this decision in advance, not merely discouraged. |
| `profile` (open bag) | REJECT | **REJECTED, permanently.** No future Stage may add an open, free-form `profile` field to `FedosIdentityDescriptor`. Any concrete profile-shaped content must be proposed as its own named, individually-reviewed field (as `displayName`/`avatar` already were), never a container. |
| `metadata` (open bag) | REJECT | **REJECTED, permanently.** Identical ruling and identical reasoning to `profile` — an open bag cannot be tested against §9's public-safety rule field by field. |
| `linkedProtocols` | REJECT at this type | **REJECTED at `FedosIdentityDescriptor`; ROUTED to a future SEPARATE canonical-identity model.** Cross-provider identity linkage remains real, needed content — but it belongs to the "⑤ FedOS Identity中核" canonical model Alpha 026 §2/§6 already scoped as its own type, not to any single Provider's own Descriptor. This decision does not schedule or design that future model; it only confirms `linkedProtocols` may never land on THIS type. |
| `capabilities` | REJECT | **REJECTED, permanently, on this type.** `FedosIdentityCapability` (Alpha 030) already exists as the correct, separate home for this question — see §4 below. This is not a "future model" deferral; the correct model already ships in this repository today. |
| `device` | REJECT (for now) | **REJECTED on `FedosIdentityDescriptor`; ROUTED to the EXISTING `device_trust.ts`/`device_registration.ts` boundary.** Unlike `linkedProtocols`, the target model here is not hypothetical — it already exists in `src/identity/` today. Any future device-identity work belongs there, reviewed on its own terms, never as a Descriptor field. |
| `createdAt` / `updatedAt` | REJECT on this type | **REJECTED on `FedosIdentityDescriptor`; ROUTED to a future SEPARATE persistence-record model, IF Identity persistence is ever built.** Per §1's own reconfirmation (below) that the Descriptor is not persistent data, these timestamps have no honest value on this type; they belong on whatever future storage-layer record WRAPS Descriptor-shaped data, should one ever be designed. |

Two additional items this Stage's own mandate names explicitly, both
already covered by Alpha 037 §8/§9 and both formally closed here:

| Candidate | Alpha 037 verdict | **Formal decision (this Stage)** |
|---|---|---|
| Authentication情報 (session tokens, login timestamps, MFA status, credential ids) | MUST NOT hold | **REJECTED, permanently, on `FedosIdentityDescriptor` or ANY future Identity-content model this decision authorizes.** Routed to the ALREADY-EXISTING, separate boundary family — `session_boundary.ts`, `passkey_boundary.ts`, `provider_boundary.ts`/`provider_types.ts` — which this decision reaffirms as the correct, permanent home for authentication-shaped state. Unlike `linkedProtocols`/`device`/`createdAt`, this exclusion is NOT scoped to "not on Descriptor specifically" — it applies to any future Identity Layer content type this arc might ever build. |
| 秘密情報 (raw private keys, raw AEAD key material, any secret) | MUST NOT hold | **REJECTED, permanently and unconditionally — no future model, of any kind, may hold it either.** This is the one candidate in this entire review with NO "route to a future model" option, because no future Identity-content model this arc could authorize is permitted to hold secret material under any circumstance (Alpha 007 §6, reaffirmed permanent). This is a ceiling on the ENTIRE Identity Layer, not a per-type routing decision. |

## 3. Descriptorの責務 (the Descriptor's own responsibility, reconfirmed and formally fixed)

**`FedosIdentityDescriptor` describes exactly one thing: what ONE
`FedosIdentityProvider` currently reports about the identity it
represents — a non-persistent, protocol-agnostic, public-safe snapshot,
recomputed fresh on every `describeIdentity()` call.** After this
Stage's §2 decisions, its authorized eventual shape (once a future
Stage implements it) is: `id`, `provider`, `publicIdentifier`
(unchanged, Alpha 028), plus `displayName` and `avatar` (ADOPTED,
unimplemented). Nothing else may ever be added without its own,
separate, future review — this Stage's decision is exhaustive for the
eight-plus-two candidates it considers, not merely illustrative.

## 4. Identity Capabilityとの境界 (boundary with `FedosIdentityCapability`, Alpha 030)

**Formally fixed: zero field overlap, permanently.** `FedosIdentityCapability`
(`provider: string`, `available: boolean`) answers "is this provider
usable at all" — a check performed BEFORE asking. `FedosIdentityDescriptor`
answers "what did this provider report" — content received (or `null`)
AFTER asking. `FedosIdentityService` (Alpha 031) already encodes this
split structurally, with `describeCapability()` and `describeIdentity()`
as two separate pass-through methods that never share a field. This
decision formally forbids §2's `capabilities` candidate from ever
crossing this boundary in either direction — `FedosIdentityCapability`
may never grow Descriptor-shaped content (a public identifier, a
display name) either, for the identical reason in reverse.

## 5. Identity Serviceとの境界 (boundary with `FedosIdentityService`, Alpha 031)

**Formally fixed: the Service remains PURE DELEGATION and never
synthesizes, caches, or derives Descriptor content.** `FedosIdentityService`'s
own doc comment already states this design: `describeIdentity()` "calls
`provider.describeIdentity()` directly and returns its result
unchanged," with no caching, no derivation, no lifecycle tracking. This
decision reaffirms that boundary explicitly for the future — even once
`displayName`/`avatar` are implemented (§2), and even if a future
cross-protocol canonical model (routed destination for `linkedProtocols`,
§2) is ever built, `FedosIdentityService` must not become the place
where multiple Providers' Descriptors are merged, cross-referenced, or
aggregated into a canonical identity. That responsibility, if it is
ever built, belongs to its own future, separately-reviewed component —
never smuggled into the Service's existing "wrap exactly one Provider"
mandate (Alpha 031 §-, its own doc comment: "wraps exactly ONE
`FedosIdentityProvider`").

## 6. Runtimeとの境界 (boundary with Runtime)

**Formally fixed, and confirmed already true today by direct source
inspection (Alpha 037 §10, reconfirmed here — zero `src/runtime/*` file
references `FedosIdentityDescriptor` anywhere in this repository).**
Runtime remains Crypto/Storage/Environment-only (Alpha 026 §4); the
Descriptor must never become a Runtime parameter or return type, and no
future Descriptor field may hold a Runtime-internal opaque handle
(`AeadKeyHandle`, `AeadCiphertextHandle`) directly. Neither
`displayName` nor `avatar` (§2's two ADOPTED candidates) requires any
Runtime-issued material — both are plain, caller-suppliable strings —
so this decision's own ADOPT verdicts introduce no new Runtime coupling
of any kind.

## 7. Storageとの境界 (boundary with Storage)

**Formally fixed, and confirmed already true today (same grep as §6).**
The Descriptor stays storage-blind: it may never hold a
`RuntimeStorageBackend` instance or any other Storage-internal
construct, and it never persists itself. Per §1's own reconfirmation
that the Descriptor is non-persistent data, any future persistence of
Descriptor-shaped content must happen through a caller explicitly
calling `storeCiphertext()` with an already-encrypted wire value it
derived FROM Descriptor data — never through the Descriptor type
gaining a Storage-shaped field or a self-persisting method. This is the
same ruling §2 already gives `createdAt`/`updatedAt`: those timestamps,
if ever needed, belong to the future storage-layer record that WRAPS
Descriptor data, not to the Descriptor itself.

## 8. Protocol Adapterとの境界 (boundary with Protocol Adapters — Nostr/ActivityPub/Bluesky/Session)

**Formally fixed: each Protocol Adapter TRANSLATES its own native
identity shape into the Descriptor's generic, protocol-agnostic fields
— never the reverse, and never by leaking native shapes downward.**
This is Alpha 026 §5's own Protocol Layer / Identity Layer boundary,
applied specifically to the Descriptor's own content: a Nostr adapter
maps its NIP-01 metadata `name`/`display_name`/`picture` onto
`displayName`/`avatar`; an ActivityPub adapter maps its actor
`name`/`icon`; a Bluesky adapter maps its profile `displayName`/`avatar`;
a Session adapter maps its own profile fields — each producing the SAME
generic shape, never passing through Nostr `tags`, an ActivityPub
JSON-LD fragment, or a Bluesky record verbatim. This decision formally
confirms `FedosIdentityDescriptor`'s eventual, ADOPTED shape (§3) stays
small and generic enough that every named Protocol can populate it
through its own adapter without protocol-specific vocabulary ever
entering `fedos_identity_descriptor.ts` itself — consistent with Alpha
028's own "no protocol-specific vocabulary of any kind" design, which
this decision does not revise.

## 9. Consistency check against Alpha 007 / 026 / 028 / 029 / 030 / 031 / 037

- **Alpha 007 §6** — the permanent raw-key-material exclusion. §2's
  Authentication/秘密情報 rulings are the only two candidates this
  Stage marks as having NO future-model escape hatch, precisely because
  Alpha 007 §6 is a ceiling on the entire Identity Layer, not a
  per-type rule Alpha 037/038 could route around.
- **Alpha 026 §2/§3/§6** — the ⑤ canonical-model direction and the
  MAY/MUST-NOT boundary. §2's `linkedProtocols` routing and §5's Service
  boundary both point at the SAME future canonical-model destination
  Alpha 026 §6 already named, without this Stage designing or
  scheduling it.
- **Alpha 028** — the original three-field Descriptor and its
  protocol-agnosticism design. §1 reconfirms it unchanged; §8 confirms
  every ADOPTED candidate preserves it.
- **Alpha 029** — `describeIdentity()`'s "never a sign-in flow" framing.
  §2's Authentication ruling is the direct extension of this exclusion
  from the Provider interface to the Descriptor's eventual content.
- **Alpha 030/031** — `FedosIdentityCapability`'s own exclusion list and
  `FedosIdentityService`'s pure-delegation design. §4/§5 formalize both
  boundaries as permanent, not merely "true today."
- **Alpha 037** — every verdict in this Stage's §2 table is a direct,
  unmodified carry-forward of Alpha 037's own reasoning; this Stage
  adds no new candidate and revisits no rejected reasoning — it only
  removes Alpha 037's own explicit "advisory only" qualifier for the
  two ADOPT verdicts, and adds explicit ROUTING destinations (future
  canonical model / existing device boundary / future persistence
  record / existing auth boundary family) for six of the eight REJECT
  verdicts.

**Conclusion: this Stage's own decision is not a new judgment — it is
Alpha 037's own review, made binding, with routing destinations named
for every REJECTED candidate that has one, and an explicit "no
destination exists, ever" ruling for the two that don't (Authentication,
secret information).**

## 10. Alpha roadmap, updated

1. **A future, separately-reviewed implementation Stage** — adds
   `displayName: string | null` and `avatar: string | null` to
   `fedos_identity_descriptor.ts`, per §2's ADOPTED verdicts. Not
   scheduled or designed by this Stage; its own exact null-handling,
   optionality, and ripple into `NoopFedosIdentityProvider`/
   `NostrIdentityProvider`'s still-`null`-returning `describeIdentity()`
   bodies remain that future Stage's own review.
2. **A future, separately-reviewed canonical-identity Stage** — if ever
   built, owns `linkedProtocols`-shaped cross-provider mapping data, per
   Alpha 026 §6's own ⑤ direction. Not scheduled by this Stage.
3. **A future, separately-reviewed persistence Stage** — if Identity
   data is ever persisted, owns a record type wrapping Descriptor data
   plus `createdAt`/`updatedAt`, reached only via `storeCiphertext()`.
   Not scheduled by this Stage.
4. **`device_trust.ts`/`device_registration.ts`** — remain the
   permanent, already-existing home for any future device-identity
   work; this Stage does not modify or extend them.
5. **`profile`/`metadata`/`capabilities`/Authentication/secret
   information** — permanently closed; no future roadmap entry exists
   for any of them on `FedosIdentityDescriptor`, and none for the last
   two on any future Identity-content type either.

## 11. Fail Closed / Public API — reconfirmed unaffected

Consistent with this Stage's own "no implementation" mandate: no
Fail-Closed guarantee, Public Runtime API signature, or Identity type
changes. `initializeCrypto()`, `runtimeCapabilities()`, `randomBytes()`,
`generateAeadKey()`, `encrypt()`, `decrypt()`, `exportCiphertext()`,
`importCiphertext()`, `storeCiphertext()`, `loadCiphertext()`,
`deleteCiphertext()`, and `resolveFedosIdentityProvider()` are all
confirmed unchanged by this Stage's own guard test, via actual calls —
this Stage decides a FUTURE shape for `FedosIdentityDescriptor`; it does
not implement any part of it.

## 12. Unresolved / open questions for future Stages

- The exact optionality/null-handling of `displayName`/`avatar` once
  implemented (`string | null` vs. `string | undefined` vs. always
  present with an empty-string sentinel) — not fixed here.
- The eventual canonical cross-provider identity model's own shape and
  Stage number — named as a routing destination (§2, §10) but not
  designed.
- Whether, or how, `device_trust.ts`/`device_registration.ts` should
  ever reference a `FedosIdentityDescriptor` (or vice versa) — this
  Stage confirms `device` does NOT belong on the Descriptor, but does
  not design any cross-reference between the two existing boundaries.
- Whether Identity persistence is ever built at all — this Stage
  neither schedules nor forecloses it, only fixes where
  `createdAt`/`updatedAt` would live IF it is.

## 13. Confirmed unchanged

- `fedos_identity_descriptor.ts` — still exactly `id`/`provider`/
  `publicIdentifier`, byte-for-byte since Alpha 028.
- `fedos_identity_provider.ts` (Alpha 029), `fedos_identity_capability.ts`
  (Alpha 030), `fedos_identity_service.ts` (Alpha 031),
  `fedos_identity_provider_resolver.ts` (Alpha 032/034/036),
  `fedos_noop_identity_provider.ts` (Alpha 033), and
  `fedos_nostr_identity_provider.ts` (Alpha 035) — all byte-for-byte
  unchanged.
- `device_trust.ts`, `device_registration.ts`, `session_boundary.ts`,
  `passkey_boundary.ts`, `provider_boundary.ts`, `provider_types.ts`,
  `provider_bridge.ts`, `recovery_policy.ts`, `vault_bridge.ts`,
  `webauthn_adapter.ts` — all byte-for-byte unchanged.
- `AppRuntime.initializeCrypto()` — `{ allowed: false, initialized:
  false, reason: "PrototypeDisabled" }`, confirmed by an actual call.
- `resolveFedosIdentityProvider()` — still returns the shared
  `NostrIdentityProvider` singleton, confirmed by an actual call.
- Every `src/runtime/*` file, `create_runtime.ts`, `types.ts`,
  `src/worker.ts`, every `src/nostr/*` file — all byte-for-byte
  unchanged.
- `packages/fedos-core-rust/src/lib.rs` — still 36 `pub fn`, still
  thirteen `#[wasm_bindgen]` exports.
- `Cargo.toml`/`package.json` — no new dependency, no count change.
- No `displayName`, `avatar`, or any other field exists anywhere in
  this Stage's own new files as actual TypeScript — every mention in
  this document is prose describing a FUTURE Stage's own authorized
  mandate, never code.

## 14. See also

- `docs/secure_runtime_alpha_037_fedos_identity_descriptor_field_review.md`
  (Secure Runtime Alpha 037) — the field-by-field review this Stage
  formally ratifies, unmodified.
- `docs/secure_runtime_alpha_012_key_boundary_decision.md` (Secure
  Runtime Alpha 012) — the REVIEW / DESIGN DECISION ONLY format (four
  candidates restated, comparison table, consistency check,
  Decision/Why-not sections, roadmap, Fail Closed reconfirmation,
  Confirmed Unchanged) this Stage follows.
- `docs/secure_runtime_alpha_026_identity_layer_boundary_review.md`
  (Secure Runtime Alpha 026) — the ⑤ canonical-model direction §2/§5/§9
  route `linkedProtocols` toward, and the Protocol Layer / Identity
  Layer boundary §8 applies to Protocol Adapters specifically.
- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md` /
  `secure_runtime_alpha_029_fedos_identity_provider_interface.md` /
  `secure_runtime_alpha_030_fedos_identity_capability.md` /
  `secure_runtime_alpha_031_fedos_identity_service_skeleton.md` —
  the Descriptor/Provider/Capability/Service boundaries §3/§4/§5
  formally fix.
- `docs/public_crypto_opaque_handles.md` / Alpha 007 §6 — the permanent,
  no-future-model-exception exclusion §2/§9 apply to secret information.
