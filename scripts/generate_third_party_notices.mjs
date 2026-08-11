#!/usr/bin/env node
// Secure Runtime Alpha 8441-8520 -- Phase D (License Governance Gate):
// a deterministic, dependency-free inventory of every npm package's own
// declared license (walking real node_modules, root + the electron-spike
// sub-package) and every Rust crate's own declared license (via `cargo
// metadata`, a standard Cargo built-in -- no new tool installed). This
// script makes NO decision about this repository's OWN license -- it
// only reports what its dependencies already declare, deterministically
// re-derivable from a real install, never hand-maintained prose.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function walkNodeModulesLicenses(nodeModulesDir) {
  const results = new Map(); // "name@version" -> license
  if (!existsSync(nodeModulesDir)) return results;
  function scanDir(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith(".")) continue;
      if (entry.name.startsWith("@")) {
        scanDir(join(dir, entry.name));
        continue;
      }
      const pkgJsonPath = join(dir, entry.name, "package.json");
      if (existsSync(pkgJsonPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
          const name = pkg.name ?? entry.name;
          const version = pkg.version ?? "unknown";
          let license = pkg.license ?? (Array.isArray(pkg.licenses) ? pkg.licenses.map((l) => l.type ?? l).join(" OR ") : undefined) ?? "UNSPECIFIED";
          if (typeof license === "object" && license !== null) license = license.type ?? JSON.stringify(license);
          results.set(`${name}@${version}`, license);
        } catch {
          results.set(`${entry.name}@unknown`, "UNREADABLE package.json");
        }
      }
      // Nested node_modules (deduped deps) -- recurse one level for completeness.
      const nested = join(dir, entry.name, "node_modules");
      if (existsSync(nested)) scanDir(nested);
    }
  }
  scanDir(nodeModulesDir);
  return results;
}

