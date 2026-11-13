import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * A short label for a state or an outcome. It is a soft tonal pill with no
 * border, and the label always says the state in words, so the colour never
 * carries it alone.
 */
const badgeVariants = cva(
	"inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 font-medium text-xs",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground",
				secondary: "bg-secondary text-secondary-foreground",
				muted: "bg-muted text-muted-foreground",
				warning: "bg-warning text-warning-foreground",
				destructive: "bg-destructive-soft text-destructive",
			},
		},
		defaultVariants: {
			variant: "secondary",
		},
	},
);

/** A state or outcome label. */
function Badge({
	className,
	variant,
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return (
		<span
			data-slot="badge"
			data-variant={variant ?? "secondary"}
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
