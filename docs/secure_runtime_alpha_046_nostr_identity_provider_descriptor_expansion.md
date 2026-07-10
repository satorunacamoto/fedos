# FedOS Secure Runtime Alpha 046 — Nostr Identity Provider Descriptor Expansion

**Status: IMPLEMENTED — two fields added to one return statement, in
one file.** `NostrIdentityProvider.describeIdentity()` (Alpha
035/039/042/044/045) now copies `snapshot.displayName`/`snapshot.avatar`
onto the Descriptor it returns, verbatim and unconditionally.
`FedosIdentityDescriptor`, `FedosIdentityRecord`, `FedosIdentityService`,
`FedosIdentityRegistry`, `FedosIdentityResolver`,
`FedosNostrPublicIdentitySource`, and `NullNostrPublicIdentitySource`
are all confirmed byte-for-byte unchanged. This is the seventeenth
artifact in the FedOS Identity arc (Alpha 028–046), and the first Stage
to make `displayName`/`avatar` actually FLOW anywhere — every prior
Stage since Alpha 038 either adopted the fields on paper or expanded a
type's own capacity to carry them, without ever connecting one field to
another.

## 1. Why now

Alpha 044 expanded `FedosNostrPublicIdentitySnapshot` and Alpha 045
expanded `FedosIdentityDescriptor` — the SOURCE and the DESTINATION of
the exact same two fields — but both Stages deliberately stopped short
of connecting them: Alpha 044 §5 confirmed `NostrIdentityProvider`
"still maps ONLY `id`/`publicIdentifier`... ignoring the new optional
fields entirely," and Alpha 045 §5 confirmed the identical fact from
the Descriptor's own side. Both Stages left the wiring itself as
explicitly-named future work. This Stage is that wiring — the smallest
possible connection between two already-expanded types, changing
nothing about either type itself.

## 2. The change

```ts
return {
  id: snapshot.id,
  provider: "nostr",
  publicIdentifier: snapshot.publicIdentifier,
  displayName: snapshot.displayName,
  avatar: snapshot.avatar,
};
```

Two lines added to the ONE `return` statement `describeIdentity()`
reaches after all three existing validation checks (Source threw;
snapshot `null`; `id`/`publicIdentifier` empty or non-string) have
already passed. Every other line of the method — the `try`/`catch`
around the Source read, the `null`-on-`snapshot === null` check, both
`id`/`publicIdentifier` validation checks — is confirmed byte-for-byte
unchanged.

## 3. Providerと Snapshotの責務 (boundary with `FedosNostrPublicIdentitySnapshot`, Alpha 039/044)

**The Provider now reads all four Snapshot fields instead of two, but
its own relationship to the Snapshot remains READ-ONLY and
NON-VALIDATING for the two new fields.** `id`/`publicIdentifier` keep
their own existing validation (non-empty string, checked explicitly,
Alpha 039 §6); `displayName`/`avatar` receive NO validation of any
kind — whatever `snapshot.displayName`/`snapshot.avatar` currently is
(a string, or `undefined`) is copied through exactly as-is. This is a
deliberate asymmetry, not an oversight: `id`/`publicIdentifier` are
REQUIRED on the Descriptor, so their absence must produce `null` (Alpha
039's own Fail-Closed table); `displayName`/`avatar` are OPTIONAL on
both the Snapshot and the Descriptor (Alpha 044/045), so their absence
is already a valid, meaningful state — `undefined` on one OPTIONAL
field is not the presence of INVALID data the way an empty
`publicIdentifier` would be.

## 4. Providerと Descriptorの責務 (boundary with `FedosIdentityDescriptor`, Alpha 028/045)

**The Descriptor this method returns now genuinely reflects everything
the Snapshot reported, not merely the three fields Alpha 039 originally
mapped.** `FedosIdentityDescriptor` itself is confirmed byte-for-byte
unchanged — its own five-field shape (Alpha 045) already had room for
this mapping before this Stage existed; this Stage does not change the
TYPE, only which of its own already-defined fields this ONE Provider
populates. A caller receiving a Descriptor from `NostrIdentityProvider`
today can, for the first time, observe a real `displayName`/`avatar`
value — PROVIDED the injected Source actually reports one; the
Resolver's own default construction (`NullNostrPublicIdentitySource`,
confirmed unchanged) still never reaches this code path at all, since
its own Snapshot is always `null`.

