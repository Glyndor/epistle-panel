import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * The look of every form field: a tonal well (`--field`) with no box around it
 * and a 2px line along its bottom edge (`--field-edge`, 3:1 or more against the
 * surface and the well, so a field is identifiable without a drawn border), a
 * deeper tone on hover, the focus ring on keyboard focus and a destructive
 * outline and line only when the value is invalid. 32 px tall on a fine pointer
 * and 44 px on a coarse one. The textarea of the composer and the native
 * `select` of the delivery filters and the language menu wear the same classes.
 */
export const FIELD_CLASS =
	"min-h-8 w-full min-w-0 rounded-lg bg-field shadow-[inset_0_-2px_0_0_var(--field-edge)] px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive),inset_0_-2px_0_0_var(--destructive)] pointer-coarse:min-h-11";

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
