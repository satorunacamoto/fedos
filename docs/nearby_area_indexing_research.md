# Nearby Area Indexing — Research Boundary (non-binding, docs only)

**Status: research notes only. This document adds NO code, NO area-id
function, NO H3/Geohash/S2 dependency, NO GPS access, NO browser geolocation,
NO mobile permission request, and NO wiring into `StorageBackend`, the
Runtime, or the Worker.** It exists so that "Nearby Discovery" — grouping
users by rough physical proximity — is studied, with its boundary problems
and privacy risks written down, *before* anyone is tempted to implement it.

This is a research/threat-model sketch, not a specification and not a
security guarantee. Where a section touches privacy-sensitive ground it
lists **risks and open questions** rather than promising properties. Do not
treat any statement here as "safe", "private", "anonymous", or "final".

---

## 1. Purpose

Fix the area-indexing problem as a **research boundary** before Nearby
Discovery is implemented. The goal of a future area index is coarse,
opt-in proximity grouping (e.g. "people active in roughly this
neighborhood-sized cell") — never precise location sharing, never a
location history, and never a feature that is on by default.

---

## 2. The problem with the Python v8.6 approach

The Python v8.6 host computes an area id with:

```
def get_area_id(lat, lon, precision=4):
    return f"{round(lat, precision - 3)}:{round(lon, precision - 3)}"
```

i.e. independently rounding latitude and longitude to one decimal place
(`round(lat, 1)`, `round(lon, 1)`) and concatenating them. This has several
concrete problems that must be fixed before any port, not carried forward:

- **Boundary problem.** `round()` snaps to the *nearest* grid line. Two
  people standing meters apart, but on opposite sides of a `.05`-degree
  rounding boundary, land in **different** area ids and are never grouped as
  "nearby" — while two people much farther apart, but both rounding toward
  the same grid point, land in the **same** area id. A fixed rectangular
  grid always has this edge problem; naive rounding has no neighbor-cell
  concept to compensate for it.
- **Non-uniform cell size.** A fixed decimal-degree step is not a fixed
  distance. One degree of longitude shrinks toward the poles
  (`cos(latitude)` factor), so the same `round(lon, 1)` step spans a much
  smaller east–west distance at high latitude than at the equator. The
  resulting "areas" are not comparable in physical size across latitudes.
- **Discontinuities.** Longitude rounding is not aware of the ±180°
  antimeridian wrap, and latitude rounding is not aware of the poles;
  naive rounding can produce nonsensical or discontinuous neighbors at
  those edges.
- **Privacy risk is not zero.** `round(lat, 1)` / `round(lon, 1)` keeps
  roughly 11 km of resolution at the equator — coarse, but still a location
  label, published or stored repeatedly it becomes a coarse **location
  trail**, and combined with other metadata (timing, contact graph) it can
  narrow a user's whereabouts far more than the raw cell size suggests. A
  simple round is not a privacy mechanism; it is a lossy quantization that
  happens to also be a bad grid.

**Conclusion of this section: the round-based function is not production
safe, independent of any privacy concern — it does not even solve the grid
problem it was written for.**

---

## 3. Candidate area-indexing schemes (comparison only, none adopted)

| Scheme | Cell shape | Boundary behavior | Maturity for this project |
| --- | --- | --- | --- |
| Geohash | Rectangular (lat/lon-aligned) | Same boundary problem as naive rounding at the string-truncation edges, but well-known neighbor-expansion algorithms exist | Simple to implement; no new binary dependency needed for prefix-only ops |
| H3 (Uber) | Hexagonal, hierarchical | Hex cells have 6 uniform neighbors (no "corner" case), so a fixed neighbor ring covers "nearby" much more evenly than a rectangular grid | Requires an external library (Rust `h3o`/C `h3` or a JS port); non-trivial footprint |
| S2 (Google) | Spherical quadrilateral cells (quad-tree on a cube projection) | Good uniformity and hierarchy; more complex mental model | Requires an external library; larger conceptual and code surface than H3 for this project's needs |
| Coarse fixed grid | Rectangular, coarser than v8.6's | Cheapest fix: enlarging the cell size reduces (but does not eliminate) the boundary problem, still needs 8-neighbor lookup | No new dependency; still has the fundamental single-cell boundary limitation |

None of these is selected by this document. This is a comparison table for a
future design stage, not a recommendation to implement any of them now.

---

## 4. H3 — potential advantages (research notes)

- **Hexagonal cells.** Every interior cell has exactly 6 equidistant
  neighbors, unlike a rectangular grid's mix of edge- and corner-adjacent
  neighbors at different distances — this makes "nearby" more geometrically
  uniform.
- **Neighbor ring (`k-ring`) queries.** H3 defines a standard way to expand
  a cell into its ring of neighbors at a given radius, which is the natural
  fix for the "two nearby people, two different cells" boundary problem: a
  client checks its own cell **and** its ring, not just its own cell.
  Documenting the concept here does not authorize implementing it yet.
- **Deterministic adjacent-cell lookup.** Given a cell id, its neighbors are
  computable without a lookup table or network call, which matters for an
  eventual client-side/offline-friendly design.
- **Hierarchy.** H3 has 16 resolutions, so a coarser or finer cell size can
  be chosen without inventing a new indexing scheme later.

---

## 5. H3 — risks and open questions (research notes)

- **Dependency risk.** Adopting H3 means adopting an external library (a
  Rust crate such as `h3o`, or a WASM/JS build of Uber's C `h3` library).
  This project has been deliberately conservative about new dependencies
  (see `docs/rust_dependency_adoption.md`); H3 is NOT adopted by this
  document, and adopting it later needs its own dependency-review stage.
- **Mobile / browser / WASM footprint.** A native H3 library needs either a
  WASM build (bundle-size and load-time cost in a browser) or a
  platform-specific binary (mobile packaging cost). Neither is measured or
  decided here.
- **Exact-location inference risk does not disappear at high resolution.**
  A fine H3 resolution cell can be as precise as a building or a room. Cell
  **resolution choice is itself a privacy decision**, not just a UX
  trade-off — choosing "too fine" defeats the purpose of using a coarse
  index at all.
- **Resolution selection is hard.** There is no single "safe" resolution:
  too coarse loses "nearby" utility (matches people kilometers apart), too
  fine reveals the equivalent of a street address. This is an unresolved
  design question, not something this document decides.
- **Neighbor-ring expansion trades precision for a different leak.**
  Querying a cell's ring to solve the boundary problem means a client is
  effectively asking "who is near approximately here", which is still a
  location query — ring expansion fixes the grid problem, not the
  underlying privacy problem (see §7).

---

## 6. Geohash — advantages and drawbacks (research notes)

**Advantages:**
- Simple to implement — a geohash is a base32-encoded interleaving of
  latitude/longitude bits; prefix comparison alone gives a cheap "same
  general area" test with no external binary dependency.
- Well-documented neighbor-expansion algorithms exist (checking the 8
  neighboring geohash cells at the same precision), which — like H3's
  k-ring — is the standard mitigation for the boundary problem.

**Drawbacks:**
- **Rectangular cells.** Geohash cells are lat/lon-aligned rectangles, not
  hexagons, so cell width and height are uneven and vary with latitude —
  the same non-uniformity problem described in §2, just at a chosen
  precision level instead of a fixed decimal-rounding step.
- **The boundary issue remains** at the geohash cell edges — a prefix
  compare alone still splits two physically close points that fall either
  side of a boundary. Neighbor expansion mitigates but does not eliminate
  this (same trade-off as H3's ring expansion, see §5).
- **Precision (string length) is the same kind of "choose the right
  resolution" problem H3 has** — a short geohash prefix is very coarse, a
  long one approaches exact-location precision.

---

## 7. Privacy policy this future feature must follow

These are requirements for **any future implementation**, not something
delivered by this document:

- **Raw latitude/longitude is never stored.** Not in `StorageBackend`
  metadata, not in a database row, not in a log line, not in a Nostr event.
- **Raw latitude/longitude is never sent** — not to a relay, not to any
  server, not to another peer, not inside a Nostr event tag or content
  field.
- **An area id is itself a potential tracking identifier.** Even a coarse
  cell id, observed repeatedly over time for the same user, reconstructs a
  coarse movement trail. "We only store the area id, not the exact
  coordinate" is not sufficient privacy protection on its own.
- **Salt / epoch / rotation design is a separate, future stage.** Any
  scheme to reduce area-id linkability over time (per-epoch salts, rotating
  identifiers, time-bucketed ids) is explicitly **not designed here** — it
  needs its own research and review before Nearby Discovery can ship.
- **Explicit consent is required.** A user must take an affirmative,
  informed action to enable Nearby Discovery. It must never be inferred
  from unrelated permissions (e.g. granting camera/contacts access must
  never imply location-sharing consent).
- **Nearby is off by default.** The feature ships (if ever) opt-in, with
  location sharing/area-id computation disabled until a user turns it on.

---

## 8. Metadata leak surface (beyond the raw coordinate)

Even a design that never stores/sends a raw coordinate can still leak
location information through side channels. These must be documented as
open risks, not solved by this document:

- **Area-id frequency.** How often a given area id appears, and from how
  many distinct users, reveals population density and activity patterns for
  that cell.
- **Time correlation.** Correlating *when* an area id is seen (time of day,
  day of week, session timing) with other user activity can narrow a
  routine or a location far more than the cell size alone suggests.
- **Peer count.** The number of peers reported "nearby" at a given moment
  is itself a signal about that physical area (e.g. a very low count in a
  small cell narrows things considerably).
- **Bandwidth / relay priority.** If "nearby" peers are ever given network
  priority (faster relay, preferred routing, prioritized delivery), the
  *existence* of that priority treatment is an observable side channel that
  can leak who is being treated as physically close to whom.
- **Relay observation.** Any relay or server that sees an area id (even
  without raw coordinates) is a third party positioned to build the
  correlation described above; this is true even for a "trusted" relay.

---

## 9. Relationship to `StorageBackend`

- `StorageBackend` (see `src/storage/types.ts`, `src/storage/policy.ts`)
  does **not** and must not automatically store an area id. Nothing in this
  document changes that boundary.
- If a future design ever wants to place an area id inside
  `StoragePacket.metadata`, that requires **a separate, explicit policy
  stage** — the current `reviewStoragePacket` sensitive-marker policy does
  not evaluate location semantics at all, and passing that policy is not
  evidence that storing an area id is privacy-safe. See
  `docs/storage_metadata_policy.md` for how that boundary is expected to be
  extended before any location-derived value is allowed near it.

---

## 10. What this document does NOT implement

Explicitly out of scope for this stage — none of the following exists after
this document is added:

- An H3 crate/library dependency (Rust or JS/WASM)
- A Geohash crate/library dependency
- GPS access of any kind
- Browser `navigator.geolocation` access
- A mobile location-permission request
- An `get_area_id`-equivalent function in this codebase
- Relay broadcast of any location or area-id value
- Peer discovery of any kind
- Bandwidth/relay priority based on proximity

---

## 11. Preconditions before ANY implementation

If Nearby Discovery / area indexing is ever built, it first requires **all**
of the following. Absence of any one is a blocker:

- **Explicit, informed consent** captured before any coordinate is read.
- **A coarse resolution decision**, documented with its trade-offs (this
  document does not choose one — see §5 and §6).
- **A neighbor-expansion policy** (k-ring / geohash-neighbor / equivalent)
  that addresses the boundary problem described in §2, chosen deliberately
  rather than inherited from whichever library is picked.
- **A rotation policy** (salt/epoch/identifier-rotation) reducing area-id
  linkability over time — designed in its own future stage, not assumed.
- **No raw-coordinate persistence**, anywhere, at any layer.
- **A written threat model** covering at minimum the leaks in §7 and §8,
  reviewed before implementation begins.

---

## 12. Conclusion

- The current Python v8.6 `round(lat, 1)` / `round(lon, 1)` approach is
  **not production safe** — it has both a boundary/grid defect and a
  non-zero privacy cost, independent of each other.
- **H3 and Geohash are candidates only.** Neither is adopted, and no
  dependency has been added. S2 and a coarser fixed grid remain candidates
  for comparison as well.
- **No implementation exists yet.** This document fixes the research
  boundary and the questions a future design stage must answer; it does not
  answer them.
