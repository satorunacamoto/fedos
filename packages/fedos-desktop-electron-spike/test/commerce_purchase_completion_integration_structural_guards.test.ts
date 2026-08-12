/**
 * FedOS Commerce "Purchase Completion" mega-arc — COORDINATOR INTEGRATION
 * PHASE structural guards, proving by direct source inspection (never
 * narrative claim alone) that the four sibling agents' independently-built
 * capabilities are genuinely wired together in
 * `fedos_electron_beta_main.cts` / `fedos_electron_beta_renderer.ts`, and
 * that the wiring itself did not weaken any authority boundary.
 *
 * WHY STRUCTURAL: this package has no DOM/IPC test harness, and the
 * Electron main process cannot be imported directly under vitest (it
 * `require`s `electron` at module load). Every other main-process
 * behaviour in this package is asserted the same way — see
 * `commerce_reachable_catalog_phase1_structural_guards.test.ts`'s own
 * established convention. The DOMAIN logic underneath this wiring is
 * separately and genuinely unit-tested (`test/commerce_payment_evidence_port.test.ts`,
 * `test/commerce_private_delivery_apply.test.ts`, ... at the repo root);
 * this file guards only the wiring those tests cannot see.
 *
 * The specific risk this file exists to pin down: the Coordinator's
 * integration added the ONE cross-process path that can move an Order to
 * `"paid"` on a process that never itself observed settlement. That path
 * must never become reachable without every receiver-side check in front
 * of it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const MAIN_PATH = join(REPO_ROOT, "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts");
const RENDERER_PATH = join(REPO_ROOT, "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_renderer.ts");
const PAGE_PATH = join(REPO_ROOT, "packages/fedos-desktop-electron-spike/src/fedos_electron_beta_page.html");
const BETA_RUNTIME_TSCONFIG = join(REPO_ROOT, "tsconfig.beta-runtime.json");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/** Comment-stripped view -- so a guard can never be satisfied by this arc's own explanatory prose merely NAMING the thing it claims to do. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * One whole top-level `function`/`async function` declaration, signature
 * included, ending at its own column-0 closing brace.
 *
 * Deliberately NOT brace-matched from the first `{`: several functions
 * here take/return inline object TYPE annotations (`envelope: { readonly
 * outcome: string; ... }`), so "first brace after the name" lands inside
 * the signature's type, not the body -- which silently made assertions
 * pass or fail against the wrong text. A column-0 `}` unambiguously ends
 * a top-level declaration in this codebase's formatting.
 */
function functionBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration);
  expect(start, `expected to find "${declaration}" in source`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("\n}", start);
  expect(end, `expected a column-0 closing brace after "${declaration}"`).toBeGreaterThan(start);
  return source.slice(start, end + 2);
}

