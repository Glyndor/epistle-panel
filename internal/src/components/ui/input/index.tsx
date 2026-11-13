import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * The look of every form field: a tonal well (`--field`) with no border at
 * rest, a deeper tone on hover, the focus ring on keyboard focus and a soft
 * destructive border only when the value is invalid. 32 px tall on a fine
 * pointer and 44 px on a coarse one. The native `select` of the delivery
 * filters wears the same classes.
 */
export const FIELD_CLASS =
	"min-h-8 w-full min-w-0 rounded-lg border border-transparent bg-field px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive pointer-coarse:min-h-11";

/** Text field. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(FIELD_CLASS, className)}
			{...props}
		/>
	);
}

export { Input };
