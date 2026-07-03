# Nearby Discovery — Consent Policy (research boundary, docs only)

**Status: policy/research notes only. This document adds NO consent UI, NO
permission-request flow, NO settings toggle, NO area-id computation, NO GPS
access, NO browser geolocation, and NO wiring into `StorageBackend`, the
Runtime, or the Worker.** It fixes the consent rules a future Nearby
Discovery feature must follow, before any of it is built. It extends
[`nearby_area_indexing_research.md`](nearby_area_indexing_research.md) §7–8,
which lists the underlying privacy risks this policy responds to.

This is a policy sketch for a not-yet-built feature, not a specification and
not a compliance guarantee (e.g. it is not a substitute for a jurisdiction's
actual consent/privacy-law requirements, which any real implementation must
still separately satisfy).

---

## 1. Default state: Nearby is OFF

Nearby Discovery — any feature that groups, matches, or surfaces users by
physical proximity — **ships disabled by default**, if it ships at all.
No coordinate is read, no area id is computed, and no proximity data is
generated for a user who has not explicitly turned the feature on. Being
signed in, being active, or granting an unrelated permission (camera,
contacts, notifications) must never be treated as enabling Nearby.

---

## 2. Consent must be explicit, informed, and separable

- **Explicit.** A user must take a distinct, affirmative action to enable
  Nearby Discovery. It must not be bundled into a general "accept terms" or
  "allow permissions" flow, and must not be pre-checked.
- **Informed.** The consent prompt must describe, in plain terms, that
  enabling the feature causes a coarse location-derived value (an area id,
  not raw coordinates — see `nearby_area_indexing_research.md` §2–6) to be
  computed and potentially shared with a server/relay/other users, and that
  this value can act as a location-tracking signal over time (§7 of that
  document). Vague wording ("improve your experience nearby") is not
  informed consent.
- **Separable.** Consent to Nearby Discovery must be revocable independently
  of every other permission or setting, and must not silently re-enable on
  app update, reinstall, or account migration.

---

## 3. Revocation must stop new signal generation, not just hide the UI

Turning Nearby off must stop any further area-id computation or sharing —
it must not merely hide a UI element while background computation continues.
This document does not design the mechanism (there is no implementation
yet); it fixes the requirement that "off" means "no new signal", not
"no longer displayed".

---

## 4. Consent does not retroactively justify past storage

Consent applies **going forward**, from the moment it is granted. Consent
to Nearby Discovery must never be used to justify:

- Backfilling area ids for historical activity that predates consent.
- Deriving an area id from a coordinate that was collected for an unrelated
  purpose (e.g. a payment address, a shipping address, an EXIF-tagged
  photo) without separate, specific consent for that use.

---

## 5. Threat model this policy responds to

This policy exists because consent alone does not neutralize the risks
already catalogued in `nearby_area_indexing_research.md`:

- An area id, even after consent, remains a **potential tracking
  identifier** if observed repeatedly over time (§7 of that document) —
  consent authorizes the feature, it does not make the underlying signal
  harmless, which is why rotation/salting is still called out as a required
  future design step, not an optional nicety.
- **Metadata leaks survive consent.** Area-id frequency, time correlation,
  peer count, bandwidth/relay priority, and relay observation (§8 of that
  document) are all still live risks for a *consenting* user — consent
  covers "should this user's proximity be computed at all", not "is the
  resulting signal safe from every third party that can observe it".
- **Coercion / shared-device risk.** A user who is compelled or observed by
  another person present at consent time may not be giving free consent.
  This document does not solve that; it records it as an open risk a real
  consent flow must consider (e.g. via clear, easily-found revocation).

---

## 6. Relationship to `StorageBackend` and the metadata policy

Enabling Nearby Discovery consent does **not** by itself authorize storing
an area id (or any other location-derived value) in `StorageBackend`
metadata. See [`storage_metadata_policy.md`](storage_metadata_policy.md) for
the separate policy step that governs what may ever reach
`StoragePacket.metadata` — consent and storage-metadata policy are two
independent gates, and both must pass.

---

## 7. What this document does NOT implement

- A consent UI, dialog, settings screen, or toggle
- A permission-request flow (mobile OS or browser)
- Consent storage/persistence of any kind
- An enable/disable API or flag read by any runtime code
- Any area-id computation, GPS access, or `navigator.geolocation` call
- Any wiring into `StorageBackend`, the Runtime, or the Worker

---

## 8. Preconditions before ANY implementation

If a Nearby Discovery consent flow is ever built, it first requires **all**
of the following. Absence of any one is a blocker:

- A concrete UI/UX design for the explicit, informed, separable consent
  described in §2, reviewed on its own before any code lands.
- A defined, testable "revocation stops new signal generation" mechanism
  (§3), not just a hidden toggle.
- The area-indexing resolution, neighbor-expansion, and rotation-policy
  preconditions from `nearby_area_indexing_research.md` §11 — consent alone
  does not substitute for those unresolved design questions.
- The `storage_metadata_policy.md` gate for any location-derived value that
  would reach `StorageBackend` metadata.
- A jurisdiction-aware legal/compliance review — this document is a product
  privacy policy sketch, not legal advice, and does not satisfy any
  region's actual consent-law requirements on its own.

---

## 9. Conclusion

- **No consent mechanism exists yet.** This document fixes the rules a
  future one must follow.
- **Nearby stays off by default** until all of §2, §3, and §8 are satisfied
  by a real design.
- **Consent is necessary but not sufficient** — it does not neutralize the
  tracking-identifier and metadata-leak risks already documented in
  `nearby_area_indexing_research.md`.
