# Promotion Provider Preview — Safety Rules (binding)

**Status: this document adds no code.** It fixes, in writing, the safety
contract that `src/promotion/invocation.ts` (Stage 49), the dual-flag Worker
wiring (Stage 52), and `src/render/promotion.ts`'s diagnostics layer (Stage 53)
already implement, so future extensions to the provider preview cannot
accidentally regress it — and so it can never be mistaken for real ad serving.
If a future change to this area would violate a rule below, the rule wins —
change the code, not this document, or open a new Stage to renegotiate the
rule explicitly.

This is a safety contract, not a marketing claim. Nothing here should be read
as "secure", "audited", or "complete" — it states what the provider preview
does and does not do, and why.

---

## 1. Purpose

The provider preview exists for exactly one job: to verify that an
already-selected `PromotionProvider` (e.g. a real `EdgeRecPromotionProvider`,
Stage 38) can be invoked and its response rendered as a PREVIEW, under an
explicit opt-in — nothing more.

- **Provider integration preview.** It confirms the wiring works end to end
  (request in, `PromotionDecision` out, rendered as a preview card) for
  whichever provider the runtime happens to have selected.
- **NOT ad serving.** No candidate rendered here is ever presented to a real
  end user as a served advertisement. Every rendered block says so explicitly
  (§4, §7).
- **NOT ranking.** This layer does not select, sort, weight, or filter
  candidates by relevance, bid, or any other signal — whatever the provider
  returns passes through untouched (or is rejected outright per §5/§6).
- **NOT billing.** No amount is charged, quoted, reconciled, or recorded here,
  under any circumstance.
- **NOT tracking.** No click, impression, view, or engagement of any kind is
  measured, recorded, or reported by this layer.

## 2. Invocation conditions (the dual-flag gate)

`invokePromotionProviderPreview(provider, request, options)` (Stage 49) calls
`provider.getPromotions(request)` ONLY when BOTH of the following are true —
this is checked twice, independently, and BOTH checks must pass:

1. **Env flag**: `ENABLE_PROMOTION_PROVIDER_PREVIEW` is truthy in `RuntimeEnv`,
   reflected into `AppRuntime.promotionProviderPreviewAllowed`
   (`isPromotionProviderPreviewAllowed`, `src/runtime/create_runtime.ts`).
2. **Query flag**: the incoming request has `?edgeRecPreview=1`/`=true` OR
   `?providerPromotionPreview=1`/`=true`
   (`isProviderPromotionPreviewEnabled(url)`, `src/worker.ts`).

Both are required. There is no default that enables either flag on its own:

- **Query flag present, env flag absent** → the provider is NEVER called. The
  Worker renders a `disabled` diagnostic (`disabledReason:
  "env_flag_disabled"`) instead — see `docs/runtime_diagnostics.md`-style
  fixed, safe copy in §7.
- **Env flag present, query flag absent** → the provider is NEVER called
  either; the Worker's `renderProviderPromotionPreview` helper is not even
  invoked for that request (the query check happens at the call site, before
  this function is reached).
- **Neither flag** → same as above: nothing is called, nothing beyond the
  normal page renders.
- **Both flags present** → and ONLY then, `invokePromotionProviderPreview` is
  called with `allowRealProvider: true` and `mode: "provider_preview"`.

**Disabled by default.** With no env configuration and no query parameter,
the provider is never invoked, on any route, ever.

## 3. Relationship to the mock preview (`?promotionPreview=1`)

The provider preview and the Stage 41 mock preview are **two entirely
separate, non-overlapping code paths** that happen to render onto the same
page:

- `?promotionPreview=1`/`=true` (`isPromotionPreviewEnabled`) drives ONLY
  `MockPromotionProvider` via `renderMockPromotionPreview` — it never touches
  `runtime.promotionProvider` and is unaffected by either half of the dual
  flag in §2.
- The provider preview (§2) drives `runtime.promotionProvider` — whatever
  `createRuntime(env)` actually selected (Stage 38's `EdgeRecPromotionProvider`
  when configured, or the mock/no-op default otherwise) — and is unaffected by
  `?promotionPreview=1`.
- Both may appear on the same product/space page at once if a caller sets all
  the relevant flags; they render as visually distinct blocks
  (`promotion-preview` vs. `promotion-provider-preview` CSS classes) and
  neither one's presence implies anything about the other.
