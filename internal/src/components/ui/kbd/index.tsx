import type * as React from "react";

import { cn } from "@/lib/class-names";

/** A key of the keyboard, named in text. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				"inline-flex min-w-5 items-center justify-center rounded-md bg-surface-raised px-1.5 font-medium font-mono text-xs",
				className,
			)}
			{...props}
		/>
	);
}

export { Kbd };
