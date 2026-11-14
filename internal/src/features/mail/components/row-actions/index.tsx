"use client";

import { StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ImportantMark } from "@/components/icons/important-mark";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { BUSY_MARK } from "@/features/mail/components/busy-mark";
import { useMessageChange } from "@/features/mail/components/reader-toolbar/use-message-change";
import type { MessageOp } from "@/features/mail/schemas/mail-input";
import { cn } from "@/lib/class-names";

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
function Mark({
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
				className={cn(
					BUSY_MARK,
					"pointer-events-auto size-6 px-0 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 active:bg-foreground/15 data-[set=true]:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:size-11 pointer-coarse:px-0 pointer-coarse:opacity-100 pointer-coarse:focus-visible:-outline-offset-2",
				)}
			>
				{children}
				<span className="sr-only">{label}</span>
			</Button>
		</Tooltip>
	);
}

/**
 * The two marks a reader sets on a message without opening it: important and
 * the star. They sit over the end of the row, beside the date, as siblings of
 * the row's link and after it, so the page holds no button inside a link and
 * the keyboard goes link, important, star.
 *
 * No press is lost. The server replaces a message's whole keyword set, so the
 * changes to one message are written one after the other (`useMessageChange`),
 * each on what the one before left; both show at once, and one the server
 * refuses is taken back on its own, with a toast. A change that worked says
 * nothing: the row already shows it.
 *
 * The box that holds the buttons is centred with its own height, never with
 * a transform: a transformed box becomes the frame a fixed tooltip is placed
 * in, and the tooltips of these buttons landed hundreds of pixels away. It
 * takes no press itself, so the row under it stays a link. On a comfortable
 * row with a fine pointer it ends where the first line ends: two pixels lower
 * its buttons lay over the end of the subject's line.
 */
export function RowActions({
	id,
	box,
	flagged,
	important,
}: {
	id: string;
	/** The folder the row is listed in, whose counter a change may move. */
	box: string;
	flagged: boolean;
	important: boolean;
}) {
	const t = useTranslations("mail");
	// No `onLeft`: a flag change leaves the message where it is.
	const { change, pending } = useMessageChange({ id, mailboxId: box });
	const press = (op: MessageOp) => change(op, { quiet: "success" });

	return (
		<div
			data-slot="row-actions"
			className="pointer-events-none absolute end-2 top-1 flex items-center group-data-[density=compact]/list:inset-y-0 pointer-coarse:inset-y-0 pointer-coarse:end-1"
		>
			<Mark
				mark="important"
				set={important}
				label={important ? t("unmarkImportant") : t("markImportant")}
				busy={pending}
				onPress={() => press(important ? "unimportant" : "important")}
			>
				<ImportantMark
					className={cn("size-4", important && "fill-current")}
				/>
			</Mark>
			<Mark
				mark="star"
				set={flagged}
				label={flagged ? t("unstar") : t("star")}
				busy={pending}
				onPress={() => press(flagged ? "unstar" : "star")}
			>
				<StarIcon
					aria-hidden="true"
					className={cn("size-4", flagged && "fill-current")}
				/>
			</Mark>
		</div>
	);
}
