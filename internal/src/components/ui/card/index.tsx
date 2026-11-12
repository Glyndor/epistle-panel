import type * as React from "react";

import { cn } from "@/lib/class-names";

/** A bordered surface that groups one piece of content. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card"
			className={cn(
				"flex flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export { Card };