## 5. displayName/avatarをそのまま転送する理由 (why `displayName`/`avatar` are forwarded verbatim, unconditionally)

- **The Snapshot and the Descriptor now share an intentionally IDENTICAL
  two-field shape** (Alpha 044 §2 / Alpha 045 §2, both `displayName?:
  string`/`avatar?: string`) — a straight, unconditional copy is the
  ONLY mapping that requires no additional decision, no format
  conversion, and no data loss in either direction. Any other mapping
  (a conditional spread, a default value, a transformation) would be an
  unauthorized, unreviewed design choice this Stage's own narrow mandate
  does not make.
- **`undefined` propagating to `undefined` is itself the correct,
  honest behavior** — a Snapshot that does not know a display name
  should produce a Descriptor that does not know one either, not a
  Descriptor asserting a fabricated default. This is the same "no
  placeholder value is better than an honest absence" reasoning Alpha
  032 §6 and Alpha 035 §2 already established for `null` at the
  Resolver/Provider level, applied here one field at a time instead of
  to the whole Descriptor.
- **This Stage's own explicit mandate specifies the exact mapping
  verbatim** — the exact `return` statement given in this Stage's own
  instructions is reproduced in §2 unchanged, character for character.

## 6. Providerで加工しない理由 (why the Provider does not process either field)

