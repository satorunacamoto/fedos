# Secure Runtime Alpha 324 — Candidate B: IndexedDB Backend Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind, and does NOT implement IndexedDB.** Stage 4 of the Alpha 321–330
Board Durable Backend Selection & Architecture Arc.

## 1. Why now

Continuing Alpha 323's candidate-by-candidate comparison against the
Alpha 322 requirement set: IndexedDB as the browser/Desktop-webview
durable backend.

## 2. Findings

- **Browser availability.** N/A here — no browser environment exists
  anywhere in this repository today (Alpha 321 §3.1: no DOM lib, no HTML
  entry point, no client bundle). IndexedDB is a real, mature, universal
  browser API in the wider world, but this repository has no browser
  host for it to run inside.
- **Desktop shell compatibility.** Only relevant if a future Desktop
  shell is ever a webview-based host (an Electron renderer or Tauri
  webview) — no such shell exists (Alpha 321 §3.3), so this is
  presently hypothetical on two levels (no Desktop shell, and no
  guarantee a future one would even be webview-based).
- **Transaction behavior.** Real (`readwrite`/`readonly` transactions
  scoped to named object stores), but the raw API is callback/event-
  based; a promise-friendly ergonomic wrapper (e.g. the `idb` package) is
  the ecosystem-standard way to use it comfortably — itself a NEW
  dependency this Arc's own Absolute Prohibitions forbid adding.
- **Object-store schema.** A natural fit for a `schemaVersion`-tagged
  record shape: one object store, keyed by `id`, storing plain
  serializable objects — maps cleanly onto
  `FedosPersistedBoardPostRecordV1` (Alpha 313) conceptually.
- **Schema upgrades.** Built in (`onupgradeneeded`, a monotonic DB
  version integer) — but this is a PHYSICAL object-store-shape version,
  a different number from the wire record's own `schemaVersion` field;
  conflating the two would be a design error a future Stage must avoid
  (see Alpha 328 §4).
- **Test environment.** This repository's `vitest.config.ts` sets
  `environment: "node"` (Alpha 321 §3.1) — Node has no native
  IndexedDB implementation. Meaningful testing would require a
  polyfill (`fake-indexeddb`), itself a new devDependency, prohibited
  this Arc.
- **Deterministic listing.** Cursor iteration is KEY-ordered, not
  insertion-ordered — not a problem in practice, since
  `hydrateFedosBoardService` already imposes its own deterministic sort
  by `id` independent of backend iteration order (Alpha 318, matching
  the SHOULD-not-MUST framing in Alpha 322 §3).
- **Corruption visibility.** Opaque — no application-level integrity
  check is exposed; corruption handling relies entirely on the browser's
  own storage-engine implementation, with no equivalent to SQLite's
  `PRAGMA integrity_check`.
- **Backup/export.** No built-in export mechanism; a full export
  requires manually iterating every object store's cursor and
  serializing the result — more application code than any other
  candidate needs for this same MUST requirement (Alpha 322 §2, "backup
  feasibility").
- **Large-data behavior.** Fine at this project's current post-record
  scale; storage-quota ceilings vary by browser and are managed by the
  browser itself, outside application control.
- **Worker availability.** Available inside Web Workers — a DIFFERENT
  "Worker" concept from this repository's own Cloudflare Worker
  (`src/worker.ts`). **Cloudflare Workers' V8 isolate has NO IndexedDB
  API at all** — this naming collision matters enough to state plainly:
  IndexedDB does not reach this repository's actual "Worker."
- **Node availability.** Not native; only reachable via a polyfill
  dependency, as above.
- **Dependency-free implementation potential.** The raw browser API
  itself needs no npm package IF a real browser host exists — but this
  repository has neither that host (§ browser availability) nor a way to
  test against the raw API without a polyfill dependency today.

## 3. Conclusion

IndexedDB is well-suited, in the abstract, to exactly the kind of
versioned, per-record object store this Arc's schema (Alpha 313) already
uses — but it requires a host (a browser, or a webview-based Desktop
shell) that does not exist in this repository (Alpha 321 §3.1/§3.3), and
even testing it meaningfully under this repository's Node-based vitest
setup would require a new polyfill dependency, prohibited this Arc.
Deferred on the same "no real host" grounds as SQLite (Alpha 323), with
the additional, sharper point that the "Worker" name itself is
misleading here: this repository's actual Worker (Cloudflare) cannot
reach IndexedDB regardless of any future browser decision.

## 4. See also

- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
- `docs/secure_runtime_alpha_322_durable_backend_requirements.md`
- `docs/secure_runtime_alpha_323_sqlite_backend_review.md`
