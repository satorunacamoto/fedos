/**
 * FedOS Commerce FINAL P1 Closure arc (Agent T) — real-filesystem corruption
 * / fail-closed coverage for the sealed-at-rest signing-key stores Agent K1
 * (`durable_persona_epoch_signing_key_store.ts`) and Agent K2
 * (`durable_receipt_issuer_signing_key_store.ts`) added, complementing
 * (never duplicating) their own MODULE-LEVEL unit tests
 * (`test/commerce_persona_epoch_signing_key_durability.test.ts`,
 * `test/commerce_receipt_issuer_signing_key_durability.test.ts`), which use
 * a synthetic `FakeFedosDirectRatchetSealingAuthority` over freshly-written
 * synthetic NDJSON files.
 *
 * THIS file's own, non-duplicative contribution: every corruption case here
 * runs against the ACTUAL `<dataDir>/commerce/*.ndjson` files a REAL
 * Electron launch produced (real Argon2 profile unlock, real WASM-backed
 * AEAD sealing via the real, unlocked Master Seed Authority) — not a
 * synthetic file built by a test double. One real "seed" launch (below)
 * creates one real profile, completes one real trade end-to-end (so both
 * `persona_epoch_signing_keys.ndjson` — one record per real pubkey — and
 * `receipt_issuer_signing_keys.ndjson` — the one demo issuer — exist with
 * genuine sealed content), then every scenario below works from a COPY of
 * that real profile directory.
 *
 * Two kinds of scenario:
 *   - Purely STRUCTURAL corruption (truncated line, unknown schemaVersion,
 *     conflicting duplicate, missing file) needs no sealing authority at
 *     all — `DurableSealedSigningKeyStore`'s own constructor replay logic
 *     (`src/os/core/vault/wasm/fedos_sealed_signing_key_store.ts`) is pure,
 *     synchronous, and runs identically whether the file came from a real
 *     Electron launch or not. These run directly against the REAL file (or
 *     a corrupted copy of it) in this Node process, no Electron needed —
 *     still the exact same production class the real app instantiates.
 *   - Ciphertext-level AEAD tamper needs a REAL `SealingAuthorityPort` to
 *     prove `restoreDirectRatchetSecret` itself (not just structural
 *     validation) rejects it — that only exists inside a real, unlocked
 *     Electron main process. Those two scenarios (receipt-issuer,
 *     persona-epoch) relaunch a real Electron process against a COPY of the
 *     seed profile with one real sealed record's `sealedBlob` ciphertext
 *     tampered, and observe the REAL, visible, structured fail-closed
 *     outcome through the same DOM-only UI-script harness every other file
 *     in this directory uses — never a mock, never a parallel weaker
 *     harness.
 *
 * SECRET SAFETY: no assertion or failure message in this file ever prints,
 * logs, or compares a raw secret-key byte. Only `publicKeyHex`/`keyId`
 * strings (already public by design — see `fedos_sealed_signing_key_store.ts`'s
 * own "AT-REST FORMAT" header section: "never a raw secret byte... never
 * derived key material" is written to disk in the first place), opaque
 * `sealedBlob` strings, boolean/string outcome tags, and UI-rendered
 * developer-authored `reason` strings (themselves already documented at
 * their source as safe/non-secret, see `fedos_electron_beta_renderer.ts`'s
 * own `showCommerceError` doc comment) are ever read, logged, or asserted.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// `import type` only -- erased at compile time, so it never produces a
// runtime `require`/`import` and is unaffected by the CommonJS/ESM
// module-format mismatch below. The actual VALUE (the class constructor)
// is loaded via a dynamic `import()` in `beforeAll` instead (see
// `DurableSealedSigningKeyStoreCtor` below): this package's own
// `package.json` has no `"type": "module"` field, so this `.ts` test file
// is classified CommonJS under `tsconfig.test.json`'s Node16 module
// resolution, and a static VALUE `import` of the repo-root ESM module
// (`"type": "module"` there) is a real TS1479 compile error -- `import()`
// is the TypeScript-recommended, always-valid way to cross that boundary.
import type { DurableSealedSigningKeyStore } from "../../../src/os/core/vault/wasm/fedos_sealed_signing_key_store.js" with { "resolution-mode": "import" };

const repoRoot = process.cwd();
const packageDir = `${repoRoot}/packages/fedos-desktop-electron-spike`;
const mainCjsPath = `${packageDir}/dist/fedos_electron_beta_main.cjs`;
const electronBinPath = `${packageDir}/node_modules/electron/dist/electron.exe`;
const pkgWasmPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`;
const pkgManifestPath = `${repoRoot}/packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json`;
const commerceDistPath = `${repoRoot}/dist/os/commerce/index.js`;
const trustDistPath = `${repoRoot}/dist/os/trust/index.js`;

const CAN_RUN_REAL =
  existsSync(pkgWasmPath) &&
  existsSync(pkgManifestPath) &&
  existsSync(electronBinPath) &&
  existsSync(mainCjsPath) &&
  existsSync(commerceDistPath) &&
  existsSync(trustDistPath);

const tmpRoots: string[] = [];
function makeTmpRoot(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `fedos-commerce-corruption-e2e-${label}-`));
  tmpRoots.push(dir);
  return dir;
}
afterAll(() => {
  while (tmpRoots.length) {
    try {
      rmSync(tmpRoots.pop()!, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

type UiStep =
  | { readonly action: "fill"; readonly selector: string; readonly value: string }
  | { readonly action: "click"; readonly selector: string }
  | { readonly action: "read"; readonly selector: string; readonly as?: "text" | "value" }
  | { readonly action: "wait"; readonly ms: number };

interface UiStepResult {
  readonly index: number;
  readonly action: string;
  readonly selector: string;
  readonly result: { readonly outcome: string; readonly value?: string };
}
interface UiRun {
  readonly output: string;
  readonly steps: readonly UiStepResult[];
}

/** Same dev-launch mechanism as every other real-Electron test in this directory. */
async function runBetaUiScript(dataDir: string, script: readonly UiStep[]): Promise<UiRun> {
  const outChunks: Buffer[] = [];
  const child = spawn(electronBinPath, [mainCjsPath], {
    cwd: packageDir,
    env: {
      ...process.env,
      FEDOS_ELECTRON_BETA_DATA_DIR: dataDir,
      FEDOS_ELECTRON_BETA_AUTOTEST: "ui-script",
      FEDOS_BETA_UI_SCRIPT: JSON.stringify(script),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (c: Buffer) => outChunks.push(c));
  child.stderr?.on("data", (c: Buffer) => outChunks.push(c));
  const timer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }, 90000);
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  clearTimeout(timer);
  const output = Buffer.concat(outChunks).toString("utf8");
  const steps: UiStepResult[] = [];
  const marker = "FEDOS_ELECTRON_BETA_UI_STEP_JSON:";
  for (const line of output.split("\n")) {
    if (!line.startsWith(marker)) continue;
    steps.push(JSON.parse(line.slice(marker.length)) as UiStepResult);
  }
  return { output, steps };
}

