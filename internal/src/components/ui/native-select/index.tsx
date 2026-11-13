import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";

import { FIELD_CLASS } from "@/components/ui/input";
import { cn } from "@/lib/class-names";

/**
 * A choice from a list, drawn by the browser: the shared field look around a
 * real `select`, with the panel's own arrow. It works before any script has
 * loaded and inside a plain `GET` form, and it needs no overlay, which is why
 * it is used where Radix Select cannot be (its markup carries a style
 * attribute the policy refuses).
 */
function NativeSelect({
	className,
	children,
	...props
}: React.ComponentProps<"select">) {
	return (
		<span
			data-slot="native-select-wrapper"
			className="relative block w-full"
		>
			<select
				data-slot="native-select"
				className={cn(FIELD_CLASS, "appearance-none pe-8", className)}
				{...props}
			>
				{children}
			</select>
			<ChevronDownIcon
				aria-hidden="true"
				className="pointer-events-none absolute end-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
			/>
		</span>
	);
}

/** One entry of the list. */
function NativeSelectOption(props: React.ComponentProps<"option">) {
	return <option data-slot="native-select-option" {...props} />;
}

export { NativeSelect, NativeSelectOption };
