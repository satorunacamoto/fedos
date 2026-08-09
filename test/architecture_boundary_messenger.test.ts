import { describe, it, expect } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { readFileSync, readdirSync, statSync } from "node:fs";
// @ts-expect-error see above.
import { dirname, join, posix, relative, resolve } from "node:path";

/**
 * OS Capability Modularization — boundary guard for the Messenger domain.
 *
 * The physical file move from `src/conversation/`, `src/board/`,
 * `src/desktop/`, `src/device/`, `src/nostr/` into `src/os/messenger/**` is
 * DEFERRED to a follow-up arc (see
 * `docs/architecture/MESSENGER-MIGRATION-MAPPING.md` and
 * `-STAGING.md`) — every messenger file the repo actually ships still lives
 * at its CURRENT location today. This test therefore walks BOTH:
 *
 *   1. the current, live messenger locations (`src/conversation/`,
 *      `src/board/`, `src/desktop/`, `src/device/`, `src/nostr/`) — the
 *      code this repo actually ships; and
 *   2. `src/os/messenger/**` — the new Port-adapter files this arc adds
 *      (`adapters/messaging_port_adapter.ts`,
 *      `adapters/conversation_port_adapter.ts`,
 *      `adapters/notification_port_adapter.ts`) plus (today) nothing else,
 *      since the rest of that tree is empty scaffolding.
 *
 * and fails if any relative import specifier in either location resolves
 * into a commerce-owned directory, at either its old (`src/commerce`,
 * `src/payment`, `src/marketplace`, `src/creator`) or new
 * (`src/os/commerce`) location. Messenger must never import commerce —
 * commerce may only consume messenger through `src/os/core/ports/*`.
 */

declare const process: { cwd(): string };

const REPO_ROOT = process.cwd();

const MESSENGER_ROOTS = [
  join(REPO_ROOT, "src", "conversation"),
  join(REPO_ROOT, "src", "board"),
  join(REPO_ROOT, "src", "desktop"),
  join(REPO_ROOT, "src", "device"),
  join(REPO_ROOT, "src", "nostr"),
  join(REPO_ROOT, "src", "os", "messenger"),
];

const FORBIDDEN_PREFIXES = [
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

function toRepoRelativePosix(absPath: string): string {
  return relative(REPO_ROOT, absPath).split("\\").join("/");
}

function listAllMessengerTsFiles(): string[] {
  const out: string[] = [];
  for (const root of MESSENGER_ROOTS) {
    out.push(...listTsFilesRecursive(root));
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
  const files = listAllMessengerTsFiles();

  for (const file of files) {
    const fileRepoRelative = toRepoRelativePosix(file);
    const content: string = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(content)) !== null) {
      const specifier = match[2] ?? "";
      const resolvedAbs = resolve(dirname(file), specifier);
      const resolvedRepoRelative = posix.normalize(toRepoRelativePosix(resolvedAbs).split("\\").join("/") + "/");
      if (FORBIDDEN_PREFIXES.some((prefix) => resolvedRepoRelative.startsWith(prefix))) {
        violations.push({ file: fileRepoRelative, specifier, resolvedRepoRelative });
      }
    }
  }
  return violations;
}

describe("messenger architecture boundary: no commerce imports", () => {
  it("walks every current-location and new-location messenger .ts file and finds at least one (sanity)", () => {
    const files = listAllMessengerTsFiles();
    expect(files.length).toBeGreaterThan(0);
  });

  it("includes files from every current messenger location (sanity — catches an accidentally-empty root)", () => {
    for (const root of MESSENGER_ROOTS) {
      const files = listTsFilesRecursive(root);
      expect(files.length, `expected at least one .ts file under ${toRepoRelativePosix(root)}`).toBeGreaterThan(0);
    }
  });

  it("no relative import from messenger (current or new location) resolves into a commerce directory (old or new)", () => {
    const violations = findViolations();
    if (violations.length > 0) {
      const details = violations
        .map((v) => `  ${v.file} imports "${v.specifier}" -> ${v.resolvedRepoRelative}`)
        .join("\n");
      throw new Error(`Found ${violations.length} messenger -> commerce import violation(s):\n${details}`);
    }
    expect(violations).toEqual([]);
  });
});
