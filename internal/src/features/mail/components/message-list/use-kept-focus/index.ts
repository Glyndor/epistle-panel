import { useEffect, useLayoutEffect, useRef } from "react";

import {
	listMemory,
	rememberScroll,
	turnTo,
} from "@/features/mail/components/message-list/list-memory";

const rowOf = (target: EventTarget | null) =>
	target instanceof Element
		? target.closest("[data-slot='message-row']")
		: null;
const idOf = (row: Element | null) =>
	row?.querySelector("a[data-message-id]")?.getAttribute("data-message-id") ??
	null;

/** The link of message `id`'s row, when the list has it. */
function linkOf(list: HTMLElement | null, id: string): HTMLElement | null {
	return (
		list?.querySelector<HTMLElement>(
			`a[data-message-id="${CSS.escape(id)}"]`,
		) ?? null
	);
}

/** The control `mark` of message `id`'s row, or its link. */
function controlOf(
	list: HTMLElement | null,
	id: string,
	mark: string | null,
): HTMLElement | null {
	const link = linkOf(list, id);
	if (link === null || mark === null) {
		return link;
	}
	return (
		rowOf(link)?.querySelector<HTMLElement>(
			`[data-mark="${CSS.escape(mark)}"]`,
		) ?? link
	);
}

/** The message that takes the place of `id`, which was in `before` and is not in `now`: the one after it, or else the one before. */
function heirOf(
	before: readonly string[],
	now: readonly string[],
	id: string,
): string | undefined {
	const at = before.indexOf(id);
	return (
		before.slice(at + 1).find((one) => now.includes(one)) ??
		before
			.slice(0, Math.max(at, 0))
			.reverse()
			.find((one) => now.includes(one))
	);
}

let watching = false;

/** A press outside a row gives its focus up, and one outside the list ends the action. Heard once for the page. */
function watchPresses() {
	if (watching) {
		return;
	}
	watching = true;
	document.addEventListener("focusin", (event) => {
		if (rowOf(event.target) === null) {
			listMemory.held = null;
		}
	});
	document.addEventListener("pointerdown", (event) => {
		const row = rowOf(event.target);
		if (listMemory.held !== null && idOf(row) !== listMemory.held.id) {
			listMemory.held = null;
		}
		if (row === null) {
			listMemory.acted = null;
		}
	});
}

/**
 * The list's side of what it remembers for the page (`list-memory`, and the
 * rules in `docs/maintainers/mail-list.md`). It writes the scroll, the control
 * with the focus and the row acted on, and each time the list is drawn with
 * its messages it reads them back:
 *
 * 1. drawn anew, the scroll of its address is put back before the paint;
 * 2. a focus that is adrift goes back to the control that had it, or to the
 *    same control of the row after it, or before it, or to the notice of the
 *    empty list. A list drawn anew with no rows at all gives the focus to
 *    that notice when the action of the person is of a row that is not
 *    there: the node that had the focus went with the row. Putting the focus
 *    never moves the scroll;
 * 3. a row is brought into view, as little as it takes: drawn anew, the row
 *    that got the focus back or the row acted on; read again in place, a
 *    restored focus is also brought into view, even after a background update;
 * 4. what could not happen (the list is not in view) is kept for the list
 *    that is drawn next.
 *
 * `ids` are the messages on screen, in order; `settled` says they are this
 * list's and not the nothing, or the previous page, of a list still on its
 * way; `address` names the list (folder, page, filter, search). The refs go
 * on an element around every state of the list and on the notice of the
 * empty one. The box that scrolls is the nearest ancestor marked
 * `data-list-scroller`.
 */
