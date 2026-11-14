import { useEffect, useRef } from "react";

/** The control of a row that had the focus: the row's link, or one of its two marks. */
interface Held {
	readonly id: string;
	readonly mark: string | null;
}

/** The same control in the row of message `id`, when the list has it. */
function controlOf(
	list: HTMLElement | null,
	id: string,
	mark: string | null,
): HTMLElement | null {
	const link = list?.querySelector<HTMLElement>(
		`a[data-message-id="${CSS.escape(id)}"]`,
	);
	if (!link || mark === null) {
		return link ?? null;
	}
	return (
		link
			.closest("[data-slot='message-row']")
			?.querySelector<HTMLElement>(`[data-mark="${CSS.escape(mark)}"]`) ??
		link
	);
}

/**
 * What the page knows of the focus in the list. It is kept for the page and
 * not for one drawing of the list: opening a message and going back to the
 * list are two pages of the same place, so the list is drawn anew between
 * them and whatever one drawing remembered would be lost with it.
 */
const page: {
	/** The control that has the focus, or had it when it was lost. */
	held: Held | null;
	/** The messages on screen, in order, as last drawn. */
	shown: readonly string[];
	/** The row a press or a key was last made in, until the list next changes. */
	acted: string | null;
	watching: boolean;
} = { held: null, shown: [], acted: null, watching: false };

const rowOf = (target: EventTarget | null) =>
	target instanceof Element
		? target.closest("[data-slot='message-row']")
		: null;
const idOf = (row: Element | null) =>
	row?.querySelector("a[data-message-id]")?.getAttribute("data-message-id") ??
	null;

/** A press outside the row gives the focus up, even to nothing. Heard once for the page. */
function watchPresses() {
	if (page.watching) {
		return;
	}
	page.watching = true;
	document.addEventListener("pointerdown", (event) => {
		if (page.held !== null && idOf(rowOf(event.target)) !== page.held.id) {
			page.held = null;
		}
	});
}

/**
 * Leave the focus to the list when message `id` is about to leave from
 * somewhere else (the reader that had it open): the list gives it to the row
 * that comes after, as if that row had been pressed. The caller makes sure
 * the focus is its own to give.
 */
export function handFocusToList(id: string): void {
	page.held = { id, mark: null };
	page.acted = id;
	// The focus is given up here and now. Left where it was until the reader
	// went, the list saw the row leave first, with the focus on a control
	// that was still there, and took it for a focus the person had moved.
	const active = document.activeElement;
	if (active instanceof HTMLElement) {
		active.blur();
	}
}

/**
 * Keeps the focus in the list when the row that had it leaves. Taking the
 * star off under the starred filter removes the row, and the focus fell to
 * the page: the next Tab started from the top. It now goes to the same
 * control of the row that came after, or of the one before when it was the
 * last, or to the notice of the empty list when no row is left, which is in
 * view and shows the focus.
 *
 * Only a focus the list lost that way is moved. One the person took elsewhere
 * (another control, or a press anywhere outside the row) is theirs: the row
 * can leave later, when the list is read again, and nothing follows it.
 *
 * A row can also be drawn again while it stays listed: its date group is, when
 * the group changes, and the whole list is when a message is opened or closed
 * (another page of the same place). The control that had the focus is then a
 * new element, and the focus is put back on it.
 *
 * The focus moves the list's scroll only when the person made the row leave
 * (a press or a key in that row). When the list was read again on its own,
 * the focus goes to its new place without scrolling to it.
 *
 * `ids` are the messages on screen, in order; `settled` says they are the
 * list's and not the nothing of a list still on its way. The refs go on an
 * element around every state of the list and on the notice of the empty one.
 */
export function useKeptFocus(ids: readonly string[], settled = true) {
	const list = useRef<HTMLDivElement>(null);
	const empty = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const box = list.current;
		if (box === null) {
			return;
		}
		watchPresses();
		const onFocusIn = (event: FocusEvent) => {
			const id = idOf(rowOf(event.target));
			page.held =
				id === null
					? null
					: {
							id,
							mark: (event.target as Element).getAttribute(
								"data-mark",
							),
						};
		};
		// The focus went to another control: it was not lost.
		const onFocusOut = (event: FocusEvent) => {
			if (event.relatedTarget !== null) {
				page.held = null;
			}
		};
		// A click is also what Enter and Space on a button or a link send.
		const onClick = (event: MouseEvent) => {
			page.acted = idOf(rowOf(event.target));
		};
		box.addEventListener("click", onClick);
		box.addEventListener("focusin", onFocusIn);
		box.addEventListener("focusout", onFocusOut);
		return () => {
			box.removeEventListener("click", onClick);
			box.removeEventListener("focusin", onFocusIn);
			box.removeEventListener("focusout", onFocusOut);
		};
	}, []);

	const key = ids.join("\n");
	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` is `ids` by value; the array is new on every render
	useEffect(() => {
		if (!settled) {
			return;
		}
		const before = page.shown;
		page.shown = ids;
		// A press or a key in a row just before the list changed: the person
		// made the change, and is looking at that row.
		const local = page.acted;
		page.acted = null;
		const lost = page.held;
		if (lost === null) {
			return;
		}
		const active = document.activeElement;
		const adrift =
			active === null || active === document.body || !active.isConnected;
		if (ids.includes(lost.id)) {
			// The row is still listed, but it was drawn again and the
			// control with the focus was replaced by a new one.
			if (adrift) {
				controlOf(list.current, lost.id, lost.mark)?.focus({
					preventScroll: true,
				});
			}
			return;
		}
		page.held = null;
		if (!adrift) {
			return;
		}
		const at = before.indexOf(lost.id);
		const next =
			before.slice(at + 1).find((id) => ids.includes(id)) ??
			before
				.slice(0, Math.max(at, 0))
				.reverse()
				.find((id) => ids.includes(id));
		// A row that left on its own (the list was read again while the person
		// reads further down) must not pull the list to where the focus goes.
		(next === undefined
			? empty.current
			: controlOf(list.current, next, lost.mark)
		)?.focus({ preventScroll: local !== lost.id });
	}, [key, settled]);

	return { list, empty };
}
