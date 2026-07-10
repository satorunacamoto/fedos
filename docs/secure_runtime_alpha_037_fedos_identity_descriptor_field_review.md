# FedOS Secure Runtime Alpha 037 — FedOS Identity Descriptor Field Review

**Status: REVIEW ONLY. No code change of any kind — `fedos_identity_descriptor.ts`,
every other `src/identity/` file, every `src/runtime/*` file,
`src/worker.ts`, Rust, `Cargo.toml`, and `package.json` are all
byte-for-byte unchanged. This document reviews what a future,
multi-protocol `FedosIdentityDescriptor` (Alpha 028) might need to hold
if Nostr/ActivityPub/Bluesky/Session are one day unified under it,
evaluates eight candidate fields with an explicit ADOPT/REJECT verdict
and reasoning for each, and formally answers seven mandated
responsibility-boundary questions. No field is added. No type changes.**

## 1. Current state — `FedosIdentityDescriptor` today (Alpha 028, unchanged)

```ts
export interface FedosIdentityDescriptor {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
}
```

Three fields, all already public-safe by Alpha 028's own design: `id`
(a caller-supplied opaque handle, never interpreted), `provider` (an
unconstrained label — Alpha 028's own doc comment: "deliberately NOT a
fixed set of named values"), and `publicIdentifier` (explicitly named
public — the one field carrying protocol-facing content). This review
does not question any of the three; it asks what a future Stage adding
real, multi-protocol content might need BEYOND them, and whether each
candidate belongs on this type at all.

## 2. Candidate fields — reviewed individually

