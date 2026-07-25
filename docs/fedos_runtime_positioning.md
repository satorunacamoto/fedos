# FedOS Runtime Positioning — Secure Runtime Platform, Desktop-first

> **Status update: Secure Runtime Alpha 8281-8360 — Production Cleanup
> and Repository Consolidation Arc.** Everything below this box is the
> ORIGINAL positioning document (Stage ~700s era), written before the
> real, shipped Desktop Beta product existed, and is preserved unchanged
> as historical context. Since then, the "Production activation — no
> real cryptography executes anywhere" line in §3 has become historically
> inaccurate: real production crypto activation now exists, but as a
> SEPARATE tree this document's own Runtime chain never connects to. This
> repository contains two, largely-disconnected Runtime/crypto paths
> today; the diagram below is the current, accurate picture (full trace:
> `docs/reviews/fedos_dead_runtime_production_path_v1/01_production_path_graph.md`
> and `02_non_production_path_graph.md`):
>
> ```
> Path A -- ORIGINAL product ("nostr-window"), described by this document below
>   src/worker.ts (Cloudflare Worker, no deploy config in this repo today)
>     -> src/runtime/create_runtime.ts  (createRuntime() / AppRuntime)
>          -> initializeCrypto()  =>  always { allowed: false, reason: "PrototypeDisabled" }
>          -> (reaches fedos_crypto_loader_facade.ts and stops -- never
>              reaches fedos_wasm_loader.ts, WebAssembly, or Rust)
>   Reachable from: src/worker.ts, and 295 test files. NOT reachable from
>   the shipped Desktop app.
>
> Path B -- REAL product actually shipped: FedOS Desktop Beta (Electron)
>   packages/fedos-desktop-electron-spike/  (electron_builder.beta.config.json -> main)
>     -> src/desktop/production_activation/*
>          -> fedos_profile_initialization_coordinator.ts  (real identity bootstrap)
>          -> real WASM-backed crypto via packages/fedos-core-rust (Rust)
>   This path NEVER constructs an AppRuntime and NEVER calls create_runtime.ts.
> ```
>
> Both paths are real and tested; neither is "the mistake." The
> confusion this update fixes is purely that one repository, one
> `package.json`, and one `README.md` describe two coexisting products,
> and this document (like `create_runtime.ts` itself) only ever described
> Path A. See `docs/reviews/fedos_dead_runtime_production_path_v1/`
> (Dead Runtime Paths / Production-Path Consolidation V1 review) for the
> full evidence trail. No code changed by this update.

**Status: this document is a SCOPE/POSITIONING statement only — it
adds no code, changes no fixed value, and does not alter any existing
guard test's outcome.** It exists to fix, in writing, what "FedOS"
names in this repository and what it deliberately does NOT name,
before further Backend Interface / Backend Abstraction work (see
`docs/runtime_crypto_backend_interface.md`) continues to build on top
of it.

## 1. What FedOS is NOT

**FedOS is not an operating-system replacement.** Despite the name, it
is not, and is not intended to become, a Tails- or Whonix-style
bootable OS/distribution that isolates or anonymizes an entire machine.
Nothing in this repository boots a kernel, manages a filesystem at the
OS level, virtualizes hardware, or routes system-wide network traffic.
Any resemblance in naming to that category of project is coincidental
and this document exists specifically to foreclose that reading.

## 2. What FedOS is

**FedOS is a Secure Runtime Platform** — a runtime that runs ON TOP OF
an existing, already-installed OS, providing a narrow, well-audited
boundary for cryptography, keys, signatures, and safety-critical
operations to the rest of this project (`nostr-window`) and to future
callers. It is a library/runtime concern, not a platform/kernel
concern.

## 3. Desktop-first

FedOS's runtime target is **desktop-first**. Design decisions,
threat-model assumptions (`docs/runtime_crypto_threat_model.md`), and
the Execution Backend candidate ordering (`docs/runtime_execution_backend.md`
— WASM first, Native second) all assume a desktop execution
environment first. The following are explicitly OUT OF SCOPE for the
current phase of work, not merely deprioritized:

- **Mobile** — no iOS/Android runtime target, no mobile-specific
  backend candidate is scheduled.
