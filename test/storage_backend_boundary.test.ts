import { describe, it, expect } from "vitest";
import {
  NoopStorageBackend,
  PlaceholderStorageBackend,
} from "../src/os/core/storage/noop_storage.js";
import {
  isSensitiveStorageValue,
  looksLikeUrlOrPath,
  reviewStoragePacket,
} from "../src/os/core/storage/policy.js";
import type { StoragePacket, StorageRef } from "../src/os/core/storage/types.js";
import { STORAGE_BACKEND_KINDS } from "../src/os/core/storage/types.js";
// Source-level checks: prove no real backend import and no runtime/worker auto-wire.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storageTypesSource from "../src/os/core/storage/types.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import storagePolicySource from "../src/os/core/storage/policy.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import noopStorageSource from "../src/os/core/storage/noop_storage.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import runtimeSource from "../src/os/_legacy_prototype/runtime/create_runtime.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/os/_legacy_prototype/worker.ts?raw";

const storageSources = [storageTypesSource, storagePolicySource, noopStorageSource].join("\n");

const cleanPacket: StoragePacket = {
  idRef: "packet-label-1",
  backendKind: "external_placeholder",
  visibility: "unlisted",
  createdAt: 1000,
  metadata: { note: "sample", size: "small" },
};

const cleanRef: StorageRef = { idRef: "packet-label-1", backendKind: "external_placeholder" };

describe("NoopStorageBackend", () => {
  it("1. is always unavailable / denies every attempt", async () => {
    const backend = new NoopStorageBackend();
    expect(backend.getStatus().allowed).toBe(false);
    expect(backend.getStatus().state).toBe("unavailable");

    const put = await backend.put(cleanPacket);
    expect(put.allowed).toBe(false);
    expect(put.state).toBe("unavailable");

    const get = await backend.get(cleanRef);
    expect(get.allowed).toBe(false);
    expect(get.state).toBe("unavailable");
    expect(get.ref).toBeUndefined();

    const del = await backend.delete(cleanRef);
    expect(del.allowed).toBe(false);
    expect(del.state).toBe("unavailable");
  });
});

