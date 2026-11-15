import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { BUSY_MARK } from "@/features/mail/components/busy-mark";
import { cn } from "@/lib/class-names";

/**
 * What a mark of a row looks like and how it is shown: the rules below, for
 * the marks that are a button of their own and for the one that opens a dialog.
 */
export const MARK_CLASS =
	"pointer-events-auto size-6 px-0 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 active:bg-foreground/15 data-[set=true]:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:size-11 pointer-coarse:px-0 pointer-coarse:opacity-100 pointer-coarse:focus-visible:-outline-offset-2";

/**
 * One mark of a row as a button: 24 px on a fine pointer, 44 px on a coarse
 * one. A mark that is set is always in view. One that is not shows when the
 * pointer is on the row, when the focus is anywhere in it, and always on a
 * coarse pointer, which has no hover. It is hidden by opacity alone, so the
 * keyboard reaches it either way and the row keeps its width.
 *
 * While a change to the message is on its way the button says so three ways
 * that move nothing: `aria-busy`, the pointer's progress cursor, and a dot on
 * its corner beside a dimmed icon. It stays pressable: a press made meanwhile
 * waits its turn.
 *
 * On a coarse pointer the button is as tall as a compact row, so its focus
 * ring is drawn inside it: outside, the ring of the first row of a date group
 * began over the row and the heading that sticks above it covered that side.
 */
export function Mark({
	mark,
	set,
	label,
	busy,
	onPress,
	children,
}: {
	/** Which mark this is, for whoever has to find the same button in another row. */
	mark: "important" | "star";
	set: boolean;
	label: string;
	busy: boolean;
	onPress: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip label={label} side="bottom" align="end">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				data-mark={mark}
				data-set={set}
				aria-busy={busy ? true : undefined}
				onClick={onPress}
				className={cn(BUSY_MARK, MARK_CLASS)}
			>
				{children}
				<span className="sr-only">{label}</span>
			</Button>
		</Tooltip>
	);
}
