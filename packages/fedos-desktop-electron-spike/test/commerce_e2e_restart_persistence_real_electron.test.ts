/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (coordinator) — the arc's own mandatory restart-acceptance
 * gate (§5/§6/§25/§26/§27 of the brief), proven against the REAL dev
 * Electron process driving the SAME `commerceState()`/`commerceReputationState()`
 * composition-root wiring the packaged binary uses (same `DurableOrderRepository`/
 * `DurableProductRepository`/`DurablePaymentSettlementLedger`/
 * `DurableDeliveryRepository`/`DurablePersonaEpochRegistry`/
 * `DurableTradeCompletionAttestationStore` adapters) — NOT the packaged/NSIS
 * binary itself (that gap is covered by `commerce_e2e_packaged_binary_real_electron.test.ts`
 * and this arc's own final report; this file exists specifically so the
 * restart-durability CLAIM has real Electron-process, real-UI evidence
 * independent of that separate, host-contention-sensitive gate).
 *
 * Flow: launch 1 runs the FULL happy-path tabletop (same steps as
 * `commerce_e2e_full_happy_path_real_electron.test.ts`) against a FRESH
 * `dataDir`, then the process exits cleanly. Launch 2 points a BRAND NEW
 * Electron process at the SAME `dataDir` (unlock, not create) and asserts,
 * through visible DOM controls only, that the Product still exists, the
 * Order is still `completed`, and Delivery has durably reached its own
 * terminal `completed` status too (Order completion finalizes the linked
 * Delivery record) — i.e. a real OS-process restart, not just a fresh
 * repository instance in the same process.
 *
 * TWO GAPS THIS TEST ORIGINALLY EMPIRICALLY CONFIRMED -- BOTH NOW CLOSED
 * (FedOS Commerce FINAL P1 Closure arc, Agents K1/K2 + this file's own
 * Agent T update) -- kept documented here, not deleted, so the "before"
 * shape of both gaps stays legible next to the restart-durability proof
 * that now supersedes it:
 *
 *   1. Seller Reputation panel: PREVIOUSLY fell back to "no reputation
 *      history" after a real restart, even though the underlying
 *      `PersonaEpochRegistry`/`TradeCompletionAttestationStore` were ALWAYS
 *      durable (Agent D's own targeted tests already proved past
 *      attestations replay and duplicate-issuance stays rejected). The gap
 *      was `commercePersonaEpochByPubkey` (`fedos_electron_beta_main.cts`)
 *      -- the coordinator's own real-pubkey -> PersonaEpoch identity-minting
 *      CACHE, which also holds each epoch's live signing keypair -- being
 *      process-lifetime-only, so the read-only query path could no longer
 *      resolve a pubkey it already durably had history for. Agent K1's
 *      `durable_persona_epoch_signing_key_store.ts` closed this: the epoch
 *      signing keypair is now sealed at rest and restored before the
 *      in-memory cache is consulted, so `commercePersonaEpochForPubkey()`
 *      resolves the SAME identity across a real restart. THIS TEST now
 *      asserts the CLOSED-gap behavior live: the reputation panel renders
 *      byte-for-byte identical content before and after a real restart (see
 *      the `reputationBeforeRestart`/`reputationAfterRestart` assertions
 *      below), not merely "no longer says no history".
 *   2. Receipt/QR durability: PREVIOUSLY not exercised here at all, and
 *      re-verifying the SAME original QR text after a restart would have
 *      failed -- `commerceReceiptSigningState()` used to mint a demo
 *      receipt-issuer keypair once per process lifetime, never durably
 *      persisted, so the single-issuer Trust policy built from it could not
 *      recognize a receipt signed by a prior process's now-discarded key.
 *      Agent K2's `durable_receipt_issuer_signing_key_store.ts` closed this
 *      the same way (sealed-at-rest, restored on every resolve). THIS TEST
 *      now drives the real in-app "Issue Signed Receipt" UI control in BOTH
 *      launches (real Trade A receipt before the restart, real Trade B
 *      receipt after it) and, outside the Electron process, decodes both
 *      QR-encoded envelopes with the SAME production
 *      `decodeCommerceReceiptProofFromQrText`/`verifySignedTradeReceiptProof`
 *      code `handleCommerceReceiptIssue` itself calls
 *      (`src/os/commerce/receipt/commerce_trust_receipt_adapter.ts`) to
 *      prove two concrete things a UI-only read cannot: (a) Trade A's
 *      receipt, signed in launch 1, still independently verifies `"VALID"`
 *      against a `FedosTrustPolicy` built from launch 2's live, restored
 *      issuer key, and (b) both receipts' signing `keyId` (== issuer
 *      `publicKeyHex`) are IDENTICAL across the restart -- issuer identity
 *      continuity, not merely "some receipt was issued after restart too".
 */
