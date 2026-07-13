# Secure Runtime Alpha 193 — Canonical Event Serialization

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs` (the same file edit as Alpha
192 — this Arc lands as a single commit). This is Stage 3 of the
Alpha 191–200 Nostr Event Foundation Arc, following Alpha 192's own
`FedosNostrEventHandle`.**

## 1. Why now

Alpha 192 built the Handle; this Stage builds the ONE place permitted
to turn it into NIP-01's own canonical pre-image text, so Alpha 194
can hash it.

## 2. What was implemented

```rust
mod nostr_event_encoding {
    use super::FedosNostrEventHandle;

    fn escape_json_string_internal(value: &str) -> String { ... }
    fn serialize_tags_internal(tags: &[Vec<String>]) -> String { ... }

    pub(crate) fn serialize_nostr_event_canonical_internal(
        event: &FedosNostrEventHandle,
    ) -> String { ... }
}
```

Nested INSIDE `master_root`, matching `nostr_identifier_encoding`'s
own (Alpha 173) placement rationale exactly: its sole accessor onto
`FedosNostrEventHandle` (`expose_fields_for_internal_canonical_serialization`,
Alpha 192) stays genuinely PRIVATE — never `pub(crate)` — reachable
only because Rust's own privacy model grants a descendant module
visibility into its ancestor's private items.

## 3. Only NIP-01's own rule — no custom serialization rules

Per this Arc's own explicit Alpha 193 instruction ("Use only NIP-01
canonical serialization. No custom serialization rules."):

- **Fixed five-element array, literal `0` marker.** `format!("[0,{},{},{},{},{}]", ...)`
  — the SAME shape and literal version marker Alpha 191 §2 quoted from
  the spec directly. No sixth element, no wrapper object, ever.
- **Escaping — exactly NIP-01's own six characters, no others.**
  `escape_json_string_internal` matches ONLY `\n` `"` `\\` `\r` `\t`
  `\u{08}` `\u{0C}` — every other `char`, INCLUDING every non-ASCII
  UTF-8 code point, passes through verbatim via the `match` arm's own
  `other => out.push(other)` fallthrough. This is a DELIBERATE
  divergence from generic JSON serializers (this repository's own
  TypeScript `JSON.stringify`-based `serializeForId` included, Alpha
  191 §3) — NIP-01's own rule, implemented exactly, not a generic
  "valid JSON" rule that happens to be close.
- **One escaper for every string field.** `pubkey`, every tag
  element, and `content` all pass through the SAME
  `escape_json_string_internal` — no field-specific escaping
  exception of any kind, even though `pubkey` (a fixed 64-char lowercase
  hex value) could never actually contain an escape-worthy character —
  uniform treatment, no special-cased shortcut.
- **No whitespace, no line breaks.** `format!`'s own fixed template
  contains no space or newline of any kind between elements —
  confirmed by Alpha 196's own real-execution test
  (`canonical_serialization_matches_the_nip01_five_element_array_shape`),
  not merely by reading the format string.
- **Numbers via `Display`, not a custom formatter.** `created_at`/`kind`
  (both `u64`) serialize via `{}` — Rust's own `Display` impl for
  unsigned integers already produces plain decimal digits, no leading
  zero, no separator, matching JSON's own number grammar with zero
  additional logic.

## 4. Hand-written against the standard library only — no new
   dependency

Matching `nostr_identifier_encoding`/`crypto::ciphertext_serialization`/
`crypto::nip44_wire_encoding`'s own established "hand-written codec,
closed input shape, no new crate" precedent exactly (Alpha 191 §4
already confirmed `serde_json` remains `[dev-dependencies]`-only).
`escape_json_string_internal`/`serialize_tags_internal` are both
private (`fn`, not `pub(crate) fn`) — internal helpers of the ONE
public entry point, `serialize_nostr_event_canonical_internal`.

## 5. Structural confirmation (real inspection, this Stage)

- `#[wasm_bindgen]` count in `lib.rs`: fixed at 13, unchanged.
- `pub fn` count in `lib.rs`: fixed at 36, unchanged
  (`serialize_nostr_event_canonical_internal` is `pub(crate) fn`, not
  counted, and reachable ONLY from within `master_root`, not even from
  sibling modules outside it).
- `serde_json`/`serde`: still `[dev-dependencies]`-only, unchanged.
- Alpha 196's own real-execution tests
  (`canonical_serialization_matches_the_nip01_five_element_array_shape`,
  `canonical_content_escapes_exactly_the_six_nip01_characters`,
  `canonical_content_passes_non_ascii_utf8_through_verbatim`) confirm
  this Stage's own claims by EXECUTION, not by reading the source
  alone — a known-input, known-output check for the full shape, and
  two targeted checks for the escaping rule specifically.

## 6. What this Stage does NOT do

- Does **not** implement Event ID generation — Alpha 194's own
  deliverable (landed in the same `lib.rs` edit as this Stage).
- Does **not** implement a Decoder of any kind — encoding only,
  matching `nostr_identifier_encoding`'s own identical scope decision
  (Alpha 171 §7).
- Does **not** add `serde`/`serde_json` (or any other JSON library) to
  `[dependencies]`.
- Does **not** modify `src/desktop/*`, `src/identity/*`, `src/nostr/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_192_nostr_event_handle.md`
- `docs/secure_runtime_alpha_191_nostr_event_model_inventory.md`
- `docs/secure_runtime_alpha_173_nostr_public_identifier_encoder.md`
