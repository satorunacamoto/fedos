# FedOS Secure Runtime Alpha 044 — Nostr Public Identity Snapshot Expansion

**Status: IMPLEMENTED — two optional fields added to one interface, in
one file.** `FedosNostrPublicIdentitySnapshot` (Alpha 039) gains
`displayName?: string` and `avatar?: string`. `FedosNostrPublicIdentitySource`
itself, `FedosIdentityDescriptor` (Alpha 028), `FedosIdentityRecord`
(Alpha 040), `NostrIdentityProvider` (Alpha 035/039/042),
`NullNostrPublicIdentitySource` (Alpha 039), `FedosIdentityService`
(Alpha 031/042), `FedosIdentityRegistry` (Alpha 041), and
`FedosIdentityResolver` (Alpha 043) are all confirmed byte-for-byte
unchanged. This is the fifteenth artifact in the FedOS Identity arc
(Alpha 028–044).

## 1. Why now

Alpha 038 §2 formally ADOPTED `displayName`/`avatar` for
`FedosIdentityDescriptor`, explicitly reserving implementation for "a
future, separately-reviewed implementation Stage" — and Alpha 039 §7
explicitly chose Option A (Descriptor unchanged) for its own, narrower
reason: "this Stage's own mandate is the Source Boundary, not the
Descriptor shape." Neither Stage closed the question of WHERE
`displayName`/`avatar` data would eventually come FROM before a future
Descriptor-side Stage could plausibly populate them. This Stage answers
exactly that narrower question — expanding the Snapshot type a real
Nostr Source would eventually report — without yet touching the
Descriptor itself, continuing Alpha 039 §7's own explicit deferral one
Stage further rather than reopening it.

## 2. The change

```ts
export interface FedosNostrPublicIdentitySnapshot {
  readonly id: string;
  readonly publicIdentifier: string;
  readonly displayName?: string;
  readonly avatar?: string;
}
```

`FedosNostrPublicIdentitySource` itself — the single-method Interface
consuming this Snapshot — is BYTE-FOR-BYTE UNCHANGED:

```ts
export interface FedosNostrPublicIdentitySource {
  readPublicIdentity(): Promise<FedosNostrPublicIdentitySnapshot | null>;
}
```

Both new fields are OPTIONAL (`?:`), matching `id`/`publicIdentifier`'s
own `readonly` discipline but never REQUIRING a Source implementation
to supply them — `NullNostrPublicIdentitySource` (confirmed unchanged,
§9) continues to satisfy the Interface trivially, since it always
resolves `null` regardless of the Snapshot's own field count.

## 3. Snapshotと Descriptorの責務 (boundary with `FedosIdentityDescriptor`, Alpha 028)

**The Snapshot may now carry more fields than the Descriptor does —
this is a DELIBERATE, one-directional asymmetry, not an oversight.**
`FedosNostrPublicIdentitySnapshot` is a per-Source-implementation
INPUT shape; `FedosIdentityDescriptor` is the per-Provider, per-call
OUTPUT shape `describeIdentity()` returns. `NostrIdentityProvider`'s
own mapping logic (Alpha 039 §6, confirmed unchanged by this Stage)
already copies exactly `id`/`publicIdentifier` from a valid Snapshot
onto a Descriptor, verbatim — it does not, and after this Stage still
does not, read `snapshot.displayName`/`snapshot.avatar` at all. A
Snapshot instance with both new fields populated, fed through the
CURRENT, unmodified `NostrIdentityProvider`, still produces a
three-field Descriptor exactly as it did before this Stage — the extra
Snapshot fields are silently ignored by existing code, which is
precisely what TypeScript's own structural typing guarantees for an
additive, optional-field interface change, and precisely why this
Stage requires zero change to the Provider to remain both compiling and
behaviorally identical.

## 4. Snapshotと Recordの責務 (boundary with `FedosIdentityRecord`, Alpha 040)

