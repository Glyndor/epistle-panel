"use client";

import {
	ArchiveIcon,
	ForwardIcon,
	MailCheckIcon,
	MailIcon,
	PenLineIcon,
	ReplyAllIcon,
	ReplyIcon,
	ShieldAlertIcon,
	StarIcon,
	Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { MoveMenu } from "@/features/mail/components/move-menu";
import { useMessageChange } from "@/features/mail/components/reader-toolbar/use-message-change";
import { composeHref } from "@/features/mail/links/mail-href";
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
				"input, textarea, select, dialog[open], [role=alertdialog], [role=menu]",
			) !== null)
	);
}

/**
 * The actions on the open message: star, read or unread, archive, spam, move and
 * delete. Opening an unread message marks it read (quietly), once. Deleting from
 * the trash is permanent and asks first with the panel's alert dialog
 * (`ConfirmAction`), whether it is the button or the key that asks. Keys: `s` star, `e` archive, `!` spam, `#` or Delete to the trash;
 * they follow the same rules as the list's keys.
 */
export function ReaderToolbar({
	message,
	onLeft,
	inTrash,
	inDrafts,
}: {
	message: MessageDetail;
	/** Where to go when the message leaves its folder: back to the list. */
	onLeft: () => void;
	/** Whether the message is in the trash folder, where "delete" is permanent. */
	inTrash: boolean;
	/** Whether the message is in the drafts folder, where it is edited and not replied to. */
	inDrafts: boolean;
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

	const [confirming, setConfirming] = useState(false);
	const remove = () => {
		if (inTrash) {
			setConfirming(true);
		} else {
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

	const deleteButton = (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			aria-keyshortcuts="#"
			disabled={pending}
			{...(inTrash ? {} : { onClick: remove })}
		>
			<Trash2Icon aria-hidden="true" />
			{inTrash ? t("deleteForever") : t("trash")}
		</Button>
	);

	return (
		<div
			role="toolbar"
			aria-label={t("toolbarLabel")}
			className="flex flex-wrap items-center gap-1 px-3 pt-2"
		>
			{inDrafts ? (
				<Button asChild variant="ghost" size="sm">
					<Link href={composeHref("draft", message.id)}>
						<PenLineIcon aria-hidden="true" />
						{t("editDraft")}
					</Link>
				</Button>
			) : (
				<>
					<Button asChild variant="ghost" size="sm">
						<Link href={composeHref("reply", message.id)}>
							<ReplyIcon aria-hidden="true" />
							{t("reply")}
						</Link>
					</Button>
					<Button asChild variant="ghost" size="sm">
						<Link href={composeHref("replyAll", message.id)}>
							<ReplyAllIcon aria-hidden="true" />
							{t("replyAll")}
						</Link>
					</Button>
					<Button asChild variant="ghost" size="sm">
						<Link href={composeHref("forward", message.id)}>
							<ForwardIcon aria-hidden="true" />
							{t("forward")}
						</Link>
					</Button>
				</>
			)}
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
			{inTrash ? (
				<ConfirmAction
					description={t("confirmDeleteForever")}
					open={confirming}
					onOpenChange={setConfirming}
					onConfirm={() => change("trash")}
				>
					{deleteButton}
				</ConfirmAction>
			) : (
				deleteButton
			)}
		</div>
	);
}
