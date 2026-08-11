import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";

/**
 * OS Capability Modularization — Factory/Port Completion pass. Three
 * dependency-rule regression guards named by this arc's own instruction
 * that had no dedicated test before this pass:
 *
 *   1. domain -> Electron-concrete forbidden: no file under `src/` may
 *      import the bare `"electron"` package (or a subpath of it).
 *      Electron usage belongs entirely to
 *      `packages/fedos-desktop-electron-spike/`, outside `src/`.
 *   2. domain -> Nostr-SDK-concrete forbidden: no file under `src/` may
 *      import a known third-party Nostr SDK package. This repo hand-rolls
 *      its own Nostr primitives (`src/os/messenger/adapters/nostr/protocol/`)
 *      specifically so it never needs one — this test makes that a
 *      measured, enforced fact rather than an assumption, and doubles as
 *      a `package.json` dependency check so the claim can't quietly rot
 *      if a future change adds the package without ever importing it in
 *      `src/`.
 *   3. protocol -> desktop-concrete forbidden (regression guard): the
 *      logical backward dependency
 *      `docs/architecture/NOSTR-CONSOLIDATION-PLAN.md` documented
 *      (`adapters/nostr/protocol/sign/*.ts` importing
 *      `FedosNostrWireEvent` from `os/messenger/desktop/fedos_nostr_wire_event.ts`)
 *      was fixed by Agent N's type-unification pass — verified fresh this
 *      pass (both `sign/` files now import `NostrEvent` from their own
 *      sibling `../types.js`, not from `desktop/`). This test pins that
 *      fix so a future edit cannot silently reintroduce the backward edge:
 *      NOTHING under `protocol/` (current canonical location) or the old
 *      `src/nostr/` compatibility shim may resolve a relative import into
 *      `os/messenger/desktop/` (new location) or `src/desktop/` (old
 *      shim location).
 */

declare const process: { cwd(): string };

const REPO_ROOT = process.cwd();
const SRC_ROOT = join(REPO_ROOT, "src");
const PROTOCOL_ROOTS = [
  join(REPO_ROOT, "src", "os", "messenger", "adapters", "nostr", "protocol"),
  join(REPO_ROOT, "src", "nostr"),
];

function listTsFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      out.push(...listTsFilesRecursive(full));
    } else if (stats.isFile() && (entry.endsWith(".ts") || entry.endsWith(".tsx"))) {
      out.push(full);
    }
  }
  return out;
}

function toRepoRelativePosix(absPath: string): string {
  return relative(REPO_ROOT, absPath).split("\\").join("/");
}

