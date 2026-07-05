# The first minimal Rust invocation: ping (Stage 369–376)

**Status: this document records real code.** It explains why a
trivial, constant-returning "ping" function is the FIRST executable
Rust entry point this codebase introduces — and why cryptographic
functionality is deliberately excluded from it.

## 1. Why ping exists

Every prior stage (305–368) built a nine-link internal execution chain
— `Provider → Operation → Opaque Request → Opaque API → Rust Boundary
→ Rust API → Execution Review → Internal Rust Call → Rust Invocation
Adapter → STOP` — entirely in TypeScript, entirely without ever
invoking Rust, WASM, or FFI. That chain is now complete and stable.

The NEXT open question is not "what does the chain look like" (already
answered) but "what does it feel like when TypeScript actually calls
into Rust for the first time." Answering that question with a
cryptographic function first would mean debugging TWO new things at
once: the cross-language call mechanism itself, AND whatever crypto
logic sits behind it. `fedos_runtime_ping_internal()`
(`packages/fedos-core-rust/src/lib.rs`, Stage 369) isolates the FIRST
concern from the second: it takes no parameters, performs no
allocation, holds no state, and always returns `true`. If a future
stage's first real cross-language call breaks, the failure can only be
in the call mechanism — never in cryptographic logic, because there is
none to break.

## 2. Why crypto is intentionally excluded

This stage's Forbidden list is deliberately identical to every prior
stage's: no encryption, no decryption, no key material, no NIP-44, no
`SecretHandle`, no `ConversationKey`, no `MessageKey`, no
`Nip44WirePayload`. `fedos_runtime_ping_internal()` cannot violate any
of these — it has no parameters to carry key material, no return type
capable of carrying ciphertext, and no branch that could ever reach
`crate::crypto`. This is not an oversight to be fixed later; it is the
entire point. Proving the cross-language call mechanism works, using a
function that is structurally incapable of leaking anything sensitive,
is strictly safer than proving it with a function that could.

`FedosRustInvocationAdapter.planPing()` (`src/runtime/fedos_rust_invocation_adapter.ts`,
Stage 370) mirrors this on the TypeScript side: it ALWAYS resolves
`"BlockedByImplementation"` in this stage and **never calls Rust yet**.
Stage 369–376 adds the Rust function and the TypeScript planning method
as two independent, unconnected pieces — proving each compiles and
tests correctly in isolation, without yet wiring them together.

## 3. What exists today

```
1-9. (unchanged) Provider -> ... -> Rust Invocation Adapter -> STOP
     |
     v
   FedosRustInvocationAdapter.planPing()   (Stage 370, TypeScript)
     -> { state: "BlockedByImplementation", ... }   -- never calls Rust

   fedos_runtime_ping_internal()            (Stage 369, Rust, pub(crate))
     -> true                                -- callable only from within
                                                the Rust crate's own tests;
                                                nothing in TypeScript calls
                                                it yet
```

These two pieces are NOT wired to each other. There is no FFI
boundary, no WASM boundary, no function anywhere in this repository
that calls `fedos_runtime_ping_internal()` from TypeScript.

## 4. Future migration path

A future, separate, explicitly-reviewed stage (see this repository's
own Stage 377 candidate list) would:

1. Promote `fedos_runtime_ping_internal()` from `pub(crate)` to a
   properly reviewed public/FFI/WASM-callable surface — a deliberate,
   visible change to `packages/fedos-core-rust`'s public API, NOT a
   silent visibility bump.
2. Extend `planPing()` to actually invoke that surface and return its
   real result (`true`), rather than the fixed
   `"BlockedByImplementation"` this stage produces.
3. Only AFTER that harmless round-trip is proven working end-to-end
   would any stage introduce a cryptographic function across the same
   boundary — starting from `fedos_encrypt`/`fedos_decrypt`
   (`packages/fedos-core-rust/src/lib.rs`), which already exist and are
   already tested, but are not yet reachable from TypeScript at all.

## 5. Still true after this stage

- No cryptographic operation of any kind is ever executed.
- No encrypt, no decrypt, no NIP-44 execution.
- No `SecretHandle`/`ConversationKey`/`MessageKey`/`Nip44WirePayload`
  exposure — all remain `pub(crate)`-private inside
  `packages/fedos-core-rust`.
- No WASM, no FFI.
- No Runtime activation, no Worker activation.
- No `Cargo.toml`/`package.json` change, no new Rust public API
  (`fedos_runtime_ping_internal` is `pub(crate)`, not `pub`).
- No Relay, Storage, Nostr, or NIP-17 connection of any kind.

## See also

- `docs/runtime_fedos_rust_invocation_adapter.md` (Stage 361–368) — the
  Rust Invocation Adapter this stage's `planPing()` extends.
- `docs/runtime_internal_execution_contract.md` (Stage 356) — the
  multi-link contract this ping sits at the end of.
