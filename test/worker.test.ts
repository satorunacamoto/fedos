import { describe, it, expect } from "vitest";
import worker, { handleRequest, selectCache, selectDirectory } from "../src/worker.js";
// Worker source as a string for a static "no provider/fetch wiring" check.
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";
import { InMemoryEventCache } from "../src/cache/event_cache.js";
import { KvEventCache, type KvLikeNamespace } from "../src/cache/kv_event_cache.js";
import { InMemorySpaceDirectory } from "../src/community/directory.js";
import { D1SpaceDirectory } from "../src/community/d1_directory.js";
import type {
  D1LikeDatabase,
  D1LikePreparedStatement,
} from "../src/indexer/d1_index.js";
import { NoopSignatureVerifier } from "../src/nostr/signature.js";
import { SAMPLE_VAULT_MEMBER } from "../src/community/sample_spaces.js";
import { SAMPLE_PRODUCT_BUYER } from "../src/commerce/sample_products.js";
import { SAMPLE_DM_PARTICIPANT } from "../src/chat/sample_chats.js";
import type {
  RelaySocketEvent,
  RelaySocketEventType,
  RelaySocketLike,
  WebSocketFactory,
} from "../src/nostr/ws_relay.js";
import type { NostrEvent } from "../src/nostr/types.js";
import type {
  AssetCache,
  AssetKey,
  AssetMetadata,
  CachedAsset,
} from "../src/asset/types.js";

const DAMUS = "wss://relay.damus.io";

/** An AssetCache that records every `get` key and returns scripted hits. */
class SpyAssetCache implements AssetCache {
  readonly getKeys: string[] = [];
  #hits: Map<string, CachedAsset>;

  constructor(hits: Record<string, CachedAsset> = {}) {
    this.#hits = new Map(Object.entries(hits));
  }

  async get(key: AssetKey, _now: number): Promise<CachedAsset | undefined> {
    this.getKeys.push(key);
    return this.#hits.get(key);
  }
  async put(): Promise<void> {}
  async has(): Promise<boolean> {
    return false;
  }
  async delete(): Promise<void> {}
  async clear(): Promise<void> {}
}

/** A cached asset with the given metadata and a recognizable byte marker. */
function cachedWith(metadata: AssetMetadata, marker = "UNUSED_BYTES"): CachedAsset {
  return {
    key: "k",
    bytes: new TextEncoder().encode(marker).buffer,
    metadata,
    cachedAt: 0,
  };
}

function sampleEvent(): NostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: "live note from relay",
    sig: "b".repeat(128),
  };
}

/** A scripted socket that answers REQ with the given events then EOSE. */
function scriptedFactory(
  events: NostrEvent[],
  counter?: { calls: number },
): WebSocketFactory {
  return () => {
    if (counter) counter.calls++;
    const listeners: Partial<
      Record<RelaySocketEventType, ((ev: RelaySocketEvent) => void)[]>
    > = {};
    const socket: RelaySocketLike = {
      send(data: string) {
        const m = JSON.parse(data);
        if (m[0] === "REQ") {
          const subId = m[1] as string;
          for (const l of listeners.message ?? []) {
            for (const ev of events) {
              l({ data: JSON.stringify(["EVENT", subId, ev]) });
            }
            l({ data: JSON.stringify(["EOSE", subId]) });
          }
        }
      },
      close() {},
      addEventListener(type, listener) {
        (listeners[type] ??= []).push(listener);
      },
    };
    return socket;
  };
}