| Field | Verdict | Reasoning |
|---|---|---|
| `displayName` | **ADOPT** (future Stage, not this one) | A genuinely cross-protocol concept — every named protocol has an equivalent (Nostr NIP-01 metadata `name`/`display_name`, an ActivityPub actor's `name`, a Bluesky profile's `displayName`, a Session profile name) — so it can be expressed generically without leaking any single protocol's wire shape into Identity Layer, satisfying §5's protocol-agnosticism requirement below. Public by nature in every one of its source protocols; no Fail-Closed risk from holding it. |
| `avatar` | **ADOPT, as a reference only** (future Stage) | Same cross-protocol reasoning as `displayName` (Nostr `picture`, ActivityPub `icon`, Bluesky `avatar`, Session profile picture). Must be a REFERENCE (URL/CID), never embedded image bytes — this mirrors the repo's own already-named "IPFS Asset Adapter... Public/unlisted bytes only" pattern (README, Future candidate boundaries) rather than inventing a new asset-handling rule. |
| `profile` (a single open, free-form object) | **REJECT** | An open/free-form bag cannot be individually vetted field-by-field for public-safety (§7 below) and invites uncontrolled schema creep — exactly the failure mode a reviewed, minimal type like this one exists to prevent. If specific profile-shaped content (`displayName`, `avatar`, and similar) is wanted, each must be its OWN named, individually-reviewed field — never a generic container. |
| `linkedProtocols` | **REJECT at this type** | This is real, needed content — but it belongs to a DIFFERENT type than the per-Provider Descriptor. `FedosIdentityDescriptor` describes what ONE Provider (`provider: string`) currently reports; "which other protocol identities represent the same person" is cross-provider MAPPING data, which Alpha 026 §2/§3/§6 already scoped to a separate "⑤ FedOS Identity中核" canonical model, explicitly NOT the same object each Provider returns from `describeIdentity()`. Folding cross-provider linkage into the single-provider Descriptor would collapse two deliberately-separated concerns (Alpha 026 §6: "a canonical model... each Protocol mapping onto it," not each Protocol's own Descriptor holding the map itself). |
| `capabilities` | **REJECT** | Directly redundant with, and would violate the separation from, `FedosIdentityCapability` (Alpha 030) — see §4 below. Descriptor answering "what capabilities does this identity have" would duplicate a question a dedicated, already-reviewed type exists to answer. |
| `device` | **REJECT (for now)** | This repository already has a dedicated device-concern boundary — `device_trust.ts`/`device_registration.ts` (`src/identity/`) — predating this arc. Adding device data to the Descriptor would duplicate an already-owned, separately-scoped responsibility rather than reuse it. If a future Stage genuinely needs Descriptor-adjacent device data, the correct move is reviewing how Descriptor and the EXISTING device boundary relate, not adding a `device` field unilaterally. |
| `metadata` (an open, free-form bag) | **REJECT** | Identical reasoning to `profile`: an open bag defeats field-by-field public-safety review (§7) and is the single easiest way to accidentally smuggle a secret onto this type, since nothing about an untyped bag prevents it. Any concrete metadata need must be proposed as its own named, explicitly-typed, individually-reviewed field. |
| `createdAt` / `updatedAt` | **REJECT on this type** | These are RECORD/persistence-layer concerns — a creation/update timestamp is meaningful for something that is STORED, not for a value freshly computed on every `describeIdentity()` call. Since §3 below confirms the Descriptor is NOT persistent data today, `createdAt`/`updatedAt` have no honest value to report here: "created when" and "updated when" both presuppose a stored record this type is not. If Identity data is ever persisted, these timestamps belong on that future storage-layer record, not on the live-query Descriptor itself. |

**Net result**: two ADOPT-eligible fields for a future, separately-reviewed
Stage (`displayName`, `avatar`, both public-safe cross-protocol
concepts, both deferred — this Stage adds neither); six REJECTED, each
for a distinct, named reason — not a blanket "add nothing" policy, but
field-by-field judgment.

## 3. Descriptorは永続データか (is the Descriptor persistent data?)

**No — and it should stay that way.** `describeIdentity()` (Alpha 029)
is defined, in its own doc comment, as "a single, idempotent READ...
never a sign-in flow, never a state change, never a creation." Every
concrete implementation reviewed by this arc so far —
`NoopFedosIdentityProvider` (Alpha 033) and `NostrIdentityProvider`
(Alpha 035) — constructs no Descriptor at all (`describeIdentity()`
always resolves `null`); confirmed by direct inspection, neither file
contains a `FedosIdentityDescriptor` object literal anywhere in this
repository today. `FedosIdentityDescriptor` is a RETURN VALUE SHAPE,
recomputed fresh on every call, never itself the thing stored on disk
or in memory between calls. This has a direct consequence for §2's
`createdAt`/`updatedAt` verdict above: a type that is never persisted
cannot honestly report when it was "created" or "updated," because
there is no persisted record for those timestamps to describe. If a
future Stage introduces real Identity persistence, the correct shape is
a SEPARATE, storage-layer record type that WRAPS Descriptor-shaped data
(via Runtime's own `storeCiphertext()`/`loadCiphertext()`, per §6
below) — not the Descriptor gaining persistence-flavored fields itself.

## 4. DescriptorはProtocol非依存であるべきか (should the Descriptor be protocol-agnostic?)

**Yes — already true today, and every ADOPT verdict in §2 preserves
it.** Alpha 028's own doc comment already states this directly:
"`provider` is left as a plain, unconstrained value here, deliberately
NOT a fixed set of named values — this file carries no protocol-specific
vocabulary of any kind." This review confirms that constraint should
extend to any future field: `displayName`/`avatar` (ADOPTED) are
GENERIC, cross-protocol concepts each Protocol's own adapter would
translate its native field into — never a Nostr `tags` array, an
ActivityPub JSON-LD document fragment, or a Bluesky record shape passed
through verbatim. This is the same Protocol Layer / Identity Layer
boundary Alpha 026 §5 already formalized: "each Protocol's own adapter
code translates its native shapes to/from Identity Layer's generic
calls... on either side of the boundary." A future field that could
only be populated by ONE protocol, or that requires protocol-specific
interpretation to use correctly, fails this test regardless of how
useful it sounds — none of §2's ADOPT candidates fail it.

## 5. Identity Capabilityとの責務分離 (separation from `FedosIdentityCapability`, Alpha 030)

**Zero field overlap today, and this review recommends keeping it that
way permanently.** `FedosIdentityCapability` (`provider: string`,
`available: boolean`) answers EXACTLY one question — "is this provider
usable at all" — deliberately excluding, per its own doc comment, "no
status, no lifecycle, no linked-identity data, no descriptive metadata
of any kind." `FedosIdentityDescriptor` answers a different question —
"what identity does this provider currently describe." The two are
already structured as a matched pair with a clean split: Capability is
the availability CHECK a caller performs BEFORE asking; Descriptor is
the CONTENT a caller receives (or the `null` it receives) AFTER asking.
`FedosIdentityService` (Alpha 031) already encodes this exact split
structurally — `describeCapability()` and `describeIdentity()` are two
separate pass-through methods, never one merged call. This is why §2
rejects `capabilities` as a Descriptor field outright: adding it would
re-merge a distinction this arc has kept deliberately separate since
Alpha 030, for the same reason Alpha 033 §4 kept the Resolver's `null`
and the Noop Provider's own `null` distinct — collapsing two
differently-scoped answers into one field erases information a future
caller needs ("can I ask" vs. "what did I get").

## 6. Storageとの責務分離 (separation from Storage)

**The Descriptor must stay storage-blind, exactly like every other
Identity-arc type reviewed by this arc so far.** Confirmed by direct
inspection: no file under `src/runtime/*` references
`FedosIdentityDescriptor`, `FedosIdentityCapability`, or
`FedosIdentityProvider` anywhere in this repository today — the
Identity/Storage boundary Alpha 026 §3 established ("MUST NOT hold... A
`RuntimeStorageBackend` instance, or any other Storage-internal
construct, directly") is not merely a stated intention but an already-true
fact about the current codebase, and this review recommends it stay
true for the Descriptor specifically, including after any future field
addition. Concretely: no future Descriptor field may hold a
`RuntimeStorageBackend` reference, an `AeadCiphertextWire`, or any other
Storage-internal type. If Descriptor-shaped data is ever persisted (§3),
the caller holding a Descriptor is responsible for calling
`storeCiphertext()` with an already-encrypted wire value derived FROM
Descriptor data — the Descriptor type itself never grows a
Storage-shaped field to do this automatically, exactly as Identity
Layer generally "must call `storeCiphertext()`/`loadCiphertext()`/
`deleteCiphertext()` like any other caller — never construct a backend"
(Alpha 026 §3).

## 7. Runtimeとの責務分離 (separation from Runtime)

**The Descriptor must stay a pure Identity Layer value type Runtime is
not aware of — already true today, confirmed by the same grep as §6.**
Alpha 026 §4 already confirmed all 11 Public Runtime API functions fall
into exactly three concerns (Crypto/Storage/Environment) and none is
Identity-shaped; this review confirms that boundary specifically holds
for `FedosIdentityDescriptor` — it is never a parameter or return type
anywhere in `src/runtime/*`, `create_runtime.ts`, or `types.ts`. This
constrains future fields in the same direction as §6: no future
Descriptor field may hold a Runtime-internal opaque handle
(`AeadKeyHandle`, `AeadCiphertextHandle`) directly. If a future field
genuinely needs to reference Runtime-issued material, Alpha 026 §3's
own "MAY hold" rule already covers this case precisely: "OPAQUE HANDLES
Runtime itself issues... Identity Layer holds the HANDLE, never the raw
bytes behind it" — but no candidate reviewed in §2 requires this, so
this review does not recommend adding any handle-shaped field now.

## 8. Authentication情報を持ってよいか (may the Descriptor hold Authentication information?)

**No.** Alpha 029's own doc comment already draws this line for the
Provider interface that PRODUCES the Descriptor: "any method that
starts, advances, or completes an authentication attempt" is
permanently excluded. This review extends the same line to the
Descriptor's own CONTENT — no session token, no login/session
timestamp, no MFA status, no WebAuthn/passkey credential id, and no
authentication-attempt state of any kind belongs on this type. This
repository already has a structurally SEPARATE family of files for
exactly that concern — `session_boundary.ts`, `passkey_boundary.ts`,
`provider_boundary.ts`/`provider_types.ts` (whose own doc comment
Alpha 026 §7 already quoted: "Apple / Google / External identity
providers as OPAQUE AUTHENTICATION-REFERENCE providers... NOT as key
sources") — and Alpha 027 §- already named the precise distinction this
review reaffirms: "the two share the English word 'identity' but are
structurally different problems." `FedosIdentityDescriptor` describes
PROTOCOL IDENTITY (what public identifier a protocol Provider reports);
it must never describe AUTHENTICATION STATE (how, or whether, a user
currently proved who they are). No candidate field in §2 crosses this
line, and this review recommends any future candidate be checked
against it explicitly before being proposed.

## 9. 秘密情報を保持してよいか (may the Descriptor hold secret information?)

**Absolutely not — a permanent exclusion, not a today-only one.** This
is the same "no raw key custody" boundary Alpha 007 §6 established for
Runtime and Alpha 026 §3 confirmed extends to Identity Layer: "Raw
private signing keys... Raw AEAD key material of any kind" must never
be held. `publicIdentifier` is already named public by design (Alpha
028); this review's own §2 verdicts apply the identical test to every
candidate — `displayName`/`avatar` pass because they are public by
construction in every source protocol; `profile`/`metadata` are
REJECTED specifically because an open, unreviewed bag cannot be tested
against this rule at all, field by field, which makes it the single
highest-risk shape a future Stage could add. Any future field proposal
must state, explicitly, which source protocol(s) already treat the
value as public before being reviewed — a requirement this Stage
recommends as a standing rule for every future Descriptor field
proposal, not only the ones considered here.

## 10. FedOS Identity方針との整合性 (consistency with the Alpha 026 direction)

This review's own conclusions are fully consistent with, and refine one
layer down from, Alpha 026 §6's own two-part recommended direction:
`FedosIdentityDescriptor` is the CONTENT shape Alpha 026 §6's "content
direction (⑤)" pointed at for a SINGLE Provider's own report — never the
cross-protocol canonical model itself (§2's `linkedProtocols`
rejection), and never something Runtime, Storage, or Authentication
boundaries reach into directly (§6/§7/§8). Nothing in this review
revises Alpha 026's own conclusions; it applies them concretely to one
specific type, one field at a time.

## 11. What this Stage does NOT do

- Does **not** implement, add, remove, or rename any field on
  `fedos_identity_descriptor.ts` — the file remains byte-for-byte
  `id`/`provider`/`publicIdentifier`, unchanged since Alpha 028.
- Does **not** change `fedos_identity_provider.ts` (Alpha 029),
  `fedos_identity_capability.ts` (Alpha 030),
  `fedos_identity_service.ts` (Alpha 031),
  `fedos_identity_provider_resolver.ts` (Alpha 032/034/036),
  `fedos_noop_identity_provider.ts` (Alpha 033), or
  `fedos_nostr_identity_provider.ts` (Alpha 035).
- Does **not** change `device_trust.ts`, `device_registration.ts`,
  `session_boundary.ts`, `passkey_boundary.ts`, `provider_boundary.ts`,
  `provider_types.ts`, `provider_bridge.ts`, `recovery_policy.ts`, or
  `vault_bridge.ts`.
- Does **not** change any `src/runtime/*` file, `create_runtime.ts`, or
  `types.ts`.
- Does **not** change `src/worker.ts`.
- Does **not** change any existing `src/nostr/*` file.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change any Public Runtime API signature.
- Does **not** authorize any future Stage to add a field without its
  own separate review — §2's ADOPT verdicts (`displayName`, `avatar`)
  are advisory recommendations for a FUTURE Stage's own scope, not a
  pre-approval this Stage grants on that future Stage's behalf.

## 12. See also

- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md` (Secure
  Runtime Alpha 028) — the Descriptor's own original three-field design
  and exclusion list, unrevised by this review.
- `docs/secure_runtime_alpha_029_fedos_identity_provider_interface.md`
  (Secure Runtime Alpha 029) — the "never a sign-in flow" exclusion
  this Stage's §8 extends from the Provider interface to the
  Descriptor's own content.
- `docs/secure_runtime_alpha_030_fedos_identity_capability.md` (Secure
  Runtime Alpha 030) — `FedosIdentityCapability`'s own exclusion list,
  this Stage's §5 comparison point.
- `docs/secure_runtime_alpha_031_fedos_identity_service_skeleton.md`
  (Secure Runtime Alpha 031) — the `describeCapability()`/
  `describeIdentity()` split this Stage's §5 cites as already-structural
  evidence for keeping Capability and Descriptor separate.
- `docs/secure_runtime_alpha_026_identity_layer_boundary_review.md`
  (Secure Runtime Alpha 026) — the MAY/MUST-NOT boundary (§3), the
  Runtime-scope confirmation (§4), the Protocol-agnosticism boundary
  (§5), and the ⑤ canonical-model direction (§6) this Stage's §4/§6/§7/
  §10 each apply concretely to the Descriptor.
- `docs/secure_runtime_alpha_027_identity_foundation_inventory.md`
  (Secure Runtime Alpha 027) — the AUTHENTICATION vs. PROTOCOL IDENTITY
  distinction this Stage's §8 reaffirms.
- `docs/public_crypto_opaque_handles.md` / Alpha 007 §6 — the permanent
  raw-key-material exclusion this Stage's §9 confirms applies to any
  future Descriptor field.
- `docs/vault_crypto_identity.md` — pre-existing "no key custody"
  design notes this Stage's §9 remains consistent with.
