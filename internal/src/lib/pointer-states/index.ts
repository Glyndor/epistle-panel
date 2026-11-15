/**
 * What a control, a card, a legend entry or a row does under the pointer when
 * the reader's system forces colours (a high contrast theme). Such a theme
 * repaints every background with the canvas, so the fill that tells rest from
 * hover from press is gone; an outline in a system colour is not repainted, so
 * the same three steps are told by its thickness: none at rest, 2 px under the
 * pointer, 4 px while pressed. Both are drawn inside the box (a negative
 * offset), so a scrolling table or a card with `overflow` never clips them.
 *
 * `hover:` is already inside `@media (hover: hover)` in Tailwind 4, so a touch
 * does not leave the outline behind either.
 */
export const FORCED_POINTER =
	"forced-colors:outline-[color:Highlight] forced-colors:hover:outline-2 forced-colors:hover:-outline-offset-2 forced-colors:active:outline-4 forced-colors:active:-outline-offset-4";

/**
 * The same for the rows of a table, whose hover is a selector of the body and
 * not a class of the row: inside `(hover: hover)`, so a touch leaves nothing
 * behind, and with the same two thicknesses. The press under a pointer is
 * `:hover:active`, a selector heavier than the hover's, or the hover would win.
 */
export const FORCED_ROW_POINTER =
	"[&_tr]:forced-colors:outline-[color:Highlight] [@media(hover:hover)]:forced-colors:[&_tr:hover]:outline-2 [@media(hover:hover)]:forced-colors:[&_tr:hover]:-outline-offset-2 forced-colors:[&_tr:active]:outline-4 forced-colors:[&_tr:active]:-outline-offset-4 [@media(hover:hover)]:forced-colors:[&_tr:hover:active]:outline-4 [@media(hover:hover)]:forced-colors:[&_tr:hover:active]:-outline-offset-4";
