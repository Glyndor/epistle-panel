import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/class-names";

const alertVariants = cva(
	"relative flex w-full flex-col gap-1 rounded-xl px-4 py-3 text-sm",
	{
		variants: {
			variant: {
				default: "bg-surface-sunken text-foreground",
				destructive: "bg-destructive-soft text-destructive",
				warning: "bg-warning text-warning-foreground",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

/** A callout announced to assistive technology (`role="alert"`). */
function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

/** The message of an {@link Alert}, at the full text contrast of the variant. */
function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn("text-sm", className)}
			{...props}
		/>
	);
}

export { Alert, AlertDescription };