describe("worker fetch handler", () => {
  it("returns 200 text/html", async () => {
    const res = await handleRequest(new Request("http://localhost/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  it("serves a full HTML document containing the sample thread", async () => {
    const res = await handleRequest(new Request("http://localhost/"));
    const body = await res.text();
    expect(body.startsWith("<!doctype html>")).toBe(true);
    expect(body).toContain("Welcome to nostr-window");
    // Sample content with HTML chars must arrive escaped, not raw.
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("exposes a default export with a fetch method", async () => {
    const res = await worker.fetch(new Request("http://localhost/"));
    expect(res.status).toBe(200);
  });

  it("reflects ?sort=top in the query status panel", async () => {
    const res = await handleRequest(new Request("http://localhost/?sort=top"));
    const body = await res.text();
    expect(body).toContain("sort=<strong>top</strong>");
  });

  it("falls back to sort=new for an invalid sort param", async () => {
    const res = await handleRequest(new Request("http://localhost/?sort=bogus"));
    const body = await res.text();
    expect(body).toContain("sort=<strong>new</strong>");
  });

  it("escapes the ?q search term in the status panel", async () => {
    const res = await handleRequest(
      new Request("http://localhost/?q=" + encodeURIComponent("<script>")),
    );
    const body = await res.text();
    expect(body).not.toContain("<code><script></code>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("rejects a relay that is not on the allowlist with 400", async () => {
    const res = await handleRequest(
      new Request("http://localhost/?relay=wss://evil.example"),
    );
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Relay not allowed");
    // The disallowed URL is shown escaped, not connected to.
    expect(body).toContain("wss://evil.example");
  });

  it("renders an error page (not a crash) when an allowlisted relay fails", async () => {
    // Inject a factory that fails plus a fresh cache, so no real network is
    // touched and no prior cache entry can mask the failure.
    const failingFactory = () => {
      throw new Error("connection refused");
    };
    const res = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}`),
      failingFactory,
      new InMemoryEventCache(),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Relay connection failed");
  });

  it("sample mode still works when no relay is given", async () => {
    const res = await handleRequest(new Request("http://localhost/"));
    const body = await res.text();
    expect(body).toContain("Sample mode");
    expect(body).toContain("Welcome to nostr-window");
  });
});

describe("worker live relay caching", () => {
  it("misses then hits: the second request does not re-open the socket", async () => {
    const cache = new InMemoryEventCache();
    const counter = { calls: 0 };
    const factory = scriptedFactory([sampleEvent()], counter);

    // Use the Noop verifier so the fake-signature sample event stays visible;
    // this test is about caching, not signature verification.
    const first = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}`),
      factory,
      cache,
      NoopSignatureVerifier,
    );
    const firstBody = await first.text();
    expect(firstBody).toContain("cache=<strong>miss</strong>");
    expect(firstBody).toContain("live note from relay");
    expect(counter.calls).toBe(1);

    const second = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}`),
      factory,
      cache,
      NoopSignatureVerifier,
    );
    const secondBody = await second.text();
    expect(secondBody).toContain("cache=<strong>hit</strong>");
    expect(secondBody).toContain("live note from relay");
    expect(counter.calls).toBe(1); // factory NOT called again
  });

  it("?cache=0 bypasses the cache", async () => {
    const cache = new InMemoryEventCache();
    const counter = { calls: 0 };
    const factory = scriptedFactory([sampleEvent()], counter);

    const res = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}&cache=0`),
      factory,
      cache,
      NoopSignatureVerifier,
    );
    const body = await res.text();
    expect(body).toContain("cache=<strong>bypass</strong>");
    expect(counter.calls).toBe(1);
  });

  it("clamps ?ttl to the maximum", async () => {
    const cache = new InMemoryEventCache();
    const res = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}&ttl=99999`),
      scriptedFactory([sampleEvent()]),
      cache,
      NoopSignatureVerifier,
    );
    const body = await res.text();
    expect(body).toContain("ttl=300s");
  });
});

describe("worker live signature verification", () => {
  const SIGNED_EVENT = {
    id: "54e612edddef0b67e2e46b6cbe0c70368f4cc55a7a4efd774c08066bc74b7f0b",
    pubkey: "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    created_at: 1700000000,
    kind: 1,
    tags: [] as string[][],
    content: "hello nostr — Stage 8 vector",
    sig: "9fafd52912c74d10ea33a981cc4e3d43789add77daaf31ed62b02c2760caa96d9b6393a007ad885810e75239cc87cbc859574fbfbc64d2ea795f1c097bfced59",
  };

  it("enables verification and shows a validly-signed event", async () => {
    const res = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}`),
      scriptedFactory([SIGNED_EVENT]),
      new InMemoryEventCache(),
      // default verifier (Noble) via no 4th arg
    );
    const body = await res.text();
    expect(body).toContain("signature verification: enabled");
    expect(body).toContain("hello nostr");
  });

  it("drops an event whose signature fails verification", async () => {
    const forged = { ...SIGNED_EVENT, content: "forged content" };
    const res = await handleRequest(
      new Request(`http://localhost/?relay=${DAMUS}`),
      scriptedFactory([forged]),
      new InMemoryEventCache(),
    );
    const body = await res.text();
    expect(body).toContain("signature verification: enabled");
    expect(body).not.toContain("forged content");
    expect(body).toContain("No threads to display.");
  });
});

