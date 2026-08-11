/**
 * Secure Runtime Alpha 023 — "Windows DPAPI Helper".
 *
 * Alpha 022 (`docs/secure_runtime_alpha_022_storage_backend_selection_policy_review.md`)
 * compared five ways to reach Windows DPAPI from this Runtime and
 * recommended shelling out to `powershell.exe` — the ONLY path that
 * needs NO new npm dependency and NO new Rust/Cargo dependency: Windows
 * PowerShell 5.1 ships on every Windows install and already exposes
 * `System.Security.Cryptography.ProtectedData` (the managed .NET
 * wrapper around the real Win32 `CryptProtectData`/`CryptUnprotectData`
 * calls) via `Add-Type -AssemblyName System.Security` — no compiled
 * native Node addon, no `node-gyp` build step, and no WASM/Rust
 * involvement (see "Why not Rust/WASM" below).
 *
 * This file is a PURE, narrow, platform-gated bridge — it does NOT know
 * about `RuntimeStorageBackend`, `AeadCiphertextWire`, or Storage at
 * all. It exposes exactly two operations, `protectWithWindowsDpapi()`/
 * `unprotectWithWindowsDpapi()`, each a thin Promise wrapper around one
 * `powershell.exe` invocation.
 *
 * **Why not Rust/WASM**: `packages/fedos-core-rust` compiles for the
 * `wasm32-unknown-unknown` target via `wasm-bindgen` — a sandboxed
 * environment with NO filesystem, NO process, and NO Win32 API access
 * of any kind; DPAPI is fundamentally unreachable from that target
 * without changing the crate's own compilation target entirely (a
 * large, separate, unauthorized architectural change). This Stage
 * therefore reaches DPAPI from the Node-side Runtime layer only —
 * `packages/fedos-core-rust/src/lib.rs`/`Cargo.toml` are untouched.
 *
 * **Only base64/ASCII ever crosses the `powershell.exe` process
 * boundary** — both the plaintext going in and the protected blob
 * coming back are base64-encoded before being written to the child
 * process's stdin, and the child's own stdout is read back as base64
 * too. This sidesteps Windows console codepage/encoding pitfalls
 * entirely. The base64 codec used here (`encodeBase64Bytes()`/
 * `decodeBase64ToBytes()`) is a small, self-contained, pure
 * implementation — no `Buffer`/`node:buffer` reference, avoiding any
 * dependency on Node-specific globals this project's own tsconfig does
 * not type (`lib: ["ES2022", "WebWorker"]`, no `@types/node`).
 * `TextEncoder`/`TextDecoder` (already used elsewhere in this project's
 * own test suite, e.g. `test/secure_runtime_alpha_019_secure_storage_foundation.test.ts`)
 * handle the actual UTF-8 encode/decode of the real plaintext — that
 * conversion happens only in this file, in Node, never inside the
 * PowerShell script itself.
 *
 * **The PowerShell script text itself is a fixed, hand-written
 * constant** — no caller-supplied value (plaintext, id, or anything
 * else) is ever interpolated into the script string. The ONLY data
 * that flows from a caller is written to the child process's stdin
 * pipe, never appended to the script or the command line — avoiding
 * any script-injection surface entirely, by construction.
 *
 * HARD GUARDRAILS:
 *   - `protectWithWindowsDpapi()`/`unprotectWithWindowsDpapi()` are the
 *     ONLY exports.
 *   - Fail Closed to `null`: not Windows (`process.platform !== "win32"`);
 *     `powershell.exe` cannot be spawned; the PowerShell script itself
 *     throws (a terminating error, e.g. a DPAPI failure); the process
 *     exits non-zero; the process times out; or any exception of any
 *     kind is thrown at any point. No exception ever escapes either
 *     exported function.
 *   - NO filesystem read/write of any kind — the child process
 *     receives its input via stdin and returns its output via stdout
 *     only; nothing is ever written to a file, the registry, or any
 *     other persistent location by this file.
 *   - NO network reference of any kind.
 *   - NO reference to `src/worker.ts`, and this file is not referenced
 *     BY `src/worker.ts` — Worker remains fully unconnected.
 *   - NO call to `randomBytes()`/`generateAeadKey()`/`encrypt()`/
 *     `decrypt()`/`exportCiphertext()`/`importCiphertext()`/
 *     `runtimeCapabilities()`/`determineFedosRuntimeMode()` — this file
 *     is a pure OS bridge, entirely independent of Runtime Mode and
 *     every Crypto API.
 */

