/**
 * How a button says that a change it asked for has not been answered yet,
 * while it stays pressable: a dimmed icon and a dot on its corner. The dot is
 * the sign that is not a colour, and it is laid over the button, so nothing
 * moves and the button keeps its size. The button sets `aria-busy`, which is
 * what these classes read and what assistive technology hears, and which the
 * base layer of the global stylesheet reads for the cursor: the work is on
 * its way and the press waits its turn, so the cursor is a progress one. See
 * `docs/maintainers/cursor-and-selection.md`.
 */
export const BUSY_MARK =
	"relative aria-busy:text-muted-foreground aria-busy:after:absolute aria-busy:after:end-0 aria-busy:after:top-0 aria-busy:after:size-1.5 aria-busy:after:rounded-full aria-busy:after:bg-foreground";