**Zero relationship, confirmed unchanged.** `FedosIdentityRecord`
(still exactly `id`/`provider`/`publicIdentifier`, confirmed
byte-for-byte unchanged by this Stage's own guard test) is constructed
by `FedosIdentityService.describeIdentity()` (Alpha 042) FROM a
Descriptor, never from a Snapshot directly — the Snapshot's own two new
fields have no path to a Record today, mirroring exactly the "not yet
on the Descriptor side either, so nothing exists yet for a Record-side
field to be derived from" reasoning Alpha 040 §9 already gave for
`displayName`/`avatar` on the Record. This Stage does not shorten that
chain; a Snapshot's `displayName`/`avatar`, even when present, cannot
reach a Record until BOTH a future Descriptor-side Stage AND a future
Record-side Stage exist.

## 5. Snapshotと Providerの責務 (boundary with `NostrIdentityProvider`, Alpha 035/039/042)

**`NostrIdentityProvider` is confirmed BYTE-FOR-BYTE UNCHANGED by this
Stage** — its own `describeIdentity()` body still reads exactly
`snapshot.id`/`snapshot.publicIdentifier`, still validates only those
two fields as non-empty strings, and still never references
`snapshot.displayName`/`snapshot.avatar` anywhere in its own code. This
is not a gap this Stage leaves accidentally open — see §6 for why the
Descriptor (and therefore the Provider's own mapping target) does not
change yet. A future Stage that DOES want `NostrIdentityProvider` to
propagate `displayName`/`avatar` would need to modify both this
Provider's own mapping logic AND `FedosIdentityDescriptor`'s own shape
together, in its own separate review — this Stage explicitly does not
do either.

## 6. SnapshotがdisplayName/avatarを持ってよい理由 (why the Snapshot may carry `displayName`/`avatar`)

- **Alpha 038's own formal decision already authorizes the CONTENT,
  independent of WHICH type carries it first.** Alpha 038 §2 ADOPTED
  both fields outright — "A future, separately-reviewed implementation
  Stage is authorized to add `displayName`" — the decision was never
  scoped to forbid a Source-side (input) type from anticipating that
  shape before the Descriptor (output) type catches up; it only
  reserved the DESCRIPTOR's own implementation for a later Stage.
- **A Source is the natural, and arguably necessary, FIRST place these
  fields can exist**, since a Source is where public Nostr profile data
  (a NIP-01 kind:0 `name`/`display_name`/`picture`) would eventually be
  READ from. Building the Snapshot's own capacity to carry this data now
  means a future, real Source implementation (still nonexistent, per
  Alpha 039 §1's own investigation) has a complete, reviewed target
  shape to populate, without that future Stage also having to review and
  extend this Snapshot type as part of its own, larger scope.
- **This mirrors the "build the seam before the real implementation"
  discipline** this arc has followed since Alpha 021 (`RuntimeStorageBackend`
  before `WindowsDpapiStorageBackend`) and Alpha 032/033 (the Resolver
  seam before the first real Provider) — expanding the Snapshot's own
  shape is a seam-widening change, not a behavior change, since nothing
  in this repository populates the new fields yet.

## 7. Descriptorへまだ追加しない理由 (why the Descriptor is not extended in this same Stage)

Continuing, not revisiting, Alpha 039 §7's own Option A reasoning:

- **1 Stage = 1 responsibility.** This Stage's own explicit mandate
  states "本StageではまだDescriptorは変更せず、Public Identity Snapshot
  だけを将来対応可能な形へ拡張する" — a single, narrow scope this Stage
  respects exactly as written, mirroring Alpha 039 §7's own reasoning
  one Stage later in the same sequence.
- **The Descriptor's own eventual `displayName`/`avatar` implementation
  is a SEPARATE decision with its own blast radius** — extending
  `FedosIdentityDescriptor` would ripple into every prior guard test
  asserting its exact three-field shape (Alpha 028 through this Stage —
  sixteen files), none of which this Stage's own mandate requires
  touching, exactly the "unnecessary change scope" concern Alpha 039 §7
  already named.
- **Populating a Descriptor field honestly requires a real value to put
  in it.** Even with the Snapshot now CAPABLE of carrying
  `displayName`/`avatar`, `NullNostrPublicIdentitySource` (§9, confirmed
  unchanged) still always resolves `null` — no Source implementation in
  this repository today could honestly populate either new field. Adding
  them to the Descriptor now would create a field with no real producer
  anywhere, the same "building ahead of need" concern Alpha 040 §10
  already raised for `linkedProtocols`.

## 8. avatarはURL/CID参照のみとする理由 (why `avatar` is a reference only)

**`avatar?: string` is documented, by this Stage's own HARD GUARDRAILS,
to hold a URL or CID reference — never embedded image bytes.** Three
reasons:

1. **This continues Alpha 038 §2's own binding constraint verbatim** —
   `avatar` was "ADOPTED, with the reference-only constraint made
   BINDING" for the Descriptor; this Stage applies the identical
   constraint to the Snapshot, the field's own earliest possible point
   of entry, so the constraint is never even momentarily absent anywhere
   in the pipeline.
2. **This matches the repository's own already-named "IPFS Asset
   Adapter" pattern** (README, Future candidate boundaries — "a future
   public-media adapter... gateway/pinning, not an embedded node...
   Public/unlisted bytes only") — avatars, like any other asset this
   arc has considered, are referenced, never inlined, consistent with
   existing precedent rather than inventing a new rule.
3. **A `string` field cannot honestly hold arbitrary binary image data
   at all without base64-encoding it into an ever-growing blob** —
   accepting only a reference keeps the Snapshot's own field a small,
   fixed-shape value regardless of how large a real avatar image might
   be, and keeps this type free of any encoding-format decision (which
   this Stage does not need to make).

## 9. Authentication情報を含めない理由・秘密情報を含めない理由 (why no Authentication or secret information is included)

**Both exclusions are unconditional, and both are explicitly restated
in this Stage's own HARD GUARDRAILS, not merely inherited by omission:**

- **Authentication**: `displayName`/`avatar` are both PUBLIC,
  DISPLAY-ONLY profile fields — a name and a picture reference a Nostr
  user already shows to anyone. Neither field is, or could honestly be
  extended to be, a session token, a login timestamp, or a credential
  id — extending either into Authentication-shaped content would
  violate Alpha 038 §2's own permanent ruling ("REJECTED, permanently,
  on `FedosIdentityDescriptor` or ANY future Identity-content model this
  decision authorizes"), which this Stage's own Snapshot — feeding
  exactly that Descriptor pipeline — is equally bound by.
- **Secret information**: neither field could hold a private key,
  `nsec`, seed, or mnemonic and still mean what its own name says — a
  "display name" and an "avatar reference" are semantically incapable
  of being secret material, and this Stage does not stretch either
  field's meaning to accommodate one. This continues Alpha 007 §6's own
  permanent, no-future-model-exception exclusion (Alpha 038 §2
  reaffirmed) unconditionally, exactly as every other Identity-arc type
  reviewed by this arc has respected it.

## 10. What this Stage does NOT do

- Does **not** modify `fedos_identity_descriptor.ts` (Alpha 028) — still
  exactly `id`/`provider`/`publicIdentifier`.
- Does **not** modify `fedos_identity_record.ts` (Alpha 040) — still
  exactly `id`/`provider`/`publicIdentifier`.
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029).
- Does **not** modify `fedos_identity_service.ts` (Alpha 031/042).
- Does **not** modify `fedos_identity_registry.ts` (Alpha 041).
- Does **not** modify `fedos_identity_resolver.ts` (Alpha 043).
- Does **not** modify `fedos_null_nostr_public_identity_source.ts`
  (Alpha 039) — `readPublicIdentity()` still always resolves `null`.
- Does **not** modify `fedos_nostr_identity_provider.ts` (Alpha
  035/039/042) — its own mapping logic still reads only
  `id`/`publicIdentifier` from the Snapshot.
- Does **not** modify `fedos_identity_provider_resolver.ts` (Alpha
  032/034/036/039), `fedos_noop_identity_provider.ts` (Alpha 033), or
  `fedos_identity_capability.ts` (Alpha 030).
- Does **not** modify `FedosNostrPublicIdentitySource` itself — still
  the same single-method Interface.
- Does **not** modify `create_runtime.ts` or any `src/runtime/*` file.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any existing `src/nostr/*` file.
- Does **not** allow `avatar` to hold embedded image bytes — reference
  only.
- Does **not** add Authentication, Credential, or Session-shaped
  content to either new field.
- Does **not** add any secret material to either new field.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.
- Does **not** change any Public Runtime API signature.

## 11. See also

- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
  (Secure Runtime Alpha 039) — the original Snapshot/Source Boundary
  and Option A decision this Stage's §7 continues.
- `docs/secure_runtime_alpha_038_fedos_identity_descriptor_decision.md`
  (Secure Runtime Alpha 038) — the formal `displayName`/`avatar` ADOPT
  decision, including the binding reference-only constraint on
  `avatar`, this Stage's §6/§8 apply to the Snapshot.
- `docs/secure_runtime_alpha_040_fedos_identity_record.md` (Secure
  Runtime Alpha 040) — the identical "nothing to derive it from yet"
  reasoning this Stage's §4/§7 reapply to the Snapshot/Descriptor pair.
- `docs/secure_runtime_alpha_042_fedos_identity_service_registry_integration.md`
  / `secure_runtime_alpha_043_fedos_identity_resolver.md` (Secure
  Runtime Alpha 042/043) — the Service/Registry/Resolver chain this
  Stage's own guard test reconfirms entirely unaffected.
