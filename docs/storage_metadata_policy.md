# Storage Metadata Policy (docs only — describes existing code, adds no new code)

**Status: this document describes the `StorageBackend` metadata policy that
already exists in code (`src/storage/policy.ts`, Stage 107) and extends it
with an explicit rule for location-derived values (e.g. a future Nearby
Discovery area id). It adds NO new source file, NO code change, NO new
metadata field, and NO area-id support.** `StorageBackend` itself remains a
skeleton: no real backend, no real storage, no network call
(`src/storage/types.ts`, `src/storage/noop_storage.ts`).

---

## 1. What `StoragePacket.metadata` already forbids (existing code)

`reviewStoragePacket` (`src/storage/policy.ts`) rejects a packet whose
metadata **key or value** contains any of the following markers
(case-insensitive, matched as a substring after stripping non-alphanumerics
from keys):

`secret`, `key`, `seed`, `token`, `payment`, `entitlement`, `dm`, `body`,
`content`, `message`

It also rejects a packet whose `idRef` is shaped like a URL or file path
(e.g. `https://...`, `/etc/...`, `C:\...`, a UNC path, or a
`drive.google.com`/`docs.google.com` link) rather than an opaque label. This
document does not change that code; it restates the rule so the location
discussion below has a fixed reference point.

---

## 2. Extension: a location-derived value is not automatically allowed

The existing marker list in §1 was written for secrets/keys/DM content — it
was **not** designed with location semantics in mind, and passing it is not
evidence that a location-derived value is safe to store. This document
fixes the rule that:

- **An area id (or any other location-derived value) must never be placed
  in `StoragePacket.metadata` on the basis that it merely passes the
  current sensitive-marker check.** A metadata field like `areaId`, `cell`,
  `geohash`, `h3Index`, or similar does not contain any of the §1 markers
  today and would currently be *accepted* by `reviewStoragePacket` — that
  gap is intentional to name here so it is not mistaken for a safety
  guarantee.
- **Storing a location-derived value requires a separate, explicit future
  policy stage** that evaluates it on its own terms (linkability over time,
  rotation/salting, consent gating — see
  [`nearby_area_indexing_research.md`](nearby_area_indexing_research.md) and
  [`nearby_consent_policy.md`](nearby_consent_policy.md)), not merely an
  addition to the existing secret/key/seed/token marker list.
- Until that future stage exists, no caller should place any area id,
  geohash, H3 index, S2 cell id, or raw/rounded coordinate into
  `StoragePacket.metadata`, `StorageRef`, or `idRef`. This document does not
  add an enforcement check for that — it records the rule for the review
  that must happen before any such field is introduced.

---

## 3. Metadata leak surface is broader than "sensitive keywords"

Even metadata that contains no secret/location value can still leak
information through patterns rather than content. These are documented as
open risks for any future metadata-carrying feature (Nearby or otherwise),
not solved by the existing keyword policy:

- **Peer count.** A metadata field recording how many peers/items relate to
  a packet can itself reveal population/activity density for whatever the
  packet groups by (see `nearby_area_indexing_research.md` §8 for the
  proximity-specific case).
- **Bandwidth / priority signals.** A metadata value that reflects or
  drives prioritized delivery (e.g. "this packet's peer is nearby, give it
  priority") is an observable side channel about relationships between
  users, independent of whether the triggering value itself is stored.
- **Relay / backend observation.** Any backend that ever becomes real
  (a Nostr relay, an external service) is a third party positioned to
  observe metadata patterns over time, even when each individual value
  looks innocuous in isolation. `StorageBackend` being a skeleton today
  does not remove this risk from the design; it just means the risk has not
  been realized yet.
- **Frequency / time correlation.** How often a given metadata value
  recurs, and when, can reconstruct behavior patterns the value's content
  alone does not reveal.

---

## 4. What this document does NOT implement

- No change to `src/storage/policy.ts`, `src/storage/types.ts`, or
  `src/storage/noop_storage.ts`
- No new metadata field, marker, or sanitizer
- No area-id, geohash, H3, or S2 support of any kind
- No wiring into the Runtime, the Worker, or any real backend

---

## 5. Preconditions before a location-derived value may reach `StorageBackend`

If a future stage ever wants to let an area id (or similar) into
`StoragePacket.metadata`, it first requires **all** of the following:

- The area-indexing preconditions in `nearby_area_indexing_research.md` §11
  (consent, resolution, neighbor-expansion policy, rotation policy, no
  raw-coordinate persistence, written threat model).
- The consent gate in `nearby_consent_policy.md` (§2, §6, §8) — consent to
  Nearby Discovery and permission to store its output in `StorageBackend`
  are treated as two separate approvals, not one.
- An explicit update to `reviewStoragePacket` (or a dedicated location-aware
  policy function) that evaluates the value on location-specific terms —
  not an assumption that clearing the existing secret/key/seed/token check
  is sufficient.
- A decision on rotation/expiry so a stored area id does not accumulate into
  a long-lived location trail even if each individual value was
  policy-clean at write time.

---

## 6. Conclusion

- The existing `src/storage/policy.ts` marker check is unchanged and
  remains scoped to secrets/keys/DM-content-shaped fields — it was never a
  location-privacy control and is not being treated as one.
- A location-derived value (area id or otherwise) is explicitly **not**
  cleared for `StorageBackend` metadata by anything that exists today.
- Any future support for it needs its own policy stage, gated on both the
  area-indexing and consent preconditions documented separately.
