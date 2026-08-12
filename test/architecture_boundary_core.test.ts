import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";

/**
 * OS Capability Modularization — boundary guard for `src/os/core`.
 *
 * `src/os/core` holds general-purpose primitives (identity/crypto/storage/
 * vault/settings) that must stay self-contained from the messenger and
 * commerce domains. This test walks every `.ts` file under `src/os/core`
 * and fails if any relative import specifier resolves into a
 * messenger-owned or commerce-owned directory, at either their old
 * (pre-modularization) or new (`src/os/...`) locations.
 */

declare const process: { cwd(): string };

const REPO_ROOT = process.cwd();
const CORE_ROOT = join(REPO_ROOT, "src", "os", "core");

const FORBIDDEN_PREFIXES = [
  "src/conversation/",
  "src/board/",
  "src/desktop/",
  "src/device/",
  "src/os/messenger/",
  "src/commerce/",
  "src/payment/",
  "src/marketplace/",
  "src/creator/",
  "src/os/commerce/",
];

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

const IMPORT_RE = /from\s+(["'])(\.[^"']*)\1/g;

interface Violation {
  file: string;
  specifier: string;
  resolvedRepoRelative: string;
}

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  const files = listTsFilesRecursive(CORE_ROOT);

  for (const file of files) {
    const content: string = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(content)) !== null) {
      const specifier = match[2] ?? "";
      const resolvedAbs = resolve(dirname(file), specifier);
      const resolvedRepoRelative = posix.normalize(
        relative(REPO_ROOT, resolvedAbs).split("\\").join("/") + "/"
      );
      if (FORBIDDEN_PREFIXES.some((prefix) => resolvedRepoRelative.startsWith(prefix))) {
        violations.push({
          file: relative(REPO_ROOT, file).split("\\").join("/"),
          specifier,
          resolvedRepoRelative,
        });
      }
    }
  }
  return violations;
}

describe("src/os/core architecture boundary: no messenger/commerce imports", () => {
  it("walks every .ts file under src/os/core and finds at least one file (sanity)", () => {
    const files = listTsFilesRecursive(CORE_ROOT);
    expect(files.length).toBeGreaterThan(0);
  });

  it("no relative import from src/os/core resolves into a messenger or commerce directory", () => {
    const violations = findViolations();
    if (violations.length > 0) {
      const details = violations
        .map((v) => `  ${v.file} imports "${v.specifier}" -> ${v.resolvedRepoRelative}`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} cross-domain import(s) from src/os/core into messenger/commerce:\n${details}`
      );
    }
    expect(violations).toEqual([]);
  });
});