// Matches both relative ("./x", "../x") and bare ("some-package") specifiers,
// across `import`/`export ... from`/dynamic `import(...)`/`require(...)`.
const IMPORT_RE = /(?:from|import|require)\s*\(?\s*(["'])((?:\.[^"']*)|(?:[^./"'][^"']*))\1/g;

interface BareSpecifierViolation {
  file: string;
  specifier: string;
}

function findBareSpecifierViolations(files: string[], isForbidden: (specifier: string) => boolean): BareSpecifierViolation[] {
  const violations: BareSpecifierViolation[] = [];
  for (const file of files) {
    const content: string = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(content)) !== null) {
      const specifier = match[2] ?? "";
      if (specifier.startsWith(".")) continue; // relative -- not a bare package specifier.
      if (isForbidden(specifier)) {
        violations.push({ file: toRepoRelativePosix(file), specifier });
      }
    }
  }
  return violations;
}

describe("domain -> Electron-concrete forbidden", () => {
  it("no file under src/ imports the bare \"electron\" package (or a subpath)", () => {
    const files = listTsFilesRecursive(SRC_ROOT);
    expect(files.length).toBeGreaterThan(1000);
    const violations = findBareSpecifierViolations(files, (specifier) => specifier === "electron" || specifier.startsWith("electron/"));
    if (violations.length > 0) {
      const details = violations.map((v) => `  ${v.file} imports "${v.specifier}"`).join("\n");
      throw new Error(`Found ${violations.length} src/ -> electron import(s):\n${details}`);
    }
    expect(violations).toEqual([]);
  });
});

describe("domain -> Nostr-SDK-concrete forbidden", () => {
  // Known third-party Nostr SDK package names/prefixes. None is installed
  // in this repo's package.json today -- this list exists so a future
  // accidental `npm install` + import of one is caught even before anyone
  // reads package.json.
  const KNOWN_NOSTR_SDK_PREFIXES: readonly string[] = [
    "nostr-tools",
    "@nostr-dev-kit/ndk",
    "@nostr-dev-kit/ndk-cache-dexie",
    "nostr-fetch",
    "nostr-relaypool",
    "@rust-nostr/nostr-sdk",
    "nostr-editor",
  ];

  function isKnownNostrSdkSpecifier(specifier: string): boolean {
    return KNOWN_NOSTR_SDK_PREFIXES.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`));
  }

  it("no file under src/ imports a known third-party Nostr SDK package (this repo hand-rolls its own primitives)", () => {
    const files = listTsFilesRecursive(SRC_ROOT);
    const violations = findBareSpecifierViolations(files, isKnownNostrSdkSpecifier);
    if (violations.length > 0) {
      const details = violations.map((v) => `  ${v.file} imports "${v.specifier}"`).join("\n");
      throw new Error(`Found ${violations.length} src/ -> third-party-Nostr-SDK import(s):\n${details}`);
    }
    expect(violations).toEqual([]);
  });

  it("package.json declares no known third-party Nostr SDK dependency (so the import-level check above cannot quietly go stale)", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declaredPackages = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ];
    const declaredSdkPackages = declaredPackages.filter((name) => isKnownNostrSdkSpecifier(name));
    expect(declaredSdkPackages).toEqual([]);
  });
});

describe("protocol -> desktop-concrete forbidden (regression guard)", () => {
  const FORBIDDEN_PREFIXES = ["src/os/messenger/desktop/", "src/desktop/"];

  function listAllProtocolTsFiles(): string[] {
    const out: string[] = [];
    for (const root of PROTOCOL_ROOTS) {
      out.push(...listTsFilesRecursive(root));
    }
    return out;
  }

  it("includes files from both protocol locations (sanity -- catches an accidentally-empty root)", () => {
    for (const root of PROTOCOL_ROOTS) {
      const files = listTsFilesRecursive(root);
      expect(files.length, `expected at least one .ts file under ${toRepoRelativePosix(root)}`).toBeGreaterThan(0);
    }
  });

  it("no relative import from the Nostr protocol layer (current or old-shim location) resolves into the desktop composition layer (current or old-shim location)", () => {
    const files = listAllProtocolTsFiles();
    const violations: { file: string; specifier: string; resolvedRepoRelative: string }[] = [];

    for (const file of files) {
      const fileRepoRelative = toRepoRelativePosix(file);
      const content: string = readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      IMPORT_RE.lastIndex = 0;
      while ((match = IMPORT_RE.exec(content)) !== null) {
        const specifier = match[2] ?? "";
        if (!specifier.startsWith(".")) continue;
        const resolvedAbs = resolve(dirname(file), specifier);
        const resolvedRepoRelative = posix.normalize(toRepoRelativePosix(resolvedAbs).split("\\").join("/") + "/");
        if (FORBIDDEN_PREFIXES.some((prefix) => resolvedRepoRelative.startsWith(prefix))) {
          violations.push({ file: fileRepoRelative, specifier, resolvedRepoRelative });
        }
      }
    }

    if (violations.length > 0) {
      const details = violations
        .map((v) => `  ${v.file} imports "${v.specifier}" -> ${v.resolvedRepoRelative}`)
        .join("\n");
      throw new Error(`Found ${violations.length} protocol -> desktop-concrete import violation(s):\n${details}`);
    }
    expect(violations).toEqual([]);
  });
});
