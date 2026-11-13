import { useEffect, useRef, useState } from "react";

/** How long the rows must stay as they are before the change is said, in milliseconds. */
export const ANNOUNCE_AFTER_MS = 500;

/** How long the sentence stays in the page once said, in milliseconds. */
export const ANNOUNCE_FOR_MS = 2500;

/**
 * Says a change of the rows to a screen reader: the range on screen, the count,
 * or that no row matches. The sentence a sighted person reads is elsewhere in
 * the table and changes at once; this one waits until the rows have been still
 * for half a second, so a word typed in the filter is one announcement and not
 * one per letter. It is emptied again afterwards, so at rest the page holds
 * each sentence once. Nothing is said of the first paint.
 */
export function DataTableAnnouncer({ message }: { message: string }) {
	const [said, setSaid] = useState("");
	const first = useRef(true);

	useEffect(() => {
		if (first.current) {
			first.current = false;
			return;
		}
		const say = setTimeout(() => setSaid(message), ANNOUNCE_AFTER_MS);
		const hush = setTimeout(
			() => setSaid(""),
			ANNOUNCE_AFTER_MS + ANNOUNCE_FOR_MS,
		);
		return () => {
			clearTimeout(say);
			clearTimeout(hush);
		};
	}, [message]);

	return (
		<p className="sr-only" aria-live="polite" aria-atomic="true">
			{said}
		</p>
	);
}
