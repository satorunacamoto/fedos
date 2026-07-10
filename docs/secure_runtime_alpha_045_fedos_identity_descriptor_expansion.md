# FedOS Secure Runtime Alpha 045 — FedOS Identity Descriptor Expansion

**Status: IMPLEMENTED — two optional fields added to one interface, in
one file.** `FedosIdentityDescriptor` (Alpha 028) gains
`displayName?: string` and `avatar?: string`, formally executing Alpha
038's own ADOPT decision. `FedosIdentityRecord` (Alpha 040),
`FedosIdentityProvider` (Alpha 029), `NostrIdentityProvider` (Alpha
035/039/042/044), `FedosIdentityService` (Alpha 031/042),
`FedosIdentityRegistry` (Alpha 041), `FedosIdentityResolver` (Alpha
043), `FedosNostrPublicIdentitySource`, and
`NullNostrPublicIdentitySource` (Alpha 039) are all confirmed
byte-for-byte unchanged. This is the sixteenth artifact in the FedOS
Identity arc (Alpha 028–045).

## 1. Why now

Alpha 038 §2 formally ADOPTED `displayName`/`avatar` for
`FedosIdentityDescriptor` outright, reserving only the IMPLEMENTATION
for "a future, separately-reviewed implementation Stage." Alpha 039 §7
and Alpha 044 §7 each independently declined to be that Stage, both for
the identical "1 Stage = 1 responsibility" reason, and Alpha 044 itself
extended the Snapshot side of the pipeline first, giving a future real
Nostr Source "a complete, reviewed target shape to populate... whenever
it is built" (Alpha 044's own closing line). This Stage is the
DESCRIPTOR-side half of that same Alpha 038 decision — the other end of
the same pipeline Alpha 044 already widened — executed on its own,
narrow terms: the type gains the two fields; nothing is wired to
populate them yet.

## 2. The change

```ts
export interface FedosIdentityDescriptor {
  readonly id: string;
  readonly provider: string;
  readonly publicIdentifier: string;
  readonly displayName?: string;
  readonly avatar?: string;
}
```

Both new fields are OPTIONAL (`?:`), placed after the three original,
still-REQUIRED fields, in the same order Alpha 044 already used for
`FedosNostrPublicIdentitySnapshot`. Because both are optional, and
because this Stage's own mandate forbids modifying
`NostrIdentityProvider` — the ONLY concrete `FedosIdentityProvider`
implementation in this repository that constructs a real Descriptor
object literal — every Descriptor this repository can currently produce
continues to omit both fields, exactly as before this Stage. This is
the identical demonstration Alpha 044 §2 already gave for the Snapshot
side: `npm run typecheck` passes against every unmodified downstream
consumer with zero code change required anywhere outside this one file.

## 3. Descriptorと Snapshotの責務 (boundary with `FedosNostrPublicIdentitySnapshot`, Alpha 039/044)

**The two types now share an IDENTICAL two-field expansion, but remain
independently declared, with no code path connecting the new fields.**
`NostrIdentityProvider`'s own mapping logic (confirmed unchanged by
this Stage) still reads only `snapshot.id`/`snapshot.publicIdentifier`
and still constructs a Descriptor object literal naming only
`id`/`provider`/`publicIdentifier` — a Snapshot's own `displayName`/
`avatar`, even when populated, still never reaches a Descriptor today.
This is not an oversight this Stage works around; propagating the
values is a SEPARATE, future decision (§7) this Stage's own mandate
("Provider実装は変更しない") explicitly forbids making now. The two
types having matching field SETS is a deliberate consistency choice —
so a future Stage that DOES wire the mapping only needs to add two
assignment lines, never redesign either type's own shape — not evidence
that the wiring already exists.

## 4. Descriptorと Recordの責務 (boundary with `FedosIdentityRecord`, Alpha 040)

