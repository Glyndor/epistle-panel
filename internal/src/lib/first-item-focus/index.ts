import { useEffect, useRef } from "react";

/**
 * A ref for the content of a menu that mounts already open. When `wanted`, the
 * first item of the menu takes the focus once, as it does in a menu opened
 * from the keyboard. Radix only does that for a key press it saw itself, and a
 * menu whose code is loaded on the first press comes into being after that
 * press.
 */
export function useFirstItemFocus(wanted: boolean) {
	const content = useRef<HTMLDivElement>(null);
	// What was wanted when the menu mounted; a later render does not ask again.
	const wantedAtMount = useRef(wanted);

	useEffect(() => {
		if (wantedAtMount.current) {
			content.current
				?.querySelector<HTMLElement>('[role^="menuitem"]')
				?.focus();
		}
	}, []);

	return content;
}
