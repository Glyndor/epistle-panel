import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/class-names";

/**
 * The way to what is out of view at one end of the filter strip, for a
 * pointer: a chevron in a circle at that end, over a fade of the pane's
 * surface, so the filter under it reads as cut and not as missing.
 *
 * - It is not in the tab order nor in the accessibility tree: the keyboard
 *   reaches every filter by Tab, which brings it into view, and a screen
 *   reader lists them all.
 * - It is not drawn while the keyboard's focus is in the strip (the strip is
 *   the `group/strip`): the fade veiled one side of the focus ring of the
 *   filter beside it, whatever room was left for it.
 * - Only the circle takes a press. The fade lets it through to the filter
 *   under it, which was otherwise two presses away: one moved the strip, the
 *   next followed the filter.
 */
export function Edge({
	side,
	onPress,
}: {
	side: "start" | "end";
	onPress: () => void;
}) {
	const Icon = side === "start" ? ChevronLeftIcon : ChevronRightIcon;
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			tabIndex={-1}
			aria-hidden="true"
			data-edge={side}
			// A press must not take the focus onto a control nobody is told
			// about: it stays where it was.
			onMouseDown={(event) => event.preventDefault()}
			onClick={onPress}
			className={cn(
				"group/edge pointer-events-none absolute inset-y-0 min-h-0 w-10 rounded-none from-50% from-surface to-transparent px-0 hover:bg-transparent active:bg-transparent group-has-[:focus-visible]/strip:hidden pointer-coarse:min-h-0 pointer-coarse:px-0",
				side === "start"
					? "start-0 justify-start bg-linear-to-r rtl:bg-linear-to-l"
					: "end-0 justify-end bg-linear-to-l rtl:bg-linear-to-r",
			)}
		>
			<span
				data-slot="edge-press"
				className="pointer-events-auto flex size-6 items-center justify-center rounded-full bg-muted group-hover/edge:bg-foreground/15 group-active/edge:bg-foreground/20"
			>
				<Icon className="size-4 rtl:rotate-180" />
			</span>
		</Button>
	);
}