- **Worker** — `src/worker.ts` remains, and continues to remain,
  deliberately unconnected to every `fedos_*.ts` Planning-chain file
  and to `AppRuntime.initializeCrypto()` (see
  `docs/runtime_internal_execution_contract.md`'s repeated "Worker
  remains explicitly OUT OF SCOPE" notes across every prior stage).
  This document does not change that; it restates WHY: Worker
  activation is a Cloudflare-edge concern, not a desktop-runtime
  concern, and belongs to a different, future, explicitly-reviewed
  scope decision if it is ever revisited.
- **Production activation** — no real cryptography executes anywhere
  in this arc (`encrypt`/`decrypt` remain `"Unsupported"`); no
  Cargo/`package.json` dependency is added; no generated artifact is
  built, loaded, or committed by this document or by any stage it
  informs.

## 4. Language responsibilities

This repository's cross-language boundary is fixed by role, not by
convenience:

| Layer | Language | Responsibility |
|---|---|---|
| Cryptography, keys, signatures, safety boundaries | **Rust** (`packages/fedos-core-rust`) | The ONLY place cryptographic material is ever handled. Does not know about "backends," "loaders," JavaScript, or Python. |
| Runtime glue, UI, orchestration | **TypeScript** (`src/runtime/`, `src/worker.ts`, the rest of `nostr-window`) | Calls into the crypto boundary through the Facade/Backend Abstraction/Backend Interface seam (§5) — never reasons about Rust internals directly. |
| Experimentation, analysis, EMSR, Ontology work | **Python** (future, unimplemented) | Named as a FUTURE candidate surface only — `"PythonPlanned"` in `fedos_crypto_loader_backend.ts`/`fedos_crypto_backend_interface.ts` — for offline research, experimentation, EMSR-style analysis, and Ontology/taxonomy work that does not belong in the production TypeScript runtime or in the Rust safety boundary. No file, dependency, or line of code anywhere in this repository implements this candidate; naming it here is scope, not a commitment. |

`docs/runtime_crypto_loader_backend_abstraction.md` §3 and
`docs/runtime_crypto_backend_interface.md` §3 already fix this same
division for the Rust/Runtime/Facade/Backend-Abstraction/
Backend-Interface chain specifically; this document generalizes it to
the whole repository's positioning, not just that one call chain.

## 5. Runtime never knows backend detail

Consistent with every stage of the `fedos_*.ts` Planning arc to date:
`AppRuntime`/`create_runtime.ts` calls `initializeCrypto()` and nothing
further — it never learns whether a candidate is
`"WasmPlanned"`/`"NativePlanned"`/`"PythonPlanned"`, whether a Backend
Interface is `interfaceReady`, or whether a WASM backend has
`loaderAttached`. That knowledge stops at the Facade →
Backend Abstraction → Backend Interface → WASM Backend Planning chain
(`docs/runtime_internal_execution_contract.md`), by design, so that
swapping or adding a backend candidate never touches Runtime's own
code.

## 6. No real load, in this document or by extension

This document does not implement, connect, or activate anything. It
does not:

- Create, select, or activate a real backend of any kind.
- Connect the real WASM Loader (`fedos_wasm_loader.ts`) or the
  generated JS glue.
- Write `import()` of any kind (static or dynamic), or call
  `WebAssembly.instantiate`/`WebAssembly.compile`/`initSync`/the
  default init export.
- Modify `src/worker.ts` or any Worker diagnostics file.
- Execute cryptography, or implement NIP-17/NIP-44/NIP-59.
- Add a Cargo/`package.json` dependency.
- Commit a generated artifact.

## See also

- `docs/runtime_crypto_backend_interface.md` (Stage 745) — the
  backend-agnostic contract this positioning motivates: ONE shape for
  WASM/Native/Python candidates, so Runtime and the Backend
  Abstraction never branch on which one is behind it.
- `docs/runtime_crypto_loader_backend_abstraction.md` (Stage 713) —
  the Backend Abstraction's own Rust/Runtime/Facade division of
  responsibility, generalized here.
- `docs/runtime_internal_execution_contract.md` — the full call-graph
  contract this positioning's §3/§5 restate the "Worker out of scope"/
  "Runtime never knows backend detail" conclusions of.
- `docs/runtime_crypto_threat_model.md` — the threat-model assumptions
  this positioning's desktop-first framing is consistent with.
- `docs/runtime_execution_backend.md` — the WASM-first, Native-second
  Execution Backend candidate ordering this positioning's §3 refers to.
