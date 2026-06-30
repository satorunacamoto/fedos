import { describe, it, expect } from "vitest";
import {
  renderSpaceDirectory,
  renderSpaceLanding,
  renderSpaceNotFound,
  renderSpaceAccessDenied,
} from "../src/render/space.js";
import type { CommunitySpace, SpaceDecision } from "../src/community/types.js";

function space(overrides: Partial<CommunitySpace> = {}): CommunitySpace {
  return {
    id: "alpha",
    type: "community",
    name: "Alpha",
    description: "A friendly place.",
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

const ALLOW: SpaceDecision = { allowed: true, role: "guest", reason: "public space" };
const DENY: SpaceDecision = {
  allowed: false,
  role: "guest",
  reason: "private space requires membership",
};

describe("renderSpaceDirectory", () => {
  it("1. renders each space with a landing link", () => {
    const html = renderSpaceDirectory([space({ id: "alpha", name: "Alpha" })]);
    expect(html).toContain("Alpha");
    expect(html).toContain('href="?space=alpha"');
    expect(html).toContain('class="space-directory"');
  });

  it("2. escapes name and description", () => {
    const html = renderSpaceDirectory([
      space({ name: "<b>Evil</b>", description: "<script>x</script>" }),
    ]);
    expect(html).not.toContain("<b>Evil</b>");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;b&gt;Evil&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("escapes the actor pubkey in the viewing-as line", () => {
    const html = renderSpaceDirectory([space()], "<script>");
    expect(html).not.toContain("viewing as <code><script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders an empty state with no spaces", () => {
    expect(renderSpaceDirectory([])).toContain("No spaces available.");
  });
});

describe("renderSpaceLanding", () => {
  it("3. renders the selected space header", () => {
    const html = renderSpaceLanding(space({ name: "Alpha" }), ALLOW, ALLOW);
    expect(html).toContain("Alpha");
    expect(html).toContain('class="space-landing"');
  });

  it("6. shows an allowed post hint", () => {
    const html = renderSpaceLanding(space(), ALLOW, ALLOW);
    expect(html).toContain("post-hint allowed");
    expect(html).toContain("You can post here");
  });

  it("7. shows a denied post hint with the escaped reason", () => {
    const reason = "<b>nope</b>";
    const html = renderSpaceLanding(space(), ALLOW, {
      allowed: false,
      role: "guest",
      reason,
    });
    expect(html).toContain("post-hint denied");
    expect(html).not.toContain("<b>nope</b>");
    expect(html).toContain("&lt;b&gt;nope&lt;/b&gt;");
  });

  it("8. the post button is disabled / coming soon", () => {
    const html = renderSpaceLanding(space(), ALLOW, ALLOW);
    expect(html).toContain("coming soon");
    expect(html).toContain("disabled");
  });
});

describe("renderSpaceNotFound", () => {
  it("5. escapes the requested id", () => {
    const html = renderSpaceNotFound("<script>");
    expect(html).not.toContain("<code><script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderSpaceAccessDenied", () => {
  it("4. renders the escaped reason", () => {
    const html = renderSpaceAccessDenied(space({ name: "Secret <x>" }), DENY);
    expect(html).toContain("Access denied");
    expect(html).toContain("private space requires membership");
    expect(html).not.toContain("Secret <x>");
    expect(html).toContain("Secret &lt;x&gt;");
  });
});

describe("renderSpaceLanding promotion placeholders", () => {
  it("1. includes header and footer promotion placeholders by default", () => {
    const html = renderSpaceLanding(space(), ALLOW, ALLOW);
    expect(html).toContain('class="promotion-placeholder promotion-space"');
    expect(html).toContain('data-placement="space_header"');
    expect(html).toContain('data-placement="space_footer"');
    expect(html).toContain("Sponsored slot");
    expect(html).toContain("Promotion placeholder");
  });

  it("2. uses escaped placement attributes (no raw injection)", () => {
    const html = renderSpaceLanding(space(), ALLOW, ALLOW);
    // Placement values come from the resolver enum; assert they are emitted as
    // safe, quoted attributes and the slot label is plain text.
    expect(html).toContain('data-placement="space_header"');
    expect(html).toContain("Space header");
    expect(html).toContain("Space footer");
  });

  it("3. the placeholders render no external link or ad candidate", () => {
    const html = renderSpaceLanding(space(), ALLOW, ALLOW);
    expect(html).not.toContain("http"); // no external destination anywhere
    expect(html).not.toContain("destination");
  });

  it("can be turned off via options.promotions = false", () => {
    const html = renderSpaceLanding(space(), ALLOW, ALLOW, { promotions: false });
    expect(html).not.toContain("promotion-placeholder");
    expect(html).toContain('class="space-landing"');
  });
});