- A change to one path must never silently change the other. If a future
  stage needs to unify them, that is itself a deliberate, reviewed decision —
  not a side effect.

## 4. What MAY be shown

Only the following, from an ALREADY-RETURNED `PromotionDecision`/
`PromotionInvocationDecision`, may ever be rendered:

- **Sanitized candidate title** — HTML-escaped, as returned by the provider.
- **Sanitized description** — HTML-escaped, when present.
- **Sanitized sponsor** — HTML-escaped, as returned by the provider.
- **Bounded metadata** — at most 10 entries, each value truncated to 200
  characters (`boundProviderPreviewMetadata`,
  `MAX_PROVIDER_PREVIEW_METADATA_ENTRIES`/
  `MAX_PROVIDER_PREVIEW_METADATA_VALUE_LENGTH` in `src/render/promotion.ts`) —
  a provider is an external boundary and could otherwise return unbounded
  data.
- **State** — one of `"provider_preview"` (success), `"provider_error"`, or
  `"disabled"` (`PromotionPreviewDiagnosticView.kind`).
- **Fixed diagnostic reason** — ONE of the fixed, safe sentences defined in
  `src/render/promotion.ts` (§7 below), never the provider's own text.

Nothing else about a candidate or a decision is ever rendered.

## 5. What MUST NEVER be shown

The following must never appear in the provider preview's HTML, in any state:

- **Destination URL** — `PromotionCandidate.destination` is read by this
  layer's types but never rendered, never linked (no `<a href>`), and never
  embedded anywhere.
- **Image URL** — `PromotionCandidate.image` is likewise never rendered (no
  `<img>`, no CSS `background-image`, no raw URL string).
- **Tracking URL** — no click-tracking, impression-tracking, or beacon URL of
  any kind, whether supplied by the provider or synthesized here (none is ever
  synthesized).
- **Click ID / impression ID** — no identifier of this kind is read from
  provider metadata and surfaced; if a provider's metadata happens to contain
  one, it is subject to the same escaping/bounding as any other metadata value
  (§4) but this layer attaches no special meaning to it and never uses it to
  construct a link or beacon.
- **Auction/ranking score** — priority/weight fields on a `PromotionCandidate`
  are part of its shape but are never displayed or acted upon here.
- **Billing info** — no amount, currency, invoice, or payment reference of any
  kind.
- **API key** — never read from `RuntimeEnv` by this layer, never rendered.
- **Endpoint URL** — never read from `RuntimeEnv` by this layer, never
  rendered (see `docs/runtime_diagnostics.md` for the equivalent rule on the
  Runtime status page).
- **Stack trace** — a thrown provider error is caught inside
  `invokePromotionProviderPreview` and reported as a fixed `provider_error`
  state (§7); no exception object, message, or trace is ever rendered.
- **Raw provider error body** — same as above: the provider's own error text
  is discarded, not merely hidden.
- **Viewer/actor pubkey** — never placed on the outgoing request (§8) and
  never rendered on the resulting preview.

## 6. What MUST NEVER be called

Neither `invokePromotionProviderPreview` nor anything in
`src/render/promotion.ts` may ever:

- Perform click tracking of any kind.
- Perform impression tracking of any kind.
- Call a billing/Stripe API.
- Call Telegram (or any messaging platform) API.
- Use `HTMLRewriter` or any similar raw-HTML-mutation facility.
- Issue an automatic `fetch` outside the ONE explicit
  `provider.getPromotions(request)` call that happens ONLY under the dual-flag
  gate (§2) — this module's own source issues no `fetch` at all; any network
  I/O happens strictly inside whatever `provider` implementation the caller
  injected.
- Trigger a "recommendation rewrite" or any other content-mutation pipeline.
- Send the viewer pubkey by default (§8) — only an explicit, separate opt-in
  elsewhere in the promotion boundary (`PROMOTION_SEND_VIEWER_PUBKEY`, unused
  by the preview path) could ever change this, and the preview path does not
  wire it in.

## 7. Error handling

When `provider.getPromotions(request)` throws or rejects:

- `invokePromotionProviderPreview` catches it and returns `state:
  "provider_error"` — it never re-throws into the caller.
