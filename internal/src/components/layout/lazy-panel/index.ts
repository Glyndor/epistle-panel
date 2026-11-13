import type { KeyboardEvent, MouseEvent } from "react";
import { useState } from "react";

import { toast } from "@/components/ui/toaster";

/** How the press that opens the panel was made. */
export type Press = "pointer" | "keyboard";

/**
 * A panel whose code is fetched the first time it is asked for: a menu that a
 * page should not carry until someone reaches for it. `trigger` is what the
 * button standing in for it listens to: hover and focus start the download
 * early, and a press shows the panel once it is there. A press is a click, the
 * way Enter and Space arrive too, or the down arrow, which opens a menu button
 * as well. When the download fails, `failed`, a sentence already translated,
 * is shown as a toast and the next press tries again.
 *
 * It keeps its own state on purpose, not `React.lazy` under `Suspense`. A
 * download that fails must leave the button it was asked from in place, so
 * the person can press again; with `lazy` the rejection went to the page's
 * error boundary, which replaced the whole page (and took an unsent draft
 * with it), and a boundary that had shown its fallback held the menu back
 * for about 300 ms on every first press.
 */
export function useLazyPanel<Panel>(
	load: () => Promise<Panel>,
	failed: string,
): {
	/** The loaded panel, once it was asked for and has arrived. */
	panel: Panel | undefined;
	/** How it was asked for. */
	press: Press | undefined;
	/** Asked for and still on its way. */
	loading: boolean;
	/** The handlers of the button that stands in for the panel. */
	trigger: {
		onPointerEnter: () => void;
		onFocus: () => void;
		onClick: (event: MouseEvent) => void;
		onKeyDown: (event: KeyboardEvent) => void;
	};
} {
	const [panel, setPanel] = useState<Panel>();
	const [press, setPress] = useState<Press>();
	const [loading, setLoading] = useState(false);

	const warm = () => {
		// Only a head start: `open` reports a failure, this does not.
		load().catch(() => {});
	};
	const open = (how: Press) => {
		setPress(how);
		setLoading(true);
		load()
			.then(
				(loaded) => setPanel(() => loaded),
				() => {
					toast.error(failed);
				},
			)
			.finally(() => setLoading(false));
	};

	const trigger = {
		onPointerEnter: warm,
		onFocus: warm,
		// A click that Enter or Space made has no pointer behind it.
		onClick: (event: MouseEvent) =>
			open(event.detail === 0 ? "keyboard" : "pointer"),
		onKeyDown: (event: KeyboardEvent) => {
			if (event.key === "ArrowDown") {
				// The arrow would scroll the page behind the menu it opens.
				event.preventDefault();
				open("keyboard");
			}
		},
	};

	return { panel, press, loading, trigger };
}