describe("worker space directory routes", () => {
  it("1. sample mode shows the space directory", async () => {
    const body = await (await handleRequest(new Request("http://localhost/"))).text();
    expect(body).toContain('class="space-directory"');
    expect(body).toContain("General");
    expect(body).toContain("Lounge");
  });

  it("2. ?space=general shows only that space's threads", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?space=general"))
    ).text();
    expect(body).toContain('class="space-landing"');
    expect(body).toContain("General community thread.");
    expect(body).not.toContain("Lounge chatter.");
    expect(body).not.toContain("Secret vault note.");
  });

  it("3. ?space=<unknown> renders not-found with the escaped id", async () => {
    const res = await handleRequest(
      new Request("http://localhost/?space=" + encodeURIComponent("<nope>")),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Space not found");
    expect(body).not.toContain("<nope>");
    expect(body).toContain("&lt;nope&gt;");
  });

  it("4. private space denies a guest", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?space=vault"))
    ).text();
    expect(body).toContain("Access denied");
    expect(body).not.toContain("Secret vault note.");
  });

  it("5. private space allows a member via ?actor", async () => {
    const body = await (
      await handleRequest(
        new Request(`http://localhost/?space=vault&actor=${SAMPLE_VAULT_MEMBER}`),
      )
    ).text();
    expect(body).toContain('class="space-landing"');
    expect(body).toContain("Secret vault note.");
  });

  it("6. escapes a malicious ?actor value", async () => {
    const body = await (
      await handleRequest(
        new Request("http://localhost/?actor=" + encodeURIComponent("<script>")),
      )
    ).text();
    expect(body).not.toContain("viewing as <code><script>");
    expect(body).toContain("&lt;script&gt;");
  });
});

