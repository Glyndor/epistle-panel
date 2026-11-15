# Exact webmail label model (issue #213, first slice)

The pure model is under `internal/src/features/mail/labels/`. It does not load
messages or render controls. The existing `keyword-codec`/`read-keywords` display
path remains in place for the current UI; it normalizes names and must not be
used to implement exact-name label creation. Wiring the new model into that UI
and its mutations is a later slice.

## Names and transport

`name-codec` exports `LABEL_NAME_MAX` (30 UTF-8 bytes), `validateLabelName`,
`encodeLabelName` and `decodeLabelKeyword`. Future HTML fields use
`fieldLength(LABEL_NAME_MAX)` for `maxlength`; client and server both call
`validateLabelName`. HTML counts UTF-16 units rather than UTF-8 bytes, so HTML
alone cannot enforce the rule for Unicode. The extra character follows the
panel's existing paste-overflow rule (`forms.md`).

A nonempty well-formed JavaScript string is preserved exactly: leading,
trailing and repeated spaces, case, combining marks, emoji, joiners and BOM.
No trimming, NFC composition or display sanitizing occurs in this model.
Even control characters are transported as hex, never literal atom controls.
Lone surrogates are rejected because UTF-8 cannot preserve them.

Transport is `ep1-` followed by two lowercase hex digits for **every** UTF-8
byte, including ASCII. Thus 30 bytes occupy the server's 64-byte keyword limit.
Encoding ASCII too preserves `Work` versus `work` despite IMAP's case-insensitive
keyword comparison. Uppercase transport spellings decode identically. Decoding
is fatal on malformed UTF-8, preserves BOM and accepts only the complete format.
The `ep1-` namespace is reserved: an external client setting a valid encoding in
that namespace gets the corresponding decoded name.

## Message labels and sidebar

`message-labels` takes an iterable keyword set. It discards invalid atoms and
all keywords beginning with `$` or backslash, including future system keywords.
Other external keywords (even bare `Junk`) are raw labels when not valid `ep1-`
encodings. Each result carries `keyword`, exact `name`, `raw` and `tone`.
Always remove by `keyword`, never by re-encoding the displayed name. A raw keyword
and an encoded label can have equal names and remain separate identities.
Presentation must escape and isolate names as text; it must not alter identity.

`sidebar-labels` consumes one label array per latest message. Its inventory is
**"seen in the latest messages"**, not an account-wide label catalogue. Counts
are messages carrying the keyword (once per message), with case-insensitive
keyword deduplication and the first spelling retained. Sort is exact UTF-16 name
order, then keyword key, deterministic across server/browser locales.

## Colour

The existing FNV-1a `labelTone` hash is reused, with the **exact name** as its
input, yielding the fixed tokens `--label-1` through `--label-8`. Existing UI dots
continue using their existing key-based input. Equal names get equal tones in
the new model regardless of raw/encoded transport.

The new `--label-n-chip` pairs are white in light mode and `#171717` in both
dark lists; the corresponding `--label-n` is the text colour. These additions
sit beside the existing chart/label palette without recolouring current dots.
`palette/index.test.ts` computes WCAG AA text contrast (4.5:1 minimum) directly
from CSS and all 28 pair distances in each theme under full-severity Machado
protanopia, deuteranopia and tritanopia simulation in linear sRGB, clamped to the
display gamut, then converted to D65 CIELAB. Every pair must have Euclidean
Lab distance at least 10. Names always carry the meaning alongside colour.

Generated round trips use `src/test/prng` (1,800 cases, seed and case reported on
failure). The model modules each have their own tests; palette tests read the
actual theme tokens, including both routes into dark mode.

## Mutation evidence

Each of the 15 new test cases was run alone against a production mutation; it
failed, and the original file was restored before the next mutation. Mutations:

1. Allow 31 name bytes (boundary validation).
2. Normalize the encoder input to NFC (exact spelling).
3. Append a character to decoded text (seeded round trips).
4. Write literal bytes instead of hex (forbidden atom characters).
5. Return replacement text on invalid UTF-8 (malformed/raw decoding).
6. Include dollar-prefixed keywords (system filtering).
7. Mark all keywords as encoded (raw/removable identity).
8. Overwrite the first spelling of duplicate keywords (case deduplication).
9. Hash the transport key instead of the exact name (tone determinism/spread).
10. Increment sidebar counts by two (per-message counts).
11. Break the equal-name keyword tie sort (separate raw/encoded identities).
12. Give light tone 1 its own text colour as its fill (AA contrast).
13. Collapse tones 1 and 2 (protanopia pair separation).
14. Collapse tones 1 and 2 (deuteranopia pair separation).
15. Collapse tones 1 and 2 (tritanopia pair separation).

An additional `fatal: false` decoder mutation survived: the canonical re-encode
check independently rejects replacement text. It was restored; mutation 5 then
verified that the malformed-input test fails if replacement text escapes that
protection. No mutations remain in production code.
