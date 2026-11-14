"use client";

import { useLayoutEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import { listMemory } from "@/features/mail/components/message-list/list-memory";

const isSearch = (target: EventTarget | null) =>
	target instanceof Element && target.matches("[data-mail-search]");

let watching = false;

/**
 * The search field's side of what the list remembers for the page, heard
 * once for the page. The field has the focus until the person takes it
 * somewhere else: another control, a press outside it, Tab or Escape. It does
 * not lose it by going with its page, and what is typed while the next page
 * is on its way is still meant for it: those keys are kept for the field
 * that comes, and are no shortcut meanwhile.
 */
function watchSearch() {
	if (watching) {
		return;
	}
	watching = true;
	const letGo = (event: Event) => {
		if (!isSearch(event.target)) {
			listMemory.search = null;
		}
	};
	document.addEventListener("focusin", letGo);
	document.addEventListener("pointerdown", letGo);
	document.addEventListener(
		"keydown",
		(event) => {
			const kept = listMemory.search;
			const active = document.activeElement;
			if (
				kept === null ||
				(active !== null && active !== document.body)
			) {
				return;
			}
			if (event.key === "Escape" || event.key === "Tab") {
				listMemory.search = null;
				return;
			}
			if (
				event.ctrlKey ||
				event.metaKey ||
				event.altKey ||
				event.isComposing
			) {
				return;
			}
			if (event.key.length === 1) {
				kept.text = (kept.text + event.key).slice(0, kept.max);
			} else if (event.key === "Backspace") {
				kept.text = kept.text.slice(0, -1);
			} else {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
		},
		true,
	);
}

/**
 * The search field of the list. Opening a message is another page, and the
 * field is drawn anew with it: a person who had gone to it and was typing
 * (`j`, then `/` and a word) found the focus on the page and the rest of the
 * word read as shortcuts, which starred or archived the message. The field
 * says to the list's memory that it has the focus and what it reads, and the
 * field that is drawn next takes both back.
 */
export function SearchField({
	maxLength,
	...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "ref" | "maxLength"> & {
	maxLength: number;
}) {
	const field = useRef<HTMLInputElement>(null);

	useLayoutEffect(() => {
		watchSearch();
		const input = field.current;
		const kept = listMemory.search;
		const active = document.activeElement;
		if (
			input === null ||
			kept === null ||
			(active !== null && active !== document.body)
		) {
			return;
		}
		input.value = kept.text;
		input.focus({ preventScroll: true });
		if (document.activeElement === input) {
			input.setSelectionRange(kept.text.length, kept.text.length);
		}
	}, []);

	const note = (event: React.SyntheticEvent<HTMLInputElement>) => {
		listMemory.search = { text: event.currentTarget.value, max: maxLength };
	};

	return (
		<Input
			{...props}
			ref={field}
			type="search"
			maxLength={maxLength}
			data-mail-search=""
			onFocus={note}
			onInput={note}
		/>
	);
}
