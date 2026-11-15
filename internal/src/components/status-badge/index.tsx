import type * as React from "react";

import { Glyph, type GlyphName } from "@/components/glyph";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/class-names";

/**
 * A state or an outcome told three ways at once: a tone (the variant of
 * `Badge`), a drawing and, above all, its word. Two states never share both
 * their tone and their drawing, so colour is never the only thing that
 * separates one from another, and the word is what a screen reader reads (the
 * drawing is hidden from it). The children are the word, already translated.
 *
 * In forced colours the fill goes and the drawing stays (see `Glyph`), and the
 * badge takes a one pixel outline so it still reads as one thing.
 */
export function StatusBadge({
	glyph,
	variant,
	className,
	children,
	...props
}: {
	glyph: GlyphName;
	variant: NonNullable<React.ComponentProps<typeof Badge>["variant"]>;
} & React.ComponentProps<"span">) {
	return (
		<Badge
			variant={variant}
			data-status-badge=""
			className={cn("forced-colors:border", className)}
			{...props}
		>
			<Glyph name={glyph} className="size-3.5" />
			{children}
		</Badge>
	);
}
