import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * A multi-line text field on the `Input` look (the `input` border token at 3:1
 * against the page, an outline for focus). A thin stand-in until the library's
 * Textarea is installed; callers use only this component.
 */
export function MailTextarea({
	className,
	...props
}: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"min-h-48 w-full min-w-0 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
				className,
			)}
			{...props}
		/>
	);
}
