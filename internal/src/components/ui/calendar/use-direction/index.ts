import { useSyncExternalStore } from "react";

/** The page's reading direction. */
export type Direction = "ltr" | "rtl";

/** The page's `dir` is the one thing a change of direction touches. */
function subscribe(onChange: () => void): () => void {
	const watcher = new MutationObserver(onChange);
	watcher.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["dir"],
	});
	return () => watcher.disconnect();
}

function read(): Direction {
	return document.documentElement.dir === "rtl" ? "rtl" : "ltr";
}

/**
 * The direction the page is read in, from `<html dir>`. The panel ships six
 * left-to-right languages, so the server draws `ltr` and a page that is
 * switched to `rtl` (an operator's own script, a right-to-left language added
 * later) is read here once it is in the browser. A control that must answer
 * the arrow keys by where they point needs it: a calendar's left arrow is the
 * day before only when the page reads from the left.
 */
export function useDirection(): Direction {
	return useSyncExternalStore(subscribe, read, () => "ltr");
}