export function useKeptFocus(
	ids: readonly string[],
	settled = true,
	address = "",
) {
	const list = useRef<HTMLDivElement>(null);
	const empty = useRef<HTMLDivElement>(null);
	// The address this drawing has taken its place for: its scroll was put
	// back, and from then on its scroll is the one to note.
	const placed = useRef<string | null>(null);
	// Whether the next reading of the memory is the first for that address.
	const anew = useRef(true);

	useEffect(() => {
		const box = list.current;
		if (box === null) {
			return;
		}
		watchPresses();
		const scroller = box.closest<HTMLElement>("[data-list-scroller]");
		const onFocusIn = (event: FocusEvent) => {
			const id = idOf(rowOf(event.target));
			listMemory.held =
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
				listMemory.held = null;
			}
		};
		// A click is also what Enter and Space on a button or a link send,
		// and what `j` and `k` send to the row they open. On the link it is
		// the row being opened: the row to come back to, also where the list
		// is not in view and its link cannot take the focus.
		const onClick = (event: MouseEvent) => {
			const id = idOf(rowOf(event.target));
			if (id === null) {
				return;
			}
			listMemory.acted = id;
			if ((event.target as Element).closest("a[data-message-id]")) {
				listMemory.held = { id, mark: null };
			}
		};
		// Only the scroll of a list that has taken its place: a new box is
		// at the top, and a list on its way is not this address yet.
		const onScroll = () => {
			if (scroller !== null && placed.current !== null) {
				rememberScroll(placed.current, scroller.scrollTop);
			}
		};
		box.addEventListener("click", onClick);
		box.addEventListener("focusin", onFocusIn);
		box.addEventListener("focusout", onFocusOut);
		scroller?.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			box.removeEventListener("click", onClick);
			box.removeEventListener("focusin", onFocusIn);
			box.removeEventListener("focusout", onFocusOut);
			scroller?.removeEventListener("scroll", onScroll);
		};
	}, []);

	// Rule 1, before the paint: a list drawn anew stands where it stood, and
	// one never seen stands at the top.
	useLayoutEffect(() => {
		if (!settled) {
			// On its way: whatever scrolls now is not this address.
			placed.current = null;
			return;
		}
		if (placed.current === address) {
			return;
		}
		turnTo(address);
		const scroller =
			list.current?.closest<HTMLElement>("[data-list-scroller]") ?? null;
		if (scroller !== null) {
			scroller.scrollTop = listMemory.scroll.get(address) ?? 0;
		}
		placed.current = address;
		anew.current = true;
	}, [address, settled]);

	// Read after every drawing, not only when IDs change: a new date
	// grouping can replace the focused row with the same messages listed.
	useEffect(() => {
		if (!settled) {
			return;
		}
		const before = listMemory.shown;
		const left = before.filter((id) => !ids.includes(id));
		if (left.length > 0) {
			const heirs = new Map(listMemory.heirs);
			// The reader can hand focus over after several refreshes. Keep
			// its successor, and follow that successor if it leaves too.
			for (const [id, heir] of heirs) {
				if (heir !== undefined && left.includes(heir)) {
					heirs.set(id, heirOf(before, ids, heir));
				}
			}
			for (const id of left) {
				heirs.delete(id);
				heirs.set(id, heirOf(before, ids, id));
			}
			// Only recent departures can still have a reader handing over.
			for (const id of heirs.keys()) {
				if (heirs.size <= 100) {
					break;
				}
				heirs.delete(id);
			}
			listMemory.heirs = heirs;
		}
		listMemory.shown = ids;
		const first = anew.current;
		anew.current = false;
		const acted = listMemory.acted;
		const lost = listMemory.held;
		const active = document.activeElement;
		const adrift =
			active === null || active === document.body || !active.isConnected;
		// Rule 3: the row to bring into view, if any.
		let reveal =
			first && acted !== null && ids.includes(acted) ? acted : null;

		if (lost !== null && adrift) {
			// Rule 2: back on its control, or on the same one of its heir.
			const stays = ids.includes(lost.id);
			// A row handed over after it had left is not in the last
			// drawing: its heir was noted when it went.
			const noted = listMemory.heirs.get(lost.id);
			const heir = stays
				? lost.id
				: noted !== undefined && ids.includes(noted)
					? noted
					: heirOf(before, ids, lost.id);
			const target =
				heir === undefined
					? empty.current
					: controlOf(list.current, heir, lost.mark);
			target?.focus({ preventScroll: true });
			if (target !== null && document.activeElement === target) {
				if (heir === undefined) {
					listMemory.held = null;
				} else {
					// Focus restored to a replacement element must be visible
					// too, even when only its date group was drawn again.
					reveal = heir;
				}
			} else if (heir !== undefined) {
				// Rule 4: it could not land, the list is not in view. Kept
				// for the list drawn next, aimed at the row that would have
				// had it: drawn anew, that list also brings it into view.
				listMemory.held = { id: heir, mark: lost.mark };
			}
		} else if (lost !== null && !ids.includes(lost.id)) {
			// The row is gone and the focus is the person's, somewhere else.
			listMemory.held = null;
		}
		// The notice of the empty list takes the focus when the list is
		// drawn anew and the action of the person is of a row that is not
		// there: the node that had the focus went with the row, and the
		// notice is what the list has left to give it to.
		if (
			first &&
			ids.length === 0 &&
			acted !== null &&
			adrift &&
			empty.current !== null
		) {
			empty.current.focus({ preventScroll: true });
		}
		// The action ends with its row, not with a drawing that still has it.
		// A list with no rows has no row after it to take its place: the
		// action is not used up until one is there.
		if (
			listMemory.acted !== null &&
			ids.length > 0 &&
			!ids.includes(listMemory.acted)
		) {
			listMemory.acted = null;
		}
		if (reveal !== null) {
			rowOf(linkOf(list.current, reveal))?.scrollIntoView({
				block: "nearest",
			});
		}
	});

	return { list, empty };
}
