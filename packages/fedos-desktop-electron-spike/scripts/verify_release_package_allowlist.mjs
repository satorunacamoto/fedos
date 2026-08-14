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

const REQUIRED_DENY_GLOBS = Object.freeze(["!src/**/*", "!test/**/*"]);

/**
 * Real Digital Delivery mega-arc (Coordinator, release-pipeline pass) --
 * `node_modules` REMOVED from this list and from `REQUIRED_DENY_GLOBS`
 * above (it used to require `"!node_modules/**\/*"` and forbid any bare
 * `"node_modules"` substring outright). That policy predates, and was
 * never updated after, three LATER, real, evidence-backed packaging
 * fixes that deliberately bundle `node_modules` (git history:
 * `06765ab3`/`5bfe57b3`/`60b4a8db`/`9b915f4c`, the last dated 2026-08-12 --
 * over three weeks after this checker's own last change, `ad12d30e`,
 * 2026-07-22) -- the packaged app genuinely cannot run without its own
 * runtime dependencies present; `docs/commerce/evidence/commerce_e2e_packaged_binary/packaged_binary_e2e_evidence.md`
 * documents a real NSIS silent-install + launch + clean exit against
 * this SAME node_modules-bundling config the same day as its last
 * change. Running this checker against that real, working config was
 * never actually done until this pass -- it failed immediately. Blanket-
 * forbidding "node_modules" was correct in spirit (never sweep in an
 * UNRELATED/unfiltered node_modules) but too blunt in practice (it
 * cannot distinguish the package's own local `node_modules/**\/*` --
 * always safe, always necessary -- from a raw, unfiltered copy of some
 * OTHER directory's node_modules -- the actually dangerous case). See
 * `verifyNoModulesEntry()` below for the precise replacement check.
 */
const FORBIDDEN_IF_INCLUDED = Object.freeze(["docs/reviews", ".git", ".claude", "worktree", ".tmp_gen", "p2p/", "target/"]);

/**
 * Precise node_modules policy (replaces the old blanket substring
 * forbid -- see `FORBIDDEN_IF_INCLUDED`'s own comment above for why). A
 * `node_modules`-referencing, non-exclusion entry is SAFE only if
 * either:
 *   (a) it is package-root-relative (never starts with `../`/`..\`) --
 *       the package's OWN local `node_modules`, always legitimate; or
 *   (b) it escapes the package root (an `extraFiles`/`extraResources`
 *       `from`, e.g. `../../node_modules`) AND carries a non-empty
 *       `filter` array -- proof it is deliberately scoped, never a raw
 *       unfiltered dump, matching this config's own current discipline
 *       (its `../../node_modules` entry excludes
 *       typescript/vitest/@cloudflare/@types/.bin).
 * Anything else referencing `node_modules` -- escapes the package root
 * with no `filter`, or an empty `filter` -- is flagged: the actually
 * dangerous shape the original blanket check was trying to catch.
 */
function nodeModulesProblem(pathValue, filter) {
  if (typeof pathValue !== "string" || pathValue.startsWith("!") || !pathValue.includes("node_modules")) return null;
  const escapesPackageRoot = pathValue.startsWith("../") || pathValue.startsWith("..\\");
  if (!escapesPackageRoot) return null; // (a) -- the package's own local node_modules, always safe.
  const hasNonEmptyFilter = Array.isArray(filter) && filter.length > 0;
  if (hasNonEmptyFilter) return null; // (b) -- deliberately scoped external copy.
  return { kind: "forbidden-node-modules-unfiltered-external-copy", entry: pathValue, hasFilter: hasNonEmptyFilter };
}

function forbiddenFragmentProblems(pathValue) {
  const problems = [];
  if (typeof pathValue !== "string" || pathValue.startsWith("!")) return problems;
  for (const forbidden of FORBIDDEN_IF_INCLUDED) {
    if (pathValue.includes(forbidden)) problems.push({ kind: "forbidden-path-included", entry: pathValue, forbidden });
  }
  return problems;
}

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

  // `files` entries are always relative to the package root, so the
  // ONLY thing to check for `node_modules` here is the generic
  // forbidden-fragment scan (nodeModulesProblem's escapes-root case
  // never applies to a `files` entry).
  for (const entry of files) {
    problems.push(...forbiddenFragmentProblems(entry));
  }

  const externalEntries = [
    ...((config.extraFiles ?? []).map((e) => (typeof e === "string" ? { from: e, filter: undefined } : e))),
    ...((config.extraResources ?? []).map((e) => (typeof e === "string" ? { from: e, filter: undefined } : e))),
  ];
  for (const e of externalEntries) {
    const from = typeof e.from === "string" ? e.from : "";
    const nmProblem = nodeModulesProblem(from, e.filter);
    if (nmProblem !== null) {
      problems.push(nmProblem);
      continue; // node_modules handled above -- do not also run it through the generic forbidden-fragment scan below.
    }
    problems.push(...forbiddenFragmentProblems(from));
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
