import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";

/**
 * OS Capability Modularization — boundary guard for `src/os/commerce`.
 *
 * `src/os/commerce` is inert scaffolding carried forward from a pre-pivot
 * prototype (see `src/os/commerce/README.md`). It must never depend on a
 * messenger implementation directly (old or new location) or on any of the
 * live product's own domains — only on Ports (`src/os/core/ports/`), which
 * this test does not need to know the shape of, only that commerce never
 * reaches around them.
 *
 * This test walks every `.ts` file under `src/os/commerce` and fails if:
 *   1. any relative import specifier resolves into `src/conversation`,
 *      `src/board`, `src/desktop`, `src/device`, `src/nostr`, or
 *      `src/os/messenger` (messenger, old or new location); or
 *   2. any import specifier (relative or bare) references a literal
 *      Telegram or BTCPay SDK package name, UNLESS the importing file
 *      lives under its own reserved adapter directory
 *      (`support/adapters/telegram/` for Telegram,
 *      `payment/adapters/btcpay/` for BTCPay) — those adapter directories
 *      are the ONLY place allowed to know about their own channel/rail SDK
 *      once a real adapter is built there.
 *
 * There are no Telegram/BTCPay SDK packages installed anywhere in this
 * repository today, so check (2) should trivially pass — it exists to
 * catch a FUTURE accidental leak of such a dependency into commerce domain
 * code.
 */

declare const process: { cwd(): string };

const REPO_ROOT = process.cwd();
const COMMERCE_ROOT = join(REPO_ROOT, "src", "os", "commerce");

const FORBIDDEN_PREFIXES = [
  "src/conversation/",
  "src/board/",
  "src/desktop/",
  "src/device/",
  "src/nostr/",
  "src/os/messenger/",
];

const TELEGRAM_ADAPTER_DIR = "src/os/commerce/support/adapters/telegram/";
const BTCPAY_ADAPTER_DIR = "src/os/commerce/payment/adapters/btcpay/";
// The only place under src/os/commerce allowed to import the Nostr protocol
// layer directly — catalog/bridge.ts's productFromEvent and classify.ts
// both take a raw NostrEvent, so they live here instead of in domain-layer
// catalog/ code. Factory/Port Completion pass: both real Nostr TYPE
// locations are allowed here — the OLD compatibility shim (`src/nostr/`,
// still resolvable by any not-yet-repointed importer) AND the NEW
// canonical post-Nostr-consolidation location
// (`src/os/messenger/adapters/nostr/protocol/`, Agent N's arc) — this
// file's own internal imports were repointed to the canonical location
// this same pass (see `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md`'s
// internal-old-path-import sweep), so the canonical prefix must be
// recognized too, not just the shim.
const NOSTR_ADAPTER_DIR = "src/os/commerce/catalog/adapters/nostr/";
const NOSTR_TARGET_PREFIXES = ["src/nostr/", "src/os/messenger/adapters/nostr/protocol/"];

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

// Matches both relative ("./x", "../x") and bare ("some-package") specifiers.
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
  matched: "telegram" | "btcpay";
}

type Violation = CrossDomainViolation | SdkLeakViolation;

function toRepoRelativePosix(absPath: string): string {
  return relative(REPO_ROOT, absPath).split("\\").join("/");
}

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  const files = listTsFilesRecursive(COMMERCE_ROOT);

  for (const file of files) {
    const fileRepoRelative = toRepoRelativePosix(file);
    const content: string = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(content)) !== null) {
      const specifier = match[2] ?? "";

      // Check 1: cross-domain reach (relative imports only — a bare
      // specifier can never resolve into a src/ directory).
      if (specifier.startsWith(".")) {
        const resolvedAbs = resolve(dirname(file), specifier);
        const resolvedRepoRelative =
          posix.normalize(toRepoRelativePosix(resolvedAbs).split("\\").join("/")) + "/";
        const isNostrAdapterFile = fileRepoRelative.startsWith(NOSTR_ADAPTER_DIR);
        const isNostrTarget = NOSTR_TARGET_PREFIXES.some((prefix) => resolvedRepoRelative.startsWith(prefix));
        if (
          FORBIDDEN_PREFIXES.some((prefix) => (resolvedRepoRelative + "/").startsWith(prefix)) &&
          !(isNostrAdapterFile && isNostrTarget)
        ) {
          violations.push({
            kind: "cross-domain",
            file: fileRepoRelative,
            specifier,
            resolvedRepoRelative,
          });
        }
      }

      // Check 2: literal Telegram/BTCPay SDK package name leak.
      const lower = specifier.toLowerCase();
      const isTelegramAdapterFile = fileRepoRelative.startsWith(TELEGRAM_ADAPTER_DIR);
      const isBtcpayAdapterFile = fileRepoRelative.startsWith(BTCPAY_ADAPTER_DIR);
      if (lower.includes("telegram") && !isTelegramAdapterFile) {
        violations.push({ kind: "sdk-leak", file: fileRepoRelative, specifier, matched: "telegram" });
      }
      if (lower.includes("btcpay") && !isBtcpayAdapterFile) {
        violations.push({ kind: "sdk-leak", file: fileRepoRelative, specifier, matched: "btcpay" });
      }
    }
  }
  return violations;
}

describe("src/os/commerce architecture boundary", () => {
  it("walks every .ts file under src/os/commerce and finds at least one file (sanity)", () => {
    const files = listTsFilesRecursive(COMMERCE_ROOT);
    expect(files.length).toBeGreaterThan(0);
  });

  it("no relative import from src/os/commerce resolves into conversation/board/desktop/device/nostr/messenger, and no Telegram/BTCPay SDK specifier leaks outside its own adapter directory", () => {
    const violations = findViolations();
    if (violations.length > 0) {
      const details = violations
        .map((v) =>
          v.kind === "cross-domain"
            ? `  [cross-domain] ${v.file} imports "${v.specifier}" -> ${v.resolvedRepoRelative}`
            : `  [sdk-leak:${v.matched}] ${v.file} imports "${v.specifier}" outside its reserved adapter directory`,
        )
        .join("\n");
      throw new Error(`Found ${violations.length} commerce boundary violation(s):\n${details}`);
    }
    expect(violations).toEqual([]);
  });
});
