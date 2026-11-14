import type * as React from "react";

import { FIELD_CLASS } from "@/components/ui/input";
import { cn } from "@/lib/class-names";

/**
 * A multi-line text field on the shared field look (`FIELD_CLASS`: a tonal
 * well, a bottom line at 3:1, the outline for focus), resizable in height. It
 * restates the coarse-pointer minimum so the 44 px of a one-line field does not
 * win over the height given here.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				FIELD_CLASS,
				"min-h-20 resize-y py-2 pointer-coarse:min-h-20",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
