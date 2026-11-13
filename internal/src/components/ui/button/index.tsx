import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * Button styles. Compact on a fine pointer (32 px by default, the density of an
 * administration surface) and at least 44 px on a coarse one, the touch target
 * the panel adopted. Dark mode needs no `dark:` utilities: the tokens flip in
 * `styles/theme.css`.
 */
const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium text-sm transition-colors hover:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
				outline:
					"bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/70",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
				ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent/70",
				link: "text-primary underline underline-offset-4 hover:no-underline active:text-primary/70",
			},
			size: {
				default:
					"min-h-8 min-w-8 px-3 py-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:px-4",
				sm: "min-h-6 min-w-6 px-2 text-xs pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:px-3",
				lg: "min-h-10 min-w-10 px-5 pointer-coarse:min-h-12 pointer-coarse:min-w-12",
				icon: "size-8 pointer-coarse:size-11",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

/** A button, or the element passed as its child when `asChild` is set. */
function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