function readAt(run: UiRun, index: number): string {
  const step = run.steps.find((s) => s.index === index);
  expect(step, `${run.output}\n--- expected a UI step at index ${index} ---`).toBeDefined();
  expect(step!.result.outcome, run.output).toBe("ok");
  return step!.result.value ?? "";
}

const ALICE_CUSTOMER = "c".repeat(64);
const NORTHLIGHT_MERCHANT = "a".repeat(64);
const CORRUPTION_TEST_PASSWORD = "commerce sealed key corruption e2e pass";

// ---------------------------------------------------------------------
// Real-NDJSON-record manipulation helpers -- every one of these operates
// on an ACTUAL sealed-key file a real launch wrote, never a hand-built
// fixture. Structural helpers only touch JSON shape; `tamperCiphertext`
// flips one character inside the opaque `sealedBlob` (same technique
// `commerce_receipt_issuer_signing_key_durability.test.ts` already
// established for this exact purpose), never touching structural fields.
// ---------------------------------------------------------------------

interface RawSealedRecordLine {
  readonly raw: string;
  readonly parsed: Record<string, unknown>;
}

function readRecordLines(filePath: string): RawSealedRecordLine[] {
  const content = readFileSync(filePath, "utf8");
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((raw) => ({ raw, parsed: JSON.parse(raw) as Record<string, unknown> }));
}

