import { describe, it, expect } from "vitest";
import {
  renderDirectoryEmptyState,
  renderDirectorySection,
  renderUnifiedDirectory,
  type UnifiedDirectoryView,
} from "../src/os/_legacy_prototype/render/directory.js";
import type { Space } from "../src/os/_legacy_prototype/community/types.js";
import type { Product } from "../src/os/commerce/catalog/types.js";
import type { ChatRoom } from "../src/os/_legacy_prototype/chat/types.js";

const OWNER = "a".repeat(64);

function space(overrides: Partial<Space> = {}): Space {
  return {
    id: "general",
    type: "community",
    name: "General",
    visibility: "public",
    description: "The main board.",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [OWNER],
    admins: [],
    moderators: [],
    members: [],
    ...overrides,
  } as Space;
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "guide-pdf",
    kind: "pdf",
    title: "Field Guide",
    description: "A guide.",
    creatorPubkey: OWNER,
    status: "active",
    visibility: "public",
    priceCents: 0,
    currency: "USD",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: [],
    ...overrides,
  } as Product;
}

function chat(overrides: Partial<ChatRoom> = {}): ChatRoom {
  return {
    id: "lounge-chat",
    kind: "group",
    visibility: "public",
    postPolicy: "open",
    participants: [OWNER],
    admins: [OWNER],
    ...overrides,
  } as ChatRoom;
}

function view(overrides: Partial<UnifiedDirectoryView> = {}): UnifiedDirectoryView {
  return {
    spaces: [space()],
    products: [product()],
    chats: [chat()],
    ...overrides,
  };
}

describe("renderUnifiedDirectory", () => {
  it("1. renders the spaces, products, and chats sections", () => {
    const html = renderUnifiedDirectory(view());
    expect(html).toContain('class="unified-directory"');
    // Reuses the existing helpers (their class names appear).
    expect(html).toContain('class="space-directory"');
    expect(html).toContain('class="product-directory"');
    expect(html).toContain('class="chat-directory"');
    // Links to the existing routes.
    expect(html).toContain('href="?space=general"');
    expect(html).toContain('href="?product=guide-pdf"');
    expect(html).toContain('href="?chat=lounge-chat"');
  });

  it("2. can hide the spaces section", () => {
    const html = renderUnifiedDirectory(view({ showSpaces: false }));
    expect(html).not.toContain('class="space-directory"');
    expect(html).toContain('class="product-directory"');
    expect(html).toContain('class="chat-directory"');
  });

  it("3. can hide the products section", () => {
    const html = renderUnifiedDirectory(view({ showProducts: false }));
    expect(html).toContain('class="space-directory"');
    expect(html).not.toContain('class="product-directory"');
    expect(html).toContain('class="chat-directory"');
  });

  it("4. can hide the chats section", () => {
    const html = renderUnifiedDirectory(view({ showChats: false }));
    expect(html).toContain('class="space-directory"');
    expect(html).toContain('class="product-directory"');
    expect(html).not.toContain('class="chat-directory"');
  });

  it("5. renders an empty state when every section is hidden", () => {
    const html = renderUnifiedDirectory(
      view({ showSpaces: false, showProducts: false, showChats: false }),
    );
    expect(html).toContain('class="directory-empty"');
    expect(html).toContain("Nothing to browse yet.");
    expect(html).not.toContain('class="space-directory"');
  });

  it("6. escapes a malicious actor pubkey", () => {
    const html = renderUnifiedDirectory(view({ actorPubkey: "<script>" }));
    expect(html).not.toContain("<code><script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("8. links only relatively — no external URL, fetch, or script", () => {
    const html = renderUnifiedDirectory(view());
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
    expect(html).not.toContain("<script");
    expect(html.toLowerCase()).not.toContain("fetch(");
    // Every anchor target is a relative `?…` link.
    for (const m of html.matchAll(/href="([^"]*)"/g)) {
      expect((m[1] ?? "").startsWith("?")).toBe(true);
    }
  });
});

describe("renderDirectorySection", () => {
  it("7. escapes the section title", () => {
    const html = renderDirectorySection("<script>Title</script>", "<div>body</div>");
    expect(html).not.toContain("<script>Title");
    expect(html).toContain("&lt;script&gt;");
    // The trusted body is passed through unescaped.
    expect(html).toContain("<div>body</div>");
  });

  it("renders an escaped step marker before the title", () => {
    const html = renderDirectorySection("Spaces", "", { step: "1", className: "x" });
    expect(html).toContain('class="directory-section x"');
    expect(html).toContain('class="directory-step">1</span>');
  });
});

describe("renderDirectoryEmptyState", () => {
  it("renders the empty text", () => {
    expect(renderDirectoryEmptyState()).toContain("Nothing to browse yet.");
  });
});
