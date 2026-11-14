/**
 * What the message list remembers for the page. Opening a message, moving to
 * the next and going back are different pages of the same place, so the list
 * pane is drawn anew each time: new elements, at the top, with no focus. What
 * it has to know from one drawing to the next is kept here and nowhere else,
 * by the rules of `docs/maintainers/mail-list.md` ("What the list remembers
 * for the page"). Nothing here is read while a component renders: only
 * effects and event handlers read and write it.
 */

/** The control of a row that has the focus, or had it: the row's link (`mark` is null) or one of its two marks. */
export interface Held {
	readonly id: string;
	readonly mark: string | null;
}

/** How many addresses keep their scroll: the most recent ones. */
const KEPT_SCROLLS = 20;

/** The list's memory. Written by the list (`use-kept-focus`), by its search field and by `handFocusToList`. */
export const listMemory: {
	/** How far the list is scrolled, by the list's address. */
	readonly scroll: Map<string, number>;
	/** The control of a row that has the focus, or had it when the focus was lost. */
	held: Held | null;
	/** The row the person's last action concerns. */
	acted: string | null;
	/** The messages last drawn, in order. */
	shown: readonly string[];
	/** The 100 rows that left last, and the row that now takes each one's place (none: the list was left empty). */
	heirs: ReadonlyMap<string, string | undefined>;
	/** The address `held`, `acted`, `shown` and `heirs` are of. */
	address: string | null;
	/** What the search field reads and how much it takes, while it has the focus or had it when it went with its page. */
	search: { text: string; readonly max: number } | null;
} = {
	scroll: new Map(),
	held: null,
	acted: null,
	shown: [],
	heirs: new Map(),
	address: null,
	search: null,
};

/** Note how far the list of `address` is scrolled. Only the most recent addresses are kept. */
export function rememberScroll(address: string, top: number): void {
	listMemory.scroll.delete(address);
	listMemory.scroll.set(address, top);
	for (const oldest of listMemory.scroll.keys()) {
		if (listMemory.scroll.size <= KEPT_SCROLLS) {
			break;
		}
		listMemory.scroll.delete(oldest);
	}
}

/**
 * A list of `address` is drawn. What is known of the rows (the focus, the
 * action, the order) is of one list: for another address it is forgotten.
 */
export function turnTo(address: string): void {
	if (listMemory.address !== address) {
		listMemory.held = null;
		listMemory.acted = null;
		listMemory.shown = [];
		listMemory.heirs = new Map();
		listMemory.address = address;
	}
}

/**
 * Leave the focus to the list for message `id`, from outside it: the reader,
 * when the message it shows leaves (archived, deleted, marked as spam) or
 * when the person goes back to the list. The list puts the focus on that
 * message's row or, when it is gone, on the row after it, and brings it into
 * view. The caller makes sure the focus is its own to give.
 *
 * The focus is given up here and now. Left where it was until the reader
 * went, the list saw the row leave first, with the focus on a control that
 * was still there, and took it for a focus the person had moved.
 */
export function handFocusToList(id: string): void {
	listMemory.held = { id, mark: null };
	listMemory.acted = id;
	const active = document.activeElement;
	if (active instanceof HTMLElement && active !== document.body) {
		active.blur();
	}
}

/** Forget everything. For tests only, after each case: the memory is the page's, and a test file is one page. */
export function forgetListMemory(): void {
	listMemory.scroll.clear();
	listMemory.held = null;
	listMemory.acted = null;
	listMemory.shown = [];
	listMemory.heirs = new Map();
	listMemory.address = null;
	listMemory.search = null;
}