function writeRecordLines(filePath: string, lines: readonly string[]): void {
  writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

/** Truncates the file so its LAST line is cut off mid-JSON (never valid JSON, never a valid structural record). */
function truncateLastLineMidJson(filePath: string): void {
  const lines = readRecordLines(filePath);
  expect(lines.length, `expected at least one real sealed record in "${filePath}"`).toBeGreaterThan(0);
  const last = lines[lines.length - 1]!.raw;
  const cut = last.slice(0, Math.max(1, Math.floor(last.length / 2)));
  const rest = lines.slice(0, -1).map((l) => l.raw);
  writeRecordLines(filePath, [...rest, cut]);
}

/** Rewrites the record for `subjectId` (or the last record, if `subjectId` omitted) with an unrecognized `schemaVersion`. */
function setUnknownSchemaVersion(filePath: string, subjectId?: string): void {
  const lines = readRecordLines(filePath);
  const idx = subjectId === undefined ? lines.length - 1 : lines.findIndex((l) => l.parsed.subjectId === subjectId);
  expect(idx, `expected a real sealed record${subjectId ? ` for subject "${subjectId}"` : ""} in "${filePath}"`).toBeGreaterThanOrEqual(0);
  const tampered = { ...lines[idx]!.parsed, schemaVersion: 999 };
  const out = lines.map((l, i) => (i === idx ? JSON.stringify(tampered) : l.raw));
  writeRecordLines(filePath, out);
}

/** Appends a SECOND, structurally-valid record for the SAME (subjectId, generation) but with DIFFERENT content -- an irreconcilable duplicate. */
function appendConflictingDuplicate(filePath: string, subjectId?: string): void {
  const lines = readRecordLines(filePath);
  const idx = subjectId === undefined ? lines.length - 1 : lines.findIndex((l) => l.parsed.subjectId === subjectId);
  expect(idx, `expected a real sealed record${subjectId ? ` for subject "${subjectId}"` : ""} in "${filePath}"`).toBeGreaterThanOrEqual(0);
  const original = lines[idx]!.parsed;
  const conflicting = {
    ...original,
    // Structurally valid (64-hex publicKeyHex pattern, non-empty sealedBlob)
    // but DIFFERENT content for the SAME (subjectId, generation) pair.
    publicKeyHex: (original.publicKeyHex as string).slice(0, -2) + ((original.publicKeyHex as string).slice(-2) === "ab" ? "cd" : "ab"),
    sealedBlob: `${original.sealedBlob as string}-conflicting-duplicate`,
  };
  writeRecordLines(filePath, [...lines.map((l) => l.raw), JSON.stringify(conflicting)]);
}

/** Flips one character inside `sealedBlob` -- the ciphertext/tag -- without altering the record's structural shape (same technique K2's own unit test uses, applied here to a REAL file). */
function tamperCiphertext(filePath: string, subjectId?: string): void {
  const lines = readRecordLines(filePath);
  const idx = subjectId === undefined ? lines.length - 1 : lines.findIndex((l) => l.parsed.subjectId === subjectId);
  expect(idx, `expected a real sealed record${subjectId ? ` for subject "${subjectId}"` : ""} in "${filePath}"`).toBeGreaterThanOrEqual(0);
  const original = lines[idx]!.parsed;
  const blob = original.sealedBlob as string;
  const lastChar = blob.slice(-1);
  const tamperedBlob = blob.slice(0, -1) + (lastChar === "0" ? "1" : "0");
  const tampered = { ...original, sealedBlob: tamperedBlob };
  const out = lines.map((l, i) => (i === idx ? JSON.stringify(tampered) : l.raw));
  writeRecordLines(filePath, out);
}

const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log(
    "commerce_e2e_sealed_key_corruption_real_electron: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce or dist/os/trust, or the real Electron binary is absent.",
  );
}

