#!/usr/bin/env node
/**
 * Secure Runtime Alpha 4741-4820 — Phase E: deterministic, SEQUENTIAL
 * production WASM artifact pipeline. Never runs Cargo and npm
 * concurrently — each step blocks on the previous one.
 *
 * Steps (in fixed order):
 *   1. cargo test              (native, proves the crate before shipping)   [--skip-tests to omit]
 *   2. cargo build --target wasm32-unknown-unknown --release
 *   3. wasm-bindgen --target web  -> packages/fedos-core-rust/pkg/
 *   4. generate the pinned artifact manifest (scripts/generate_wasm_artifact_manifest.mjs)
 *
 * The `wasm32-unknown-unknown` build REQUIRES the getrandom wasm_js
 * backend cfg (see Cargo.toml's getrandom note). This script sets it
 * per-invocation in the child environment — it does NOT bake a
 * .cargo/config.toml into the repo (the project's deliberate policy).
 *
 * All output lands in the gitignored `pkg/`/`target/` directories; no
 * generated binary or manifest is committed.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";

const CRATE_MANIFEST = join(process.cwd(), "packages", "fedos-core-rust", "Cargo.toml");
const WASM_OUT = join(process.cwd(), "packages", "fedos-core-rust", "pkg");
const WASM_BIN = join(
  process.cwd(),
  "packages",
  "fedos-core-rust",
  "target",
  "wasm32-unknown-unknown",
  "release",
  "fedos_core_rust.wasm",
);

const skipTests = process.argv.includes("--skip-tests");
const rustflags = '--cfg getrandom_backend="wasm_js"';

function run(cmd, args, extraEnv = {}) {
  console.log(`\n[pipeline] ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    shell: process.platform === "win32",
  });
  if (res.status !== 0) {
    console.error(`[pipeline] step failed: ${cmd} ${args.join(" ")} (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
}

// 1. Rust tests (native) — the getrandom wasm_js cfg is NOT applied here.
if (!skipTests) {
  run("cargo", ["test", "--manifest-path", CRATE_MANIFEST]);
}

// 2. wasm32 release build (getrandom wasm_js cfg required).
run(
  "cargo",
  ["build", "--manifest-path", CRATE_MANIFEST, "--target", "wasm32-unknown-unknown", "--release"],
  { RUSTFLAGS: rustflags },
);

// 3. wasm-bindgen generation.
run("wasm-bindgen", ["--target", "web", "--out-dir", WASM_OUT, WASM_BIN]);

// 4. pinned manifest generation.
run("node", [join(process.cwd(), "scripts", "generate_wasm_artifact_manifest.mjs")]);

console.log("\n[pipeline] production WASM artifact + manifest ready under packages/fedos-core-rust/pkg/");
