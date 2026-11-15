import type { KeyboardEvent, RefObject } from "react";

/** The controls of the list: the tick boxes and the button that makes a label, in the order they are drawn. */
const CONTROLS = "[data-label-control]";

/**
 * The keys of the "Label as" list. The tick boxes and the create button are
 * one list for the arrow keys: Down and Up move between them and Up from the
 * first goes back to the field, Home and End go to the ends, and Enter presses
 * the box it is on (a box takes only the space bar by itself). It is handed
 * to the element that holds the list, so a key from any control of it arrives.
 * Typing is the field's, and Escape is the dialog's.
 */
export function useListKeys(
	list: RefObject<HTMLElement | null>,
	field: RefObject<HTMLInputElement | null>,
): {
	onListKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
	onFieldArrow: (event: KeyboardEvent<HTMLInputElement>) => boolean;
} {
	const controls = () =>
		Array.from(list.current?.querySelectorAll<HTMLElement>(CONTROLS) ?? []);

	return {
		onListKeyDown: (event) => {
			const all = controls();
			const at = all.indexOf(event.target as HTMLElement);
			if (at === -1) {
				return;
			}
			if (event.key === "Enter") {
				if (event.target instanceof HTMLInputElement) {
					event.preventDefault();
					event.target.click();
				}
				return;
			}
			const next =
				event.key === "ArrowDown"
					? all[Math.min(at + 1, all.length - 1)]
					: event.key === "ArrowUp"
						? at === 0
							? field.current
							: all[at - 1]
						: event.key === "Home"
							? all[0]
							: event.key === "End"
								? all.at(-1)
								: undefined;
			if (next) {
				event.preventDefault();
				next.focus();
			}
		},
		/** The field's Down arrow goes into the list. `true` when it did. */
		onFieldArrow: (event) => {
			const first = controls()[0];
			if (event.key !== "ArrowDown" || !first) {
				return false;
			}
			event.preventDefault();
			first.focus();
			return true;
		},
	};
}