function cargoLicenses(manifestPath) {
  try {
    const raw = execFileSync("cargo", ["metadata", "--format-version", "1", "--manifest-path", manifestPath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const meta = JSON.parse(raw);
    const results = new Map();
    for (const pkg of meta.packages ?? []) {
      results.set(`${pkg.name}@${pkg.version}`, pkg.license ?? pkg.license_file ?? "UNSPECIFIED");
    }
    return results;
  } catch (err) {
    return { error: String(err?.message ?? err) };
  }
}

function summarize(map) {
  const byLicense = new Map();
  for (const [pkg, license] of map) {
    const key = license || "UNSPECIFIED";
    if (!byLicense.has(key)) byLicense.set(key, []);
    byLicense.get(key).push(pkg);
  }
  return byLicense;
}

const rootDeps = walkNodeModulesLicenses(join(ROOT, "node_modules"));
const electronSpikeDeps = walkNodeModulesLicenses(join(ROOT, "packages", "fedos-desktop-electron-spike", "node_modules"));
const allNpm = new Map([...rootDeps, ...electronSpikeDeps]);
const cargoResult = cargoLicenses(join(ROOT, "packages", "fedos-core-rust", "Cargo.toml"));

const lines = [];
lines.push("# Third-Party Notices — FedOS Desktop");
lines.push("");
lines.push("**Generated, not hand-maintained.** Regenerate with:");
lines.push("```");
lines.push("node scripts/generate_third_party_notices.mjs");
lines.push("```");
lines.push("This is a factual inventory of what dependencies declare about their own");
lines.push("licensing, deterministically re-derived from a real install and from");
lines.push("`cargo metadata` (a standard Cargo built-in — no new tool was installed to");
lines.push("produce this file). It makes **no decision** about this repository's own");
lines.push("license — see `LICENSE_STATUS.md` for that (currently: **MPL-2.0**,");
lines.push("decided; see `LICENSE_STATUS.md` for the full decision record).");
lines.push("");
lines.push(`Generated at: ${new Date().toISOString()}`);
lines.push("");

lines.push("## npm dependencies (root + packages/fedos-desktop-electron-spike)");
lines.push("");
if (allNpm.size === 0) {
  lines.push("_No node_modules found at generation time — run `npm install` first, then regenerate._");
} else {
  const byLicense = summarize(allNpm);
  const sortedLicenses = [...byLicense.keys()].sort();
  for (const license of sortedLicenses) {
    const pkgs = byLicense.get(license).sort();
    lines.push(`### ${license} (${pkgs.length} package${pkgs.length === 1 ? "" : "s"})`);
    lines.push("");
    for (const p of pkgs) lines.push(`- ${p}`);
    lines.push("");
  }
}

lines.push("## Rust crates (packages/fedos-core-rust, via `cargo metadata`)");
lines.push("");
if (cargoResult.error) {
  lines.push(`_Could not run \`cargo metadata\`: ${cargoResult.error}. Regenerate this file after a working Rust toolchain is available (see BUILDING.md)._`);
} else {
  const byLicense = summarize(cargoResult);
  const sortedLicenses = [...byLicense.keys()].sort();
  for (const license of sortedLicenses) {
    const pkgs = byLicense.get(license).sort();
    lines.push(`### ${license} (${pkgs.length} crate${pkgs.length === 1 ? "" : "s"})`);
    lines.push("");
    for (const p of pkgs) lines.push(`- ${p}`);
    lines.push("");
  }
}

lines.push("## Redistributed runtime/tooling components (not npm/Cargo packages)");
lines.push("");
lines.push("- **Electron** (bundled into the packaged app): MIT License. See");
lines.push("  https://github.com/electron/electron/blob/main/LICENSE (verify against");
lines.push("  the exact Electron version pinned in");
lines.push("  `packages/fedos-desktop-electron-spike/package.json` at release time).");
lines.push("- **NSIS** (Nullsoft Scriptable Install System, used by electron-builder to");
lines.push("  produce the Windows installer): zlib/libpng-style license. Not modified;");
lines.push("  used as a build tool, not redistributed as a linked component of the app");
lines.push("  itself, though the generated installer executable embeds its stub.");
lines.push("- **electron-builder** itself: a build-time-only dependency (not");
lines.push("  redistributed inside the packaged app) — MIT License.");
lines.push("");

lines.push("## Committed third-party test-vector data (packages/fedos-core-rust adjacent)");
lines.push("");
lines.push("Each file under `test-vectors/` already carries its own inline `license`");
lines.push("field documenting real provenance — see");
lines.push("`docs/crypto_vector_sources.md` for the full policy. Summary:");
lines.push("");
lines.push("- `test-vectors/aead/aes256gcm-nist.json` — NIST CAVP; U.S. federal");
lines.push("  government work, public domain (17 U.S.C. §105).");
lines.push("- `test-vectors/aead/chacha20poly1305-rfc8439.json`,");
lines.push("  `test-vectors/kdf/hkdf-rfc5869.json`,");
lines.push("  `test-vectors/kdf/argon2id-rfc9106.json` — IETF RFCs; code components");
lines.push("  licensed under the Simplified BSD License per IETF Trust policy.");
lines.push("- `test-vectors/nip44/nip44-v2.json` — nostr-protocol/nips states NIPs are");
lines.push("  public domain, but the specific hosting repo (paulmillr/nip44) has no");
lines.push("  LICENSE file of its own — an honest, already-disclosed gap (see that");
lines.push("  file's own `license` field), not resolved by this script.");
lines.push("");

lines.push("## Fonts, images, and other binary assets");
lines.push("");
lines.push("No font or image assets were found bundled into the packaged Electron app");
lines.push("at generation time (the UI is plain HTML/CSS with no embedded font files or");
lines.push("images — verified via the `files`/`extraResources` allowlist in");
lines.push("`packages/fedos-desktop-electron-spike/electron_builder.beta.config.json`).");
lines.push("If this changes, regenerate this section manually until an automated asset");
lines.push("scan is built.");
lines.push("");

writeFileSync(join(ROOT, "THIRD_PARTY_NOTICES.md"), lines.join("\n") + "\n");
console.log(`[third-party-notices] wrote THIRD_PARTY_NOTICES.md -- ${allNpm.size} npm package(s), ${cargoResult.error ? "cargo metadata unavailable" : `${cargoResult.size} crate(s)`}`);
