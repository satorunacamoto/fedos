# Secure Runtime Alpha 449 — Security Regression Guards

Phase B, Stage 9. Every guard run for REAL against this Arc's actual
diff (`git diff`), not asserted from memory.

| Guard | Command / method | Result |
|---|---|---|
| No raw seed getter | `grep "pub fn.*raw.*seed\|pub fn expose.*seed"` on `lib.rs`, excluding `for_internal` accessors | Zero matches |
| No raw secret-key getter | `grep "pub fn.*raw.*secret\|pub fn.*secret_key_bytes"` on `lib.rs` | Zero matches |
| No `nsec` export | `grep -i nsec` across `lib.rs` and `src/**/*.ts` | Every hit is either a doc comment naming `nprofile` (never `nsec`) or an EXISTING pre-Arc file's own "forbidden field name" denylist (`federation/outbound_queue.ts`, `notification/policy.ts`, `payment/noop_payment.ts`) — none of which this Arc touched |
| No generic `sign(hash)` | `grep "fn sign("` on `lib.rs` | Zero matches — the only signing entry points are `sign_nostr_event_internal` (existing, unchanged, takes a full unsigned event) and `FedosMasterSeedAuthority::sign_nostr_event` (this Arc, takes structured fields, computes its own digest internally) |
| No TypeScript signing primitive | `grep` for `k256`/`schnorr`/`secp256k1` imports in `src/nostr/sign/*.ts`, `src/runtime/master_seed/*.ts` | Zero matches — both files import only types and the WASM loader |
| No secret field in Outbox | `git diff --stat` for `src/board/outbox/*` | Zero files touched by this Arc |
| No secret field in Board | `git diff --stat` for `src/board/*` (excluding `src/board/outbox/`) | Zero files touched by this Arc |
| No Relay dependency in signing authority | `grep -i "relay"` in `src/nostr/sign/*.ts` | Zero matches |
| No `p2p` import | `grep "p2p"` across every file this Arc touched | Zero matches; `git status --short` confirms `p2p/` remains the only untracked entry, unstaged |
| Secret-bearing Rust types remain non-`Clone`/non-`Debug`/non-`Serialize` | Direct inspection: `enum FedosMasterSeedAuthorityState` and `pub struct FedosMasterSeedAuthority` carry zero derive attributes | Confirmed |
| WASM export-count change equals the reviewed surface | `git diff | grep -c "^+#\[wasm_bindgen\]"` | Exactly 2 — the new struct and its one impl block (covering all eight methods, wasm-bindgen's own per-block attribute convention) |
| Cargo dependency count unchanged | `git diff --stat -- packages/fedos-core-rust/Cargo.toml` | Empty diff |
| Package dependency count unchanged | `git diff --stat -- package.json` | Empty diff |
| `master_root` still carries no `#[wasm_bindgen]` anywhere in its own body | Brace-counted extraction of `mod master_root { ... }` (lines 3054–6166), then `grep -c wasm_bindgen` on exactly that span | Zero matches — Alpha 422's own regression guard remains unbroken |

## Scope note on the `nsec` grep

Every existing `"nsec"` string literal predates this Arc and lives in
files this Arc did not modify (`federation/outbound_queue.ts:97`,
`federation/publish_intent.ts:101`, `notification/policy.ts:26`,
`payment/noop_payment.ts:42` — all denylist entries in unrelated
modules; `identity/*.ts`/`desktop/*.ts` — doc-comment prohibitions).
This Arc's own new files contain no `nsec` string at all.

`test/secure_runtime_alpha_449_security_regression_guards.test.ts`
encodes every guard above as a real, executable `vitest` assertion —
scoped to code (source lines), never prose comments, per this Stage's
own instruction.
