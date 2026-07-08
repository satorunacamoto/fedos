# FedOS Minimum Runtime Chain (Prototype Phase 007)

**Status: this document is a DEFINITION, not an implementation
change.** It names which layers are the minimum FedOS Runtime actually
needs, going forward, and states the Architecture Principles that
justify that minimum. It changes no code, no fixed value, no
diagnostics field, and no wiring. Nothing is deleted or merged by this
document.

## 1. The chain

```
Runtime (AppRuntime)
        │
        ▼
initializeCrypto()
        │
        ▼
Crypto Loader Facade                  (fedos_crypto_loader_facade.ts)
        │
        ▼
Crypto Loader Backend                 (fedos_crypto_loader_backend.ts — "Backend Abstraction")
        │
        ▼
Crypto Backend Interface              (fedos_crypto_backend_interface.ts)
        │
        ▼
Crypto Backend Resolver               (fedos_crypto_backend_resolver.ts)
        │
        ▼
WASM Backend                          (fedos_wasm_backend.ts — "WASM Backend Planning")
        │
        ▼
(future) WASM Loader                  (fedos_wasm_loader.ts — Loader Skeleton, not yet connected)
        │
        ▼
Rust                                  (packages/fedos-core-rust, not yet connected)
```

This is the SAME chain `docs/runtime_architecture_simplification_review.md`
§1's "Chain 1" names as the only one actually reached, today, from
`createRuntime().initializeCrypto()` — with its two still-future links
(WASM Loader, Rust) appended as the acknowledged, not-yet-built
continuation. Every link up to and including WASM Backend is REAL code
today; every link past it remains exactly as disconnected as
`docs/runtime_internal_execution_contract.md` has always documented.

## 2. Why each link is required

- **Runtime (`AppRuntime`)** — the one public surface callers ever see;
  everything below this line is Runtime's own implementation detail.
- **`initializeCrypto()`** — the ONLY entry point into crypto
  initialization; no auto-load, no implicit load
  (`docs/runtime_explicit_crypto_initialization.md`).
- **Crypto Loader Facade** — the single door Runtime and Provider ever
  see; the WASM Loader and Rust are never known above this line
  (`docs/runtime_crypto_loader_facade.md`).
- **Crypto Loader Backend** — names WHICH backend candidate
  (`"WasmPlanned"`/`"NativePlanned"`/`"PythonPlanned"`) is designated,
  without the Facade ever hard-coding one
  (`docs/runtime_crypto_loader_backend_abstraction.md`).
- **Crypto Backend Interface** — a common, backend-agnostic CONTRACT
  shape so a future Native or Python candidate never forces the
  Abstraction to branch (`docs/runtime_crypto_backend_interface.md`).
- **Crypto Backend Resolver** — answers ONLY "which backend is
  planned," kept separate from "is it ready to load"
  (`docs/runtime_crypto_backend_resolver.md`).
- **WASM Backend** — the WASM candidate's OWN readiness and
  loader-attachment state, separate from the Resolver's repository-wide
  answer (`docs/runtime_wasm_backend_planning.md`).
- **(future) WASM Loader** — the eventual real loader for the generated
  JS glue; today a Loader Skeleton (`fedos_wasm_loader.ts`) that plans
  operations and denies all of them by policy
  (`docs/runtime_wasm_loader.md`), structurally isolated from the chain
  above it until a future, separate, explicitly-reviewed stage connects
  them.
- **Rust (`packages/fedos-core-rust`)** — the only place cryptography,
  keys, signatures, and safety boundaries live
  (`docs/fedos_runtime_positioning.md` §4); still fully disconnected
  from TypeScript.

## 3. What is explicitly NOT in the Minimum Runtime Chain

Per `docs/runtime_architecture_simplification_review.md`, three other
chains exist in this repository and are DELIBERATELY excluded from the
minimum:

- **Chain 2 (Provider/Facade Boundary + initializeCrypto Public API,
  10 files)** — real and reached from the Facade's own second reach,
  but never touches Rust/WASM. Redirected to: stays real code for now
  (mostly Merge Candidates for a future stage; see the review §3).
- **Chain 3 (WASM Loader Activation, 14 files)** — a disconnected
  island naming every precondition before the WASM Loader could ever
  be activated. Redirected to: `fedos_wasm_loader.ts` and
  `fedos_explicit_crypto_initialization.ts` stay Core Runtime (they
  encode load-bearing policy); the other 12 are Merge/Documentation
  candidates.
