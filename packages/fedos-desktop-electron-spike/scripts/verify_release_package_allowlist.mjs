#!/usr/bin/env node
// Secure Runtime Alpha 5241-5320 -- Phase E: package allowlist
// verification. A STATIC check of `electron_builder.beta.config.json`'s
// own `files` array (the actual mechanism electron-builder uses to
// decide what enters the packaged app, `01`) -- confirms every required
// compiled Beta file is explicitly allow-listed and that no forbidden
// path (source, tests, review docs, VCS/agent metadata, build caches)
// could be swept in. This is deliberately a config-level check, not a
// post-build asar-content check (the asar is a binary archive; parsing
// it would need a new dependency this Arc does not add) -- since
// electron-builder's own `files` allow-list is the SOLE mechanism
// deciding package membership, verifying the CONFIG is a direct,
// sufficient proxy for verifying the eventual package content.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_ROOT = process.cwd();
const CONFIG_PATH = join(PACKAGE_ROOT, "electron_builder.beta.config.json");

const REQUIRED_ALLOWED_ENTRIES = Object.freeze([
  "dist/fedos_electron_beta_main.cjs",
  "dist/fedos_electron_beta_preload.cjs",
  "dist/fedos_electron_beta_renderer.js",
  "dist/fedos_electron_beta_page.html",
  "package.json",
]);

const REQUIRED_DENY_GLOBS = Object.freeze(["!node_modules/**/*", "!src/**/*", "!test/**/*"]);

/** Forbidden path fragments -- if a `files`/`extraFiles`/`extraResources` entry's own `from`/glob string contains one of these WITHOUT a leading `!` (i.e., it would be INCLUDED, not excluded), that is a real packaging defect. */
const FORBIDDEN_IF_INCLUDED = Object.freeze([
  "docs/reviews",
  ".git",
  ".claude",
  "worktree",
  ".tmp_gen",
  "p2p/",
  "target/",
  "node_modules",
]);

export function verifyFedosBetaPackageAllowlist(configText) {
  const config = JSON.parse(configText);
  const problems = [];
  const files = Array.isArray(config.files) ? config.files : [];

  for (const required of REQUIRED_ALLOWED_ENTRIES) {
    if (!files.includes(required)) problems.push({ kind: "missing-required-entry", entry: required });
  }
  for (const requiredDeny of REQUIRED_DENY_GLOBS) {
    if (!files.includes(requiredDeny)) problems.push({ kind: "missing-required-deny-glob", entry: requiredDeny });
  }

  const allEntries = [
    ...files,
    ...((config.extraFiles ?? []).map((e) => (typeof e === "string" ? e : e.from ?? ""))),
    ...((config.extraResources ?? []).map((e) => (typeof e === "string" ? e : e.from ?? ""))),
  ];
  for (const entry of allEntries) {
    const isExclusion = typeof entry === "string" && entry.startsWith("!");
    if (isExclusion) continue;
    for (const forbidden of FORBIDDEN_IF_INCLUDED) {
      if (typeof entry === "string" && entry.includes(forbidden)) {
        problems.push({ kind: "forbidden-path-included", entry, forbidden });
      }
    }
  }

  // `files` must not be a bare directory glob (e.g. "**/*") -- an explicit allow-list only.
  if (files.some((f) => typeof f === "string" && /^\*\*\/\*$|^\.\/\*\*$/.test(f))) {
    problems.push({ kind: "non-explicit-allowlist", entry: "a bare '**/*'-style glob was found instead of an explicit file list" });
  }

  return Object.freeze({ ok: problems.length === 0, problems: Object.freeze(problems) });
}

function main() {
  const configText = readFileSync(CONFIG_PATH, "utf8");
  const result = verifyFedosBetaPackageAllowlist(configText);
  if (!result.ok) {
    console.error("[allowlist-verify] FAILED:");
    for (const p of result.problems) console.error(`  ${JSON.stringify(p)}`);
    process.exit(1);
  }
  console.log("[allowlist-verify] OK -- electron_builder.beta.config.json's own files/extraFiles/extraResources allow-list is explicit and contains no forbidden path.");
}

if (process.argv[1] && process.argv[1].endsWith("verify_release_package_allowlist.mjs")) {
  main();
}
