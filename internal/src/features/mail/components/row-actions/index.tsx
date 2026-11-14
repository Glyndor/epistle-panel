"use client";

import { StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useRef } from "react";

import { ImportantMark } from "@/components/icons/important-mark";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useMessageChange } from "@/features/mail/components/reader-toolbar/use-message-change";
import type { MessageOp } from "@/features/mail/schemas/mail-input";
import { cn } from "@/lib/class-names";

/**
 * One mark of a row as a button: 24 px on a fine pointer, 44 px on a coarse
 * one. A mark that is set is always in view. One that is not shows when the
 * pointer is on the row, when the focus is anywhere in it, and always on a
 * coarse pointer, which has no hover. It is hidden by opacity alone, so the
 * keyboard reaches it either way and the row keeps its width. While a change
 * is on its way the button says so with `aria-disabled` and keeps the focus.
 *
 * Its tooltip opens under it and ends where it ends. Beside it, the text lay
 * over the other mark and took the press meant for that one.
 */
function Mark({
	set,
	label,
	busy,
	onPress,
	children,
}: {
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
				data-set={set}
				aria-disabled={busy ? true : undefined}
				onClick={onPress}
				className="size-6 px-0 opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 active:bg-foreground/15 aria-disabled:text-muted-foreground data-[set=true]:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:size-11 pointer-coarse:px-0 pointer-coarse:opacity-100"
			>
				{children}
				<span className="sr-only">{label}</span>
			</Button>
		</Tooltip>
	);
}

/**
 * The two marks a reader sets on a message without opening it: important and
 * the star. They sit over the end of the row's first line, beside the date,
 * as siblings of the row's link and after it, so the page holds no button
 * inside a link and the keyboard goes link, important, star.
 *
 * Both write through one mutation. The server replaces a message's whole
 * keyword set, so two changes at once would each be built from the set before
 * the other and the second to land would undo the first: while one is on its
 * way, a press on either button sends nothing. The change shows at once and
 * is put back, with a toast, if the server refuses.
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
	// `pending` turns true with the next render; the lock is shut in the press
	// itself, so a second press in the same instant finds it shut.
	const sending = useRef(false);
	const press = (op: MessageOp) => {
		if (sending.current) {
			return;
		}
		sending.current = true;
		change(op, {
			onSettled: () => {
				sending.current = false;
			},
		});
	};

	return (
		<div
			data-slot="row-actions"
			className="absolute end-2 top-1.5 flex group-data-[density=compact]/list:top-1/2 group-data-[density=compact]/list:-translate-y-1/2 pointer-coarse:end-1 pointer-coarse:top-1/2 pointer-coarse:-translate-y-1/2"
		>
			<Mark
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