describe("worker publish prototype (mock-only)", () => {
  const OWNER = "a".repeat(64); // owner of the sample spaces (can post anywhere)

  it("1. ?space=general&compose=1 shows the publish prototype panel", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?space=general&compose=1"))
    ).text();
    expect(body).toContain('class="publish-prototype"');
    expect(body).toContain("Compose — preview only");
  });

  it("2. an allowed actor with content shows the unsigned event preview", async () => {
    const body = await (
      await handleRequest(
        new Request(
          `http://localhost/?space=general&compose=1&actor=${OWNER}&content=${encodeURIComponent("hello world")}`,
        ),
      )
    ).text();
    expect(body).toContain("Unsigned event preview");
    expect(body).toContain("hello world");
    // No id/sig were produced — this app does not sign.
    expect(body).toContain("<code>id</code>");
    expect(body).toContain("<code>sig</code>");
  });

  it("3. a denied actor shows the denied reason and no preview", async () => {
    // announce is an admins-only channel; the owner can post but a stranger cannot.
    const stranger = "c".repeat(64);
    const body = await (
      await handleRequest(
        new Request(
          `http://localhost/?space=announce&compose=1&actor=${stranger}&content=hi`,
        ),
      )
    ).text();
    expect(body).toContain("publish-denied");
    expect(body).not.toContain("Unsigned event preview");
  });

  it("4. escapes a <script> content value in the preview", async () => {
    const body = await (
      await handleRequest(
        new Request(
          `http://localhost/?space=general&compose=1&actor=${OWNER}&content=${encodeURIComponent("<script>alert(1)</script>")}`,
        ),
      )
    ).text();
    expect(body).not.toContain("<script>alert(1)</script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("5. without ?compose the prototype panel is not shown", async () => {
    const body = await (
      await handleRequest(new Request(`http://localhost/?space=general&actor=${OWNER}`))
    ).text();
    expect(body).not.toContain('class="publish-prototype"');
  });

  it("6. there is no publish endpoint / no POST behavior", async () => {
    // A POST is handled exactly like a GET (read-only render); nothing is sent.
    const res = await handleRequest(
      new Request(`http://localhost/?space=general&compose=1&actor=${OWNER}&content=hi`, {
        method: "POST",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    // Still just the preview; the button is disabled and mock-only.
    expect(body).toContain("mock only");
    expect(body).toContain("disabled");
  });
});

describe("worker cache backend selection", () => {
  class MockKv implements KvLikeNamespace {
    store = new Map<string, string>();
    async get(key: string): Promise<string | null> {
      return this.store.get(key) ?? null;
    }
    async put(): Promise<void> {}
    async delete(): Promise<void> {}
  }

  it("10. uses a KvEventCache when the KV binding is present", () => {
    const cache = selectCache({ NOSTR_EVENT_CACHE: new MockKv() });
    expect(cache).toBeInstanceOf(KvEventCache);
  });

  it("11. falls back to the in-memory cache when no binding is present", () => {
    expect(selectCache()).toBeInstanceOf(InMemoryEventCache);
    expect(selectCache({})).toBeInstanceOf(InMemoryEventCache);
  });

  it("default fetch wires env through to the cache backend", async () => {
    // No relay param -> sample mode -> 200 regardless of backend.
    const res = await worker.fetch(new Request("http://localhost/"), {
      NOSTR_EVENT_CACHE: new MockKv(),
    });
    expect(res.status).toBe(200);
  });
});

describe("worker space directory selection", () => {
  class StubD1 implements D1LikeDatabase {
    prepare(): D1LikePreparedStatement {
      const stmt: D1LikePreparedStatement = {
        bind: () => stmt,
        run: () => Promise.resolve({}),
        all: () => Promise.resolve({ results: [] }),
        first: () => Promise.resolve(null),
      };
      return stmt;
    }
    batch(): Promise<unknown[]> {
      return Promise.resolve([]);
    }
  }

  it("12. uses a D1SpaceDirectory when the D1 binding is present", () => {
    expect(selectDirectory({ NOSTR_SPACE_DB: new StubD1() })).toBeInstanceOf(D1SpaceDirectory);
  });

  it("13. falls back to the in-memory sample directory without a binding", () => {
    expect(selectDirectory()).toBeInstanceOf(InMemorySpaceDirectory);
    expect(selectDirectory({})).toBeInstanceOf(InMemorySpaceDirectory);
  });
});

describe("worker product route (read-only)", () => {
  it("1. ?product=<sample> renders the product page with public previews", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?product=guide-pdf"))
    ).text();
    expect(body).toContain('class="product-page"');
    expect(body).toContain("Field Guide (PDF)");
    // Public + unlisted previews are shown; the paid original is not.
    expect(body).toContain('data-asset="asset-guide-thumb"');
    expect(body).toContain('data-asset="asset-guide-preview"');
    expect(body).not.toContain('data-asset="asset-guide-full"');
  });

  it("2. ?product=<unknown> renders not-found with the escaped id", async () => {
    const res = await handleRequest(
      new Request("http://localhost/?product=" + encodeURIComponent("<nope>")),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Product not found");
    expect(body).not.toContain("<nope>");
    expect(body).toContain("&lt;nope&gt;");
  });

  it("3. a private product denies a guest", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?product=pro-pack"))
    ).text();
    expect(body).toContain("Access denied");
    expect(body).not.toContain('data-asset="asset-pro-preview"');
    expect(body).not.toContain('data-asset="asset-pro-full"');
  });

  it("4. a grant holder may view the private product (previews only)", async () => {
    const body = await (
      await handleRequest(
        new Request(`http://localhost/?product=pro-pack&actor=${SAMPLE_PRODUCT_BUYER}`),
      )
    ).text();
    expect(body).toContain('class="product-page"');
    expect(body).toContain("Pro Pack (ZIP)");
    expect(body).toContain('data-asset="asset-pro-preview"'); // public preview
    expect(body).not.toContain('data-asset="asset-pro-full"'); // paid original hidden
  });

  it("5. escapes a malicious ?actor value on a product page", async () => {
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf&actor=" + encodeURIComponent("<script>")),
      )
    ).text();
    expect(body).not.toContain("viewing as <code><script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("6. the default board shows the product directory", async () => {
    const body = await (await handleRequest(new Request("http://localhost/"))).text();
    expect(body).toContain('class="product-directory"');
    expect(body).toContain("Field Guide (PDF)");
    expect(body).toContain('href="?product=guide-pdf"');
  });

  it("7. renders no signed URL / download / payment affordance on a product page", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?product=guide-pdf"))
    ).text();
    const lower = body.toLowerCase();
    expect(lower).not.toContain("download");
    expect(lower).not.toContain("signed url");
    expect(lower).not.toContain("checkout");
    expect(lower).not.toContain("stripe");
    expect(lower).not.toContain("data:application"); // no inline asset bytes
    expect(body).not.toContain("base64");
    expect(body).not.toContain("<button"); // no buy/checkout action
  });

  it("8. introduces no asset-byte/delivery wiring in the Worker", () => {
    const src: string = workerSource;
    expect(src).not.toContain("R2AssetCache");
    expect(src).not.toContain("MeshKVAssetCache");
    expect(src).not.toContain("InMemoryAssetCache");
    expect(src).not.toContain("arrayBuffer");
    expect(src).not.toContain("createSignedUrl");
    expect(src).not.toContain("EdgeRecPromotionProvider");
  });
});

