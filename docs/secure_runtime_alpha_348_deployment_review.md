# Secure Runtime Alpha 348 — Deployment Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 8 of the Alpha 341–350 Board Durable Backend
Re-evaluation & Local Backend Selection Arc. Determines where each
reviewed backend can REALISTICALLY exist, across every target
environment this repository has.

## 1. Target environments, re-confirmed unchanged

Per Alpha 321 §3.1–§3.3 (re-confirmed by direct inspection this Arc,
zero drift): exactly two REAL execution environments exist — Cloudflare
Workers (`src/worker.ts`, the primary deployed target) and Node
(`vitest.config.ts`, test/dev harness). No browser exists anywhere in
this repository (no `DOM` lib, no client entry point). Alpha 341 adds
ONE new fact: a real, Node-executable Desktop Host
(`FedosDesktopHost`) now exists WITHIN the Node environment,
distinct from "Node as bare test harness."

## 2. Desktop Host (Node, with a real Host boundary)

- **SQLite:** reachable — Node has a real filesystem and can load a
  native module or (Node 22+) `node:sqlite` (Alpha 343 §1/§2). This is
  the ONLY environment SQLite can ever run in, in this repository, for
  either dependency path reviewed.
- **Append-only:** reachable — Node has a real filesystem, and the
  entire implementation (Alpha 344) uses only already-reachable
  `node:fs`-shaped APIs (Alpha 331 §3.8). Also Host-only, permanently.

**Conclusion: the Desktop Host is the ONLY realistic caller for either
backend.** Every other environment fails at least one requirement
both backends share (a real, persistent, local filesystem):

## 3. Node (bare test/dev harness, no Host)

Technically the SAME runtime as §2 — `vitest.config.ts` sets
`environment: "node"` — but Alpha 321 §3.2 (re-confirmed unchanged)
found no Node process anywhere in `src/` "serves a request, opens a
socket, or is a packaged executable a user would run directly." Both
backends are TECHNICALLY reachable from a test file today (exactly as
`InMemoryFedosBoardPersistence` already is), but neither has a
PRODUCTION caller here — only `FedosDesktopHost` (§2) does. This
distinction matters for Alpha 349: "Node can technically run it" is
NOT the same claim as "a real caller exists," which Alpha 329's own
Decision Constraints already treated as the operative bar.

## 4. Cloudflare Workers

**Neither backend is reachable, permanently.** A V8 isolate has no
filesystem and no native-module support (Alpha 321 §3.10, unchanged) —
this is not a missing dependency or a missing Host, it is a structural
property of the Workers runtime itself that no future Arc can change
without abandoning the Workers deployment target entirely. D1 remains
the only durable option for this environment (Alpha 325, unchanged,
and explicitly out of THIS Arc's own scope — "Do NOT implement... D1").

## 5. Browser

**Neither backend is reachable — no browser exists in this repository
at all** (Alpha 321 §3.1, re-confirmed unchanged: no `DOM` lib, no
client entry point, no `window`/`document` reference anywhere in
`src/`). IndexedDB remains the only theoretically-fitting option for a
future browser/webview host, and remains explicitly out of THIS Arc's
own scope regardless.

## 6. Summary table

| Environment       | SQLite reachable? | Append-only reachable? | Real caller exists? |
|--------------------|:---:|:---:|:---:|
| Desktop Host (Node) | Yes | Yes | **Yes — `FedosDesktopHost`** |
| Node (bare, no Host) | Yes (untested-in-production) | Yes (untested-in-production) | No |
| Cloudflare Workers  | No (no filesystem) | No (no filesystem) | N/A |
| Browser             | No (doesn't exist) | No (doesn't exist) | N/A |

## 7. Conclusion

Exactly one environment — the Desktop Host — is BOTH technically
capable of hosting either reviewed backend AND has a real,
non-test caller (`FedosDesktopHost`, Alpha 341). This confirms, from
the deployment side, the SAME conclusion Alpha 341's own capability
inventory reached from the Host side: this Arc's own premise — that a
real local Host caller now exists to unblock backend selection — holds
under direct re-inspection, for BOTH backends equally. Deployment
environment is therefore NOT a differentiator between SQLite and
append-only (Alpha 349's own selection must be decided on the other
criteria: dependency footprint, crash recovery, migration,
testability, simplicity).

## 8. See also

- `docs/secure_runtime_alpha_341_host_capability_inventory.md`
- `docs/secure_runtime_alpha_343_sqlite_review.md`
- `docs/secure_runtime_alpha_344_append_only_backend_review.md`
- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
