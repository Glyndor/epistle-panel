"use client";

import { StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ImportantMark } from "@/components/icons/important-mark";
import { useMessageChange } from "@/features/mail/components/reader-toolbar/use-message-change";
import { Mark } from "@/features/mail/components/row-actions/mark";
import type { MessageOp } from "@/features/mail/schemas/mail-input";
import { cn } from "@/lib/class-names";

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
