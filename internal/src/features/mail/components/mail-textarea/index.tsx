import type * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/class-names";

/**
 * The text area of the composer: the shared `Textarea`, taller, since it holds
 * the body of a message.
 */
export function MailTextarea({
	className,
	...props
}: React.ComponentProps<"textarea">) {
	return (
		<Textarea
			className={cn("min-h-48 pointer-coarse:min-h-48", className)}
			{...props}
		/>
	);
}
