import { describe, it, expect } from "vitest";
import {
  createRuntime,
  selectPaymentProvider,
  resolvePaymentDefaultRail,
} from "../src/runtime/create_runtime.js";
import type { RuntimeEnv } from "../src/runtime/types.js";
import { NoopPaymentProvider, PlaceholderPaymentProvider } from "../src/payment/noop_payment.js";
import type { PaymentDecision, PaymentProvider, PaymentRequest } from "../src/payment/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeTypesSource from "../src/runtime/types.ts?raw";

const runtimeSources = [runtimeSource, runtimeTypesSource].join("\n");

describe("Stage 46 — Payment provider runtime env selection", () => {
  it("1. no env -> NoopPaymentProvider", () => {
    expect(selectPaymentProvider()).toBeInstanceOf(NoopPaymentProvider);
    expect(createRuntime().paymentProvider).toBeInstanceOf(NoopPaymentProvider);
  });

  it("2. PAYMENT_PROVIDER=noop -> NoopPaymentProvider", () => {
    const env: RuntimeEnv = { PAYMENT_PROVIDER: "noop" };
    expect(selectPaymentProvider(env)).toBeInstanceOf(NoopPaymentProvider);
    expect(createRuntime(env).paymentProvider).toBeInstanceOf(NoopPaymentProvider);
  });

  it("3. PAYMENT_PROVIDER=placeholder -> PlaceholderPaymentProvider", () => {
    const env: RuntimeEnv = { PAYMENT_PROVIDER: "placeholder" };
    expect(selectPaymentProvider(env)).toBeInstanceOf(PlaceholderPaymentProvider);
    expect(createRuntime(env).paymentProvider).toBeInstanceOf(PlaceholderPaymentProvider);
  });

  it("4. ENABLE_PAYMENT_PLACEHOLDER truthy -> PlaceholderPaymentProvider", () => {
    for (const flag of ["true", "1", "yes", "on", true] as const) {
      const env: RuntimeEnv = { ENABLE_PAYMENT_PLACEHOLDER: flag };
      expect(selectPaymentProvider(env)).toBeInstanceOf(PlaceholderPaymentProvider);
    }
    // Falsy values must not opt in.
    for (const flag of ["false", "0", "no", "off", false] as const) {
      const env: RuntimeEnv = { ENABLE_PAYMENT_PLACEHOLDER: flag };
      expect(selectPaymentProvider(env)).toBeInstanceOf(NoopPaymentProvider);
    }
  });

  it("5. invalid / unknown PAYMENT_PROVIDER -> NoopPaymentProvider", () => {
    for (const provider of ["stripe", "lightning", "", "PLACEHOLDER", "Noop"]) {
      const env: RuntimeEnv = { PAYMENT_PROVIDER: provider };
      expect(selectPaymentProvider(env)).toBeInstanceOf(NoopPaymentProvider);
    }
  });

  it("6. invalid PAYMENT_DEFAULT_RAIL is silently ignored", () => {
    expect(resolvePaymentDefaultRail({ PAYMENT_DEFAULT_RAIL: "bitcoin" })).toBeUndefined();
    expect(resolvePaymentDefaultRail({ PAYMENT_DEFAULT_RAIL: "lightning" })).toBeUndefined();
    expect(resolvePaymentDefaultRail({ PAYMENT_DEFAULT_RAIL: "" })).toBeUndefined();
    expect(resolvePaymentDefaultRail({})).toBeUndefined();
    expect(resolvePaymentDefaultRail()).toBeUndefined();
  });

  it("7. valid PAYMENT_DEFAULT_RAIL is accepted", () => {
    for (const rail of [
      "lightning_placeholder",
      "stripe_placeholder",
      "apple_pay_placeholder",
      "google_pay_placeholder",
      "manual_placeholder",
      "external_placeholder",
    ] as const) {
      expect(resolvePaymentDefaultRail({ PAYMENT_DEFAULT_RAIL: rail })).toBe(rail);
    }
    // An invalid rail alongside a valid provider still selects the provider normally.
    const env: RuntimeEnv = {
      PAYMENT_PROVIDER: "placeholder",
      PAYMENT_DEFAULT_RAIL: "bad_rail",
    };
    expect(selectPaymentProvider(env)).toBeInstanceOf(PlaceholderPaymentProvider);
    expect(resolvePaymentDefaultRail(env)).toBeUndefined();
  });

  it("8. overrides.paymentProvider wins over env", () => {
    const stub = new NoopPaymentProvider();
    const envPlaceholder: RuntimeEnv = { PAYMENT_PROVIDER: "placeholder" };
    expect(selectPaymentProvider(envPlaceholder, { paymentProvider: stub })).toBe(stub);
    const rt = createRuntime(envPlaceholder, { paymentProvider: stub });
    expect(rt.paymentProvider).toBe(stub);
    expect(selectPaymentProvider(undefined, { paymentProvider: stub })).toBe(stub);
  });

  it("9. createRuntime does not call requestPayment()", () => {
    let requestPaymentCalls = 0;
    const spy: PaymentProvider = {
      getStatus: () => ({ available: false, reason: "" }),
      getCapabilities: () => [],
      requestPayment: async (request: PaymentRequest): Promise<PaymentDecision> => {
        requestPaymentCalls += 1;
        return {
          allowed: false,
          status: "unavailable",
          rail: request.rail,
          reason: "",
          productId: request.productId,
        };
      },
    };
    const rt = createRuntime(undefined, { paymentProvider: spy });
    expect(rt.paymentProvider).toBe(spy);
    expect(requestPaymentCalls).toBe(0);
  });

  it("10. createRuntime does not call fetch/send (payment provider is selection only)", () => {
    let fetchCalls = 0;
    const fakeFetch = (() => {
      fetchCalls += 1;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    }) as unknown as RuntimeEnv["fetch"];
    const env: RuntimeEnv = {
      PAYMENT_PROVIDER: "placeholder",
      fetch: fakeFetch,
    };
    createRuntime(env);
    expect(fetchCalls).toBe(0);
    selectPaymentProvider(env);
    expect(fetchCalls).toBe(0);
  });

  it("11. Worker source has no requestPayment auto-call outside the purchase preview path", () => {
    // The Stage 45 purchase preview legitimately calls `.requestPayment(` once,
    // via a freshly-constructed PlaceholderPaymentProvider — never through
    // runtime.paymentProvider (selection only, Stage 46).
    const calls = workerSource.match(/\.requestPayment\s*\(/g) ?? [];
    expect(calls.length).toBeLessThanOrEqual(1);
    expect(workerSource).not.toMatch(/runtime\.paymentProvider\s*\.\s*requestPayment/);
  });

  it("12. Worker source has no paymentDecisionToGrant call", () => {
    expect(workerSource).not.toMatch(/paymentDecisionToGrant\s*\(/);
  });

  it("13. imports no Lightning/Stripe/Breez/Greenlight library in the runtime sources", () => {
    const importLines = runtimeSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = [
      "breez",
      "greenlight",
      "lightning",
      "lnd",
      "lnurl",
      "bolt11",
      "stripe",
      "apple-pay",
      "applepay",
      "google-pay",
      "googlepay",
      "braintree",
      "paypal",
    ];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it("14. input env is not mutated by selectPaymentProvider or createRuntime", () => {
    const env: RuntimeEnv = {
      PAYMENT_PROVIDER: "placeholder",
      ENABLE_PAYMENT_PLACEHOLDER: "true",
      PAYMENT_DEFAULT_RAIL: "lightning_placeholder",
    };
    const before = { ...env };
    const beforeKeys = Object.keys(env).sort();
    selectPaymentProvider(env);
    createRuntime(env);
    resolvePaymentDefaultRail(env);
    expect(Object.keys(env).sort()).toEqual(beforeKeys);
    for (const key of beforeKeys) {
      expect(env[key as keyof RuntimeEnv]).toBe(before[key as keyof RuntimeEnv]);
    }
  });
});
