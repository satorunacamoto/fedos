# FedOS Runtime ⇄ Rust boundary decision (Stage 385–392)

**Status: this document records a real architecture decision.** It
does NOT introduce any executable code — no WASM is generated, no FFI
is added, no Native Addon is added, nothing is loaded or executed.
This is the decision itself, made explicitly and in writing, before
any of it is built.

## The decision

**WebAssembly is the sole official MVP boundary between FedOS Runtime
and `packages/fedos-core-rust`.**

```
FedOS Runtime
     |
     v
WebAssembly
     |
     v
FedOS Rust  (packages/fedos-core-rust)
```

No other mechanism — Node Native Addon, a spawned CLI process, or a
raw FFI/N-API binding — is adopted for the MVP. This is a genuine
architectural decision with genuine trade-offs, recorded here so the
reasoning is not lost or silently re-litigated stage by stage.

## Why WebAssembly

- **Runs in every target this codebase already ships to.** `nostr-window`
  runs in a browser context as well as Node; a WASM module loads
  identically in both, with no platform-specific rebuild step. A
  Native Addon (`.node` file) is platform- and Node-ABI-specific and
  cannot run in a browser at all.
- **No process boundary, no IPC serialization.** A CLI-subprocess
  boundary would require serializing every request/response across
  stdin/stdout (or a socket), adding latency, a new failure class
  (process spawn failure, broken pipe), and a much larger surface for
  something to go wrong silently. WASM calls are in-process function
  calls once loaded.
- **Matches this codebase's existing, already-guarded expectations.**
  `test/fedos_core_wasm_loader.test.ts` (Stage 63) already models a
  `FedosCoreWasmLoader` interface and guards against a WASM binary or
  loader being wired in prematurely — the WASM path is the one this
  repository has been structurally preparing for since early on, not
  a new idea introduced by this decision.
- **`packages/fedos-core-rust` already targets this.** The crate's own
  `Cargo.toml` and `src/lib.rs` structure (a `cdylib`-friendly, no-std-adjacent,
  dependency-minimal crate) is naturally suited to `wasm-bindgen`/
  `wasm-pack` compilation — no crate-level redesign would be needed to
  produce a WASM artifact from it later.

## Why NOT Node Native Addon (rejected for the MVP)

A Native Addon (built with `napi-rs`/`neon`, producing a `.node` file)
would give the fastest raw call performance and full access to native
threading — but:
- It only runs under Node.js, never in a browser. This codebase's
  Runtime is not Node-only.
- It requires per-platform prebuilt binaries (Windows/macOS/Linux ×
  architecture) or a build toolchain on every install target — a much
  heavier operational burden than a single portable `.wasm` file.
- It would need `node-gyp`/`napi-rs` tooling as a new build-time
  dependency, which this stage — and every stage before it — has been
  explicitly forbidden from adding.

**May be reconsidered later** if a Node-only, latency-critical path
ever needs raw native performance beyond what WASM provides — but that
is a future, separate, explicitly-reviewed decision, not this one.

## Why NOT a spawned CLI process (rejected for the MVP)

Spawning `packages/fedos-core-rust` as a compiled CLI binary and
communicating over stdin/stdout would avoid any WASM/FFI complexity
entirely — but:
- It introduces a real OS process per call (or a long-lived worker
  process to manage), with all the lifecycle, error-handling, and
  cross-platform binary-distribution concerns that implies.
- It cannot run in a browser at all.
- Serializing key material or plaintext across a process boundary (even
  a local one) is a strictly larger attack surface than an in-process
  WASM linear memory that never leaves the same process.

**May be reconsidered later** for a specific dev-tooling or
server-only use case — but not for the MVP Runtime path.

## Why NOT raw FFI (rejected for the MVP)

A raw FFI binding (calling into a `.dll`/`.so`/`.dylib` via a low-level
foreign-function mechanism, distinct from a packaged Native Addon)
carries the same Node-only, per-platform-binary drawbacks as the
Native Addon option above, with LESS tooling support and LESS memory
safety than either a Native Addon (which wraps FFI in a maintained,
audited layer) or WASM (which runs in a memory-sandboxed VM by
design). There is no scenario where raw FFI is preferable to the
Native Addon option already rejected above, so it is rejected for the
same reasons plus this additional one.

## What this decision does NOT do

- Does NOT generate any `.wasm` file. `test/fedos_core_wasm_loader.test.ts`
  (Stage 63, item 13) still asserts no compiled artifact exists.
- Does NOT call `WebAssembly.instantiate`/`WebAssembly.compile` anywhere.
- Does NOT add `wasm-bindgen`, `wasm-pack`, or any WASM tooling to
  `Cargo.toml`/`package.json`.
- Does NOT change `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` (still
  permanently `false`).
- Does NOT execute any cryptographic operation, call Rust, or load
  anything.

## Still true after this stage

- No Rust execution, no WASM load, no FFI, no Native Addon, no CLI.
- No Runtime activation, no Worker activation.
- `encrypt()`/`decrypt()` STILL always resolve `"Unsupported"`.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  STILL never return `"Allowed"`.
- No `Cargo.toml`/`package.json` change, no new Rust public API, no
  new `pub fn`.

## See also

- `docs/runtime_wasm_boundary.md` (Stage 386–390) — the placeholder
  `FedosWasmBoundary` model this decision motivates.
- `docs/runtime_internal_execution_contract.md` (Stage 356) — the
  multi-link contract this decision adds a tenth link to.
- `test/fedos_core_wasm_loader.test.ts` (Stage 63) — the pre-existing
  WASM loader boundary this decision is consistent with.