realSuite("FedOS Commerce sealed signing-key stores -- real-filesystem corruption / fail-closed", () => {
  // One real Electron launch, shared read-only across every scenario below:
  // creates a real profile, completes one real trade end-to-end, and issues
  // one real receipt -- so BOTH `persona_epoch_signing_keys.ndjson` (one
  // record per real pubkey: Alice the customer, Northlight the merchant) and
  // `receipt_issuer_signing_keys.ndjson` (the one demo issuer) exist on disk
  // with genuine sealed content before any corruption scenario runs.
  let seedDataDir: string;
  let personaEpochKeysPath: string;
  let receiptIssuerKeysPath: string;
  // Constructor-function type (not `typeof DurableSealedSigningKeyStore` --
  // that name is a TYPE-ONLY import above, so `typeof` cannot query it as a
  // value; this shape is exactly what `new (...)` needs).
  let DurableSealedSigningKeyStoreCtor: new (filePath: string) => DurableSealedSigningKeyStore;

  beforeAll(async () => {
    DurableSealedSigningKeyStoreCtor = (
      await import("../../../src/os/core/vault/wasm/fedos_sealed_signing_key_store.js")
    ).DurableSealedSigningKeyStore;

    seedDataDir = makeTmpRoot("seed");
    const seedRun = await runBetaUiScript(seedDataDir, [
      { action: "wait", ms: 300 }, // 0
      { action: "fill", selector: "#create-label", value: "Sealed Key Corruption Seed Profile" }, // 1
      { action: "fill", selector: "#create-pass", value: CORRUPTION_TEST_PASSWORD }, // 2
      { action: "fill", selector: "#create-pass-confirm", value: CORRUPTION_TEST_PASSWORD }, // 3
      { action: "click", selector: "#create-pass-ack" }, // 4
      { action: "click", selector: "#create-submit" }, // 5
      { action: "wait", ms: 2000 }, // 6
      { action: "read", selector: "#current-screen" }, // 7 -- expect "ready"

      { action: "click", selector: "#nav-commerce-merchant" }, // 8
      { action: "wait", ms: 300 }, // 9
      { action: "fill", selector: "#commerce-merchant-acting-as", value: NORTHLIGHT_MERCHANT }, // 10
      { action: "wait", ms: 200 }, // 11
      { action: "fill", selector: "#commerce-merchant-create-title", value: "Corruption Seed Mug" }, // 12
      { action: "fill", selector: "#commerce-merchant-create-description", value: "A small fictional demo product for the sealed-key corruption E2E." }, // 13
      // Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) -- price
      // field is decimal-dollars now (friction ledger row #18); Publish
      // click targets its own class since the row also has Preview/Edit.
      { action: "fill", selector: "#commerce-merchant-create-price", value: "25.00" }, // 14
      { action: "fill", selector: "#commerce-merchant-create-currency", value: "USD" }, // 15
      { action: "click", selector: "#commerce-merchant-create-submit" }, // 16
      { action: "wait", ms: 300 }, // 17
      { action: "read", selector: "#commerce-merchant-products-list" }, // 18
      { action: "click", selector: "#commerce-merchant-products-list li:last-child button.commerce-btn-publish" }, // 19 -- Publish
      { action: "wait", ms: 300 }, // 20

      { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 21
      { action: "wait", ms: 200 }, // 22
      { action: "click", selector: "#nav-commerce" }, // 23
      { action: "wait", ms: 300 }, // 24
      { action: "read", selector: "#commerce-catalog-list" }, // 25
      { action: "click", selector: "#commerce-catalog-list li:nth-child(4) button" }, // 26 -- 3 seeded + 1 new
      { action: "wait", ms: 300 }, // 27
      { action: "read", selector: "#commerce-detail-title" }, // 28 -- expect "Corruption Seed Mug"
      { action: "click", selector: "#commerce-order-create-submit" }, // 29
      { action: "wait", ms: 400 }, // 30
      { action: "read", selector: "#commerce-order-status-text" }, // 31 -- expect "created"
      { action: "click", selector: "#commerce-order-submit-btn" }, // 32
      { action: "wait", ms: 300 }, // 33
      { action: "read", selector: "#commerce-order-status-text" }, // 34 -- expect "submitted"

      { action: "fill", selector: "#commerce-acting-as", value: NORTHLIGHT_MERCHANT }, // 35
      { action: "wait", ms: 200 }, // 36
      { action: "click", selector: "#commerce-order-accept-btn" }, // 37
      { action: "wait", ms: 300 }, // 38
      { action: "read", selector: "#commerce-order-status-text" }, // 39 -- expect "accepted"

      { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 40
      { action: "wait", ms: 200 }, // 41
      { action: "click", selector: "#commerce-order-payment-request-btn" }, // 42
      { action: "wait", ms: 400 }, // 43
      { action: "read", selector: "#commerce-order-payment-id" }, // 44
      { action: "click", selector: "#commerce-order-payment-simulate-btn" }, // 45
      { action: "wait", ms: 500 }, // 46
      { action: "read", selector: "#commerce-order-status-text" }, // 47 -- expect "paid"

      { action: "fill", selector: "#commerce-acting-as", value: NORTHLIGHT_MERCHANT }, // 48
      { action: "wait", ms: 200 }, // 49
      { action: "click", selector: "#commerce-order-fulfill-btn" }, // 50
      { action: "wait", ms: 400 }, // 51
      { action: "read", selector: "#commerce-order-status-text" }, // 52 -- expect "fulfilling"

      { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 53
      { action: "wait", ms: 200 }, // 54
      { action: "click", selector: "#commerce-order-acknowledge-receipt-btn" }, // 55
      { action: "wait", ms: 400 }, // 56
      { action: "read", selector: "#commerce-order-status-text" }, // 57 -- expect "delivered"

      { action: "click", selector: "#commerce-order-complete-btn" }, // 58
      { action: "wait", ms: 400 }, // 59
      { action: "read", selector: "#commerce-order-status-text" }, // 60 -- expect "completed" (mints+seals BOTH real pubkeys' Persona Epoch signing keys)

      { action: "click", selector: "#commerce-order-receipt-issue-btn" }, // 61 -- mints+seals the receipt-issuer signing key
      { action: "wait", ms: 500 }, // 62
      { action: "read", selector: "#commerce-order-receipt-verify-status" }, // 63 -- expect "VALID"
    ]);

    expect(readAt(seedRun, 7)).toBe("ready");
    expect(readAt(seedRun, 28)).toBe("Corruption Seed Mug");
    expect(readAt(seedRun, 60)).toBe("completed");
    expect(readAt(seedRun, 63)).toBe("VALID");

    // `dataDir()` (`fedos_electron_beta_main.cts`) appends its own `profile`
    // subdirectory under `FEDOS_ELECTRON_BETA_DATA_DIR`, and
    // `commerceDurableFilePath()` appends `commerce/<name>.ndjson` under
    // THAT -- i.e. `<FEDOS_ELECTRON_BETA_DATA_DIR>/profile/commerce/<name>.ndjson`.
    personaEpochKeysPath = join(seedDataDir, "profile", "commerce", "persona_epoch_signing_keys.ndjson");
    receiptIssuerKeysPath = join(seedDataDir, "profile", "commerce", "receipt_issuer_signing_keys.ndjson");
    expect(existsSync(personaEpochKeysPath), "seed launch should have produced a real persona_epoch_signing_keys.ndjson").toBe(true);
    expect(existsSync(receiptIssuerKeysPath), "seed launch should have produced a real receipt_issuer_signing_keys.ndjson").toBe(true);

    // Sanity: two real subject records (Alice + Northlight), never a raw secret.
    const personaLines = readRecordLines(personaEpochKeysPath);
    expect(personaLines.some((l) => l.parsed.subjectId === NORTHLIGHT_MERCHANT)).toBe(true);
    expect(personaLines.some((l) => l.parsed.subjectId === ALICE_CUSTOMER)).toBe(true);
    const receiptLines = readRecordLines(receiptIssuerKeysPath);
    expect(receiptLines.length).toBeGreaterThan(0);
  }, 60000);

  /** Clones the real seed profile directory into a fresh scratch root -- every scenario below corrupts its OWN copy, never the shared seed. */
  function cloneSeedProfile(label: string): { readonly dataDir: string; readonly personaEpochKeysPath: string; readonly receiptIssuerKeysPath: string } {
    const dataDir = makeTmpRoot(label);
    cpSync(seedDataDir, dataDir, { recursive: true });
    return {
      dataDir,
      personaEpochKeysPath: join(dataDir, "profile", "commerce", "persona_epoch_signing_keys.ndjson"),
      receiptIssuerKeysPath: join(dataDir, "profile", "commerce", "receipt_issuer_signing_keys.ndjson"),
    };
  }

  // -----------------------------------------------------------------
  // Structural corruption -- pure Node, no Electron needed; the REAL
  // `DurableSealedSigningKeyStore` constructor against a corrupted COPY of
  // the real file.
  // -----------------------------------------------------------------

  describe("DurableSealedSigningKeyStore -- structural corruption against a REAL sealed-key file", () => {
    it("a truncated (mid-JSON-cut) line in the REAL receipt-issuer file makes the constructor throw -- never fabricates a usable store", () => {
      const { receiptIssuerKeysPath: p } = cloneSeedProfile("truncated-receipt");
      truncateLastLineMidJson(p);
      expect(() => new DurableSealedSigningKeyStoreCtor(p)).toThrow();
    });

    it("a truncated (mid-JSON-cut) line in the REAL persona-epoch file makes the constructor throw -- never fabricates a usable store", () => {
      const { personaEpochKeysPath: p } = cloneSeedProfile("truncated-persona");
      truncateLastLineMidJson(p);
      expect(() => new DurableSealedSigningKeyStoreCtor(p)).toThrow();
    });

    it("an unrecognized schemaVersion in a REAL sealed record makes the constructor throw (one targeted real-file check; full schemaVersion-gating coverage already lives in K1/K2's own module-level unit tests)", () => {
      const { receiptIssuerKeysPath: p } = cloneSeedProfile("bad-schema");
      setUnknownSchemaVersion(p);
      expect(() => new DurableSealedSigningKeyStoreCtor(p)).toThrow();
    });

    it("a conflicting duplicate record (SAME subjectId+generation, DIFFERENT content) appended to a REAL persona-epoch file makes the constructor throw -- never silently picks one", () => {
      const { personaEpochKeysPath: p } = cloneSeedProfile("conflicting-dup");
      appendConflictingDuplicate(p, NORTHLIGHT_MERCHANT);
      expect(() => new DurableSealedSigningKeyStoreCtor(p)).toThrow();
    });

    it("a MISSING sealed-key file (ordinary first-ever-launch state, the contrast case, not corruption) constructs cleanly and reports no record -- never throws, never treated as an error", () => {
      const freshDataDir = makeTmpRoot("missing-file");
      const neverWrittenPath = join(freshDataDir, "commerce", "receipt_issuer_signing_keys.ndjson");
      expect(existsSync(neverWrittenPath)).toBe(false);
      let store: DurableSealedSigningKeyStore | undefined;
      expect(() => {
        store = new DurableSealedSigningKeyStoreCtor(neverWrittenPath);
      }).not.toThrow();
      expect(store!.latestFor("fedos-commerce-e2e-demo-merchant")).toBeUndefined();
      expect(store!.historyFor("fedos-commerce-e2e-demo-merchant")).toEqual([]);
    });
  });

  // -----------------------------------------------------------------
  // AEAD-ciphertext tamper -- needs a REAL, unlocked SealingAuthorityPort,
  // so this relaunches a real Electron process against a COPY of the real
  // seed profile with one real record's `sealedBlob` tampered, and reads
  // the REAL, visible, structured fail-closed outcome through the DOM.
  // -----------------------------------------------------------------

  describe("real Electron relaunch against a REAL, ciphertext-tampered sealed-key file -- fails closed end-to-end", () => {
    it(
      "receipt-issuer: tampered sealedBlob -> real relaunch, real unlock -> 'Issue Signed Receipt' surfaces a structured rejection, NOT a new working receipt",
      async () => {
        const { dataDir, receiptIssuerKeysPath } = cloneSeedProfile("tampered-receipt-issuer");
        tamperCiphertext(receiptIssuerKeysPath);

        const run = await runBetaUiScript(dataDir, [
          { action: "wait", ms: 300 }, // 0
          { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock"
          { action: "fill", selector: "#unlock-pass", value: CORRUPTION_TEST_PASSWORD }, // 2
          { action: "click", selector: "#unlock-submit" }, // 3
          { action: "wait", ms: 2000 }, // 4
          { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"

          { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 6
          { action: "wait", ms: 200 }, // 7
          { action: "click", selector: "#nav-commerce" }, // 8
          { action: "wait", ms: 300 }, // 9
          { action: "read", selector: "#commerce-my-orders-list" }, // 10 -- expect the real completed order, still present
          { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 11 -- Open
          { action: "wait", ms: 300 }, // 12
          { action: "read", selector: "#commerce-order-status-text" }, // 13 -- expect "completed" (still true; only the SIGNING KEY is tampered, never the Order/Delivery data)

          // The receipt-issuer identity is corrupted -- this must fail
          // closed with a structured, visible rejection, never a silently
          // "successful" receipt signed under a discontinuous/fabricated key.
          { action: "click", selector: "#commerce-order-receipt-issue-btn" }, // 14
          { action: "wait", ms: 500 }, // 15
          { action: "read", selector: "#commerce-order-receipt-error" }, // 16 -- expect a non-empty rejection reason
        ]);

        expect(readAt(run, 1)).toBe("unlock");
        expect(readAt(run, 5)).toBe("ready");
        expect(readAt(run, 13)).toBe("completed");

        const rejectionReason = readAt(run, 16);
        expect(rejectionReason.length, "a tampered receipt-issuer sealed record must surface a NON-EMPTY, visible rejection reason").toBeGreaterThan(0);
        expect(rejectionReason.toLowerCase()).toMatch(/corrupt/);
      },
      60000,
    );

    it(
      "persona-epoch: tampered sealedBlob for the SELLER's real pubkey -> real relaunch, real unlock -> Seller Reputation panel falls back to 'no reputation history' DESPITE real underlying attested trade history (contrast: the sibling ordinary-restart test now proves the SAME panel shows real content when the sealed record is intact)",
      async () => {
        const { dataDir, personaEpochKeysPath } = cloneSeedProfile("tampered-persona-epoch");
        tamperCiphertext(personaEpochKeysPath, NORTHLIGHT_MERCHANT);

        const run = await runBetaUiScript(dataDir, [
          { action: "wait", ms: 300 }, // 0
          { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock"
          { action: "fill", selector: "#unlock-pass", value: CORRUPTION_TEST_PASSWORD }, // 2
          { action: "click", selector: "#unlock-submit" }, // 3
          { action: "wait", ms: 2000 }, // 4
          { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"

          { action: "click", selector: "#nav-commerce" }, // 6
          { action: "wait", ms: 300 }, // 7
          { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 8
          { action: "wait", ms: 200 }, // 9
          { action: "read", selector: "#commerce-catalog-list" }, // 10 -- expect the product still present (product data itself is untouched)
          { action: "click", selector: "#commerce-catalog-list li:nth-child(4) button" }, // 11
          { action: "wait", ms: 400 }, // 12
          { action: "read", selector: "#commerce-detail-title" }, // 13 -- expect "Corruption Seed Mug"
          { action: "read", selector: "#commerce-detail-reputation-summary" }, // 14 -- expect "no reputation history" fallback, DESPITE real attested history existing
        ]);

        expect(readAt(run, 1)).toBe("unlock");
        expect(readAt(run, 5)).toBe("ready");
        expect(readAt(run, 13)).toBe("Corruption Seed Mug");

        const reputationWithTamperedKey = readAt(run, 14);
        expect(
          reputationWithTamperedKey,
          "a tampered persona-epoch sealed record must fail closed to the honest 'no history' fallback, never fabricate/guess a board",
        ).toMatch(/no reputation history/i);
      },
      60000,
    );
  });
});
