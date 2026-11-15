import type * as React from "react";

import { Glyph, type GlyphName } from "@/components/glyph";
import { cn } from "@/lib/class-names";

/**
 * A rounded tile with a drawing in it, the mark at the start of a page header,
 * a counter or a chart's figure. It is decoration: the words beside it say all
 * of it, so it is hidden from assistive technology. It takes its tones from
 * the secondary tokens, so both themes and an operator's theme hold, and its
 * size is fixed so nothing moves when it arrives.
 */
export function IconTile({
	name,
	className,
	...props
}: { name: GlyphName } & Omit<React.ComponentProps<"span">, "children">) {
	return (
		<span
			data-slot="icon-tile"
			aria-hidden="true"
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground",
				className,
			)}
			{...props}
		>
			<Glyph name={name} className="size-5" />
		</span>
	);
}
