import type * as React from "react";

import { Glyph, type GlyphName } from "@/components/glyph";
import { cn } from "@/lib/class-names";

/** A decorative mark beside a row's identity; the text and any link stay the caller's. */
export function TableIdentity({
	icon,
	className,
	children,
}: {
	icon: GlyphName;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<span
			className={cn(
				"inline-flex max-w-full items-start gap-2",
				className,
			)}
		>
			{/* The mark sits level with the first line of the text, whatever its line height, and stays there when a long name wraps. */}
			<Glyph name={icon} className="mt-[calc((1lh-1rem)/2)]" />
			<span className="min-w-0 wrap-anywhere">{children}</span>
		</span>
	);
}