describe("Purchase Completion integration -- Agent P's PaymentEvidence transport is genuinely wired into the main process", () => {
  it("1. the payment-evidence bridge + receiver Port are really loaded as root modules (not merely present as unreferenced files on disk)", () => {
    const main = stripComments(read(MAIN_PATH));
    // Agent P shipped these three files but deliberately left the Electron
    // wiring undone; before the integration phase NOTHING imported them.
    expect(main).toMatch(/commerce_private_payment_evidence_bridge\.js/);
    expect(main).toMatch(/payment_evidence_port\.js/);
    expect(main).toMatch(/RealPaymentEvidenceTransport:/);
    expect(main).toMatch(/applyInboundPaymentEvidenceSync:/);
    expect(main).toMatch(/COMMERCE_PRIVATE_PAYMENT_EVIDENCE_SYNC_TAG:/);
  });

  it("2. all three of Agent P's modules are in the beta-runtime build, so the dynamic imports above can actually resolve at runtime", () => {
    const tsconfig = read(BETA_RUNTIME_TSCONFIG);
    // A missing entry here compiles and typechecks fine but fails at
    // RUNTIME with an unresolved dist import -- exactly the failure mode
    // this repo has hit before, hence a guard rather than trust.
    for (const entry of [
      "src/os/commerce/catalog/adapters/nostr/commerce_private_payment_evidence_bridge.ts",
      "src/os/commerce/events/commerce_private_payment_evidence_sync.ts",
      "src/os/commerce/payment/payment_evidence_port.ts",
    ]) {
      expect(tsconfig).toContain(entry);
    }
  });

  it("3. OUTBOUND: evidence is sent only from handleCommercePaymentSimulate, only AFTER the local ledger transitioned AND the Order action was accepted, and only to the order's own seller", () => {
    const main = stripComments(read(MAIN_PATH));
    const body = functionBody(main, "async function handleCommercePaymentSimulate(");

    // The send must come after BOTH independent local gates.
    const ledgerGate = body.indexOf('if (applied.outcome !== "transitioned")');
    const orderGate = body.indexOf("if (!result.ok || result.order === undefined)");
    const send = body.indexOf("sendPrivatePaymentEvidenceSyncNonFatal(");
    expect(ledgerGate).toBeGreaterThanOrEqual(0);
    expect(orderGate).toBeGreaterThanOrEqual(0);
    expect(send).toBeGreaterThan(ledgerGate);
    expect(send).toBeGreaterThan(orderGate);

    // Recipient is the seller -- never the acting buyer, never wire-supplied.
    expect(body).toMatch(/sendPrivatePaymentEvidenceSyncNonFatal\(\s*evidence,\s*\{[^}]*\},\s*order\.sellerPubkey,\s*\)/);
    // The amount binding is re-derived from THIS process's own Order record.
    expect(body).toMatch(/amountCents: order\.unitPriceCents \* order\.quantity/);
  });

  it("4. OUTBOUND: the send helper goes through Agent P's domain-facing Port adapter, so the outbound authority gate can never be bypassed by hand-building a wire payload here", () => {
    const main = stripComments(read(MAIN_PATH));
    const transportFactory = functionBody(main, "function commercePaymentEvidenceTransportFor(");
    expect(transportFactory).toMatch(/new m\.CommerceNostr\.RealPaymentEvidenceTransport\(/);
    // The lower-level wire transport would skip
    // `buildOutboundPaymentEvidenceSyncPayload()`'s authority re-check.
    expect(main).not.toMatch(/new m\.CommerceNostr\.RealCommercePrivatePaymentEvidenceTransport\(/);
    // This file must never construct a payment-evidence wire payload itself.
    expect(main).not.toMatch(/"private-payment-evidence-sync"/);
  });

  it("5. INBOUND: acceptance is one-directional -- only the order's own SELLER may adopt inbound payment evidence, and only from that order's own buyer", () => {
    const main = stripComments(read(MAIN_PATH));
    const body = functionBody(main, "function commercePaymentEvidenceExpectationFor(");
    // This process must BE the seller...
    expect(body).toMatch(/ownPubkeyHex !== localOrder\.sellerPubkey/);
    // ...and the only trusted sender is that order's own buyer.
    expect(body).toMatch(/expectedCounterpartyPubkeyHex: localOrder\.buyerPubkey/);
    // Order/amount/currency expectations come from local state only.
    expect(body).toMatch(/expectedOrderId: localOrder\.id/);
    expect(body).toMatch(/expectedAmountCents: localOrder\.unitPriceCents \* localOrder\.quantity/);
    expect(body).toMatch(/expectedCurrency: localOrder\.currency/);
    // Provider identity is pinned to this build's one real rail.
    expect(body).toMatch(/expectedProviderIdentity: requireModules\(\)\.Commerce\.TEST_SIMULATOR_NAME/);
  });

  it("6. INBOUND: the Order is moved to paid ONLY via Agent P's receiver gate AND only on a genuine ledger transition -- never on a no_op, never on a rejection, never straight from the wire", () => {
    const main = stripComments(read(MAIN_PATH));
    const body = functionBody(main, "function applyInboundPrivatePaymentEvidenceNonFatal(");

    // Only a cryptographically-decrypted envelope is considered at all.
    expect(body).toMatch(/envelope\.outcome !== "decrypted"/);
    // Standing check comes before anything else touches the ledger.
    const expectationCall = body.indexOf("commercePaymentEvidenceExpectationFor(");
    const portCall = body.indexOf("applyInboundPaymentEvidenceSync(");
    const orderApply = body.indexOf("applyOrderAction(");
    expect(expectationCall).toBeGreaterThanOrEqual(0);
    expect(portCall).toBeGreaterThan(expectationCall);
    expect(body).toMatch(/if \(expectation === null \|\| localOrder === undefined\) return;/);

    // Extra receiver check beyond the Port's own six.
    expect(body).toMatch(/envelope\.payload\.productId !== localOrder\.productId/);

    // The Order transition is gated on a REAL ledger transition and comes
    // strictly after the Port's verdict.
    expect(body).toMatch(/if \(!applied\.accepted\)/);
    expect(body).toMatch(/if \(applied\.result\.outcome !== "transitioned"\) return;/);
    expect(orderApply).toBeGreaterThan(portCall);

    // The evidence object handed to the ledger is built by Agent P's Port,
    // never reconstructed here from wire fields.
    expect(body).not.toMatch(/verification:\s*\{/);
    // The settlement binding uses THIS process's own order/product ids.
    expect(body).toMatch(/state\.ledger\.bind\(paymentId, localOrder\.id, localOrder\.productId\)/);
    // ...and only when genuinely unbound, so a paymentId already bound to a
    // different order is left for the state machine to reject.
    expect(body).toMatch(/if \(state\.ledger\.get\(paymentId\) === undefined\)/);
  });

  it("7. `{ kind: \"payment_evidence\" }` remains constructible in exactly two places, both behind a real settlement-ledger verdict", () => {
    const main = stripComments(read(MAIN_PATH));
    const occurrences = main.match(/kind: "payment_evidence"/g) ?? [];
    // One pre-existing (handleCommercePaymentSimulate), one added by the
    // integration phase (the inbound apply above). A third would mean a new
    // unreviewed path to "paid".
    expect(occurrences).toHaveLength(2);
  });

  it("8. inbound payment-evidence discovery runs BEFORE delivery discovery at every refresh point (a delivery event's own reconciliation depends on payment having landed first)", () => {
    const main = stripComments(read(MAIN_PATH));
    const paymentCalls = [...main.matchAll(/await commercePrivatePaymentEvidenceDiscoverAndApplyNonFatal\(\);/g)];
    const deliveryCalls = [...main.matchAll(/await commercePrivateDeliveryDiscoverAndApplyNonFatal\(\);/g)];
    // Orders-list-mine, orders-list-incoming, delivery-status, acknowledge-receipt.
    expect(paymentCalls).toHaveLength(4);
    expect(deliveryCalls).toHaveLength(4);
    for (let i = 0; i < paymentCalls.length; i += 1) {
      expect(paymentCalls[i]!.index!).toBeLessThan(deliveryCalls[i]!.index!);
    }
  });
});

describe("Purchase Completion integration -- honest cross-process sync reporting (Agent U's vocabulary, extended for Agents P and D)", () => {
  it("9. all three channels have their OWN note element, so one channel's result can never overwrite and hide another's", () => {
    const page = read(PAGE_PATH);
    expect(page).toContain('id="commerce-order-sync-note"');
    expect(page).toContain('id="commerce-order-payment-sync-note"');
    expect(page).toContain('id="commerce-order-delivery-sync-note"');
  });

  it("10. the renderer renders each channel into its own element with its own channel tag", () => {
    const renderer = stripComments(read(RENDERER_PATH));
    expect(renderer).toMatch(/renderCommerceSyncOutcomeNote\("commerce-order-payment-sync-note", result\.paymentSyncOutcome, "payment-evidence"\)/);
    expect(renderer).toMatch(/renderCommerceSyncOutcomeNote\("commerce-order-delivery-sync-note", result\.deliverySyncOutcome, "delivery"\)/);
  });

  it("11. Agent D's delivery-sync outcomes are captured rather than discarded (they were fire-and-forget before the integration phase)", () => {
    const main = stripComments(read(MAIN_PATH));
    const sends = [...main.matchAll(/sendPrivateDeliverySyncNonFatal\(/g)];
    // One declaration + three real call sites (fulfill, acknowledge, complete).
    expect(sends.length).toBeGreaterThanOrEqual(4);
    expect(main).toMatch(/deliverySyncOutcome = await sendPrivateDeliverySyncNonFatal\(started\.delivery, "fulfilling"/);
    expect(main).toMatch(/const deliverySyncOutcome = await sendPrivateDeliverySyncNonFatal\(deliveryResult\.delivery, "recipient_acknowledged"/);
    // Every real delivery send's result is now bound to something.
    expect(main).not.toMatch(/\n\s*await sendPrivateDeliverySyncNonFatal\(/);
  });

  it("12. the payment channel's security refusal is reported as its own outcome, never flattened into a generic network error", () => {
    const main = stripComments(read(MAIN_PATH));
    const body = functionBody(main, "async function sendPrivatePaymentEvidenceSyncNonFatal(");
    expect(body).toMatch(/return "evidence-not-transportable"/);
    // ...and the renderer has honest, distinct copy for it that does not
    // describe a security refusal as a connectivity problem.
    const renderer = stripComments(read(RENDERER_PATH));
    expect(renderer).toMatch(/"evidence-not-transportable":/);
    const copy = renderer.slice(renderer.indexOf('"evidence-not-transportable":'));
    expect(copy.slice(0, 200)).toMatch(/Not sent/);
    expect(copy.slice(0, 200)).not.toMatch(/Couldn't reach/);
  });

  it("13. an arbitrary transport-supplied message is still never echoed verbatim into the DOM, on ANY channel", () => {
    const renderer = stripComments(read(RENDERER_PATH));
    const body = functionBody(renderer, "function describeCommerceSyncOutcome(");
    // Lookup-with-constant-fallback, never a passthrough of `outcome`.
    expect(body).toMatch(/COMMERCE_SYNC_OUTCOME_TEXT\[outcome\] \?\?/);
    expect(body).not.toMatch(/\$\{outcome\}/);
  });
});

describe("Purchase Completion integration -- Agent R's receipt auto-restore composes with Agent U's order-open flow", () => {
  it("14. openCommerceOrderScreen performs BOTH agents' resets and BOTH agents' fetches, with no per-order state leaking between orders", () => {
    const renderer = stripComments(read(RENDERER_PATH));
    const body = functionBody(renderer, "function openCommerceOrderScreen(");
    // Agent R's receipt panel reset + Agent U's sync-note resets.
    expect(body).toMatch(/byId\("commerce-order-receipt-result"\)\.setAttribute\("hidden", ""\)/);
    expect(body).toMatch(/byId\("commerce-order-sync-note"\)\.textContent = ""/);
    // Coordinator: the two added channels reset for the identical reason.
    expect(body).toMatch(/byId\("commerce-order-payment-sync-note"\)\.textContent = ""/);
    expect(body).toMatch(/byId\("commerce-order-delivery-sync-note"\)\.textContent = ""/);
    // Both agents' on-open fetches survive the merge.
    expect(body).toMatch(/void refreshCommerceDeliveryStatus\(\)/);
    expect(body).toMatch(/void refreshCommerceReceiptStatus\(\)/);
  });

  it("15. Agent R's auto-restore stays strictly read-only -- it never mints a receipt for an order that was never issued one", () => {
    const renderer = stripComments(read(RENDERER_PATH));
    const body = functionBody(renderer, "async function refreshCommerceReceiptStatus(");
    expect(body).toMatch(/commerceReceiptLookup\(orderId\)/);
    expect(body).not.toMatch(/commerceReceiptIssue\(/);
    // Guards against a stale response landing after navigating away.
    expect(body).toMatch(/currentCommerceOrder\.id !== orderId/);
  });
});
