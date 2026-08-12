import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";

/**
 * FedOS Trust / Offline Monetization + OSS Release Closure arc — boundary
 * guard for `src/os/trust`, mirroring `test/architecture_boundary_commerce.test.ts`'s
 * structure (`docs/architecture/ADDING-A-CAPABILITY.md`'s required boundary
 * test).
 *
 * `src/os/trust` must never depend on `os/messenger` (old or new location),
 * `os/commerce`, any Electron package, or any Nostr SDK — arc brief's own
 * dependency-direction target (core -> trust -> messenger/commerce) and its
 * explicit "Trust MUST NOT depend on: Messenger concrete implementation,
 * Commerce concrete implementation, Electron, Nostr concrete implementation"
 * instruction. It MAY depend on `@noble/curves`/`@noble/hashes` (root crypto
 * dependency, already used elsewhere in this repo) and, for QR image
 * rendering only, the `qrcode` package added this same arc.
 */

declare const process: { cwd(): string };

const REPO_ROOT = process.cwd();
const TRUST_ROOT = join(REPO_ROOT, "src", "os", "trust");

const FORBIDDEN_RELATIVE_PREFIXES = [
  "src/conversation/",
  "src/board/",
  "src/desktop/",
  "src/device/",
  "src/nostr/",
  "src/os/messenger/",
  "src/os/commerce/",
];

// Bare (non-relative) specifiers this capability must never import.
const FORBIDDEN_BARE_SUBSTRINGS = ["electron", "nostr-tools", "nostr-sdk"];

// The only bare/relative-external dependencies `os/trust` is allowed to use.
const ALLOWED_BARE_PREFIXES = ["@noble/curves", "@noble/hashes", "qrcode"];

function listTsFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      out.push(...listTsFilesRecursive(full));
    } else if (stats.isFile() && entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const IMPORT_RE = /(?:from|import)\s*\(?\s*(["'])((?:\.[^"']*)|(?:[^./"'][^"']*))\1/g;

interface CrossDomainViolation {
  kind: "cross-domain";
  file: string;
  specifier: string;
  resolvedRepoRelative: string;
}
interface SdkLeakViolation {
  kind: "sdk-leak";
  file: string;
  specifier: string;
}
interface UnexpectedBareDependencyViolation {
  kind: "unexpected-bare-dependency";
  file: string;
  specifier: string;
}
type Violation = CrossDomainViolation | SdkLeakViolation | UnexpectedBareDependencyViolation;

function toRepoRelativePosix(absPath: string): string {
  return relative(REPO_ROOT, absPath).split("\\").join("/");
}

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  const files = listTsFilesRecursive(TRUST_ROOT);

  for (const file of files) {
    const fileRepoRelative = toRepoRelativePosix(file);
    const content: string = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(content)) !== null) {
      const specifier = match[2] ?? "";

      if (specifier.startsWith(".")) {
        const resolvedAbs = resolve(dirname(file), specifier);
        const resolvedRepoRelative =
          posix.normalize(toRepoRelativePosix(resolvedAbs).split("\\").join("/")) + "/";
        if (FORBIDDEN_RELATIVE_PREFIXES.some((prefix) => (resolvedRepoRelative + "/").startsWith(prefix))) {
          violations.push({ kind: "cross-domain", file: fileRepoRelative, specifier, resolvedRepoRelative });
        }
        continue;
      }

      // Bare specifier.
      const lower = specifier.toLowerCase();
      if (FORBIDDEN_BARE_SUBSTRINGS.some((needle) => lower.includes(needle))) {
        violations.push({ kind: "sdk-leak", file: fileRepoRelative, specifier });
        continue;
      }
      if (!ALLOWED_BARE_PREFIXES.some((prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`))) {
        // Node built-ins (fs, path, etc.) and "node:*" specifiers are not
        // expected anywhere under src/os/trust today; flag anything
        // unrecognized so a future accidental dependency is caught here
        // instead of discovered downstream.
        if (!specifier.startsWith("node:")) {
          violations.push({ kind: "unexpected-bare-dependency", file: fileRepoRelative, specifier });
        }
      }
    }
  }
  return violations;
}

describe("src/os/trust architecture boundary", () => {
  it("walks every .ts file under src/os/trust and finds at least one file (sanity)", () => {
    const files = listTsFilesRecursive(TRUST_ROOT);
    expect(files.length).toBeGreaterThan(0);
  });

  it("no relative import from src/os/trust resolves into conversation/board/desktop/device/nostr/messenger/commerce, no electron/nostr SDK specifier, and no unexpected bare dependency", () => {
    const violations = findViolations();
    if (violations.length > 0) {
      const details = violations
        .map((v) => {
          if (v.kind === "cross-domain") return `  [cross-domain] ${v.file} imports "${v.specifier}" -> ${v.resolvedRepoRelative}`;
          if (v.kind === "sdk-leak") return `  [sdk-leak] ${v.file} imports "${v.specifier}"`;
          return `  [unexpected-bare-dependency] ${v.file} imports "${v.specifier}"`;
        })
        .join("\n");
      throw new Error(`Found ${violations.length} trust boundary violation(s):\n${details}`);
    }
    expect(violations).toEqual([]);
  });
});
