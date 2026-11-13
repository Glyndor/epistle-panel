"use client";

import {
	ArchiveIcon,
	MailCheckIcon,
	MailIcon,
	ShieldAlertIcon,
	StarIcon,
	Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { MoveMenu } from "@/features/mail/components/move-menu";
import { useMessageChange } from "@/features/mail/components/reader-toolbar/use-message-change";
import type { MessageDetail } from "@/features/mail/schemas/mail-view";

/** Whether a key press is meant for a field, a dialog or a modifier combination. */
function belongsElsewhere(event: KeyboardEvent): boolean {
	if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
		return true;
	}
	const target = event.target;
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			target.closest(
				"input, textarea, select, dialog[open], [role=menu]",
			) !== null)
	);
}

/**
 * The actions on the open message: star, read or unread, archive, spam, move and
 * delete. Opening an unread message marks it read (quietly), once. Deleting from
 * the trash is permanent and asks first with the browser's own confirm (a modal
 * dialog from the component library would inject a style element the policy
 * refuses). Keys: `s` star, `e` archive, `!` spam, `#` or Delete to the trash;
 * they follow the same rules as the list's keys.
 */
export function ReaderToolbar({
	message,
	onLeft,
	inTrash,
}: {
	message: MessageDetail;
	/** Where to go when the message leaves its folder: back to the list. */
	onLeft: () => void;
	/** Whether the message is in the trash folder, where "delete" is permanent. */
	inTrash: boolean;
}) {
	const t = useTranslations("mail");
	const { change, pending } = useMessageChange({
		id: message.id,
		mailboxId: message.mailboxId,
		onLeft,
	});

	const unread = message.unread;
	const messageId = message.id;
	// biome-ignore lint/correctness/useExhaustiveDependencies: marks a message read once, when it is opened; `change` is a new function on every render
	useEffect(() => {
		if (unread) {
			change("read", { quiet: true });
		}
	}, [messageId]);

	const remove = () => {
		if (!inTrash || window.confirm(t("confirmDeleteForever"))) {
			change("trash");
		}
	};
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (belongsElsewhere(event)) {
				return;
			}
			if (event.key === "s") {
				change(message.flagged ? "unstar" : "star");
			} else if (event.key === "e") {
				change("archive");
			} else if (event.key === "!") {
				change("spam");
			} else if (event.key === "#" || event.key === "Delete") {
				remove();
			} else {
				return;
			}
			event.preventDefault();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	});

	return (
		<div
			role="toolbar"
			aria-label={t("toolbarLabel")}
			className="flex flex-wrap items-center gap-1 px-3 pt-2"
		>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				aria-pressed={message.flagged}
				aria-keyshortcuts="s"
				disabled={pending}
				onClick={() => change(message.flagged ? "unstar" : "star")}
			>
				<StarIcon aria-hidden="true" />
				{message.flagged ? t("unstar") : t("star")}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				disabled={pending}
				onClick={() => change(message.unread ? "read" : "unread")}
			>
				{message.unread ? (
					<MailCheckIcon aria-hidden="true" />
				) : (
					<MailIcon aria-hidden="true" />
				)}
				{message.unread ? t("markRead") : t("markUnread")}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				aria-keyshortcuts="e"
				disabled={pending}
				onClick={() => change("archive")}
			>
				<ArchiveIcon aria-hidden="true" />
				{t("archive")}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				aria-keyshortcuts="!"
				disabled={pending}
				onClick={() => change("spam")}
			>
				<ShieldAlertIcon aria-hidden="true" />
				{t("spam")}
			</Button>
			<MoveMenu
				current={message.mailboxId}
				disabled={pending}
				onMove={(box) => change({ move: box })}
			/>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				aria-keyshortcuts="#"
				disabled={pending}
				onClick={remove}
			>
				<Trash2Icon aria-hidden="true" />
				{inTrash ? t("deleteForever") : t("trash")}
			</Button>
		</div>
	);
}