describe("PlaceholderStorageBackend", () => {
  it("2. accepts a policy-clean packet as accepted_placeholder (nothing stored)", async () => {
    const backend = new PlaceholderStorageBackend();
    expect(backend.getStatus().allowed).toBe(true);

    const decision = await backend.put(cleanPacket);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("3. rejects a packet with sensitive metadata", async () => {
    const backend = new PlaceholderStorageBackend();
    const decision = await backend.put({
      ...cleanPacket,
      metadata: { authToken: "abc", note: "keep" },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("rejected");
  });

  it("4. get always resolves unavailable (nothing was ever stored)", async () => {
    const backend = new PlaceholderStorageBackend();
    await backend.put(cleanPacket);
    const decision = await backend.get(cleanRef);
    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe("unavailable");
    expect(decision.ref).toBeUndefined();
  });

  it("5. delete is a safe no-op that always succeeds", async () => {
    const backend = new PlaceholderStorageBackend();
    const decision = await backend.delete(cleanRef);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });
});

describe("storage placeholder policy", () => {
  it("6. a clean packet is accepted_placeholder", () => {
    const decision = reviewStoragePacket(cleanPacket);
    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe("accepted_placeholder");
  });

  it("7. secret/key/seed/token/payment/entitlement/dm/body/content/message metadata is rejected", () => {
    const markers = [
      "secret",
      "key",
      "seed",
      "token",
      "payment",
      "entitlement",
      "dm",
      "body",
      "content",
      "message",
    ];
    for (const marker of markers) {
      const decision = reviewStoragePacket({
        ...cleanPacket,
        metadata: { [marker]: "x" },
      });
      expect(decision.allowed).toBe(false);
      expect(decision.state).toBe("rejected");

      const valueDecision = reviewStoragePacket({
        ...cleanPacket,
        metadata: { note: `has ${marker} inside` },
      });
      expect(valueDecision.allowed).toBe(false);
    }
  });

  it("8. a URL or file-path-shaped idRef is rejected", () => {
    const urls = [
      "https://drive.google.com/file/d/abc",
      "http://example.com/x",
      "/etc/passwd",
      "\\\\server\\share",
      "C:\\Users\\x\\file.txt",
    ];
    for (const idRef of urls) {
      const decision = reviewStoragePacket({ ...cleanPacket, idRef });
      expect(decision.allowed).toBe(false);
      expect(decision.state).toBe("rejected");
    }
  });

  it("9. an opaque idRef label is accepted", () => {
    expect(looksLikeUrlOrPath("opaque-label-123")).toBe(false);
    expect(looksLikeUrlOrPath("https://x.com")).toBe(true);
    expect(isSensitiveStorageValue("a bearer secret")).toBe(true);
    expect(isSensitiveStorageValue("opaque-label-123")).toBe(false);
  });

  it("10. does not mutate its input", () => {
    const dirty: StoragePacket = {
      ...cleanPacket,
      metadata: { authToken: "abc", note: "keep" },
    };
    const snapshot = JSON.stringify(dirty);
    reviewStoragePacket(dirty);
    expect(JSON.stringify(dirty)).toBe(snapshot);
  });

  it("11. never throws", async () => {
    const backend = new PlaceholderStorageBackend();
    await expect(backend.put(cleanPacket)).resolves.toBeDefined();
    await expect(backend.get(cleanRef)).resolves.toBeDefined();
    await expect(backend.delete(cleanRef)).resolves.toBeDefined();
    expect(() => reviewStoragePacket(cleanPacket)).not.toThrow();
  });
});

describe("storage packet/ref never carry stored bytes", () => {
  it("12. StoragePacket/StorageRef/StorageDecision shapes carry no bytes/body/content field", () => {
    expect(Object.keys(cleanPacket)).not.toContain("bytes");
    expect(Object.keys(cleanPacket)).not.toContain("body");
    expect(Object.keys(cleanPacket)).not.toContain("content");
    expect(Object.keys(cleanRef)).not.toContain("bytes");
    // The type source itself declares no such FIELD anywhere (prose comments
    // are free to discuss "bytes"/"body"/"content" as concepts to avoid —
    // only an actual `readonly bytes?:`-shaped property declaration matters).
    expect(storageTypesSource).not.toMatch(/readonly\s+bytes\s*[?:]/);
    expect(storageTypesSource).not.toMatch(/readonly\s+body\s*[?:]/);
    expect(storageTypesSource).not.toMatch(/readonly\s+content\s*[?:]/);
    expect(storageTypesSource).not.toMatch(/\bplaintext\s*[?:]/);
    expect(storageTypesSource).not.toMatch(/\bciphertext\s*[?:]/);
  });

  it("13. every backend kind is a placeholder label", () => {
    for (const kind of STORAGE_BACKEND_KINDS) {
      expect(kind).toMatch(/_placeholder$/);
    }
  });
});

describe("storage boundary stays unwired and free of real backends", () => {
  it("14. imports no Google Drive / Nostr WebSocket / SQLite / Bluetooth / Wi-Fi / IPFS client", () => {
    const importLines = storageSources
      .split("\n")
      .filter((line: string) => /^\s*import\b/.test(line));
    const denylist = [
      "googleapis",
      "google-auth",
      "google.colab",
      "colab",
      "from \"ws\"",
      "from 'ws'",
      "websocket",
      "sqlite",
      "better-sqlite3",
      "bluetooth",
      "noble-bluetooth",
      "ipfs",
      "kubo",
      "node:http",
      "node:https",
      "node:fs",
      "node:net",
    ];
    for (const line of importLines) {
      for (const banned of denylist) {
        expect(line.toLowerCase()).not.toContain(banned);
      }
    }
  });

  it("15. issues no fetch/file IO and opens no socket/relay/gateway", () => {
    // `drive.google.com` legitimately appears inside policy.ts as a
    // URL-shape guard string (see `looksLikeUrlOrPath`) — never as a call
    // target. The real invariant checked here is: no fetch, no WebSocket,
    // no file IO.
    expect(storageSources).not.toMatch(/\bfetch\s*\(/);
    expect(storageSources).not.toMatch(/\bnew\s+WebSocket\s*\(/);
    expect(storageSources).not.toMatch(/\breadFile|writeFile|readFileSync|writeFileSync\b/);
    expect(storageSources).not.toMatch(/api\.telegram|ipfs\.io/i);
  });

  it("16. Runtime source SELECTS a StorageBackend (Stage 109) but never calls put/get/delete", () => {
    // Stage 109: createRuntime now SELECTS a StorageBackend from env, so the
    // runtime source IS allowed to reference storage imports/selection helpers.
    // The invariant is that put()/get()/delete() are NEVER called automatically.
    expect(runtimeSource).toMatch(/from\s+['"].*storage\//);
    expect(runtimeSource).not.toMatch(/\.\s*(put|get|delete)\s*\(\s*(packet|ref)/);
  });

  it("17. Worker source exposes storage env fields (Stage 109) but never calls put/get/delete", () => {
    // Stage 109: the Worker Env interface now includes STORAGE_PROVIDER/
    // ENABLE_STORAGE_PLACEHOLDER fields, so the worker source IS allowed to
    // reference storage-related strings. The invariant is that put()/get()/
    // delete() are NEVER called automatically, and the Worker never
    // constructs a backend directly itself.
    expect(workerSource).not.toMatch(/runtime\.storageBackend\s*\.\s*(put|get|delete)\s*\(/);
    expect(workerSource).not.toMatch(/new\s+(Noop|Placeholder)StorageBackend/);
  });

  it("18. storage boundary does not import any crypto provider", () => {
    expect(storageSources).not.toMatch(/from\s+['"].*crypto\//);
    expect(storageSources).not.toMatch(/CryptoProvider/);
    expect(storageSources).not.toMatch(/encrypt|decrypt/i);
  });
});
