import { ForwardIcon, PaperclipIcon, ReplyIcon } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LabelChips } from "@/features/mail/components/label-chips";
import { RowActions } from "@/features/mail/components/row-actions";
import {
	formatRowDate,
	type RowDatePart,
} from "@/features/mail/format/row-date";
import { type ListAddress, mailHref } from "@/features/mail/links/mail-href";
import type { MessageSummary } from "@/features/mail/schemas/mail-view";
import { cn } from "@/lib/class-names";
import { initials } from "@/lib/initials";

/**
 * The row's surface and its height, which no state changes: 72 px for the
 * comfortable list (two lines and the preview) and 40 px for the compact one
 * (one line; 44 px on a coarse pointer). The density comes from the pane
 * (`group/list`). The row is the container its own parts ask about their
 * room (`@container/row`). The row under the pointer or with the focus is
 * raised one step over its neighbours, so a tooltip that leaves its box is
 * drawn over the next row; it stays under a date heading, which is higher.
 */
const ROW =
	"group/row @container/row relative h-18 rounded-xl hover:z-1 hover:bg-muted focus-within:z-1 active:bg-accent group-data-[density=compact]/list:h-10 pointer-coarse:group-data-[density=compact]/list:h-11";

/** The open message: the accent surface, and a mark on the start edge, which is the right one in a right-to-left page. */
const OPEN =
	"bg-accent before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-primary hover:bg-accent";

/**
 * The link fills the row. Comfortable: the initials, then three lines beside
 * them. Compact: one line of initials, sender, subject and date. The end of
 * the first line is left free for the two buttons that lie over it; on a
 * coarse pointer they are taller than a line, so the whole link stops short.
 */
const LINK =
	"grid h-full grid-cols-[auto_minmax(0,1fr)_auto] content-center items-center gap-x-3 rounded-xl ps-5 pe-3 text-sm outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2 group-data-[density=compact]/list:grid-cols-[auto_5rem_minmax(0,1fr)_auto] group-data-[density=compact]/list:gap-x-2 group-data-[density=compact]/list:@sm/row:grid-cols-[auto_8rem_minmax(0,1fr)_auto] pointer-coarse:pe-24";

const AVATAR =
	"col-start-1 row-span-3 row-start-1 mt-1 self-start group-data-[density=compact]/list:row-span-1 group-data-[density=compact]/list:mt-0 group-data-[density=compact]/list:size-6 group-data-[density=compact]/list:self-center";

/** A dot in the row's own margin, before the sender and before the initials that stand for the sender: no row moves when it comes or goes. */
const UNREAD_DOT =
	"absolute start-1.5 top-3.5 size-2 rounded-full bg-primary forced-color-adjust-none group-data-[density=compact]/list:top-1/2 group-data-[density=compact]/list:-translate-y-1/2";

const SENDER = "col-start-2 row-start-1 flex h-5 min-w-0 items-center gap-1.5";

const SUBJECT =
	"col-span-2 col-start-2 row-start-2 flex h-5 min-w-0 items-center gap-1.5 group-data-[density=compact]/list:col-span-1 group-data-[density=compact]/list:col-start-3 group-data-[density=compact]/list:row-start-1";

const PREVIEW =
	"col-span-2 col-start-2 row-start-3 h-4 truncate text-muted-foreground text-xs leading-4 group-data-[density=compact]/list:hidden";

const META =
	"col-start-3 row-start-1 me-12 flex h-5 items-center gap-1.5 text-muted-foreground text-xs group-data-[density=compact]/list:col-start-4 pointer-coarse:me-0";

/**
 * One message of the list. The row is a list item that holds a link to the
 * message and, after it, the buttons for its two marks: siblings, because a
 * button inside a link is not valid and not reachable.
 *
 * Every state has a sign that is not a colour, and none changes the row's
 * height: an unread message is heavier, has a dot before its sender and
 * stands on the raised surface; a starred or important one shows its mark
 * filled beside the date; an answered or forwarded one has the icon of it
 * before the subject; a draft says so before the name; an attachment is a
 * clip beside the date; labels are chips after the subject; the open message
 * is on the accent surface with a mark on its start edge. All of it is said
 * once in words to assistive technology, where the icons are silent.
 *
 * Every text is text from the message, already cleaned on the server and
 * wrapped in `<bdi>` here, so a right-to-left sender cannot reorder what is
 * beside it.
 */