import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Same production decode/verify pipeline `handleCommerceReceiptIssue`
// (`fedos_electron_beta_main.cts`) itself calls via `m.Commerce.*` --
// imported directly here (Node process, NOT inside Electron) purely to
// INSPECT and CROSS-VERIFY the two real signed envelopes launch 1/launch 2
// already produced through the real UI control below. This file invents no
// new signing/verification logic of its own. Loaded via a DYNAMIC `import()`
// (awaited inside the `it()` body below, see `loadReceiptTrustModules()`),
// not a static top-level import: this package's own `package.json` has no
// `"type": "module"` field, so this `.ts` test file is classified CommonJS
// under `tsconfig.test.json`'s Node16 module resolution, and a static
// `import` of the repo-root ESM module (`"type": "module"` there) is a
// real, correct TS1479 compile error, not a style nit -- `import()` is the
// TypeScript-recommended, always-valid way to cross that boundary.
async function loadReceiptTrustModules() {
  const receiptAdapter = await import("../../../src/os/commerce/receipt/commerce_trust_receipt_adapter.js");
  const policy = await import("../../../src/os/trust/policy/index.js");
  return {
    decodeCommerceReceiptProofFromQrText: receiptAdapter.decodeCommerceReceiptProofFromQrText,
    verifySignedTradeReceiptProof: receiptAdapter.verifySignedTradeReceiptProof,
    createSingleIssuerFedosTrustPolicy: policy.createSingleIssuerFedosTrustPolicy,
  };
}

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
  const dir = mkdtempSync(join(tmpdir(), `fedos-commerce-restart-e2e-${label}-`));
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

/** Same dev-launch mechanism as `commerce_e2e_full_happy_path_real_electron.test.ts` -- `stdio: ["ignore","pipe","pipe"]` is safe for the DEV binary (only the packaged/NSIS binary requires `stdio:"ignore"`, per this arc's own harness-hardening finding). */
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

// Same synthetic demo pubkeys as the full happy-path test / the renderer's own `COMMERCE_DEMO_ACTORS`.
const ALICE_CUSTOMER = "c".repeat(64);
const NORTHLIGHT_MERCHANT = "a".repeat(64);
const RESTART_TEST_PASSWORD = "commerce restart persistence e2e pass";

const realSuite = CAN_RUN_REAL ? describe : describe.skip;
if (!CAN_RUN_REAL) {
  // eslint-disable-next-line no-console
  console.log(
    "commerce_e2e_restart_persistence_real_electron: SKIPPED -- real pkg/ WASM artifact, its manifest, dist/os/commerce or dist/os/trust, or the real Electron binary is absent.",
  );
}

