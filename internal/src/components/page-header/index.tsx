import type * as React from "react";

import type { GlyphName } from "@/components/glyph";
import { IconTile } from "@/components/icon-tile";
import { cn } from "@/lib/class-names";

/**
 * The top of an admin page: the icon tile, the title (the page's `h1`), one
 * line saying what the page is for and, at the end, the primary action. Where
 * the row is too narrow the action goes under the title, whole, and the title
 * keeps its width. Presentational and with no `"use client"`: a server page, a
 * `loading.tsx` and a client component draw it alike, so what is on screen
 * while a page loads is what stays there.
 *
 * The tile is decoration; the words say all of it.
 */
export function PageHeader({
	icon,
	title,
	description,
	actions,
	titleClassName,
}: {
	icon: GlyphName;
	/** The page's title, already translated. It is the page's `h1`. */
	title: string;
	/** What the page is for, in one line, already translated. */
	description: string;
	/** The primary action, when the page has one. */
	actions?: React.ReactNode;
	/** A class for the title, for a page whose title can be one long word. */
	titleClassName?: string;
}) {
	return (
		<header
			data-slot="page-header"
			className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
		>
			<div className="flex min-w-0 flex-[1_1_20rem] items-center gap-3">
				<IconTile name={icon} />
				<div className="flex min-w-0 flex-col">
					<h1 className={cn("font-semibold text-lg", titleClassName)}>
						{title}
					</h1>
					<p className="text-muted-foreground">{description}</p>
				</div>
			</div>
			{actions === undefined ? null : (
				<div
					data-slot="page-header-actions"
					className="flex shrink-0 items-center"
				>
					{actions}
				</div>
			)}
		</header>
	);
}