export function MessageRow({
	message,
	selected,
	view,
	datePart,
}: {
	message: MessageSummary;
	selected: boolean;
	/** What the row prints of its date: the heading it stands under says the rest. */
	datePart: RowDatePart;
	/** The list's own parameters, so the link keeps the folder, the filter and the page. */
	view: ListAddress;
}) {
	const t = useTranslations("mail");
	const format = useFormatter();
	const sender = message.from?.name ?? message.from?.email ?? t("noSender");
	const states = [
		message.unread ? t("stateUnread") : null,
		message.flagged ? t("stateFlagged") : null,
		message.important ? t("stateImportant") : null,
		message.answered ? t("stateAnswered") : null,
		message.forwarded ? t("stateForwarded") : null,
		message.draft ? t("stateDraft") : null,
		message.hasAttachment ? t("hasAttachment") : null,
		message.labels.length > 0
			? t("stateLabels", {
					list: format.list(
						message.labels.map((label) => label.name),
						{ type: "conjunction" },
					),
				})
			: null,
	].filter((state): state is string => state !== null);

	return (
		<li
			data-slot="message-row"
			data-unread={message.unread}
			className={cn(
				ROW,
				message.unread && "bg-surface",
				selected && OPEN,
			)}
		>
			<Link
				href={mailHref({ ...view, msg: message.id })}
				aria-current={selected ? "true" : undefined}
				data-message-id={message.id}
				scroll={false}
				className={LINK}
			>
				{states.length > 0 ? (
					<span className="sr-only">{states.join(", ")}.</span>
				) : null}
				{message.unread ? (
					<span data-slot="unread-dot" className={UNREAD_DOT} />
				) : null}
				<Avatar aria-hidden="true" className={AVATAR}>
					<AvatarFallback className="bg-foreground/10 text-foreground text-xs">
						{initials(sender)}
					</AvatarFallback>
				</Avatar>
				<span className={SENDER}>
					{message.draft ? (
						<Badge variant="muted" aria-hidden="true">
							{t("stateDraft")}
						</Badge>
					) : null}
					<bdi
						className={cn(
							"min-w-0 truncate",
							message.unread
								? "font-semibold"
								: "text-muted-foreground",
						)}
					>
						{sender}
					</bdi>
				</span>
				<span className={SUBJECT}>
					{message.answered ? (
						<ReplyIcon
							aria-hidden="true"
							data-slot="answered-icon"
							className="size-3.5 shrink-0 text-muted-foreground"
						/>
					) : null}
					{message.forwarded ? (
						<ForwardIcon
							aria-hidden="true"
							data-slot="forwarded-icon"
							className="size-3.5 shrink-0 text-muted-foreground"
						/>
					) : null}
					<bdi
						className={cn(
							"min-w-0 flex-1 truncate",
							message.unread && "font-medium",
						)}
					>
						{message.subject === ""
							? t("noSubject")
							: message.subject}
					</bdi>
					<LabelChips labels={message.labels} />
				</span>
				<bdi className={PREVIEW}>{message.preview}</bdi>
				<span className={META}>
					{message.hasAttachment ? (
						<PaperclipIcon
							aria-hidden="true"
							data-slot="attachment-icon"
							className="size-3.5 shrink-0"
						/>
					) : null}
					<time
						dateTime={message.receivedAt}
						data-date-part={datePart}
					>
						{formatRowDate(format, message.receivedAt, datePart)}
					</time>
				</span>
			</Link>
			<RowActions
				id={message.id}
				box={view.box}
				flagged={message.flagged}
				important={message.important}
			/>
		</li>
	);
}
