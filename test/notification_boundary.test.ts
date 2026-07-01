import { describe, it, expect } from "vitest";
import {
  NoopNotificationBridge,
  PlaceholderNotificationBridge,
} from "../src/notification/noop_notification.js";
import {
  canSendNotification,
  isSensitiveNotificationField,
  sanitizeNotificationPayload,
} from "../src/notification/policy.js";
import {
  chatEventToNotification,
  productEventToNotification,
  spaceEventToNotification,
} from "../src/notification/bridge.js";
import type { NotificationPayload } from "../src/notification/types.js";
import type { ChatMessage, ChatRoom } from "../src/chat/types.js";
import type { NostrEvent } from "../src/nostr/types.js";
import { SAMPLE_SPACES } from "../src/community/sample_spaces.js";
import { SAMPLE_PRODUCTS } from "../src/commerce/sample_products.js";
// Notification sources as strings: prove no transport import and no send/fetch call.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import notificationTypesSource from "../src/notification/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import notificationPolicySource from "../src/notification/policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopNotificationSource from "../src/notification/noop_notification.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import notificationBridgeSource from "../src/notification/bridge.ts?raw";
// Runtime / Worker sources: prove the notification layer is NOT auto-wired.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

const notificationSources = [
  notificationTypesSource,
  notificationPolicySource,
  noopNotificationSource,
  notificationBridgeSource,
].join("\n");

const SECRET_BODY = "TOPSECRET dm body: nsec1privatekey";

const sampleChat: ChatRoom = {
  id: "chat-1",
  kind: "group",
  visibility: "public",
  postPolicy: "open",
  participants: [],
  admins: [],
};

const sampleEvent: NostrEvent = {
  id: "event-1",
  pubkey: "aa".repeat(32),
  created_at: 1000,
  kind: 1,
  tags: [],
  content: "CONFIDENTIAL space post body that must never appear",
  sig: "bb".repeat(64),
};

const sampleMessage: ChatMessage = {
  id: "msg-1",
  chatId: "chat-1",
  authorPubkey: "cc".repeat(32),
  createdAt: 1000,
  content: SECRET_BODY,
  event: { ...sampleEvent, content: SECRET_BODY },
};

const safePayload: NotificationPayload = {
  kind: "chat_activity",
  channel: "local_placeholder",
  title: "New chat activity",
  bodyPreview: "New chat activity",
  targetRef: "chat-1",
  actorRef: "cc".repeat(32),
  createdAt: 1000,
  metadata: { count: "3" },
};

describe("NoopNotificationBridge", () => {
  it("1. is unavailable and denies every attempt", async () => {
    const bridge = new NoopNotificationBridge();
    expect(bridge.getStatus().state).toBe("unavailable");
    expect(bridge.getStatus().allowed).toBe(false);
    expect(bridge.getCapabilities()).toEqual([]);
    const decision = await bridge.notify(safePayload);
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
  });
});

