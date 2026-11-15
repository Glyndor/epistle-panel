/**
 * What a control, a card, a legend entry or a row does under the pointer when
 * the reader's system forces colours (a high contrast theme). Such a theme
 * repaints every background with the canvas, so the fill that tells rest from
 * hover from press is gone; an outline in a system colour is not repainted, so
 * the same three steps are told by its thickness: none at rest, 1 px under the
 * pointer, 2 px while pressed. Both are drawn inside the box (a negative
 * offset), so a scrolling table or a card with `overflow` never clips them.
 *
 * `hover:` is already inside `@media (hover: hover)` in Tailwind 4, so a touch
 * does not leave the outline behind either.
 */
export const FORCED_POINTER =
	"forced-colors:outline-[color:Highlight] forced-colors:hover:outline-1 forced-colors:hover:-outline-offset-1 forced-colors:active:outline-2 forced-colors:active:-outline-offset-2";

/**
 * The same for the rows of a table, whose hover is a selector of the body and
 * not a class of the row: inside `(hover: hover)`, so a touch leaves nothing
 * behind, and with the same two thicknesses, 1 px and 2 px. The press under a pointer is
 * `:hover:active`, a selector heavier than the hover's, or the hover would win.
 */
export const FORCED_ROW_POINTER =
	"[&_tr]:forced-colors:outline-[color:Highlight] [@media(hover:hover)]:forced-colors:[&_tr:hover]:outline-1 [@media(hover:hover)]:forced-colors:[&_tr:hover]:-outline-offset-1 forced-colors:[&_tr:active]:outline-2 forced-colors:[&_tr:active]:-outline-offset-2 [@media(hover:hover)]:forced-colors:[&_tr:hover:active]:outline-2 [@media(hover:hover)]:forced-colors:[&_tr:hover:active]:-outline-offset-2";

/**
 * What a mark of a chart does under the pointer: a ring in the theme's ring
 * colour (`--color-ring`, softened from `--ring` in `styles/theme.css` and held
 * at 3:1 against every surface), 1 px while the pointer is on the mark and 2 px
 * while it is pressed. The marks of a bar sit 2 px apart (`gap-0.5`), and the
 * ring takes no more than that: 1 px set 1 px off the mark, then 2 px set
 * against it, so neither is drawn over the next mark, and the focus ring of a
 * control (2 px, `--color-ring`) is never thicker than the press of a mark.
 * Under forced colours, where a mark keeps its own colour, the ring is the
 * system's `Highlight`, as every other outline of this file.
 */
export const MARK_POINTER =
	"outline-ring outline-offset-1 hover:outline-1 active:outline-2 active:outline-offset-0 forced-colors:outline-[color:Highlight]";
