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
 * Keeps the focus in the list when the row that had it leaves. Taking the
 * star off under the starred filter removes the row, and the focus fell to
 * the page: the next Tab started from the top. It now goes to the same
 * control of the row that came after, or of the one before when it was the
 * last, or to the list's heading when no row is left.
 *
 * Only a focus the list lost that way is moved. One the person took elsewhere
 * (another control, or a press anywhere outside the row) is theirs: the row
 * can leave later, when the list is read again, and nothing follows it.
 *
 * `ids` are the messages on screen, in order. The refs go on an element
 * around every state of the list and on its heading.
 */
export function useKeptFocus(ids: readonly string[]) {
	const list = useRef<HTMLDivElement>(null);
	const heading = useRef<HTMLHeadingElement>(null);
	const held = useRef<Held | null>(null);
	const shown = useRef<readonly string[]>(ids);

	useEffect(() => {
		const box = list.current;
		if (box === null) {
			return;
		}
		const rowOf = (target: EventTarget | null) =>
			target instanceof Element
				? target.closest("[data-slot='message-row']")
				: null;
		const idOf = (row: Element | null) =>
			row
				?.querySelector("a[data-message-id]")
				?.getAttribute("data-message-id") ?? null;
		const onFocusIn = (event: FocusEvent) => {
			const id = idOf(rowOf(event.target));
			held.current =
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
				held.current = null;
			}
		};
		// A press outside the row gives the focus up, even to nothing.
		const onPointerDown = (event: PointerEvent) => {
			if (
				held.current !== null &&
				idOf(rowOf(event.target)) !== held.current.id
			) {
				held.current = null;
			}
		};
		box.addEventListener("focusin", onFocusIn);
		box.addEventListener("focusout", onFocusOut);
		document.addEventListener("pointerdown", onPointerDown);
		return () => {
			box.removeEventListener("focusin", onFocusIn);
			box.removeEventListener("focusout", onFocusOut);
			document.removeEventListener("pointerdown", onPointerDown);
		};
	}, []);

	const key = ids.join("\n");
	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` is `ids` by value; the array is new on every render
	useEffect(() => {
		const before = shown.current;
		shown.current = ids;
		const lost = held.current;
		if (lost === null || ids.includes(lost.id)) {
			return;
		}
		held.current = null;
		const active = document.activeElement;
		if (active !== null && active !== document.body && active.isConnected) {
			return;
		}
		const at = before.indexOf(lost.id);
		const next =
			before.slice(at + 1).find((id) => ids.includes(id)) ??
			before
				.slice(0, Math.max(at, 0))
				.reverse()
				.find((id) => ids.includes(id));
		(next === undefined
			? heading.current
			: controlOf(list.current, next, lost.mark)
		)?.focus();
	}, [key]);

	return { list, heading };
}
