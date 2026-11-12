import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * Text field, 44 px tall. The border uses the `input` token, which is kept at
 * 3:1 or more against the page so the field boundary is visible.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base transition-colors placeholder:text-muted-foreground hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
