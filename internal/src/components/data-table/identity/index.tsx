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
				"inline-flex max-w-full items-center gap-2",
				className,
			)}
		>
			<Glyph name={icon} />
			<span className="min-w-0 wrap-anywhere">{children}</span>
		</span>
	);
}
