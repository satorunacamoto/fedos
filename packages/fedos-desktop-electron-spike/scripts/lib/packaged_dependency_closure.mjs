// Commerce Mainline Integration (Agent P) -- durable regression guard for
// the exact defect class documented in
// `docs/commerce/evidence/commerce_e2e_packaged_binary/packaged_binary_bootstrap_investigation_2026-08-12_agent_x_p1.md`
// section 0c: `electron_builder.beta.config.json`'s `npmRebuild: false` +
// verbatim `node_modules/**/*` bundling means the packaged app's real
// dependency completeness is only as good as whatever the shared,
// multi-worktree-mutated `node_modules` happens to contain at package
// time -- a silently INCOMPLETE packaged artifact can still exit 0.
//
// This module derives the REAL runtime npm-package dependency closure by
// statically walking the ACTUAL compiled-output require/import graph
// (never a hand-maintained list) -- starting from the two compiled entry
// trees (`dist/` at repo root, `dist/` inside this package), following
// every relative require/import within a file, and every bare (npm
// package) specifier by resolving it through Node's own node_modules
// lookup algorithm and recursing into that package's own entry file (or,
// for a subpath specifier like `@noble/hashes/sha2.js`, that exact file)
// -- so a package only enters the closure if the compiled code ACTUALLY
// requires it at module-load time, not merely because it is declared
// somewhere in a `package.json`'s `dependencies` field (which, per the
// investigation doc, is over-inclusive -- e.g. `qrcode` declares `yargs`
// as a dependency for its own unused CLI binary, `yargs` is never
// `require()`d by `qrcode`'s actual library entry point and must NOT be
// treated as required).
//
// Deliberately dependency-free (no new npm package added) -- uses only
// Node builtins, matching the discipline every other script under this
// package's `scripts/` directory already follows.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";

const BUILTIN_MODULE_NAMES = new Set(builtinModules);

