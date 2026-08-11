import { describe, it, expect } from "vitest";
import {
  createRuntime,
  selectNotificationBridge,
  resolveNotificationDefaultChannel,
} from "../src/os/_legacy_prototype/runtime/create_runtime.js";
import type { RuntimeEnv } from "../src/os/_legacy_prototype/runtime/types.js";
import {
  NoopNotificationBridge,
  PlaceholderNotificationBridge,
} from "../src/notification/noop_notification.js";
import type { NotificationBridge } from "../src/notification/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

describe("Stage 42 — Notification runtime env selection", () => {
  it("1. no env -> NoopNotificationBridge", () => {
    expect(selectNotificationBridge()).toBeInstanceOf(NoopNotificationBridge);
    expect(createRuntime().notificationBridge).toBeInstanceOf(NoopNotificationBridge);
  });

  it("2. NOTIFICATION_PROVIDER=noop -> NoopNotificationBridge", () => {
    const env: RuntimeEnv = { NOTIFICATION_PROVIDER: "noop" };
    expect(selectNotificationBridge(env)).toBeInstanceOf(NoopNotificationBridge);
    expect(createRuntime(env).notificationBridge).toBeInstanceOf(NoopNotificationBridge);
  });

  it("3. NOTIFICATION_PROVIDER=placeholder -> PlaceholderNotificationBridge", () => {
    const env: RuntimeEnv = { NOTIFICATION_PROVIDER: "placeholder" };
    expect(selectNotificationBridge(env)).toBeInstanceOf(PlaceholderNotificationBridge);
    expect(createRuntime(env).notificationBridge).toBeInstanceOf(PlaceholderNotificationBridge);
  });

  it("4. ENABLE_NOTIFICATION_PLACEHOLDER truthy -> PlaceholderNotificationBridge", () => {
    for (const flag of ["true", "1", "yes", "on", true] as const) {
      const env: RuntimeEnv = { ENABLE_NOTIFICATION_PLACEHOLDER: flag };
      expect(selectNotificationBridge(env)).toBeInstanceOf(PlaceholderNotificationBridge);
    }
    // Falsy values must not opt in.
    for (const flag of ["false", "0", "no", "off", false] as const) {
      const env: RuntimeEnv = { ENABLE_NOTIFICATION_PLACEHOLDER: flag };
      expect(selectNotificationBridge(env)).toBeInstanceOf(NoopNotificationBridge);
    }
  });

  it("5. invalid / unknown NOTIFICATION_PROVIDER -> NoopNotificationBridge", () => {
    for (const provider of ["telegram", "fcm", "apns", "", "PLACEHOLDER", "Noop"]) {
      const env: RuntimeEnv = { NOTIFICATION_PROVIDER: provider };
      expect(selectNotificationBridge(env)).toBeInstanceOf(NoopNotificationBridge);
    }
  });

  it("6. invalid NOTIFICATION_DEFAULT_CHANNEL is silently ignored", () => {
    // Bad channel names return undefined.
    expect(resolveNotificationDefaultChannel({ NOTIFICATION_DEFAULT_CHANNEL: "bad" })).toBeUndefined();
    expect(resolveNotificationDefaultChannel({ NOTIFICATION_DEFAULT_CHANNEL: "telegram" })).toBeUndefined();
    expect(resolveNotificationDefaultChannel({ NOTIFICATION_DEFAULT_CHANNEL: "fcm" })).toBeUndefined();
    expect(resolveNotificationDefaultChannel({})).toBeUndefined();
    expect(resolveNotificationDefaultChannel()).toBeUndefined();
    // Valid channel names are returned.
    expect(resolveNotificationDefaultChannel({ NOTIFICATION_DEFAULT_CHANNEL: "telegram_placeholder" })).toBe("telegram_placeholder");
    expect(resolveNotificationDefaultChannel({ NOTIFICATION_DEFAULT_CHANNEL: "line_placeholder" })).toBe("line_placeholder");
    expect(resolveNotificationDefaultChannel({ NOTIFICATION_DEFAULT_CHANNEL: "apns_placeholder" })).toBe("apns_placeholder");
    expect(resolveNotificationDefaultChannel({ NOTIFICATION_DEFAULT_CHANNEL: "fcm_placeholder" })).toBe("fcm_placeholder");
    expect(resolveNotificationDefaultChannel({ NOTIFICATION_DEFAULT_CHANNEL: "email_placeholder" })).toBe("email_placeholder");
    expect(resolveNotificationDefaultChannel({ NOTIFICATION_DEFAULT_CHANNEL: "local_placeholder" })).toBe("local_placeholder");
    // An invalid channel alongside a valid provider still selects the bridge normally.
    const env: RuntimeEnv = {
      NOTIFICATION_PROVIDER: "placeholder",
      NOTIFICATION_DEFAULT_CHANNEL: "bad_channel",
    };
    expect(selectNotificationBridge(env)).toBeInstanceOf(PlaceholderNotificationBridge);
  });

  it("7. overrides.notificationBridge wins over env", () => {
    const stub = new NoopNotificationBridge();
    const envPlaceholder: RuntimeEnv = { NOTIFICATION_PROVIDER: "placeholder" };
    // Override wins even when env would select Placeholder.
    expect(selectNotificationBridge(envPlaceholder, { notificationBridge: stub })).toBe(stub);
    const rt = createRuntime(envPlaceholder, { notificationBridge: stub });
    expect(rt.notificationBridge).toBe(stub);
    // Override wins when env is empty.
    expect(selectNotificationBridge(undefined, { notificationBridge: stub })).toBe(stub);
  });

  it("8. createRuntime does not call notify()", async () => {
    let notifyCalls = 0;
    const spy: NotificationBridge = {
      getStatus: () => ({ allowed: false, state: "unavailable", reason: "" }),
      getCapabilities: () => [],
      notify: async () => {
        notifyCalls += 1;
        return { allowed: false, state: "unavailable", reason: "" };
      },
    };
    const rt = createRuntime(undefined, { notificationBridge: spy });
    expect(rt.notificationBridge).toBe(spy);
    expect(notifyCalls).toBe(0);
  });

  it("9. createRuntime does not call fetch/send (notification bridge is selection only)", () => {
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
      NOTIFICATION_PROVIDER: "placeholder",
      fetch: fakeFetch,
    };
    createRuntime(env);
    expect(fetchCalls).toBe(0);
    // Selecting a bridge also issues no fetch.
    selectNotificationBridge(env);
    expect(fetchCalls).toBe(0);
  });

  it("10. Worker source has no notify() auto-call", () => {
    expect(workerSource).not.toMatch(/\.notify\s*\(/);
  });

  it("11. Worker source imports no Telegram/LINE/APNs/FCM/Email transports", () => {
    // Whitelist: only the placeholder channel *names* may appear as strings.
    // No real transport import should be present.
    expect(workerSource).not.toMatch(/from\s+['"].*telegram/i);
    expect(workerSource).not.toMatch(/from\s+['"].*line[-_]api/i);
    expect(workerSource).not.toMatch(/from\s+['"].*apns/i);
    expect(workerSource).not.toMatch(/from\s+['"].*firebase/i);
    expect(workerSource).not.toMatch(/from\s+['"].*fcm/i);
    expect(workerSource).not.toMatch(/from\s+['"].*nodemailer/i);
    // No Bot API, Push API, or send call.
    expect(workerSource).not.toMatch(/bot[_-]?api/i);
    expect(workerSource).not.toMatch(/push[_-]?api/i);
  });

  it("12. input env is not mutated by selectNotificationBridge or createRuntime", () => {
    const env: RuntimeEnv = {
      NOTIFICATION_PROVIDER: "placeholder",
      ENABLE_NOTIFICATION_PLACEHOLDER: "true",
      NOTIFICATION_DEFAULT_CHANNEL: "telegram_placeholder",
    };
    const before = { ...env };
    const beforeKeys = Object.keys(env).sort();
    selectNotificationBridge(env);
    createRuntime(env);
    resolveNotificationDefaultChannel(env);
    expect(Object.keys(env).sort()).toEqual(beforeKeys);
    for (const key of beforeKeys) {
      expect(env[key as keyof RuntimeEnv]).toBe(before[key as keyof RuntimeEnv]);
    }
  });
});