describe("worker product asset preview from runtime (Stage 35)", () => {
  it("1. ?product=<id> consults the runtime assetCache", async () => {
    const spy = new SpyAssetCache();
    await handleRequest(
      new Request("http://localhost/?product=guide-pdf"),
      undefined,
      undefined,
      undefined,
      undefined,
      spy,
    );
    // guide-pdf references three asset ids; each is looked up by id.
    expect(spy.getKeys).toContain("asset-guide-thumb");
    expect(spy.getKeys).toContain("asset-guide-preview");
    expect(spy.getKeys).toContain("asset-guide-full");
  });

  it("2. the no-param board never touches the assetCache", async () => {
    const spy = new SpyAssetCache();
    await handleRequest(
      new Request("http://localhost/"),
      undefined,
      undefined,
      undefined,
      undefined,
      spy,
    );
    expect(spy.getKeys).toEqual([]);
  });

  it("3. private/paid metadata (from cache OR sample) is not displayed", async () => {
    // A cache hit turns the normally-public thumb into a paid asset.
    const spy = new SpyAssetCache({
      "asset-guide-thumb": cachedWith({
        kind: "thumbnail",
        visibility: "paid",
        contentType: "image/png",
        sizeBytes: 1,
        tags: [],
      }),
    });
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf"),
        undefined,
        undefined,
        undefined,
        undefined,
        spy,
      )
    ).text();
    expect(body).not.toContain('data-asset="asset-guide-thumb"'); // now paid -> hidden
    expect(body).not.toContain('data-asset="asset-guide-full"'); // sample paid -> hidden
    expect(body).toContain('data-asset="asset-guide-preview"'); // unlisted -> shown
  });

  it("4. cached asset bytes never reach the HTML", async () => {
    const spy = new SpyAssetCache({
      "asset-guide-preview": cachedWith(
        {
          kind: "preview",
          visibility: "unlisted",
          contentType: "application/pdf",
          sizeBytes: 10,
          tags: [],
        },
        "BYTES_SHOULD_NOT_APPEAR",
      ),
    });
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf"),
        undefined,
        undefined,
        undefined,
        undefined,
        spy,
      )
    ).text();
    expect(body).not.toContain("BYTES_SHOULD_NOT_APPEAR");
    expect(body).not.toContain("base64");
    expect(body).not.toContain("data:application");
    // Metadata itself is still rendered.
    expect(body).toContain('data-asset="asset-guide-preview"');
  });

  it("5. introduces no download / signed URL / payment on the runtime-sourced page", async () => {
    const spy = new SpyAssetCache({
      "asset-guide-preview": cachedWith({
        kind: "preview",
        visibility: "unlisted",
        contentType: "application/pdf",
        sizeBytes: 10,
        tags: [],
      }),
    });
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf"),
        undefined,
        undefined,
        undefined,
        undefined,
        spy,
      )
    ).text();
    const lower = body.toLowerCase();
    expect(lower).not.toContain("download");
    expect(lower).not.toContain("signed url");
    expect(lower).not.toContain("checkout");
    expect(lower).not.toContain("stripe");
    expect(body).not.toContain("<button");
  });
});

