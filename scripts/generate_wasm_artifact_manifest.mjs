#!/usr/bin/env node
/**
 * Secure Runtime Alpha 4741-4820 — Phase E: pinned artifact manifest
 * generation, a deterministic build-pipeline step.
 *
 * Reads the freshly-generated `packages/fedos-core-rust/pkg/` artifacts
 * (produced by `npm run build:wasm`) and writes
 * `pkg/fedos_wasm_artifact_manifest.v1.json` — a small record of ONLY
 * safe, public facts (schema version, crate identity, filenames,
 * SHA-256 of the real `.wasm` bytes, reviewed capability profile /
 * allowed export set, compatibility version, build timestamp). It
 * contains NO secret and performs NO remote fetch. The manifest lives in
 * the gitignored `pkg/` output and is never committed — it is
 * regenerated on every clean build and VERIFIED before the artifact is
 * loaded (see `fedos_production_wasm_artifact_manifest.ts`).
 *
 * Run AFTER `build:wasm`, never concurrently with Cargo or npm builds.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const PKG_DIR = join(process.cwd(), "packages", "fedos-core-rust", "pkg");
const WASM_FILE = "fedos_core_rust_bg.wasm";
const JS_GLUE_FILE = "fedos_core_rust.js";
const MANIFEST_FILE = "fedos_wasm_artifact_manifest.v1.json";
const CRATE_TOML = join(process.cwd(), "packages", "fedos-core-rust", "Cargo.toml");

function crateIdentity() {
  const toml = readFileSync(CRATE_TOML, "utf8");
  const pkgSection = toml.slice(toml.indexOf("[package]"));
  const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(pkgSection)?.[1] ?? "fedos-core-rust";
  const version = /^\s*version\s*=\s*"([^"]+)"/m.exec(pkgSection)?.[1] ?? "0.0.0";
  return { name, version };
}

function main() {
  const wasmPath = join(PKG_DIR, WASM_FILE);
  const gluePath = join(PKG_DIR, JS_GLUE_FILE);
  if (!existsSync(wasmPath) || !existsSync(gluePath)) {
    console.error(`[manifest] missing pkg artifacts under ${PKG_DIR}; run 'npm run build:wasm' first.`);
    process.exit(1);
  }
  const wasmBytes = readFileSync(wasmPath);
  const wasmSha256Hex = createHash("sha256").update(wasmBytes).digest("hex");
  const { name, version } = crateIdentity();

  const manifest = {
    schemaVersion: 1,
    crateName: name,
    crateVersion: version,
    wasmFilename: WASM_FILE,
    jsGlueFilename: JS_GLUE_FILE,
    wasmSha256Hex,
    capabilityProfile: "desktop-master-seed-v1",
    allowedExports: ["FedosMasterSeedAuthority", "initSync"],
    compatibilityVersion: 1,
    generatedAt: new Date().toISOString(),
  };

  const outPath = join(PKG_DIR, MANIFEST_FILE);
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`[manifest] wrote ${outPath}`);
  console.log(`[manifest] wasm sha256 = ${wasmSha256Hex}`);
  console.log(`[manifest] wasm bytes  = ${wasmBytes.length}`);
}

main();
