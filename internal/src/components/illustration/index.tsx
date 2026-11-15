import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * The drawings of the empty states, by name. Each is a file in
 * `styles/illustrations/` worn as a mask by a class of
 * `styles/illustrations.css`; the table gives the class in full, so Tailwind
 * and a search for it both find it.
 */
const ILLUSTRATIONS = {
	/** A tray with nothing in it: a folder, a queue, a log. */
	tray: "illustration-tray",
	/** A magnifier: a search or a filter that matched nothing. */
	search: "illustration-search",
	/** A closed letter: no message open in the reader. */
	letter: "illustration-letter",
	/** Two people: no accounts yet. */
	people: "illustration-people",
	/** A shield with a tick: nothing is suppressed. */
	shield: "illustration-shield",
	/** A globe: no domains. */
	globe: "illustration-globe",
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

/** The names, in the order of the table above. */
export const ILLUSTRATION_NAMES = Object.keys(
	ILLUSTRATIONS,
) as IllustrationName[];

/**
 * One drawing of an empty state: an empty `span` painted with the muted text
 * colour through a mask, so it follows the theme and is no markup with
 * children (see `docs/maintainers/charts.md` for why a streamed page cannot
 * carry one). It is decoration: hidden from assistive technology, and gone in
 * forced colours, where the text beside it says everything. Its size is fixed,
 * so nothing moves when it arrives.
 */
export function Illustration({
	name,
	className,
	...props
}: { name: IllustrationName } & Omit<
	React.ComponentProps<"span">,
	"children"
>) {
	return (
		<span
			data-slot="illustration"
			data-illustration={name}
			aria-hidden="true"
			className={cn(
				"illustration block size-24 shrink-0 bg-muted-foreground forced-colors:hidden",
				ILLUSTRATIONS[name],
				className,
			)}
			{...props}
		/>
	);
}