describe("worker chat route (read-only)", () => {
  it("1. the default board (sample mode) shows the chat directory", async () => {
    const body = await (await handleRequest(new Request("http://localhost/"))).text();
    expect(body).toContain('class="chat-directory"');
    expect(body).toContain('href="?chat=lounge-chat"');
    // A private DM is not surfaced to a guest.
    expect(body).not.toContain('href="?chat=dm-alice-bob"');
  });

  it("2. ?chat=<public> renders the chat room with its messages", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?chat=lounge-chat"))
    ).text();
    expect(body).toContain('class="chat-room"');
    expect(body).toContain("Welcome to the lounge chat");
    expect(body).toContain('data-chat="lounge-chat"');
  });

  it("3. ?chat=<unknown> renders not-found with the escaped id", async () => {
    const res = await handleRequest(
      new Request("http://localhost/?chat=" + encodeURIComponent("<nope>")),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Chat not found");
    expect(body).not.toContain("<nope>");
    expect(body).toContain("&lt;nope&gt;");
  });

  it("4. a private DM denies a guest", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?chat=dm-alice-bob"))
    ).text();
    expect(body).toContain("Access denied");
    expect(body).not.toContain("one-to-one thread"); // no message leaks
  });

  it("5. a participant may view the private DM via ?actor", async () => {
    const body = await (
      await handleRequest(
        new Request(`http://localhost/?chat=dm-alice-bob&actor=${SAMPLE_DM_PARTICIPANT}`),
      )
    ).text();
    expect(body).toContain('class="chat-room"');
    expect(body).toContain("one-to-one thread");
  });

  it("6. message content is escaped in the room view", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?chat=lounge-chat"))
    ).text();
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("7. introduces no send/publish form, button, or wording on a chat page", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?chat=lounge-chat"))
    ).text();
    const lower = body.toLowerCase();
    // The chat room itself exposes no compose/send affordance.
    const room = lower.slice(lower.indexOf('class="chat-room"'));
    expect(room).not.toContain("<form");
    expect(room).not.toContain("<textarea");
    expect(room).not.toContain("send message");
    expect(room).not.toContain("encrypted");
    expect(room).not.toContain("secure");
  });

  it("8. introduces no real chat send / NIP-07 / publisher wiring in the Worker", () => {
    const src: string = workerSource;
    expect(src).not.toContain("WebSocketRelayPublisher");
    expect(src).not.toContain("Nip07EventSigner");
    expect(src).not.toContain("validateBeforePublish");
    expect(src).not.toContain("nip04");
    expect(src).not.toContain("nip44");
  });
});

