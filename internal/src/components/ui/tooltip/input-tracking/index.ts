/**
 * What the person last did, as far as a focus that arrives can tell: the Tab
 * key moves the focus to a control, and anything else (Escape closing a menu,
 * Enter choosing in it, a press) only hands it back to one. Kept for the page
 * and not for a tooltip: the button of a menu that loads on demand is replaced
 * by another when it is first pressed, and a note kept by the first would be
 * lost with it.
 */
let lastInput: "tab" | "other" = "other";
/**
 * Set when a tooltip gave way to the control under the pointer: that control
 * was never told the pointer came in, so the next move on it shows its name.
 * Any key or press takes it back. It is the one case in which a move shows a
 * tooltip: after a press or Escape on a control, moving on it must not.
 */
let pointerUncovered = false;
let watching = false;

/** Whether the last key of the page was Tab: a focus that arrives now is a visit. */
export function lastInputWasTab(): boolean {
	return lastInput === "tab";
}

/** Whether a tooltip gave way to the control under the pointer and none has named it since. */
export function isPointerUncovered(): boolean {
	return pointerUncovered;
}

/** Note that a tooltip gave way to the control under the pointer, or that the note was used. */
export function setPointerUncovered(value: boolean): void {
	pointerUncovered = value;
}

/** Start noting the last key and press of the page, once. */
export function watchInput() {
	if (watching) {
		return;
	}
	watching = true;
	document.addEventListener(
		"keydown",
		(event) => {
			lastInput = event.key === "Tab" ? "tab" : "other";
			pointerUncovered = false;
		},
		true,
	);
	document.addEventListener(
		"pointerdown",
		() => {
			lastInput = "other";
			pointerUncovered = false;
		},
		true,
	);
}