- **Chain 4 (Rust Execution Readiness, 13 files)** — the ORIGINAL,
  pre-Prototype-Phase architecture, reachable only via direct test
  instantiation of `FedosRuntimeCryptoProvider`, never from
  `AppRuntime.crypto`'s default path. Redirected to:
  `fedos_runtime_crypto_provider.ts` stays Core Runtime (the eventual
  real provider); most of the rest are Merge candidates, two
  conceptually duplicating Chain 1 itself
  (`fedos_execution_backend.ts`, `fedos_wasm_boundary.ts`).

None of these three chains is touched, deleted, or merged by this
document — they remain exactly as they are today.

## 4. Architecture Principles

These principles govern every future decision about what belongs in
the Minimum Runtime Chain versus documentation-only or a future
consolidation:

1. **FedOS is a Secure Runtime Platform** — not an OS replacement, not
   a Tails/Whonix-style distribution
   (`docs/fedos_runtime_positioning.md` §1–2).
2. **Desktop-first** — design and threat-model assumptions target
   desktop execution first (`docs/fedos_runtime_positioning.md` §3).
3. **Runtime is minimum configuration** — `AppRuntime` exposes as few
   real, load-bearing layers as the design honestly requires; every
   additional layer is a candidate for documentation or future
   consolidation, never added for its own sake (this document, §1/§3).
4. **Fail Closed is maintained** — every layer, in every chain,
   permanently resolves its own denial; nothing in this review changes
   that (`docs/runtime_crypto_threat_model.md`).
5. **Runtime never knows backend detail** — `AppRuntime`/
   `create_runtime.ts` calls `initializeCrypto()` and nothing further;
   `backendKind`/`backendSelected`/`loaderKind` never surface above the
   Facade (`docs/runtime_internal_execution_contract.md`).
6. **Independent of Worker** — `src/worker.ts` remains unmodified and
   unconnected to every layer in every chain named above
   (`docs/runtime_worker_activation_boundary.md`).
7. **The cryptographic boundary is concentrated in Rust** —
   `packages/fedos-core-rust` is the ONLY place cryptography, keys,
   signatures, and safety boundaries live (`docs/fedos_runtime_positioning.md` §4).
8. **TypeScript is wiring** — runtime glue, UI, and orchestration only;
   it never reasons about Rust internals directly
   (`docs/fedos_runtime_positioning.md` §4).
9. **Python is EMSR/Ontology/experimentation** — a FUTURE, unimplemented
   candidate surface (`"PythonPlanned"`) for offline research,
   experimentation, EMSR-style analysis, and Ontology/taxonomy work —
   never the production runtime or the Rust safety boundary
   (`docs/fedos_runtime_positioning.md` §4).

## 5. Guardrails (unchanged by this document)

- No Runtime, Worker, Facade, Backend, Interface, Resolver, or WASM
  Backend behavior changes.
- No diagnostics field is added, removed, or renamed.
- No Planning Layer is deleted or merged — every classification in
  `docs/runtime_architecture_simplification_review.md` is a
  recommendation for a FUTURE, separate, explicitly-reviewed stage.
- No Loader is added or connected; `fedos_wasm_loader.ts` remains a
  Skeleton, not a real loader.
- No `import()` of any kind (static or dynamic), no
  `WebAssembly.instantiate`/`compile`, no `fetch`.
- No cryptographic operation of any kind; NIP-17, NIP-44, NIP-59,
  Double Ratchet, Triple Ratchet, and onion routing all remain
  unimplemented.
- No Cargo or `package.json` dependency added; no generated artifact
  committed.

## See also

- `docs/runtime_architecture_simplification_review.md` — the full
  42-layer review this Minimum Chain is drawn from.
- `docs/fedos_runtime_positioning.md` — the source of Architecture
  Principles 1, 2, 7, 8, and 9.
- `docs/runtime_crypto_threat_model.md` — the source of Architecture
  Principle 4 (Fail Closed).
- `docs/runtime_worker_activation_boundary.md` — the source of
  Architecture Principle 6 (Worker independence).
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth this chain is verified against.
- `docs/fedos_onion_like_routing.md` — a separate, unrelated docs-only
  design review, still fully unimplemented and out of scope for this
  chain.
