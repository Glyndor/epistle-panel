"use client";

import { useEffect } from "react";

/** Whether a key press is meant for a field, a dialog or a modifier combination, not for the list. */
function belongsElsewhere(event: KeyboardEvent): boolean {
	if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
		return true;
	}
	const target = event.target;
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return (
		target.isContentEditable ||
		target.closest("input, textarea, select, dialog[open]") !== null
	);
}

/**
 * Keyboard shortcuts of the list: `j` and `k` open the next and the previous
 * message, `/` goes to the search field and `u` goes back to the list. They
 * are ignored while a field or a dialog has the focus and with any modifier
 * held, so they never take a key from typing or from the browser. Opening a
 * message is following its own link (so the address, the history and the
 * prefetch behave as for a click) and the focus moves to that link, so the
 * next press starts from it.
 */
export function useMailShortcuts({
	ids,
	selectedId,
}: {
	ids: readonly string[];
	selectedId: string | undefined;
}): void {
	useEffect(() => {
		const open = (id: string) => {
			const link = document.querySelector<HTMLAnchorElement>(
				`a[data-message-id="${id}"]`,
			);
			link?.click();
			link?.focus();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (belongsElsewhere(event)) {
				return;
			}
			if (event.key === "j" || event.key === "k") {
				event.preventDefault();
				const current =
					selectedId === undefined ? -1 : ids.indexOf(selectedId);
				const next =
					event.key === "j"
						? ids[current + 1]
						: ids[Math.max(current - 1, 0)];
				if (next !== undefined && next !== selectedId) {
					open(next);
				}
			} else if (event.key === "/") {
				const field =
					document.querySelector<HTMLElement>("[data-mail-search]");
				if (field) {
					event.preventDefault();
					field.focus();
				}
			} else if (event.key === "u" && selectedId !== undefined) {
				event.preventDefault();
				document
					.querySelector<HTMLAnchorElement>("a[data-mail-back]")
					?.click();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [ids, selectedId]);
}