import { execFile } from "node:child_process";

declare const process: { platform: string };

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** PRIVATE — self-contained base64 encoder; no `Buffer` reference. */
function encodeBase64Bytes(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    result += BASE64_ALPHABET[b0 >> 2];
    result += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    result += hasB1 ? BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : "=";
    result += hasB2 ? BASE64_ALPHABET[b2 & 0x3f] : "=";
  }
  return result;
}

/** PRIVATE — self-contained base64 decoder; no `Buffer` reference. */
function decodeBase64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;
  for (const char of clean) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bitsCollected += 6;
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      bytes.push((buffer >> bitsCollected) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** PRIVATE — fixed PowerShell 5.1 script text. No caller data is ever interpolated into this string. */
const PROTECT_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "$b64In = [Console]::In.ReadToEnd().Trim()",
  "$bytes = [Convert]::FromBase64String($b64In)",
  "Add-Type -AssemblyName System.Security",
  "$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
  "[Console]::Out.Write([Convert]::ToBase64String($protected))",
].join("\n");

/** PRIVATE — fixed PowerShell 5.1 script text. No caller data is ever interpolated into this string. */
const UNPROTECT_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "$b64In = [Console]::In.ReadToEnd().Trim()",
  "$bytes = [Convert]::FromBase64String($b64In)",
  "Add-Type -AssemblyName System.Security",
  "$plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
  "[Console]::Out.Write([Convert]::ToBase64String($plain))",
].join("\n");

/**
 * Injectable ONLY for testability (mirrors
 * `FedosWasmLoaderSkeletonOptions`'s own reason for existing). Every
 * REAL call site omits this and gets the real `process.platform`/real
 * `powershell.exe` invocation.
 */
export interface WindowsDpapiHelperOptions {
  readonly platform?: string;
  readonly runPowerShell?: (script: string, stdinBase64: string) => Promise<string | null>;
}

/**
 * PRIVATE — spawns `powershell.exe -NoProfile -NonInteractive -Command
 * <script>`, writes `stdinBase64` to its stdin, and resolves its
 * trimmed stdout on a clean (exit code 0) run. Resolves `null` on ANY
 * failure — spawn failure, non-zero exit, timeout, or a thrown error —
 * never throws.
 */
function runPowerShell(script: string, stdinBase64: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: string | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    try {
      const child = execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        { windowsHide: true, encoding: "utf8", timeout: 5000 },
        (error: unknown, stdout: string) => {
          if (error) {
            settle(null);
            return;
          }
          const trimmed = typeof stdout === "string" ? stdout.trim() : "";
          settle(trimmed.length > 0 ? trimmed : null);
        },
      );
      try {
        child.stdin?.write(stdinBase64, "utf8");
        child.stdin?.end();
      } catch {
        settle(null);
      }
    } catch {
      settle(null);
    }
  });
}

/**
 * PUBLIC, ASYNC — protects `plaintext` via DPAPI (`CurrentUser`-scoped)
 * and resolves the protected value as a base64 `string`, or `null` on
 * any failure (not Windows, `powershell.exe` unavailable, DPAPI call
 * failure, or any exception).
 */
export async function protectWithWindowsDpapi(
  plaintext: string,
  options: WindowsDpapiHelperOptions = {},
): Promise<string | null> {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    return null;
  }
  try {
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const inputBase64 = encodeBase64Bytes(plaintextBytes);
    const run = options.runPowerShell ?? runPowerShell;
    return await run(PROTECT_SCRIPT, inputBase64);
  } catch {
    return null;
  }
}

/**
 * PUBLIC, ASYNC — reverses `protectWithWindowsDpapi()`: unprotects a
 * base64 DPAPI-protected value and resolves the recovered plaintext
 * `string`, or `null` on any failure (not Windows, `powershell.exe`
 * unavailable, DPAPI call failure — including a value protected by a
 * different user/machine, or any exception).
 */
export async function unprotectWithWindowsDpapi(
  protectedBase64: string,
  options: WindowsDpapiHelperOptions = {},
): Promise<string | null> {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") {
    return null;
  }
  try {
    const run = options.runPowerShell ?? runPowerShell;
    const outputBase64 = await run(UNPROTECT_SCRIPT, protectedBase64);
    if (outputBase64 === null) {
      return null;
    }
    return new TextDecoder().decode(decodeBase64ToBytes(outputBase64));
  } catch {
    return null;
  }
}
