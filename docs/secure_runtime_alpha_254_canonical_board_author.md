# Secure Runtime Alpha 254 — Canonical Board Author

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/fedos_board_author.ts`.** Stage 4 of the Alpha 251–260
Canonical Board Model Foundation Arc.

## 1. Why now

`FedosBoardPost` (Alpha 255) needs an author reference before it can be
written. This Stage fixes that shape first, independently, because the
displayName/avatar question below has real consequences for later
Stages (freshness, storage size) and deserves its own decision.

## 2. The four options and the adopted one

- **Option A — embed `FedosIdentityDescriptor`.** Rejected: a
  `FedosIdentityDescriptor` is a per-Provider, non-persistent value
  (Alpha 028's own doc) — embedding it inside an immutable, potentially
  long-lived `FedosBoardPost` misuses a type designed for one-shot
  `describeIdentity()` calls, and drags along `displayName`/`avatar`
  automatically (see §3).
- **Option B — store only a canonical local identity id.** Rejected
  alone: fails every federated author (the overwhelmingly common case for
  Nostr/ActivityPub/ATProto/Session content) — most authors of imported
  content will never be a local `FedosIdentityRecord`.
- **Option C — store source-protocol author identifier directly.**
  Rejected alone: loses the ability to recognize "this Nostr pubkey and
  this local identity are the same person" once local identity linking
  exists — no field would exist to carry that link.
- **Option D — a dedicated `FedosBoardAuthorReference`.** **Adopted**,
  exactly this Arc's own preferred candidate — it is Option B and Option
  C combined into one type, so both a possible local link AND the
  always-present source-protocol identifier are available together.

## 3. displayName/avatar — reviewed and excluded

This Arc's own instruction asks explicitly: "Review carefully whether
displayName/avatar belong in the immutable post model... Prefer avoiding
stale profile snapshots unless product requirements justify them."

**Decision: excluded.** Unlike `FedosIdentityDescriptor`/`FedosIdentityRecord`'s
own optional `displayName`/`avatar` fields (Alpha 045/047, matching Alpha
038's ADOPT decision for THOSE types), `FedosBoardAuthorReference` carries
neither. Reasoning:

- `FedosIdentityDescriptor`/`FedosIdentityRecord` are refreshed each time
  `describeIdentity()`/registry resolution runs — a stale value there is
  overwritten on the next call. A `FedosBoardPost`, once constructed, is
  **immutable and never re-validated** — a `displayName`/`avatar`
  snapshotted at ingest time has no mechanism in this Arc's scope to ever
  update, so it would silently drift from the real, current profile the
  moment the author renames or changes their avatar.
- No product requirement in this Arc's own instruction justifies the
  staleness risk — display resolution is explicitly a rendering-layer
  concern this Arc does not build.
- The alternative works today with zero design debt: a future
  presentation layer resolves `displayName`/`avatar` SEPARATELY (via
  `FedosIdentityRecord` for a matched `identityId`, or a future
  per-protocol profile cache keyed by `publicIdentifier` for everyone
  else) and joins it at render time, always fresh.

## 4. The shape

```ts
export interface FedosBoardAuthorReference {
  readonly identityId: string | null;
  readonly protocol: FedosBoardSourceProtocol;
  readonly publicIdentifier: string;
}
```

- `identityId` — a LOCAL `FedosIdentityRecord.id`
  (`src/identity/fedos_identity_record.ts`, Alpha 040) when the author is
  already a known local identity; `null` for every other author (the
  common case for federated content). This Arc does not implement the
  linking logic that would populate a non-null value — the field exists
  so a future Stage can, without a `FedosBoardPost` schema change.
- `protocol` — reuses `FedosBoardSourceProtocol` (Alpha 253) rather than
  inventing a second protocol union; an author's protocol and a post's
  source protocol are usually, but not always, the same (a repost/mirror
  could in principle carry a different author protocol than its source
  reference — this Arc does not model reposts, so the two happen to
  coincide for every fixture in Alpha 259, but the field is kept
  independent on purpose).
- `publicIdentifier` — an already-public value in the author's own
  protocol namespace: a Nostr pubkey/npub, an ActivityPub Actor URI, an
  AT Protocol DID, or a Session ID. The SAME kind of already-public value
  `FedosIdentityDescriptor.publicIdentifier` already is (Alpha 028) —
  never a secret, by the identical discipline that field already
  established.

## 5. Permanent prohibitions (verbatim from this Arc's own instruction)

None of the following may ever appear on `FedosBoardAuthorReference`, and
none does — confirmed by direct inspection of the file (also checked
structurally by this Stage's own test):

- private key
- Master Seed
- authentication token
- OAuth token
- session cookie
- `nsec`
- protocol credential

## 6. See also

- `docs/secure_runtime_alpha_253_board_source_provenance.md`
- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_028_fedos_identity_descriptor.md`
- `docs/secure_runtime_alpha_040_fedos_identity_record.md`