- **`NostrIdentityProvider` has never reformatted, normalized, or
  "corrected" any field it maps** — Alpha 039 §6's own guardrail
  ("`publicIdentifier`... the Source's own string is used verbatim or
  not at all") already established this discipline for the ORIGINAL two
  fields; this Stage extends the identical discipline to the two NEW
  ones rather than introducing a different rule for them.
- **Processing `avatar` in particular would risk silently weakening
  Alpha 038/044/045's own thrice-stated reference-only constraint.** Any
  validation attempting to distinguish "a valid URL/CID reference" from
  "something else" would be a real parsing/validation decision this
  Stage's own mandate does not authorize; leaving `avatar` entirely
  unprocessed means this Provider can never accidentally accept, reject,
  or reinterpret a value in a way that contradicts a constraint set by
  an earlier, separately-reviewed Stage.
- **Any real validation belongs to the Source, not the Provider** — if
  a future, real Source implementation ever wants to guarantee its own
  `displayName`/`avatar` values meet some quality bar, that validation
  is that future Source's own responsibility to build, not something
  this generic Provider should duplicate or second-guess.

## 7. Recordへまだ流さない理由 (why `displayName`/`avatar` do not yet reach `FedosIdentityRecord`)

**`FedosIdentityService.describeIdentity()` (Alpha 042, confirmed
unchanged by this Stage) still maps a Descriptor onto a Record by
copying exactly three named fields** — `id: descriptor.id`,
`provider: descriptor.provider`, `publicIdentifier: descriptor.publicIdentifier`
— and this Stage does not touch that file at all. This is not an
accidental gap this Stage leaves unfixed by oversight; `FedosIdentityRecord`
itself was explicitly NOT expanded alongside the Descriptor (Alpha 045
§4's own reconfirmation, itself continuing Alpha 040 §9's original
"nothing to derive it from yet" reasoning) — until a future,
separately-reviewed Stage decides to expand the Record's own shape AND
update the Service's own mapping together, a Descriptor's
`displayName`/`avatar`, even when populated by this Stage's own new
code, has structurally nowhere further to go. This Stage's own guard
test reconfirms this end-to-end: a Descriptor carrying real
`displayName`/`avatar` values, fed through the CURRENT, unmodified
Service, still produces a three-field Record.

## 8. Runtimeへまだ配線しない理由 (why this stays disconnected from Runtime)

**Zero Runtime reference of any kind, confirmed unchanged.**
`create_runtime.ts`/`types.ts`/every other `src/runtime/*` file has zero
reference to `NostrIdentityProvider`, `displayName`, or `avatar`, and
this Provider itself imports nothing from `src/runtime/*`. The same two
reasons Alpha 034 §4 and Alpha 042 §7 already gave for keeping Runtime
disconnected from this arc's own Identity types apply unchanged here:
`FedosIdentityService` still has no default constructor argument
Runtime could reach through, and wiring any Identity-arc capability into
Runtime remains its own, separate, future decision this Stage's own
narrow mandate ("Runtimeへは接続しない") does not make.

## 9. Authentication情報を扱わない理由・秘密情報を扱わない理由 (why no Authentication or secret information is handled)

**Both exclusions are unconditional and unaffected by this Stage,
because this Stage transports EXISTING, already-reviewed field values —
it does not introduce a new field, a new source, or a new kind of data
this arc has not already classified.** `displayName`/`avatar` remain
exactly the PUBLIC, DISPLAY-ONLY fields Alpha 038 §2/Alpha 044
§9/Alpha 045 §9 already established, unconditionally and permanently —
this Stage's own code does not, and structurally cannot, turn a display
name or an avatar reference into a session token, a credential id, or a
private key merely by copying it one layer further down the same
pipeline. Continuing Alpha 007 §6's own permanent, no-future-model-
exception exclusion, this Stage introduces no path for secret material
to enter the Descriptor that did not already exist (or not exist) before
this Stage.

## 10. What this Stage does NOT do

- Does **not** modify `fedos_identity_descriptor.ts` (Alpha 028/045).
- Does **not** modify `fedos_identity_record.ts` (Alpha 040) — still
  exactly `id`/`provider`/`publicIdentifier`, three required fields.
- Does **not** modify `fedos_identity_service.ts` (Alpha 031/042) — its
  own Record-mapping step still reads only three named Descriptor
  fields.
- Does **not** modify `fedos_identity_registry.ts` (Alpha 041).
- Does **not** modify `fedos_identity_resolver.ts` (Alpha 043).
- Does **not** modify `fedos_nostr_public_identity_source.ts` (Alpha
  039/044) — `FedosNostrPublicIdentitySnapshot`/`FedosNostrPublicIdentitySource`
  both stay exactly as Alpha 044 shipped them.
- Does **not** modify `fedos_null_nostr_public_identity_source.ts`
  (Alpha 039) — `readPublicIdentity()` still always resolves `null`, so
  this Stage's own new mapping code is never even reached via the
  Resolver's own default construction.
- Does **not** modify `fedos_identity_provider.ts` (Alpha 029),
  `fedos_noop_identity_provider.ts` (Alpha 033),
  `fedos_identity_capability.ts` (Alpha 030), or
  `fedos_identity_provider_resolver.ts` (Alpha 032/034/036/039).
- Does **not** modify `create_runtime.ts` or any `src/runtime/*` file.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any existing `src/nostr/*` file.
- Does **not** validate, reformat, or normalize `displayName`/`avatar`
  in any way — both are copied verbatim.
- Does **not** wire `displayName`/`avatar` into `FedosIdentityRecord`,
  `FedosIdentityRegistry`, or `FedosIdentityResolver` — that remains a
  separate, future, unauthorized-by-this-Stage decision.
- Does **not** add Authentication, Credential, or Session-shaped
  content anywhere.
- Does **not** add any secret material anywhere.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** add a new dependency.
- Does **not** change any Public Runtime API signature.

## 11. See also

- `docs/secure_runtime_alpha_044_nostr_public_identity_snapshot_expansion.md`
  (Secure Runtime Alpha 044) — the Snapshot-side expansion this Stage's
  own mapping now finally reads from.
- `docs/secure_runtime_alpha_045_fedos_identity_descriptor_expansion.md`
  (Secure Runtime Alpha 045) — the Descriptor-side expansion this
  Stage's own mapping now finally writes to.
- `docs/secure_runtime_alpha_039_nostr_public_identity_source_boundary.md`
  (Secure Runtime Alpha 039) — the original Provider/Source mapping and
  "never reformat" discipline this Stage extends, not replaces.
- `docs/secure_runtime_alpha_040_fedos_identity_record.md` /
  `secure_runtime_alpha_042_fedos_identity_service_registry_integration.md`
  (Secure Runtime Alpha 040/042) — the Record/Service chain this
  Stage's §7 reconfirms remains structurally unreachable from either
  new field.
