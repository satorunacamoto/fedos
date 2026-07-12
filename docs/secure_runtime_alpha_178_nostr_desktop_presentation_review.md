# Secure Runtime Alpha 178 — Nostr Desktop Presentation Review

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 3 of the Alpha 176–180 Nostr Public Identifier Runtime
Boundary Arc, following Alpha 177's own adoption of hex as the
Runtime-internal canonical representation.**

## 1. Why now

Alpha 177 §5 deliberately left Desktop presentation open, deferring it
to this Stage. Alpha 175 §3 item 3 already offered a preliminary,
still-unwired RECOMMENDATION (`npub`) for Desktop display, "to be
reconfirmed or revised by whichever future, separate, explicitly-
reviewed Stage actually performs the wiring" (Alpha 175 §3). This
Stage is that reconfirmation review — for the DECISION only, still not
the wiring (this Arc's own "No GUI" rule forecloses wiring regardless).

## 2. What "Desktop presentation responsibility" means here

Per Alpha 176 §2, `DesktopApplication.currentPublicIdentity()`/
`readPublicIdentity()` (Alpha 121/127/128) already surface a
`FedosIdentityDescriptor | null` — whatever string the injected Source
supplied as `publicIdentifier`, verbatim, no reformatting (Alpha 039
§6's own Provider-responsibility rule, still true, Alpha 176 §7
reconfirmed it unchanged). Today, NO real Source exists that supplies
a Nostr-derived value at all — `NullNostrPublicIdentitySource` always
resolves `null` in production (Alpha 176 §2). "Desktop presentation"
therefore names a FUTURE question: once a real Source exists,
should whatever eventually renders `publicIdentifier` on screen show
the hex form, the `npub` form, or offer both — and does answering that
question require Runtime to change WHAT it hands Desktop, or only how
Desktop displays what it already receives?

## 3. Options compared

| # | Option | Description |
|---|---|---|
| A | hex only | Desktop always renders the raw hex form, never `npub`. |
| B | `npub` only | Desktop always renders the Bech32 `npub` form, never hex. |
| C | Both, Desktop's own choice of when | Desktop MAY render either or both, chosen by Desktop's own future UI concerns — Runtime does not mandate one. |
| D | Desktop re-derives the missing form itself | Desktop receives ONE string form and computes the other client-side (e.g., a Desktop-local Bech32 encoder). |

## 4. Evaluation

| Criterion | A (hex only) | B (`npub` only) | C (Desktop's own choice) | D (Desktop re-derives) |
|---|---|---|---|---|
| NIP-19's own stated purpose (Alpha 171 §2.6) | Ignored — hex is not the human-shareable form NIP-19 defines `npub` for | Directly served | Directly servable, at Desktop's own discretion | Directly servable, but by DUPLICATING encoding logic instead of reusing it |
| Human-shareability / copy-paste into another Nostr client | Poor — most Nostr clients/users expect `npub` for sharing, not raw hex | Good | Good, if Desktop chooses to show it | Good, if Desktop chooses to show it |
| Power-user / interop use (raw hex for scripts, relay queries) | Directly served | Not served without a Decoder Desktop does not have | Directly servable IF Runtme also hands Desktop the hex form | Directly servable, but again via duplicated logic |
| Runtime ownership of the canonical value (Alpha 177 §4) | Consistent — hex IS the canonical form | Requires Desktop to consume a NON-canonical form as its only option | Consistent — Runtime remains the single source of truth for BOTH forms; Desktop picks which to SHOW, never which to COMPUTE | **Violates it** — a second, Desktop-side encoder would mean two independently-maintained implementations of the SAME NIP-19 rule, exactly the "no reusable TypeScript codec" gap Alpha 171 §2.2/§2.5 confirmed does not exist today, and this Arc's own "No Cargo dependency additions" / "Avoid implementation" rules forbid building one now |
| New Cargo/npm dependency | None | None | None | Would likely require a bech32-capable TypeScript dependency, or a hand-rolled duplicate of Alpha 173's own Rust encoder — either way, new surface this Arc's own rules forbid |
| Blast radius of the DECISION itself (not the future wiring) | None — this is a decision-only Stage either way | None | None | None |
| Flexibility for a FUTURE UI (e.g., "show npub, tap to reveal hex") | Forecloses it — hex only | Forecloses it — `npub` only | Preserves it — Desktop's own future UI Stage decides, unconstrained by this Stage | Preserves it, but at the cost of duplicated logic |
| Consistency with Alpha 177's own explicit separation (§5: "Desktop formatting may differ") | Partially consistent (a fixed, single answer), but narrower than Alpha 177 §5 intended | Partially consistent, same narrowness | **Fully consistent** — Alpha 177 §5 named exactly this: Runtime-canonical and Desktop-facing display are independent axes | Not what Alpha 177 §5 meant by "differ" — it meant "Desktop may show a different form than Runtime's canonical one," not "Desktop computes its own" |

## 5. Decision: Option C — Desktop MAY expose either or both, Desktop's
   own choice, Runtime ownership of the canonical value unchanged

**Option C is ADOPTED.** Desktop is NOT restricted to showing only
hex or only `npub` — a future Desktop-facing Stage may render `npub`
alone (the likely DEFAULT choice, restated below), hex alone for a
power-user/advanced view, or both side by side. This Stage does not
pick a single fixed answer, because doing so (Option A or B) would
foreclose legitimate future UI flexibility for no corresponding
benefit — the underlying value doesn't change; only how many of its
forms Desktop is ALLOWED to show does. Option D is REJECTED outright:
it would require Desktop to independently reimplement Bech32/hex
encoding logic that Alpha 173 already built once, correctly, inside
the Rust Encoder Boundary — a strictly worse outcome (duplicated
logic, a second place `npub` could ever be computed incorrectly) with
zero benefit Option C does not already provide.

**Restating Alpha 175 §3 item 3 as this Stage's own, now-confirmed
DEFAULT recommendation, not a binding requirement:** if a future,
separately-reviewed Desktop-wiring Stage must pick ONE form to show
by default, `npub` remains the right default — the same NIP-19
human-shareability reasoning Alpha 175 §3 items 1/3 and §4 of this
Stage both restate. Nothing in this Stage requires that Stage to also
expose hex; Option C permits it without mandating it.

## 6. Runtime ownership is unaffected

This Stage's own decision changes nothing about WHERE the canonical
value lives or who computes it. Per Alpha 177 §4, `FedosNostrPublicKeyHex`
remains the Runtime-internal canonical form; per Alpha 176 §5, no
Public Runtime API exists yet to expose EITHER form to Desktop, hex or
`npub`. "Desktop MAY expose both" (§5 above) describes a FUTURE
capability contingent on that Public Runtime API existing — it does
not, itself, create one. Desktop's own role, unchanged by this Stage,
remains strictly a CONSUMER of whatever `publicIdentifier` string the
Source Boundary (Alpha 039, Alpha 176 §6) eventually supplies — never
a second place where Nostr identifier encoding logic is computed
(§5's Option D rejection, restated).

## 7. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** implement any GUI, rendering logic, or Desktop-side
  encoder of any kind — this repository remains GUI-free (this Arc's
  own "No GUI" rule).
- Does **not** change what `DesktopApplication`/`NostrPublicIdentityReader`
  return — both remain exactly the Alpha 121/127/128/103 pass-through
  behavior, unmodified.
- Does **not** build a Public Runtime API exposing either identifier
  form to Desktop — that remains a separate, future, explicitly out-
  of-scope Stage (Alpha 176 §5).
- Does **not** revisit or change Alpha 177's own Runtime-canonical
  decision (hex) — this Stage only decides Desktop's OWN, independent
  display latitude.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, `src/desktop/*`, `src/nostr/*`,
  Storage, Observation, any Protocol Adapter, `Cargo.toml`, or
  `package.json`.

## 8. See also

- `docs/secure_runtime_alpha_177_nostr_runtime_canonical_identifier_decision.md`
- `docs/secure_runtime_alpha_176_nostr_public_identifier_origin_review.md`
- `docs/secure_runtime_alpha_175_nostr_public_identifier_completion.md`
- `docs/secure_runtime_alpha_171_existing_nostr_identifier_inventory.md`