**Confirmed to remain exactly as Alpha 040 §3 originally distinguished
— now with a WIDENING gap, not a narrowing one.** `FedosIdentityRecord`
is confirmed byte-for-byte unchanged by this Stage — still exactly
`id`/`provider`/`publicIdentifier`, three required fields, no optional
ones. `FedosIdentityService.describeIdentity()` (Alpha 042, confirmed
unchanged) still maps a Descriptor onto a Record by copying exactly
three named fields — `id: descriptor.id`, `provider: descriptor.provider`,
`publicIdentifier: descriptor.publicIdentifier` — never
`descriptor.displayName`/`descriptor.avatar`, which the Service's own
code does not reference at all. A Descriptor with both new fields
populated, fed through the CURRENT, unmodified Service, still produces
a three-field Record exactly as it did before this Stage — mirroring
Alpha 044 §5's own end-to-end confirmation for the Snapshot→Descriptor
leg, now reconfirmed one leg further down the same pipeline for the
Descriptor→Record leg.

## 5. Descriptorと Providerの責務 (boundary with `FedosIdentityProvider`/`NostrIdentityProvider`)

**`FedosIdentityProvider`'s own single method, `describeIdentity()`,
remains typed to return `FedosIdentityDescriptor | null` — unchanged,
since the return TYPE itself already covered any future field the
Descriptor might gain, without the Interface needing to change.**
`NostrIdentityProvider` — the ONLY concrete implementation that
constructs a real Descriptor — is confirmed byte-for-byte unchanged:
its own `describeIdentity()` body still builds exactly
`{ id: snapshot.id, provider: "nostr", publicIdentifier: snapshot.publicIdentifier }`,
never touching `snapshot.displayName`/`snapshot.avatar` even though
both are now available on the Snapshot it already holds (Alpha 044).
`NoopFedosIdentityProvider` (confirmed unchanged, always resolving
`null`) is unaffected for the identical structural reason Alpha 033 §2
already established — it never constructs a Descriptor object literal
at all.

## 6. Descriptorと Serviceの責務・Descriptorと Registryの責務 (boundary with `FedosIdentityService`/`FedosIdentityRegistry`)

**Both confirmed unaffected, for two independent, layered reasons.**
First, `FedosIdentityService.describeIdentity()` (Alpha 042) returns
the Provider's own Descriptor UNCHANGED, reference-equal, to its own
caller — whatever fields a future Descriptor carries, the Service
passes all of them through without inspecting or filtering any (a
property Alpha 042 §5 already established and this Stage does not
revisit). Second, per §4, the Service's own Record-mapping step reads
only three named fields regardless of how many the Descriptor actually
has — so `displayName`/`avatar`, even where present on a Descriptor,
never reach `registry.register()`'s own argument. `FedosIdentityRegistry`
itself (confirmed unchanged) never sees a Descriptor at all — it only
ever holds Records, per Alpha 041's own design — so this Stage's own
change is, by construction, two full layers removed from anything the
Registry could observe.

## 7. displayNameをoptionalにする理由・avatarをoptionalにする理由 (why both fields are optional)

- **No Provider implementation in this repository is authorized, by
  this Stage's own mandate, to populate either field.** Making either
  field REQUIRED would mean every current and future Descriptor
  construction site — `NostrIdentityProvider`'s own object literal, and
  any test fixture across sixteen prior guard-test files — would need
  to supply a value for a field this Stage's own scope forbids wiring
  any real data into, an immediate contradiction this Stage avoids by
  keeping both fields optional.
- **This exactly mirrors Alpha 044 §2's own reasoning for the Snapshot
  side** — an additive, optional-field change lets every existing,
  unmodified consumer continue to compile and behave identically,
  confirmed directly by this Stage's own clean `npm run typecheck` run
  against the unmodified `NostrIdentityProvider`.
- **This Stage's own explicit mandate states it directly** — "optional
  のみ。必須へ変更禁止" — independent of the two structural reasons
  above.

## 8. avatarはURL/CIDのみとする理由 (why `avatar` remains a reference only)

**Continuing, not re-deciding, Alpha 038 §2's own BINDING constraint —
now stated a third time, at a third layer of the same pipeline.** Alpha
038 §2 bound `avatar` to reference-only on the Descriptor originally;
Alpha 044 §8 applied the identical constraint to the Snapshot; this
Stage's own `avatar?: string` field on the Descriptor is the same
constraint's THIRD application, not a new decision — a `string` field
here, exactly as on the Snapshot, is documented to hold a URL or CID
only, never embedded image bytes, matching this repository's own
already-named "IPFS Asset Adapter" gateway/pinning pattern
(README, Future candidate boundaries) rather than any Descriptor-side
exception to a rule already fixed twice before.