realSuite("FedOS Commerce End-to-End -- restart durability, REAL dev Electron process (two independent launches, same profile dir)", () => {
  it(
    "launch 1: full happy-path tabletop completes a real Order+Payment+Delivery+Reputation trade; process exits; launch 2 (fresh Electron process, SAME dataDir): Product/Order/Delivery/Reputation all still correct, no impossible state, no silent data loss",
    async () => {
      const dataDir = makeTmpRoot("restart");

      // --- Launch 1: create profile, run the full tabletop, close cleanly. ---
      const run1 = await runBetaUiScript(dataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "fill", selector: "#create-label", value: "Commerce Restart E2E Profile" }, // 1
        { action: "fill", selector: "#create-pass", value: RESTART_TEST_PASSWORD }, // 2
        { action: "fill", selector: "#create-pass-confirm", value: RESTART_TEST_PASSWORD }, // 3
        { action: "click", selector: "#create-submit" }, // 4
        { action: "wait", ms: 2000 }, // 5
        { action: "read", selector: "#current-screen" }, // 6 -- expect "ready"

        { action: "click", selector: "#nav-commerce-merchant" }, // 7
        { action: "wait", ms: 300 }, // 8
        { action: "fill", selector: "#commerce-merchant-acting-as", value: NORTHLIGHT_MERCHANT }, // 9
        { action: "wait", ms: 200 }, // 10
        { action: "fill", selector: "#commerce-merchant-create-title", value: "Restart-Durability Test Mug" }, // 11
        { action: "fill", selector: "#commerce-merchant-create-description", value: "A small fictional demo product for the restart-durability E2E." }, // 12
        // Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) -- price
        // field is decimal-dollars now (friction ledger row #18); Publish
        // click targets its own class since the row also has Preview/Edit.
        { action: "fill", selector: "#commerce-merchant-create-price", value: "31.00" }, // 13
        { action: "fill", selector: "#commerce-merchant-create-currency", value: "USD" }, // 14
        { action: "click", selector: "#commerce-merchant-create-submit" }, // 15
        { action: "wait", ms: 300 }, // 16
        { action: "read", selector: "#commerce-merchant-products-list" }, // 17
        { action: "click", selector: "#commerce-merchant-products-list li:last-child button.commerce-btn-publish" }, // 18 -- Publish
        { action: "wait", ms: 300 }, // 19

        { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 20
        { action: "wait", ms: 200 }, // 21
        { action: "click", selector: "#nav-commerce" }, // 22
        { action: "wait", ms: 300 }, // 23
        { action: "read", selector: "#commerce-catalog-list" }, // 24
        { action: "click", selector: "#commerce-catalog-list li:nth-child(4) button" }, // 25 -- 3 seeded + 1 new
        { action: "wait", ms: 300 }, // 26
        { action: "read", selector: "#commerce-detail-title" }, // 27 -- expect "Restart-Durability Test Mug"
        { action: "click", selector: "#commerce-order-create-submit" }, // 28
        { action: "wait", ms: 400 }, // 29
        { action: "read", selector: "#commerce-order-status-text" }, // 30 -- expect "created"
        { action: "click", selector: "#commerce-order-submit-btn" }, // 31
        { action: "wait", ms: 300 }, // 32
        { action: "read", selector: "#commerce-order-status-text" }, // 33 -- expect "submitted"

        { action: "fill", selector: "#commerce-acting-as", value: NORTHLIGHT_MERCHANT }, // 34
        { action: "wait", ms: 200 }, // 35
        { action: "click", selector: "#commerce-order-accept-btn" }, // 36
        { action: "wait", ms: 300 }, // 37
        { action: "read", selector: "#commerce-order-status-text" }, // 38 -- expect "accepted"

        { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 39
        { action: "wait", ms: 200 }, // 40
        { action: "click", selector: "#commerce-order-payment-request-btn" }, // 41
        { action: "wait", ms: 400 }, // 42
        { action: "read", selector: "#commerce-order-payment-id" }, // 43
        { action: "click", selector: "#commerce-order-payment-simulate-btn" }, // 44
        { action: "wait", ms: 500 }, // 45
        { action: "read", selector: "#commerce-order-status-text" }, // 46 -- expect "paid"

        { action: "fill", selector: "#commerce-acting-as", value: NORTHLIGHT_MERCHANT }, // 47
        { action: "wait", ms: 200 }, // 48
        { action: "click", selector: "#commerce-order-fulfill-btn" }, // 49
        { action: "wait", ms: 400 }, // 50
        { action: "read", selector: "#commerce-order-status-text" }, // 51 -- expect "fulfilling"

        { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 52
        { action: "wait", ms: 200 }, // 53
        { action: "click", selector: "#commerce-order-acknowledge-receipt-btn" }, // 54
        { action: "wait", ms: 400 }, // 55
        { action: "read", selector: "#commerce-order-status-text" }, // 56 -- expect "delivered"

        { action: "click", selector: "#commerce-order-complete-btn" }, // 57
        { action: "wait", ms: 400 }, // 58
        { action: "read", selector: "#commerce-order-status-text" }, // 59 -- expect "completed"

        // Issue a REAL signed, QR-encoded Trust receipt for this trade ("Trade A")
        // -- still on the Order detail screen, order is "completed" so
        // `#commerce-order-receipt-actions` is visible. Captured below and
        // cross-verified against launch 2's live, restored issuer policy.
        { action: "click", selector: "#commerce-order-receipt-issue-btn" }, // 60
        { action: "wait", ms: 500 }, // 61
        { action: "read", selector: "#commerce-order-receipt-verify-status" }, // 62 -- expect "VALID"
        { action: "read", selector: "#commerce-order-receipt-qr-text", as: "value" }, // 63 -- non-empty real signed envelope text ("Trade A")

        // Capture the Seller Reputation panel BEFORE restart, for comparison.
        { action: "click", selector: "#commerce-detail-back" }, // 64
        { action: "wait", ms: 200 }, // 65
        { action: "click", selector: "#commerce-catalog-list li:nth-child(4) button" }, // 66
        { action: "wait", ms: 400 }, // 67
        { action: "read", selector: "#commerce-detail-reputation-summary" }, // 68
      ]);

      expect(readAt(run1, 6)).toBe("ready");
      expect(readAt(run1, 27)).toBe("Restart-Durability Test Mug");
      expect(readAt(run1, 30)).toBe("created");
      expect(readAt(run1, 33)).toBe("submitted");
      expect(readAt(run1, 38)).toBe("accepted");
      const paymentIdText = readAt(run1, 43);
      expect(paymentIdText.length).toBeGreaterThan(0);
      expect(readAt(run1, 46)).toBe("paid");
      expect(readAt(run1, 51)).toBe("fulfilling");
      expect(readAt(run1, 56)).toBe("delivered");
      expect(readAt(run1, 59)).toBe("completed");

      // "Trade A" receipt -- issued and independently verified VALID by the
      // real in-app pipeline, in launch 1, BEFORE the restart.
      expect(readAt(run1, 62)).toBe("VALID");
      const qrTextTradeA = readAt(run1, 63);
      expect(qrTextTradeA.length).toBeGreaterThan(0);

      const reputationBeforeRestart = readAt(run1, 68);
      expect(reputationBeforeRestart).not.toMatch(/no reputation history/i);
      expect(reputationBeforeRestart).toMatch(/verified trades/i);

      // --- Launch 2: BRAND NEW Electron process, SAME dataDir, UNLOCK (not create). ---
      const run2 = await runBetaUiScript(dataDir, [
        { action: "wait", ms: 300 }, // 0
        { action: "read", selector: "#current-screen" }, // 1 -- expect "unlock" (an existing profile was found on disk)
        { action: "fill", selector: "#unlock-pass", value: RESTART_TEST_PASSWORD }, // 2
        { action: "click", selector: "#unlock-submit" }, // 3
        { action: "wait", ms: 2000 }, // 4 -- real Argon2 re-derivation + real durable-log replay
        { action: "read", selector: "#current-screen" }, // 5 -- expect "ready"

        // Product still exists, still published, still in the customer catalog.
        { action: "click", selector: "#nav-commerce" }, // 6
        { action: "wait", ms: 300 }, // 7
        { action: "fill", selector: "#commerce-acting-as", value: ALICE_CUSTOMER }, // 8
        { action: "wait", ms: 200 }, // 9
        { action: "read", selector: "#commerce-catalog-list" }, // 10 -- expect the product title still present

        // Order still exists, in "My Orders", still terminal-completed.
        { action: "read", selector: "#commerce-my-orders-list" }, // 11 -- expect a real (not "No orders yet.") entry
        { action: "click", selector: "#commerce-my-orders-list li:last-child button" }, // 12 -- Open
        { action: "wait", ms: 300 }, // 13
        { action: "read", selector: "#commerce-order-status-text" }, // 14 -- expect "completed" (survived restart; reachable ONLY via the guarded chain: submitted->accepted->paid[verified evidence only]->fulfilling->delivered->completed, so this alone proves Payment+Delivery consistency too)
        { action: "read", selector: "#commerce-order-delivery-status" }, // 15 -- expect "Delivery status: completed" (the persisted DeliveryRecord's own terminal status, independently confirming Delivery durability -- Order completion also finalizes the linked Delivery record to its own "completed" state, not merely "delivered")

        // Issue a SECOND real signed, QR-encoded Trust receipt for the SAME
        // order ("Trade B") -- a brand new Electron process, after a real
        // restart+unlock, still on this SAME Order's detail screen (still
        // "completed", so `#commerce-order-receipt-actions` is visible
        // again). Proves issuer-key continuity below (same `keyId` as
        // Trade A's receipt from launch 1).
        { action: "click", selector: "#commerce-order-receipt-issue-btn" }, // 16
        { action: "wait", ms: 500 }, // 17
        { action: "read", selector: "#commerce-order-receipt-verify-status" }, // 18 -- expect "VALID"
        { action: "read", selector: "#commerce-order-receipt-qr-text", as: "value" }, // 19 -- non-empty real signed envelope text ("Trade B")

        // Seller Reputation panel: re-open the SAME product's detail screen.
        { action: "click", selector: "#nav-commerce" }, // 20
        { action: "wait", ms: 300 }, // 21
        { action: "click", selector: "#commerce-catalog-list li:nth-child(4) button" }, // 22
        { action: "wait", ms: 400 }, // 23
        { action: "read", selector: "#commerce-detail-title" }, // 24 -- expect "Restart-Durability Test Mug"
        { action: "read", selector: "#commerce-detail-reputation-summary" }, // 25 -- expect the SAME real reputation text, NOT "no history"

        // Duplicate-attestation-after-restart rejection: attempting the SAME
        // completed order's reputation issuance again must not be reachable
        // from ordinary UI (there is no "re-issue reputation" button), so
        // this is asserted at Agent D's own targeted persistence test level
        // (`commerce_durable_reputation_persistence.test.ts`), not here --
        // this screen-level check instead confirms the SAME persona epoch
        // is still being resolved (no silently-minted second identity would
        // show a "no history yet" board for a pubkey that already has one).

        // Messenger regression: still reachable after a real restart+unlock.
        { action: "click", selector: "#nav-conversations" }, // 26
        { action: "wait", ms: 300 }, // 27
        { action: "read", selector: ".app-screen.active#app-screen-conversations" }, // 28
      ]);

      expect(readAt(run2, 1)).toBe("unlock");
      expect(readAt(run2, 5)).toBe("ready");

      const catalogAfterRestart = readAt(run2, 10);
      expect(catalogAfterRestart).toMatch(/Restart-Durability Test Mug/);

      const myOrdersAfterRestart = readAt(run2, 11);
      expect(myOrdersAfterRestart).not.toMatch(/No orders yet\./);

      expect(readAt(run2, 14)).toBe("completed");
      expect(readAt(run2, 15)).toMatch(/Delivery status: completed/);

      // "Trade B" receipt -- issued and independently verified VALID by the
      // real in-app pipeline, in launch 2, AFTER the restart, for the SAME
      // order.
      expect(readAt(run2, 18)).toBe("VALID");
      const qrTextTradeB = readAt(run2, 19);
      expect(qrTextTradeB.length).toBeGreaterThan(0);

      expect(readAt(run2, 24)).toBe("Restart-Durability Test Mug");
      const reputationAfterRestart = readAt(run2, 25);
      // FORMERLY A KNOWN, DISCLOSED GAP (Commerce Durability arc final
      // report, "REPUTATION PERSISTENCE: PARTIAL") -- NOW CLOSED (FedOS
      // Commerce FINAL P1 Closure arc, Agent K1). The underlying
      // `PersonaEpochRegistry`/`TradeCompletionAttestationStore` were ALWAYS
      // durable (Agent D's own targeted tests already proved past
      // attestations replay and duplicate-issuance stays rejected across a
      // restart); the actual gap was `commercePersonaEpochByPubkey`
      // (`fedos_electron_beta_main.cts`), the coordinator's own real-pubkey
      // -> PersonaEpoch identity-minting CACHE (which also holds each
      // epoch's live secp256k1 signing keypair), being process-lifetime-only
      // -- after a real restart the cache used to be empty, so
      // `commercePersonaEpochForPubkey(pubkey, false)` (the read-only
      // Persona Board query path) returned `undefined` for a pubkey that
      // provably DID have durable attested history.
      //
      // Agent K1's `durable_persona_epoch_signing_key_store.ts` closes this
      // for real: `commercePersonaEpochForPubkey()` now tries the sealed,
      // durable signing-key store FIRST (restoring the SAME epoch identity
      // that already has attested history) before ever falling back to "no
      // identity known yet". This assertion is the live, real-Electron-
      // process proof of the CLOSED state, not just "no longer says no
      // history": the reputation panel renders content IDENTICAL to what it
      // rendered before the restart -- same persona-epoch label, same
      // verified-trade bucket, same category, same validity -- because it
      // is the SAME underlying attested history resolved through the SAME
      // persisted signing identity both times.
      expect(reputationAfterRestart).not.toMatch(/no reputation history/i);
      expect(reputationAfterRestart).toMatch(/verified trades/i);
      expect(reputationAfterRestart).toBe(reputationBeforeRestart);

      readAt(run2, 28); // Conversations still reachable.

      // --- Receipt-issuer continuity, decoded+cross-verified OUTSIDE Electron. ---
      // Uses the SAME production `decodeCommerceReceiptProofFromQrText`/
      // `verifySignedTradeReceiptProof` code `handleCommerceReceiptIssue`
      // itself calls (`src/os/commerce/receipt/commerce_trust_receipt_adapter.ts`,
      // via `m.Commerce.*` inside the real Electron process) -- this test
      // file invents no parallel decode/verify logic of its own.
      const { decodeCommerceReceiptProofFromQrText, verifySignedTradeReceiptProof, createSingleIssuerFedosTrustPolicy } =
        await loadReceiptTrustModules();
      const decodedTradeA = decodeCommerceReceiptProofFromQrText(qrTextTradeA);
      const decodedTradeB = decodeCommerceReceiptProofFromQrText(qrTextTradeB);
      expect("error" in decodedTradeA ? decodedTradeA.error : undefined, JSON.stringify(decodedTradeA)).toBeUndefined();
      expect("error" in decodedTradeB ? decodedTradeB.error : undefined, JSON.stringify(decodedTradeB)).toBeUndefined();
      if ("error" in decodedTradeA || "error" in decodedTradeB) throw new Error("unreachable");

      // Issuer-key continuity: Trade A (launch 1, pre-restart) and Trade B
      // (launch 2, post-restart) were signed under the SAME issuer `keyId`
      // (== the receipt issuer's `publicKeyHex`, see
      // `commerce_trust_receipt_adapter.ts`'s `buildEnvelopeInput`) -- proof
      // this is one continuous issuer identity across the restart, not two
      // different keys that happen to both say "VALID" locally.
      expect(decodedTradeA.issuer).toBe(decodedTradeB.issuer);
      expect(decodedTradeA.keyId).toBe(decodedTradeB.keyId);
      expect(decodedTradeA.keyId).toMatch(/^[0-9a-f]{64}$/);

      // The concrete "a historical receipt survives restart" proof: Trade
      // A's receipt, signed BEFORE the restart, independently verifies
      // `"VALID"` against a `FedosTrustPolicy` built from the SAME
      // `issuer`/`keyId` launch 2's own live, restored issuer resolution
      // uses (`commerceReceiptSigningState()`'s own
      // `createSingleIssuerFedosTrustPolicy({issuerId, keys:[{keyId:
      // keypair.publicKeyHex, publicKeyHex: keypair.publicKeyHex}]})` --
      // mirrored exactly here, using launch 2's OWN decoded `keyId`, not a
      // value this test invents).
      const policyFromLaunch2Issuer = createSingleIssuerFedosTrustPolicy({
        issuerId: decodedTradeB.issuer,
        keys: [{ keyId: decodedTradeB.keyId, publicKeyHex: decodedTradeB.keyId }],
      });
      const verifiedTradeAAfterRestart = verifySignedTradeReceiptProof(decodedTradeA, policyFromLaunch2Issuer);
      expect(verifiedTradeAAfterRestart.status, JSON.stringify(verifiedTradeAAfterRestart)).toBe("VALID");

      // And the reverse direction, for completeness: Trade B (signed AFTER
      // the restart) verifies VALID against a policy built from launch 1's
      // own issuer key -- both directions confirm one continuous identity.
      const policyFromLaunch1Issuer = createSingleIssuerFedosTrustPolicy({
        issuerId: decodedTradeA.issuer,
        keys: [{ keyId: decodedTradeA.keyId, publicKeyHex: decodedTradeA.keyId }],
      });
      const verifiedTradeBAgainstLaunch1Issuer = verifySignedTradeReceiptProof(decodedTradeB, policyFromLaunch1Issuer);
      expect(verifiedTradeBAgainstLaunch1Issuer.status, JSON.stringify(verifiedTradeBAgainstLaunch1Issuer)).toBe("VALID");
    },
    150000,
  );
});
