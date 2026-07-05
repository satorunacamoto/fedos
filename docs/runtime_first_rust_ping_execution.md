# The first Rust ping "execution" (Stage 377–384)

**Status: this document records real code.** It explains what
`planPing()`'s new behavior (Stage 377) actually is, what it honestly
is NOT, and why cryptographic functionality remains completely
untouched by this stage.

## 1. The flow that now completes

```
TypeScript
  |
  v
FedosRustInvocationAdapter.planPing()      (src/runtime/fedos_rust_invocation_adapter.ts, Stage 370/377)
  |
  v
fedosRustPingBridgeCall()                  (Stage 377 -- pure TypeScript function)
  |
  v
returns true                               <-- STAGE 377-384 ENDS HERE
```

```
                                            (independent, unwired)
Rust
  |
  v
fedos_runtime_ping_internal()              (packages/fedos-core-rust/src/lib.rs, Stage 369, pub(crate))
  |
  v
returns true                               <-- verified by cargo test, never called from TypeScript
```

`planPing()` now resolves `{ state: "RustPingExecuted", succeeded: true,
... }` instead of Stage 370–376's `"BlockedByImplementation"`. **No
cryptographic operation is executed anywhere in this flow.** No NIP-44,
no AES, no ChaCha20, no HKDF, no key generation, no `SecretHandle`, no
`ConversationKey`, no `MessageKey`, no `Nip44WirePayload`. The only
thing that happens is: a function with zero parameters runs and
returns the boolean `true`.

## 2. What "executed" honestly means here

This is the part worth being precise about. TypeScript, running under
Node/Vitest/a browser, cannot invoke compiled Rust bytecode without
one of: a WASM module instantiated via `WebAssembly.instantiate`, a
native addon (FFI, e.g. N-API/neon), or an external process spawn.
**None of these exist in this repository**, and Stage 377–384 adds
none of them — `test/fedos_core_wasm_loader.test.ts` (Stage 63)
already guards against a `.wasm` binary or compiled artifact ever being
committed, and this stage's own guard tests (`test/runtime_first_rust_ping_execution.test.ts`,
Stage 381) additionally verify no such boundary was introduced.

So what does `planPing()` actually call? `fedosRustPingBridgeCall()`
— a hand-maintained, pure TypeScript function
(`src/runtime/fedos_rust_invocation_adapter.ts`) that reproduces
`fedos_runtime_ping_internal()`'s contract EXACTLY: zero parameters,
zero allocation, zero state, always returns `true`. The two functions
are NOT connected by any runtime mechanism. They are connected by
CONTRACT EQUIVALENCE, independently verified twice:

- Rust's own `cargo test` suite (`fedos_runtime_ping_wiring`, Stage
  369) proves `fedos_runtime_ping_internal()` always returns `true`.
- This repository's `vitest` suite (Stage 381) proves
  `fedosRustPingBridgeCall()` always returns `true`, and additionally
  proves the two function bodies match the same trivial shape.

Calling this "the first Rust invocation" is honest in the sense that
it is the first time this internal chain's terminal step (`planPing()`)
produces a genuinely EXECUTED, SUCCEEDED outcome rather than a
permanently blocked one — a real change in kind from every prior
stage (305–376), which never let ANY chain link report anything but
denial. It is NOT honest to say TypeScript called into the compiled
Rust binary; it did not, and cannot, without a future, separate,
explicitly-reviewed stage introducing an actual WASM/FFI boundary.

## 3. Why encrypt/decrypt are untouched

`planEncrypt()`/`planDecrypt()` still use
`FedosRustInvocationAdapterDecisionState`, ALWAYS resolving
`"BlockedByImplementation"` — completely unchanged by this stage. The
ping's own execution-state model, `FedosRustPingExecutionState`
(`"RustPingNotExecuted"` / `"RustPingExecuted"`), is a SEPARATE type
that only `planPing()` uses. This separation (Stage 378) is
deliberate: proving the harmless ping path can report success must
never, by construction, imply anything about the encrypt/decrypt
paths — those remain governed entirely by
`FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` (still permanently `false`) and
`FedosRustExecutionReview` (still `{ approved: false, reason:
"BlockedBeforeCrypto" }`).

## 4. Still true after this stage

- No cryptographic operation of any kind is ever executed.
- No NIP-44, no AES, no ChaCha20, no HKDF execution.
- No key generation, no `SecretHandle`/`ConversationKey`/`MessageKey`/
  `Nip44WirePayload` exposure.
- No WASM, no FFI, no native addon, no subprocess.
- No Runtime activation, no Worker activation —
  `create_runtime.ts`/`src/worker.ts` still never call `planPing()`
  or any link in this chain.
- `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  still never return `"Allowed"`, even with both locks open.
- `encrypt()`/`decrypt()` still always resolve `"Unsupported"`.
- No `Cargo.toml`/`package.json` change, no new Rust public API — the
  Rust crate's source is untouched by this stage; only the
  already-existing, already-tested `fedos_runtime_ping_internal()`
  (Stage 369) is referenced, in documentation only.

## See also

- `docs/runtime_first_rust_invocation.md` (Stage 369–376) — why the
  ping exists at all and why crypto is intentionally excluded from it.
- `docs/runtime_internal_execution_contract.md` (Stage 356) — the
  multi-link contract this stage does not extend (Rust Crypto, link 8,
  remains disconnected).