/** Extracts every `require("x")`/`require('x')`, `import ... from "x"`, bare `import "x"`, and literal `import("x")` specifier from a source file's text. Deliberately regex-based (not a full parser) -- sufficient for compiled, non-obfuscated CommonJS/ESM output, and errs toward over-matching (a spurious specifier just fails to resolve and is skipped, see `resolveBareSpecifier` below) rather than under-matching. */
function extractSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s+[^;'"]*?\bfrom\s+["']([^"']+)["']/g,
    /^\s*import\s+["']([^"']+)["']/gm,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

/** Splits a bare specifier into its npm package name and any subpath, e.g. `"@noble/hashes/sha2.js"` -> `{ packageName: "@noble/hashes", subpath: "sha2.js" }`, `"qrcode"` -> `{ packageName: "qrcode", subpath: "" }`. */
function splitBareSpecifier(specifier) {
  const segments = specifier.split("/");
  if (specifier.startsWith("@")) {
    const packageName = segments.slice(0, 2).join("/");
    const subpath = segments.slice(2).join("/");
    return { packageName, subpath };
  }
  return { packageName: segments[0], subpath: segments.slice(1).join("/") };
}

/** Node's own node_modules resolution algorithm, simplified to directory lookups only (no `exports`-map / conditional-exports handling -- every package this closure has ever needed is a plain `main`-field CommonJS or ESM package; if a future dependency needs a real `exports` map, `resolvePackageEntryFile` below is the single place to extend). Walks upward from `fromDir` through every ancestor `node_modules`. */
function resolvePackageDir(packageName, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, "node_modules", packageName);
    if (existsSync(path.join(candidate, "package.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const CANDIDATE_EXTENSIONS = ["", ".js", ".cjs", ".mjs"];

function resolveFileWithExtensions(basePath) {
  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = basePath + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = path.join(basePath, "index" + (ext === "" ? ".js" : ext));
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Resolves a package's own entry file for a given (possibly empty) subpath -- an explicit subpath (e.g. `sha2.js` from `@noble/hashes/sha2.js`) resolves directly under the package directory; an empty subpath resolves via the package's own `package.json` `main` field (defaulting to `index.js`, matching plain CommonJS package convention). */
function resolvePackageEntryFile(packageDir, subpath) {
  if (subpath.length > 0) {
    return resolveFileWithExtensions(path.join(packageDir, subpath));
  }
  const pkgJsonPath = path.join(packageDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  const mainField = typeof pkg.main === "string" && pkg.main.length > 0 ? pkg.main : "index.js";
  return resolveFileWithExtensions(path.join(packageDir, mainField));
}

/**
 * Walks the real require/import graph starting from `entryFiles`, returning
 * the full set of npm packages the compiled code actually loads.
 *
 * @param {readonly string[]} entryFiles absolute paths to compiled entry files to seed the walk from.
 * @param {readonly string[]} [hostProvidedPackages] package names to treat as resolved-but-not-bundled (e.g. `"electron"` -- provided by the Electron runtime itself, never present in `node_modules` of a packaged app).
 * @returns {{ readonly packages: ReadonlyMap<string, string>; readonly unresolved: readonly { readonly specifier: string; readonly fromFile: string }[]; readonly localFiles: ReadonlySet<string> }}
 *   `packages`: packageName -> absolute directory it resolved to on THIS machine (used only to keep walking the graph; the artifact-presence check re-resolves independently against the packaged artifact, never trusts this path). `unresolved`: any bare specifier that could not be resolved from local `node_modules` at all -- a real, actionable finding (either a genuinely missing local install, or a specifier this walker's simplified resolution algorithm cannot handle) that a caller should surface, not silently drop. `localFiles`: every relative (`./`/`../`)-resolved sibling/local file this walk actually visited, as absolute paths on THIS machine -- these are compiled output that lives alongside the entry files themselves (never inside `node_modules`), so their packaging completeness depends on the electron-builder `"files"` allowlist, not the `node_modules` bundling this module otherwise exists to check (see `checkLocalFileClosurePresentInAsarListing` below -- this is precisely the closure a same-directory `Cannot find module './x.js'` packaged-startup failure comes from).
 */
export function walkRuntimeDependencyGraph(entryFiles, hostProvidedPackages = []) {
  const hostProvided = new Set(hostProvidedPackages);
  const visitedFiles = new Set();
  const packages = new Map();
  const unresolved = [];
  const localFiles = new Set();

  function visit(file) {
    if (visitedFiles.has(file)) return;
    visitedFiles.add(file);
    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      return;
    }
    for (const specifier of extractSpecifiers(source)) {
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const resolved = resolveFileWithExtensions(path.resolve(path.dirname(file), specifier));
        if (resolved !== null) {
          localFiles.add(resolved);
          visit(resolved);
        }
        continue;
      }
      const normalized = specifier.startsWith("node:") ? specifier.slice("node:".length) : specifier;
      if (BUILTIN_MODULE_NAMES.has(normalized)) continue;
      const { packageName, subpath } = splitBareSpecifier(specifier);
      if (hostProvided.has(packageName)) continue;
      if (packages.has(packageName)) continue; // already resolved+queued this package's own entry walk
      const packageDir = resolvePackageDir(packageName, path.dirname(file));
      if (packageDir === null) {
        unresolved.push({ specifier, fromFile: file });
        continue;
      }
      packages.set(packageName, packageDir);
      const entryFile = resolvePackageEntryFile(packageDir, subpath);
      if (entryFile !== null) visit(entryFile);
    }
  }

  for (const entryFile of entryFiles) visit(entryFile);
  return { packages, unresolved, localFiles };
}

/** Recursively lists every file under `dir` with one of the given extensions -- used to enumerate a compiled `dist/` tree as walk seed files. */
export function listCompiledFiles(dir, extensions = [".js", ".cjs", ".mjs"]) {
  const out = [];
  if (!existsSync(dir)) return out;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listCompiledFiles(full, extensions));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

/**
 * Derives the full, real runtime npm-package dependency closure for the
 * FedOS Desktop Beta packaged app: the union of every package the
 * root-compiled `dist/` (built by `tsc -p tsconfig.beta-runtime.json`) and
 * this package's own compiled `dist/` (built by this package's own
 * `build` script) actually `require()`/`import` at module-load time,
 * walked transitively through each resolved package's own files.
 *
 * @param {{ readonly repoRootDist: string; readonly packageDist: string }} dirs
 * @returns {{ readonly names: readonly string[]; readonly unresolved: readonly { readonly specifier: string; readonly fromFile: string }[] }}
 */
export function deriveRuntimeDependencyClosure(dirs) {
  const entryFiles = [...listCompiledFiles(dirs.repoRootDist), ...listCompiledFiles(dirs.packageDist)];
  const { packages, unresolved } = walkRuntimeDependencyGraph(entryFiles, ["electron"]);
  return { names: [...packages.keys()].sort(), unresolved };
}

/**
 * Installed-startup root-cause pass (Real Digital Delivery Release
 * Closure) -- derives the closure of THIS package's own local, relative
 * (`./`/`../`) `dist/` files that the REAL PACKAGED entry point(s)
 * actually `require()`/`import` at module-load time, transitively. This
 * is a DIFFERENT closure than `deriveRuntimeDependencyClosure` above:
 * that one finds `node_modules` packages (bundled verbatim, so
 * completeness only depends on the shared install being complete); this
 * one finds sibling `.js` files this package's OWN build produces, whose
 * packaging completeness depends entirely on the hand-maintained `files`
 * allowlist in `electron_builder.beta.config.json` -- exactly the class
 * of gap that produced a real, reproduced `Cannot find module
 * './fedos_electron_ipc_command_registry.js'` packaged-startup crash
 * (three local files imported by `fedos_electron_beta_main.cts` were
 * simply never added to that allowlist as the file grew new IPC
 * handlers over time).
 *
 * Deliberately seeded ONLY from `entryFiles` (the real packaged main.cjs,
 * caller-supplied), never from `listCompiledFiles(packageDist)` walking
 * every compiled file in the package's `dist/` as its own entry point --
 * this package's `dist/` also holds several OTHER accepted electron
 * main-process entry points (`fedos_electron_unlock_main.cjs`,
 * `fedos_electron_badge_main.cjs`, `fedos_electron_settings_*_main.cjs`,
 * etc. -- see `fedos_electron_beta_main.cts`'s own doc comment: "all
 * seven remain untouched, preserved as accepted test/harness entry
 * points"), each with its own local sibling files (e.g. the
 * `*_selftest.js`/`*_host_bridge_loader.js` files those OTHER mains
 * import) that are correctly NOT part of the Beta app's own packaged
 * `files` allowlist -- walking every compiled file as an entry point
 * would wrongly demand THOSE unrelated files be packaged too, a false
 * positive this scoping avoids. Only `packageDist`-local relative
 * resolutions are returned (never `repoRootDist`): the root-compiled
 * `dist/` tree is bundled whole via `extraFiles` (a real on-disk
 * directory copy, not a hand-maintained per-file allowlist), so it
 * cannot suffer this same defect class.
 *
 * @param {{ readonly entryFiles: readonly string[]; readonly packageDist: string }} args
 * @returns {{ readonly relativePaths: readonly string[] }} POSIX-style paths relative to `packageDist` (e.g. `"fedos_electron_ipc_command_registry.js"`), sorted.
 */
export function derivePackageLocalFileClosure(args) {
  const { localFiles } = walkRuntimeDependencyGraph(args.entryFiles, ["electron"]);
  const packageDistResolved = path.resolve(args.packageDist);
  const relativePaths = [...localFiles]
    .filter((file) => path.resolve(file).startsWith(packageDistResolved + path.sep))
    .map((file) => path.relative(packageDistResolved, file).split(path.sep).join("/"));
  return { relativePaths: relativePaths.sort() };
}

/**
 * Checks that every relative path in `relativePaths` (as returned by
 * `derivePackageLocalFileClosure`, e.g. `"fedos_electron_ipc_command_registry.js"`)
 * is present as `dist/<relativePath>` in an already-listed `@electron/asar`
 * package entry list (backslash- or forward-slash-separated paths, as
 * `@electron/asar`'s own `listPackage()` returns on Windows).
 */
export function checkLocalFileClosurePresentInAsarListing(asarEntries, relativePaths) {
  const normalized = new Set(asarEntries.map((entry) => entry.replace(/\\/g, "/")));
  const missing = relativePaths.filter((relativePath) => !normalized.has(`/dist/${relativePath}`));
  return { ok: missing.length === 0, missing };
}

/**
 * Checks that every package name in `closureNames` is present (has its own
 * `package.json` under `node_modules/<name>/`) in an already-listed
 * `@electron/asar` package entry list (backslash- or forward-slash-
 * separated paths, as `@electron/asar`'s own `listPackage()` returns on
 * Windows).
 */
export function checkClosurePresentInAsarListing(asarEntries, closureNames) {
  const normalized = new Set(asarEntries.map((entry) => entry.replace(/\\/g, "/")));
  const missing = closureNames.filter((name) => !normalized.has(`/node_modules/${name}/package.json`));
  return { ok: missing.length === 0, missing };
}

/** Checks that every package name in `closureNames` has its own `package.json` present on disk directly under `<dir>/<name>/` (used for the `extraFiles`-copied `dist/node_modules` tree, which is a real directory, never an asar). */
export function checkClosurePresentOnDisk(dir, closureNames) {
  const missing = closureNames.filter((name) => !existsSync(path.join(dir, name, "package.json")));
  return { ok: missing.length === 0, missing };
}