describe("PlaceholderNotificationBridge", () => {
  it("2. is ready but sends nothing externally (decision only)", async () => {
    const bridge = new PlaceholderNotificationBridge();
    expect(bridge.getStatus().state).toBe("ready");
    for (const cap of bridge.getCapabilities()) {
      expect(cap).toMatch(/_placeholder$/);
    }
    // A clean payload resolves to a decision; nothing is dispatched.
    const decision = await bridge.notify(safePayload);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted");
  });

  it("rejects a sensitive payload without throwing", async () => {
    const bridge = new PlaceholderNotificationBridge();
    const decision = await bridge.notify({
      ...safePayload,
      bodyPreview: SECRET_BODY,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("rejected");
  });
});

describe("safe-notification policy", () => {
  it("3. a safe payload is allowed", () => {
    const decision = canSendNotification(safePayload);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted");
  });

  it("4. DM/message content is denied and sanitized away", () => {
    const withBody: NotificationPayload = {
      ...safePayload,
      metadata: { messageBody: SECRET_BODY, dmContent: "hi" },
    };
    expect(canSendNotification(withBody).allowed).toBe(false);
    // Sanitize drops the sensitive metadata keys entirely.
    const clean = sanitizeNotificationPayload(withBody);
    expect(clean.metadata).toBeUndefined();
    expect(canSendNotification(clean).allowed).toBe(true);
  });

  it("5. secret/key/token/payment fields are denied and sanitized", () => {
    const withSecrets: NotificationPayload = {
      ...safePayload,
      metadata: { authToken: "abc", paymentSecret: "x", seed: "y", ok: "keep" },
    };
    expect(canSendNotification(withSecrets).allowed).toBe(false);
    const clean = sanitizeNotificationPayload(withSecrets);
    // Only the non-sensitive entry survives.
    expect(clean.metadata).toEqual({ ok: "keep" });
    expect(isSensitiveNotificationField("a bearer token")).toBe(true);
    expect(isSensitiveNotificationField("New chat activity")).toBe(false);
  });

  it("9. sanitize removes sensitive metadata and replaces a sensitive title", () => {
    const dirty: NotificationPayload = {
      kind: "system_notice",
      channel: "local_placeholder",
      title: "your seed phrase is ...",
      metadata: { safe: "ok", credential: "leak" },
    };
    const clean = sanitizeNotificationPayload(dirty);
    expect(clean.title).toBe("Notification");
    expect(clean.metadata).toEqual({ safe: "ok" });
  });
});

describe("domain → notification bridge helpers", () => {
  it("6. chatEventToNotification never includes the message content", () => {
    const payload = chatEventToNotification(sampleChat, sampleMessage);
    expect(JSON.stringify(payload)).not.toContain(SECRET_BODY);
    expect(payload.bodyPreview).toBe("New chat activity");
    expect(payload.targetRef).toBe("chat-1");
    expect(payload.actorRef).toBe(sampleMessage.authorPubkey);
    // The produced payload passes the safe policy.
    expect(canSendNotification(payload).allowed).toBe(true);
  });

  it("7. spaceEventToNotification never includes the event content", () => {
    const space = SAMPLE_SPACES[0]!;
    const payload = spaceEventToNotification(space, sampleEvent);
    expect(JSON.stringify(payload)).not.toContain(sampleEvent.content);
    expect(payload.bodyPreview).toBe("New space activity");
    expect(payload.targetRef).toBe(space.id);
    expect(canSendNotification(payload).allowed).toBe(true);
  });

  it("8. productEventToNotification never includes payment/download info", () => {
    const product = SAMPLE_PRODUCTS[0]!;
    const payload = productEventToNotification(product);
    const json = JSON.stringify(payload);
    for (const assetId of product.assetIds) {
      expect(json).not.toContain(assetId);
    }
    expect(payload).not.toHaveProperty("priceCents");
    expect(payload).not.toHaveProperty("currency");
    expect(payload.title).toBe("Product updated");
    expect(payload.targetRef).toBe(product.id);
    expect(canSendNotification(payload).allowed).toBe(true);
  });
});

describe("notification boundary is pure and total", () => {
  it("10. does not mutate its inputs", () => {
    const dirty: NotificationPayload = {
      ...safePayload,
      metadata: { authToken: "abc", ok: "keep" },
    };
    const snapshot = JSON.stringify(dirty);
    canSendNotification(dirty);
    sanitizeNotificationPayload(dirty);
    expect(JSON.stringify(dirty)).toBe(snapshot);

    const chatSnapshot = JSON.stringify(sampleMessage);
    chatEventToNotification(sampleChat, sampleMessage);
    expect(JSON.stringify(sampleMessage)).toBe(chatSnapshot);
  });

  it("11. never throws", async () => {
    const bridge = new PlaceholderNotificationBridge();
    await expect(bridge.notify(safePayload)).resolves.toBeDefined();
    expect(() => canSendNotification(safePayload)).not.toThrow();
    expect(() => sanitizeNotificationPayload(safePayload)).not.toThrow();
    expect(() => chatEventToNotification(sampleChat)).not.toThrow();
  });
});

describe("notification layer stays a boundary and is not auto-wired", () => {
  it("12. Runtime source wires notification bridge selection but never auto-calls notify()", () => {
    // Stage 42: createRuntime now selects a NotificationBridge from env, so the
    // runtime source IS allowed to reference notification imports/selection helpers.
    // The invariant is that notify() is NEVER called automatically.
    expect(runtimeSource).not.toMatch(/\.notify\s*\(/);
    // No Telegram/LINE/APNs/FCM/Email transport imported in the runtime.
    expect(runtimeSource).not.toMatch(/from\s+['"].*telegraf/i);
    expect(runtimeSource).not.toMatch(/from\s+['"].*line[-_]bot/i);
    expect(runtimeSource).not.toMatch(/from\s+['"].*apns/i);
    expect(runtimeSource).not.toMatch(/from\s+['"].*firebase/i);
    expect(runtimeSource).not.toMatch(/from\s+['"].*nodemailer/i);
  });

  it("13. Worker source exposes notification env fields but never auto-calls notify()", () => {
    // Stage 42: the Worker Env interface now includes NOTIFICATION_* fields, so
    // the worker source IS allowed to reference notification-related strings.
    // The invariant is that notify() is NEVER called automatically.
    expect(workerSource).not.toMatch(/\.notify\s*\(/);
    // No Telegram/LINE/APNs/FCM/Email transport imported in the worker.
    expect(workerSource).not.toMatch(/from\s+['"].*telegraf/i);
    expect(workerSource).not.toMatch(/from\s+['"].*line[-_]bot/i);
    expect(workerSource).not.toMatch(/from\s+['"].*apns/i);
    expect(workerSource).not.toMatch(/from\s+['"].*firebase/i);
    expect(workerSource).not.toMatch(/from\s+['"].*nodemailer/i);
  });

  it("14. imports no Telegram / LINE / APNs / FCM / Email transport", () => {
    const importLines = notificationSources
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));
    const denylist = [
      "telegraf",
      "telegram",
      "@line",
      "line-bot",
      "apns",
      "node-apn",
      "fcm",
      "firebase",
      "nodemailer",
      "web-push",
      "node:http",
      "node:https",
    ];
    for (const line of importLines) {
      for (const pkg of denylist) {
        expect(line.toLowerCase()).not.toContain(pkg);
      }
    }
  });

  it("15. issues no fetch and calls no send API", () => {
    expect(notificationSources).not.toMatch(/\bfetch\s*\(/);
    expect(notificationSources).not.toMatch(/\.send\s*\(/);
    expect(notificationSources).not.toMatch(/api\.telegram|line\.me|push\.apple|fcm\.googleapis/i);
  });
});
