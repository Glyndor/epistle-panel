import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * A static block that holds the place of content that is loading. It does not
 * pulse: the panel's contract is no decorative motion at rest.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			aria-hidden="true"
			className={cn("rounded-md bg-muted", className)}
			{...props}
		/>
	);
}

export { Skeleton };