describe("worker unified directory (Stage 30)", () => {
  it("1. the default board shows the unified directory", async () => {
    const body = await (await handleRequest(new Request("http://localhost/"))).text();
    expect(body).toContain('class="unified-directory"');
    // The three reused sections are all present in sample mode.
    expect(body).toContain('class="space-directory"');
    expect(body).toContain('class="product-directory"');
    expect(body).toContain('class="chat-directory"');
  });

  it("2. the directory contains ?space= links", async () => {
    const body = await (await handleRequest(new Request("http://localhost/"))).text();
    expect(body).toContain('href="?space=general"');
  });

  it("3. the directory contains ?product= links", async () => {
    const body = await (await handleRequest(new Request("http://localhost/"))).text();
    expect(body).toContain('href="?product=guide-pdf"');
  });

  it("4. the directory contains ?chat= links", async () => {
    const body = await (await handleRequest(new Request("http://localhost/"))).text();
    expect(body).toContain('href="?chat=lounge-chat"');
  });

  it("5. escapes a malicious ?actor value on the unified directory", async () => {
    const body = await (
      await handleRequest(
        new Request("http://localhost/?actor=" + encodeURIComponent("<script>")),
      )
    ).text();
    expect(body).not.toContain("viewing as <code><script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("6. the existing ?space route still works", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?space=general"))
    ).text();
    expect(body).toContain('class="space-landing"');
    expect(body).toContain("General community thread.");
    // The unified directory only appears on the no-param board.
    expect(body).not.toContain('class="unified-directory"');
  });

  it("7. the existing ?product route still works", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?product=guide-pdf"))
    ).text();
    expect(body).toContain('class="product-page"');
    expect(body).toContain("Field Guide (PDF)");
  });

  it("8. the existing ?chat route still works", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?chat=lounge-chat"))
    ).text();
    expect(body).toContain('class="chat-room"');
    expect(body).toContain("Welcome to the lounge chat");
  });

  it("9. introduces no MeshKV / EdgeRec / publisher / NIP-07 auto-wire", () => {
    const src: string = workerSource;
    expect(src).not.toContain("MeshKVBrowserClient");
    expect(src).not.toContain("EdgeRecProvider");
    expect(src).not.toContain("EdgeRecPromotionProvider");
    expect(src).not.toContain("WebSocketRelayPublisher");
    expect(src).not.toContain("Nip07EventSigner");
  });
});

describe("worker promotion placeholders (read-only)", () => {
  it("1. ?space=general shows empty header/footer promotion placeholders", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?space=general"))
    ).text();
    expect(body).toContain('class="promotion-placeholder promotion-space"');
    expect(body).toContain('data-placement="space_header"');
    expect(body).toContain('data-placement="space_footer"');
    // No ad candidate / destination is ever rendered.
    expect(body).not.toContain("destination");
  });

  it("2. the no-space board shows the directory but no promotion placeholder", async () => {
    const body = await (await handleRequest(new Request("http://localhost/"))).text();
    expect(body).toContain('class="space-directory"');
    expect(body).not.toContain("promotion-placeholder");
  });

  it("3. introduces no provider call or new fetch wiring in the Worker", () => {
    const src: string = workerSource;
    // The placeholders are rendered purely; no promotion provider is constructed.
    expect(src).not.toContain("EdgeRecPromotionProvider");
    expect(src).not.toContain("MockPromotionProvider");
    expect(src).not.toContain("getPromotions");
    expect(src).not.toContain("getRecommendations");
    expect(src).not.toContain("edge_rec_adapter");
  });
});