## 9. Authentication情報を含めない理由・秘密情報を含めない理由 (why no Authentication or secret information is included)

**Both exclusions are unconditional and permanent, restated here for
the Descriptor exactly as Alpha 044 §9 already restated them for the
Snapshot:**

- **Authentication**: `displayName`/`avatar` remain PUBLIC,
  DISPLAY-ONLY profile fields on the Descriptor exactly as they are on
  the Snapshot — neither field is, or could honestly become, a session
  token, login timestamp, or credential id without ceasing to mean what
  its own name says. This continues Alpha 038 §2's own permanent ruling
  ("REJECTED, permanently, on `FedosIdentityDescriptor` or ANY future
  Identity-content model this decision authorizes") — a ruling that
  named `FedosIdentityDescriptor` specifically, which this Stage's own
  field addition does not, and structurally cannot, contradict.
- **Secret information**: identical reasoning to Alpha 044 §9 — a
  "display name" and an "avatar reference" are semantically incapable
  of holding a private key, `nsec`, seed, or mnemonic. This continues
  Alpha 007 §6's own permanent, no-future-model-exception exclusion,
  unconditionally.

## 10. What this Stage does NOT do

- Does **not** modify `fedos_identity_record.ts` (Alpha 040) — still
  exactly `id`/`provider`/`publicIdentifier`, three required fields.
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029) — its
  own `describeIdentity(): Promise<FedosIdentityDescriptor | null>`
  signature already covered this change without needing to change
  itself.
- Does **not** modify `fedos_nostr_identity_provider.ts` (Alpha
  035/039/042/044) — its own mapping logic still reads and writes only
  `id`/`provider`/`publicIdentifier`.
- Does **not** modify `fedos_noop_identity_provider.ts` (Alpha 033).
- Does **not** modify `fedos_identity_service.ts` (Alpha 031/042).
- Does **not** modify `fedos_identity_registry.ts` (Alpha 041).
- Does **not** modify `fedos_identity_resolver.ts` (Alpha 043).
- Does **not** modify `fedos_identity_provider_resolver.ts` (Alpha
  032/034/036/039).
- Does **not** modify `fedos_identity_capability.ts` (Alpha 030).
- Does **not** modify `fedos_nostr_public_identity_source.ts` (Alpha
  039/044) — `FedosNostrPublicIdentitySnapshot`/`FedosNostrPublicIdentitySource`
  both stay exactly as Alpha 044 shipped them.
- Does **not** modify `fedos_null_nostr_public_identity_source.ts`
  (Alpha 039) — `readPublicIdentity()` still always resolves `null`.
- Does **not** modify `create_runtime.ts` or any `src/runtime/*` file.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any existing `src/nostr/*` file.
- Does **not** wire any Provider to populate `displayName`/`avatar` —
  that remains a separate, future, unauthorized-by-this-Stage decision.
- Does **not** allow `avatar` to hold embedded image bytes — reference
  only.
- Does **not** add Authentication, Credential, or Session-shaped
  content to either new field.
- Does **not** add any secret material to either new field.
- Does **not** make either new field required.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.
- Does **not** change any Public Runtime API signature.

## 11. See also

- `docs/secure_runtime_alpha_038_fedos_identity_descriptor_decision.md`
  (Secure Runtime Alpha 038) — the formal ADOPT decision this Stage
  finally executes on the Descriptor's own type.
- `docs/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion.md`
  (Secure Runtime Alpha 044) — the identical Snapshot-side expansion
  this Stage mirrors on the Descriptor side, one pipeline stage later.
- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md` (Secure
  Runtime Alpha 028) — the Descriptor's own original three-field design
  this Stage extends, not replaces.
- `docs/secure_runtime_alpha_040_fedos_identity_record.md` /
  `secure_runtime_alpha_042_fedos_identity_service_registry_integration.md`
  (Secure Runtime Alpha 040/042) — the Record/Service chain this
  Stage's §4/§6 reconfirm entirely unaffected.
