"use client";

import { PaperclipIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { formatReceivedAt } from "@/features/mail/format/received-at";
import { mailHref } from "@/features/mail/links/mail-href";
import type { MessageSummary } from "@/features/mail/schemas/mail-view";
import { cn } from "@/lib/class-names";

/**
 * One message of the list, a link to its view. Every text is text from the
 * message, already cleaned on the server and wrapped in `<bdi>` here, so a
 * right-to-left sender cannot reorder what is beside it. The state (unread,
 * starred, answered, draft, attachment) is spelled out for assistive
 * technology and not left to the icon or the weight.
 */
export function MessageRow({
	message,
	selected,
	view,
}: {
	message: MessageSummary;
	selected: boolean;
	/** The list's own parameters, so the link keeps the folder, the filter and the page. */
	view: {
		box: string;
		page: number;
		filter: Parameters<typeof mailHref>[0]["filter"];
		q: string;
	};
}) {
	const t = useTranslations("mail");
	const format = useFormatter();
	const sender = message.from?.name ?? message.from?.email ?? t("noSender");
	const states = [
		message.unread ? t("stateUnread") : null,
		message.flagged ? t("stateFlagged") : null,
		message.answered ? t("stateAnswered") : null,
		message.draft ? t("stateDraft") : null,
		message.hasAttachment ? t("hasAttachment") : null,
	].filter((state): state is string => state !== null);

	return (
		<li>
			<Link
				href={mailHref({ ...view, msg: message.id })}
				aria-current={selected ? "true" : undefined}
				data-message-id={message.id}
				scroll={false}
				className={cn(
					"flex min-h-14 flex-col gap-0.5 rounded-xl px-3 py-2 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring pointer-coarse:min-h-16",
					selected && "bg-accent",
				)}
			>
				{states.length > 0 ? (
					<span className="sr-only">{states.join(", ")}.</span>
				) : null}
				<span className="flex items-baseline gap-2">
					<bdi
						className={cn(
							"min-w-0 flex-1 truncate",
							message.unread
								? "font-semibold"
								: "text-muted-foreground",
						)}
					>
						{sender}
					</bdi>
					{message.flagged ? (
						<StarIcon
							aria-hidden="true"
							className="size-3.5 shrink-0"
						/>
					) : null}
					{message.hasAttachment ? (
						<PaperclipIcon
							aria-hidden="true"
							className="size-3.5 shrink-0"
						/>
					) : null}
					<time
						dateTime={message.receivedAt}
						className="shrink-0 text-muted-foreground text-xs"
					>
						{formatReceivedAt(format, message.receivedAt)}
					</time>
				</span>
				<bdi
					className={cn("truncate", message.unread && "font-medium")}
				>
					{message.subject === "" ? t("noSubject") : message.subject}
				</bdi>
				<bdi className="truncate text-muted-foreground text-xs">
					{message.preview}
				</bdi>
			</Link>
		</li>
	);
}
