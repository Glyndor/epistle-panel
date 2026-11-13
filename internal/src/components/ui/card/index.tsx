import type * as React from "react";

import { cn } from "@/lib/class-names";

/** A surface one step above the page canvas that groups one piece of content. It has no border: the tone separates it. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card"
			className={cn(
				"flex flex-col gap-2 rounded-xl bg-card p-4 text-card-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export { Card };