- `buildPromotionPreviewDiagnostic` maps this to `{ kind: "provider_error" }`
  and DROPS the raw `PromotionInvocationDecision.reason` string entirely —
  it is not carried forward into the diagnostic view at all, so there is
  nothing left to leak even if a future provider adapter starts stuffing
  richer detail into that field.
- `renderPromotionPreviewDiagnostic` renders a SINGLE FIXED sentence for this
  state: *"the provider could not be reached or returned an error."*
  (`PROVIDER_ERROR_TEXT` in `src/render/promotion.ts`) — never the provider's
  own error message, never an endpoint, never an API key, never a stack trace.
- The `disabled` state is similarly fixed: one of three safe sentences keyed
  by `PromotionPreviewDisabledReason` (`env_flag_disabled` /
  `query_flag_missing` / `preview_mode_not_requested`), never an echoed
  flag/env value.

## 8. Privacy

- **Viewer pubkey: non-send by default.** `buildProductPlacement`/
  `buildSpacePlacement` are called from the Worker's provider-preview path
  with NO `viewerPubkey` option — the resulting `PromotionRequest.viewerPubkey`
  is `undefined`.
- **`?actor=` is never passed to the provider request.** The `actor` query
  parameter is read elsewhere (e.g. for the purchase/grant preview, or as a
  "viewing as" display line) but is deliberately NOT threaded into the
  placement builders used for the provider preview.
- **Metadata is bounded** (§4) — a defensive limit against an external
  boundary (the provider) returning unbounded or oversized data, not a privacy
  mechanism per se, but it also limits how much of a provider's response can
  ever reach the page.
- **Candidate URLs are never surfaced** (§5) — `destination`/`image` are part
  of the type but never rendered, so no outbound link or image request is ever
  constructed from a candidate, and no referrer/analytics leak can occur
  through this layer.

## 9. Test policy for this area

Every change that touches `src/promotion/invocation.ts`,
`src/render/promotion.ts`'s provider-preview functions, or the Worker's dual
flag wiring must be covered by tests that:

- **Assert the dual-flag gate** — `allowRealProvider: false` and `mode:
  "disabled"`/`"mock_preview"` never call the provider; only `allowRealProvider:
  true` + `mode: "provider_preview"` does, exactly once per request.
- **Assert query-only / env-only never call the provider** — both halves of
  §2's gate are tested independently with a call-counting spy provider,
  confirming zero calls in either single-flag configuration and exactly one
  call when both are present, on both the product and space routes.
- **Assert no link/image/tracking markup** — the rendered preview never
  contains `<a `, `href=`, `<img`, `onclick`, `data-track`, or the candidate's
  literal `destination`/`image` string.
- **Assert error sanitization** — a provider that throws (including one whose
  thrown message is crafted to contain a fake secret/endpoint/stack-trace-like
  string) results in rendered output containing NONE of that injected text,
  only the fixed `provider_error` sentence.
- **Assert the mock path is unaffected** — `?promotionPreview=1` continues to
  render "Promotion preview (mock)" regardless of either dual-flag setting,
  and the provider-preview tests never assert against or depend on mock-path
  behavior.

These are enforced today in `test/promotion_invocation.test.ts`,
`test/promotion_provider_preview_ui.test.ts`,
`test/promotion_provider_preview_diagnostics.test.ts`, and
`test/render_promotion_preview.test.ts`.

## 10. Rules for future real serving

- **Real ad serving requires its own, separate Stage.** Turning this preview
  into an actual delivery path (one where a real end user sees a real,
  provider-chosen advertisement) is explicitly OUT OF SCOPE for the provider
  preview forever. It must be designed, reviewed, and shipped as its own
  boundary — not grown incrementally out of this one.
- **Click/billing/tracking/ranking are separate boundaries.** Each of these
  concerns (measuring a click, charging for one, tracking an impression,
  ranking/auctioning candidates) is its own future decision with its own
  privacy and safety review — none of them may be added to this preview layer
  as a "small addition"; each needs a disabled-by-default gate of its own, the
  way Stage 49/52 gated real provider invocation itself.
- **The provider preview must never be silently promoted to production.**
  There is no flag combination, env value, or code path that turns
  `invokePromotionProviderPreview`/`renderPromotionPreviewDiagnostic` into a
  real ad-serving mechanism. If that is ever wanted, it is a new feature with
  a new name, new tests, and its own explicit safety document — not a
  reinterpretation of "preview".
