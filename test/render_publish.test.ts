import { describe, it, expect } from "vitest";
import {
  buildPublishPrototypeView,
  renderPublishPrototype,
  renderUnsignedEventPreview,
  renderPublishDenied,
} from "../src/render/publish.js";
import type { CommunitySpace, SpaceDecision } from "../src/community/types.js";
import type { UnsignedNostrEvent } from "../src/sign/types.js";

const ACTOR = "a".repeat(64);

function community(overrides: Partial<CommunitySpace> = {}): CommunitySpace {
  return {
    id: "general",
    type: "community",
    name: "General",
    visibility: "public",
    membershipPolicy: "open",
    postPolicy: "open",
    owners: [],
    admins: [],
    moderators: [],
    members: [],
    ...overrides,
  };
}

const ALLOW: SpaceDecision = { allowed: true, role: "guest", reason: "ok" };
const DENY: SpaceDecision = {
  allowed: false,
  role: "guest",
  reason: "post policy not met",
};

function unsigned(overrides: Partial<UnsignedNostrEvent> = {}): UnsignedNostrEvent {
  return {
    pubkey: ACTOR,
    created_at: 1700000000,
    kind: 1,
    tags: [["space", "general"]],
    content: "hello space",
    ...overrides,
  };
}

describe("renderPublishPrototype", () => {
  it("1. allowed + content renders the unsigned event preview", () => {
    const view = buildPublishPrototypeView(
      { content: "hello space", actorPubkey: ACTOR },
      community({ postPolicy: "open" }),
    );
    const html = renderPublishPrototype(view);
    expect(html).toContain("publish-prototype");
    expect(html).toContain("Unsigned event preview");
    expect(html).toContain("hello space");
  });

  it("2. denied renders the (escaped) reason and no preview", () => {
    const view = buildPublishPrototypeView(
      { content: "nope", actorPubkey: ACTOR },
      community({ postPolicy: "admins" }),
    );
    const html = renderPublishPrototype(view);
    expect(html).toContain("publish-denied");
    expect(html).not.toContain("Unsigned event preview");
  });

  it("4. notes that id/sig are absent", () => {
    const html = renderUnsignedEventPreview(unsigned());
    expect(html).toContain("<code>id</code>");
    expect(html).toContain("<code>sig</code>");
    expect(html).toContain("not");
  });

  it("5. the publish button is disabled and mock-only", () => {
    const view = buildPublishPrototypeView(
      { content: "hi", actorPubkey: ACTOR },
      community({ postPolicy: "open" }),
    );
    const html = renderPublishPrototype(view);
    expect(html).toContain("disabled");
    expect(html).toContain("mock only");
  });

  it("6. allowed + empty content shows a placeholder, not a preview", () => {
    const view = buildPublishPrototypeView(
      { content: "", actorPubkey: ACTOR },
      community({ postPolicy: "open" }),
    );
    const html = renderPublishPrototype(view);
    expect(html).toContain("publish-placeholder");
    expect(html).not.toContain("Unsigned event preview");
  });

  it("a missing actor is denied (guest cannot preview)", () => {
    const view = buildPublishPrototypeView(
      { content: "hi" },
      community({ postPolicy: "open" }),
    );
    expect(view.decision.allowed).toBe(false);
    expect(view.unsigned).toBeUndefined();
    expect(renderPublishPrototype(view)).toContain("no actor selected");
  });
});

describe("renderUnsignedEventPreview escaping", () => {
  it("3. escapes HTML in content", () => {
    const html = renderUnsignedEventPreview(
      unsigned({ content: "<script>alert(1)</script>" }),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("7. escapes HTML in tags", () => {
    const html = renderUnsignedEventPreview(
      unsigned({ tags: [["t", "<img src=x>"]] }),
    );
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img src=x&gt;");
  });
});

describe("renderPublishDenied", () => {
  it("escapes the decision reason", () => {
    const html = renderPublishDenied({ ...DENY, reason: "<b>no</b>" });
    expect(html).not.toContain("<b>no</b>");
    expect(html).toContain("&lt;b&gt;no&lt;/b&gt;");
  });
});

describe("buildPublishPrototypeView", () => {
  it("builds an unsigned event only when allowed with content", () => {
    const allowed = buildPublishPrototypeView(
      { content: "x", actorPubkey: ACTOR },
      community({ postPolicy: "open" }),
    );
    expect(allowed.unsigned?.content).toBe("x");

    const denied = buildPublishPrototypeView(
      { content: "x", actorPubkey: ACTOR },
      community({ postPolicy: "admins" }),
    );
    expect(denied.unsigned).toBeUndefined();
    expect(denied.decision.allowed).toBe(false);
  });
});
