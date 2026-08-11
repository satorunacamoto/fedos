/**
 * Stage 30 — unified read-only directory page.
 *
 * Pure string builders that ORGANIZE the existing Space / Product / Chat
 * directory helpers into one section, so the "board → Space → Product → Chat"
 * flow reads as a single screen. This layer adds NO new data lookup, NO network,
 * and NO new routes: it only arranges already-built, already-escaped fragments
 * and links to the existing `?space=`/`?product=`/`?chat=` routes.
 *
 * SECURITY: every string this layer contributes itself (section titles, the
 * empty-state text, the actor line inside the reused helpers) is HTML-escaped.
 * The reused helpers (`renderSpaceDirectory`/`renderProductDirectory`/
 * `renderChatDirectory`) already escape all space/product/chat-derived text and
 * emit only relative `?…` links; this layer trusts that and escapes only the
 * additional strings it introduces. Nothing here fetches, signs, or publishes.
 */

import type { Space } from "../community/types.js";
import type { Product } from "../../commerce/catalog/types.js";
import type { ChatRoom } from "../chat/types.js";
import { escapeHtml } from "./html.js";
import { renderSpaceDirectory } from "./space.js";
import { renderProductDirectory } from "./product.js";
import { renderChatDirectory } from "./chat.js";

/** The input for `renderUnifiedDirectory`: already-filtered listings only. */
export interface UnifiedDirectoryView {
  /** Spaces the actor may read (e.g. `listReadableSpaces`). */
  readonly spaces: readonly Space[];
  /** Products the actor may view (e.g. `listViewableProducts`). */
  readonly products: readonly Product[];
  /** Chats the actor may read (e.g. `listReadableChats`). */
  readonly chats: readonly ChatRoom[];
  /** Viewer pubkey; passed through to the reused helpers (guest when absent). */
  readonly actorPubkey?: string;
  /** Render the Spaces section. Default true. */
  readonly showSpaces?: boolean;
  /** Render the Products section. Default true. */
  readonly showProducts?: boolean;
  /** Render the Chats section. Default true. */
  readonly showChats?: boolean;
}

/** Options for `renderDirectorySection`. */
export interface DirectorySectionOptions {
  /** Extra class appended to the section (developer-supplied constant). */
  readonly className?: string;
  /** A short step marker (e.g. "1") shown before the title. Escaped. */
  readonly step?: string;
}

/** Text shown when every section is hidden (no directory to display). */
const EMPTY_TEXT = "Nothing to browse yet.";

/**
 * Wraps a directory `body` (already-built HTML from a reused helper) under an
 * escaped `title`. The title and optional step marker are the only strings this
 * function introduces, and both are escaped; `body` is trusted as pre-escaped
 * HTML from the Space/Product/Chat helpers.
 */
export function renderDirectorySection(
  title: string,
  body: string,
  options: DirectorySectionOptions = {},
): string {
  const cls = options.className ? ` ${options.className}` : "";
  const step = options.step
    ? `<span class="directory-step">${escapeHtml(options.step)}</span> `
    : "";
  return (
    `<section class="directory-section${cls}">` +
    `<h3 class="directory-section-title">${step}${escapeHtml(title)}</h3>` +
    body +
    `</section>`
  );
}

/** The empty state shown when no section is rendered. */
export function renderDirectoryEmptyState(): string {
  return (
    `<section class="directory-empty">` +
    `<p class="empty">${escapeHtml(EMPTY_TEXT)}</p>` +
    `</section>`
  );
}

/**
 * The unified directory: Spaces, Products, and Chats in one section, each built
 * from its existing read-only helper and linking to its existing route. Sections
 * can be toggled independently (default: all shown); when none are shown the
 * empty state is rendered. Adds no new data lookup, link, or network.
 */
export function renderUnifiedDirectory(view: UnifiedDirectoryView): string {
  const actor = view.actorPubkey;
  const showSpaces = view.showSpaces ?? true;
  const showProducts = view.showProducts ?? true;
  const showChats = view.showChats ?? true;

  const sections: string[] = [];
  if (showSpaces) {
    sections.push(
      renderDirectorySection("Spaces", renderSpaceDirectory(view.spaces, actor), {
        className: "directory-spaces",
        step: "1",
      }),
    );
  }
  if (showProducts) {
    sections.push(
      renderDirectorySection("Products", renderProductDirectory(view.products, actor), {
        className: "directory-products",
        step: "2",
      }),
    );
  }
  if (showChats) {
    sections.push(
      renderDirectorySection("Chats", renderChatDirectory(view.chats, actor), {
        className: "directory-chats",
        step: "3",
      }),
    );
  }

  const inner = sections.length > 0 ? sections.join("") : renderDirectoryEmptyState();
  return (
    `<section class="unified-directory">` +
    `<h2>Directory</h2>` +
    `<p class="directory-intro">` +
    `Browse the board, then its Spaces, Products, and Chats.` +
    `</p>` +
    inner +
    `</section>`
  );
}
