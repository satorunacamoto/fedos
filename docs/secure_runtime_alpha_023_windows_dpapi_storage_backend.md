# FedOS Secure Runtime Alpha 023 — Windows DPAPI Storage Backend

**Status: IMPLEMENTED.** Adds `WindowsDpapiStorageBackend`, a SECOND
`RuntimeStorageBackend` implementation standing alongside Alpha 019's
`MemoryStorageBackend` (Alpha 021's renamed home) — completing the
first real OS-backed backend Alpha 022 recommended. The Storage
Resolver (`fedos_runtime_storage_resolver.ts`) remains hardcoded to
`MemoryStorageBackend` only, exactly as Alpha 021 left it — wiring a
real backend switch is explicitly out of this Stage's own scope.

## 1. Implementation method — compared before writing any code

Per the mandate, five ways to reach Windows DPAPI from this Runtime
were compared across four criteria before choosing one.

| # | Method | 新規依存 (new dependency) | 保守性 (maintainability) | Fail Closed | Runtime適合性 (fit) |
|---|---|---|---|---|---|
| ① | PowerShell (`powershell.exe`, built-in Windows PowerShell 5.1, via `child_process`) | None — Node's built-in `child_process` + the OS's own bundled `powershell.exe`; no npm package, no Rust crate | High — `System.Security.Cryptography.ProtectedData` is a stable, long-supported .NET API; the script is a short, fixed, readable constant | Simple — exactly three failure shapes (non-zero exit / thrown terminating error / timeout), each collapsing to the SAME `null` | Good — fits this arc's existing "async spawn + try/catch, Fail Closed to null" shape directly; Storage operations are inherently low-frequency, so per-call process-spawn cost is acceptable |
| ② | `child_process` calling a lower-level Windows CLI tool directly (e.g. `certutil`, `reg`) | None | Low — no OS-standard CLI directly wraps generic-purpose DPAPI protect/unprotect; repurposing a certificate-oriented tool like `certutil` for this is non-standard and brittle | Complex — each tool's own output format differs and requires fragile parsing | Low — in practice collapses back into ① (spawning a process and reading stdout) while losing ①'s clean, purpose-built .NET API |
| ③ | Node native API (a compiled N-API/`node-gyp` addon calling Win32 `CryptProtectData` directly, or an existing npm package such as `keytar`) | Yes — a new npm dependency and/or a native build toolchain (`node-gyp`), directly against this Stage's own "no new dependency" constraint | Low — prebuilt-binary distribution, Node ABI-version compatibility, and cross-compilation are real, ongoing operational costs | Depends on the addon's own design; still needs correct native-exception-to-JS-Promise propagation, an extra layer of Fail-Closed surface | Low — this project's own `types: ["@cloudflare/workers-types"]` suggests a broader-than-Node-only ambition; a native addon cannot run in a Workers-style runtime at all |
| ④ | Rust — DPAPI via the `windows`/`winapi` crate, either as a native Node addon (`napi-rs`) or reached from `packages/fedos-core-rust` itself | Yes — a new Cargo dependency, directly against this Stage's own "Cargo変更禁止が望ましい" preference | Low — `packages/fedos-core-rust` compiles for `wasm32-unknown-unknown` (verified: no Win32 API is reachable from that target at all); reaching DPAPI this way requires changing the crate's own compilation target, a large, separate, unauthorized architectural change | Not evaluable via the WASM path — architecturally blocked, not merely inconvenient | Unfit — the existing crate cannot reach any Win32 API from its current target |
| ⑤ | Other (a prebuilt helper `.exe` checked into the repo; PowerShell Core `pwsh.exe`; Windows Credential Manager CLI tools like `cmdkey`/`vaultcmd`) | A checked-in binary is dependency-adjacent (build/signing/distribution concerns each time it changes); `pwsh.exe` is NOT guaranteed present on every Windows install (unlike Windows PowerShell 5.1, which ships with the OS) | Low-to-medium — a checked-in binary needs rebuilding and recommitting on every change; Credential Manager CLI tools serve a different purpose (named credentials, not generic byte protection) | Achievable but adds real distribution risk if the checked-in binary itself is ever the failure point | Medium — workable, but strictly more complex and riskier than ① for no compensating benefit |

**Selected: ① PowerShell, invoked via `child_process`, using the
Windows-PowerShell-5.1-bundled `System.Security.Cryptography.ProtectedData`.**

Reasoning: it is the ONLY candidate needing zero new dependency of any
kind (no npm package, no Rust crate, no checked-in binary), the only
one with a genuinely simple, bounded Fail-Closed surface, and the only
one that does not require either a native build toolchain this project
does not have or an architectural change to the WASM crate this Stage
is explicitly not authorized to make.

## 2. Why not Rust — confirmed structurally, not just by preference

`packages/fedos-core-rust` compiles for the `wasm32-unknown-unknown`
target via `wasm-bindgen`. That target has NO filesystem, NO process,
and NO Win32 API access of any kind — DPAPI (`CryptProtectData`/
`CryptUnprotectData`) is a genuine Win32 API unreachable from inside a
WASM sandbox, full stop. Reaching it from Rust at all would require
either (a) changing the crate's own compilation target away from
`wasm32-unknown-unknown` (a large, separate, explicitly out-of-scope
architectural change), or (b) a SEPARATE native Rust binary/addon
outside the WASM crate (still a new Cargo dependency and a new build
artifact, rejected in §1 row ④ on maintainability and dependency
grounds). **`packages/fedos-core-rust/src/lib.rs` and `Cargo.toml` are
therefore both untouched by this Stage** — not merely left alone by
convention, but genuinely inapplicable to this Stage's own objective.

## 3. Backend design

`WindowsDpapiStorageBackend` (`fedos_runtime_storage_backend_windows_dpapi.ts`)
implements `RuntimeStorageBackend` exactly (`fedos_runtime_storage_backend.ts`,
unchanged):

```ts
export interface RuntimeStorageBackend {
  store(id: string, wire: AeadCiphertextWire): Promise<boolean>;
  load(id: string): Promise<AeadCiphertextWire | null>;
  delete(id: string): Promise<boolean>;
}
```

Entries are held in a plain in-process `Map<string, string>`, keyed by
the caller-supplied `id` — the SAME "no persistence across an actual
process restart" contract `MemoryStorageBackend` already has. The
difference is what the Map's VALUE holds: `store()` calls
`protectWithWindowsDpapi(wire)` (`fedos_windows_dpapi_helper.ts`)
BEFORE inserting anything, so the Map never holds the plaintext wire
string — only its DPAPI-protected (base64) form. `load()` reverses
that with `unprotectWithWindowsDpapi()`. `delete()` is a pure `Map`
operation, identical to `MemoryStorageBackend`'s own — no DPAPI call is
needed to remove an entry.

### 3.1 The DPAPI helper (`fedos_windows_dpapi_helper.ts`)

A pure, narrow bridge exposing exactly two functions,
`protectWithWindowsDpapi(plaintext)`/`unprotectWithWindowsDpapi(protectedBase64)`,
with NO knowledge of `RuntimeStorageBackend`, Storage, or
`AeadCiphertextWire` at all. Each spawns `powershell.exe -NoProfile
-NonInteractive -Command <fixed script>`, writes a base64-encoded
payload to the child's stdin, and reads a base64-encoded result back
from stdout:

- The PowerShell script text itself is a **fixed, hand-written
  constant** — no caller-supplied value is ever interpolated into it.
  All real data flows through stdin/stdout pipes only, eliminating any
  script-injection surface by construction.
- **Only base64/ASCII ever crosses the process boundary** — the real
  UTF-8 encode/decode of the actual plaintext happens only in Node
  (via `TextEncoder`/`TextDecoder` plus a small, self-contained base64
  codec — no `Buffer` reference, since this project's own tsconfig
  types only `["ES2022", "WebWorker"]`, no `@types/node`). This
  sidesteps Windows console codepage pitfalls entirely.
- DPAPI protection scope is `CurrentUser` — bound to the calling
  Windows user account, matching Alpha 022 §2's own DPAPI row
  assessment (`Security: High — OS-level encryption bound to the
  user/machine account`).

## 4. Fail Closed table

| Condition | `protectWithWindowsDpapi()`/`unprotectWithWindowsDpapi()` | `WindowsDpapiStorageBackend.store()` | `WindowsDpapiStorageBackend.load()` | `WindowsDpapiStorageBackend.delete()` |
|---|---|---|---|---|
| Not Windows (`process.platform !== "win32"`) | `null` | `false` | `null` (nothing was ever stored) | unaffected — pure `Map.delete()` |
| `powershell.exe` cannot be spawned | `null` | `false` | `null` | unaffected |
| The PowerShell script itself throws (a DPAPI failure, e.g. protected by a different user/machine) | `null` | `false` | `null` | unaffected |
| Process exits non-zero / times out | `null` | `false` | `null` | unaffected |
| Any other exception, at any point | `null` | `false` | `null` | unaffected |
| Production/Unknown Runtime | N/A — this class has no Runtime Mode gate of its own | N/A | N/A | N/A |

**No Development/Production gate lives in this Backend or its
helper.** Exactly like `MemoryStorageBackend`, `WindowsDpapiStorageBackend`
answers only "can DPAPI store/load/delete this," never "is storage
currently allowed" — that Fail-Closed decision remains entirely the
Runtime Storage Service's own responsibility
(`isDevelopmentRuntimeForCiphertextStorage()`,
`fedos_runtime_ciphertext_storage.ts`, byte-for-byte unchanged by this
Stage). Since the Resolver still always returns `MemoryStorageBackend`,
`storeCiphertext()`/`loadCiphertext()`/`deleteCiphertext()`'s own
Production/Unknown → `null` behavior is completely unaffected by this
Stage — `WindowsDpapiStorageBackend` is reachable only via direct
construction (tests today; a future Resolver change later).

## 5. Regression — confirmed unaffected

- `MemoryStorageBackend`'s own file (`fedos_runtime_storage_backend.ts`)
  is untouched — `WindowsDpapiStorageBackend` lives in its own, new
  file.
- `fedos_runtime_storage_resolver.ts` is untouched — still hardcoded to
  `MemoryStorageBackend` only.
- `fedos_runtime_ciphertext_storage.ts`, `types.ts`, `create_runtime.ts`
  are all untouched — `storeCiphertext()`/`loadCiphertext()`/
  `deleteCiphertext()` keep their exact Public API signatures.
- `initializeCrypto()`/`runtimeCapabilities()`/`randomBytes()`/
  `generateAeadKey()`/`encrypt()`/`decrypt()`/`exportCiphertext()`/
  `importCiphertext()` — all byte-for-byte unchanged; none of these
  functions is touched by this Stage.
- `packages/fedos-core-rust/src/lib.rs`/`Cargo.toml`/`package.json` —
  all byte-for-byte unchanged (see §2).

## 6. What this Stage does NOT do

- Does **not** wire `WindowsDpapiStorageBackend` into
  `resolveRuntimeStorageBackend()` — the Resolver remains hardcoded to
  `MemoryStorageBackend` only.
- Does **not** implement macOS Keychain, Linux Secret Service, or
  Browser Secure Storage.
- Does **not** add filesystem, registry, SQLite, or IndexedDB
  persistence — DPAPI-protected entries live in an in-process `Map`
  only, exactly like `MemoryStorageBackend`.
- Does **not** add Identity or Network capability of any kind.
- Does **not** add a new Crypto API or a new Storage API surface beyond
  the second `RuntimeStorageBackend` implementation itself.
- Does **not** add `exportKey()`/`importKey()` or any raw key
  import/export capability.
- Does **not** connect a Worker.
- Does **not** connect Production.
- Does **not** change `packages/fedos-core-rust/src/lib.rs` (see §2 for
  why this is structural, not just a preference).
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change any Public Runtime API signature.

## 7. See also

- `docs/secure_runtime_alpha_019_secure_storage_foundation.md` (Secure
  Runtime Alpha 019) — defined `MemoryStorageBackend`'s own
  in-process-`Map`, non-persistent-across-restart contract this Stage's
  `WindowsDpapiStorageBackend` follows exactly.
- `docs/secure_runtime_alpha_021_storage_backend_abstraction.md`
  (Secure Runtime Alpha 021) — defined `RuntimeStorageBackend` (the
  interface this Stage's class implements) and
  `resolveRuntimeStorageBackend()` (left untouched by this Stage).
- `docs/secure_runtime_alpha_022_storage_backend_selection_policy_review.md`
  (Secure Runtime Alpha 022) — recommended Windows DPAPI as the first
  real backend to implement; this Stage is that implementation.
