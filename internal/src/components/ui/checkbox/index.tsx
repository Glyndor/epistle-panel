import { CheckIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * A tick box that is the browser's own `<input type="checkbox">`, drawn with
 * the panel's tokens. It is not a Radix button: a button has no form value
 * until a script has loaded, and a search is a plain GET that must work before
 * one has. Checked, the input submits its `value` under its `name`; unchecked,
 * it submits nothing, which is what a form with no script already does.
 *
 * The box is 16 px. Its label carries the target: put it inside a `Label` that
 * is 24 px tall on a fine pointer and 44 px on a coarse one, so the press lands
 * on the words as well as on the box.
 *
 * The tick is an icon beside the input, shown by the input's own `:checked`
 * state (`peer-checked`), so no state lives in a script and no style is
 * written inline.
 *
 * In forced colours the browser removes the box-shadow that draws the border
 * and puts the background on the system's canvas, so the drawn box and its
 * tick vanish (measured in a browser, 2026-11-14). There the input goes back to
 * its own native drawing, which the system colours keep, and the icon is
 * hidden.
 */
function Checkbox({
	className,
	...props
}: Omit<React.ComponentProps<"input">, "type">) {
	return (
		<span
			data-slot="checkbox-box"
			className="relative inline-flex size-4 shrink-0 items-center justify-center"
		>
			<input
				type="checkbox"
				data-slot="checkbox"
				className={cn(
					"peer absolute inset-0 size-4 appearance-none rounded-xs bg-field inset-ring-2 inset-ring-field-edge hover:bg-surface-sunken checked:bg-primary checked:inset-ring-0 checked:hover:bg-primary/90 active:bg-surface-sunken checked:active:bg-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 forced-colors:appearance-auto",
					className,
				)}
				{...props}
			/>
			<CheckIcon
				aria-hidden="true"
				className="pointer-events-none relative size-3 text-primary-foreground opacity-0 peer-checked:opacity-100 forced-colors:hidden"
			/>
		</span>
	);
}

export { Checkbox };
